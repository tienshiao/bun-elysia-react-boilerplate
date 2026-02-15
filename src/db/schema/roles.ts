import { pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.ts';

export const roles = pgTable('roles', {
  roleId: uuid('role_id').primaryKey().default(sql`uuidv7()`),
  name: text('name').notNull().unique(),
});

export const userRoles = pgTable('user_roles', {
  userId: uuid('user_id').notNull().references(() => users.userId),
  roleId: uuid('role_id').notNull().references(() => roles.roleId),
}, (table) => [
  primaryKey({ columns: [table.userId, table.roleId] }),
]);
