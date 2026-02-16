import { pgTable, primaryKey, text } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { shortUuid } from '@/db/short-uuid.ts';
import { users } from './users.ts';

export const roles = pgTable('roles', {
  roleId: shortUuid('role_id').primaryKey().default(sql`uuidv7()`),
  name: text('name').notNull().unique(),
});

export const userRoles = pgTable('user_roles', {
  userId: shortUuid('user_id').notNull().references(() => users.userId),
  roleId: shortUuid('role_id').notNull().references(() => roles.roleId),
}, (table) => [
  primaryKey({ columns: [table.userId, table.roleId] }),
]);
