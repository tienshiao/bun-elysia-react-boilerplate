import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  userId: uuid('user_id').primaryKey().default(sql`uuidv7()`),
  username: text('username').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const usersPrivate = pgTable('users_private', {
  userId: uuid('user_id').primaryKey().references(() => users.userId),
  email: text('email').notNull().unique(), // use citext in migration SQL
  passwordHash: text('password_hash').notNull(),
});
