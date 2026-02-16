import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { shortUuid } from '@/db/short-uuid.ts';

export const users = pgTable('users', {
  userId: shortUuid('user_id').primaryKey().default(sql`uuidv7()`),
  username: text('username').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const usersPrivate = pgTable('users_private', {
  userId: shortUuid('user_id').primaryKey().references(() => users.userId),
  email: text('email').notNull().unique(), // use citext in migration SQL
  passwordHash: text('password_hash').notNull(),
});
