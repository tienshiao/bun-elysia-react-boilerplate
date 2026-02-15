import { Elysia } from 'elysia';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.ts';

const connectionString = process.env.DATABASE_URL
  ?? 'postgres://bp_user:bp_password@localhost:5432/boilerplate_development';

const client = postgres(connectionString);
const db = drizzle(client, { schema });

export type Database = PostgresJsDatabase<typeof schema>;

export const dbPlugin = new Elysia({ name: 'db' })
  .decorate('db', db);

export { client };
