import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { readdir } from 'node:fs/promises';
import * as schema from './schema/index.ts';
import type { Database } from './index.ts';

export async function makeTestDb(dbConfig: { url: string }, schemaName: string): Promise<{
  db: Database;
  client: postgres.Sql;
  cleanup: () => Promise<void>;
}> {
  const url = dbConfig.url;

  schemaName = `test_${schemaName}`;

  // 1. Bootstrap: drop and recreate the schema
  const bootstrap = postgres(url);
  await bootstrap.unsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
  await bootstrap.unsafe(`CREATE SCHEMA "${schemaName}"`);
  await bootstrap.end();

  // 2. Create connection with search_path set to the custom schema
  const client = postgres(url, {
    connection: { search_path: `${schemaName},public` },
  });

  // 3. Read migration SQL files, strip "public". qualifiers, and execute
  const migrationsDir = './drizzle';
  const sqlFiles: string[] = [];
  for (const entry of await readdir(migrationsDir)) {
    if (entry.endsWith('.sql')) sqlFiles.push(entry);
  }
  sqlFiles.sort();

  for (const sqlFile of sqlFiles) {
    const content = await Bun.file(`${migrationsDir}/${sqlFile}`).text();
    const patched = content.replace(/"public"\./g, '');
    const statements = patched.split('--> statement-breakpoint');
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (trimmed) await client.unsafe(trimmed);
    }
  }

  // 4. Create drizzle instance
  const db = drizzle(client, { schema });

  // 5. Cleanup function
  const cleanup = async () => {
    const teardown = postgres(url);
    await teardown.unsafe(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await teardown.end();
    await client.end();
  };

  return { db, client, cleanup };
}
