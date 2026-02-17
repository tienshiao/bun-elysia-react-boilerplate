import { sql } from "drizzle-orm";
import { Elysia } from "elysia";

import type { Database } from "@/db/index.ts";

export function makeHealthPlugin(db: Database) {
  return new Elysia({ prefix: "/health", tags: ["Health"] }).get(
    "/",
    async ({ set }) => {
      try {
        await db.execute(sql`SELECT 1`);
        return { status: "ok" as const };
      } catch {
        set.status = 503;
        return { status: "error" as const, error: "Database unavailable" };
      }
    },
    {
      detail: {
        summary: "Health check",
        description: "Check API and database connectivity",
      },
    },
  );
}
