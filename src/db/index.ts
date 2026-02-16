import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.ts';

export type Database = PostgresJsDatabase<typeof schema>;

export function makeDb(dbConfig: { url: string }) {
  const client = postgres(dbConfig.url);
  const db = drizzle(client, { schema });
  return { db, client };
}
