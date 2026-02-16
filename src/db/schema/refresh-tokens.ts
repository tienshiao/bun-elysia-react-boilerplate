import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { shortUuid } from "@/db/short-uuid.ts";
import { users } from "./users.ts";

export const refreshTokens = pgTable("refresh_tokens", {
  id: shortUuid("id")
    .primaryKey()
    .default(sql`uuidv7()`),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  userId: shortUuid("user_id")
    .notNull()
    .references(() => users.userId),
});
