import { and, eq, isNull } from "drizzle-orm";

import { isUniqueViolation } from "@/db/errors.ts";
import type { Database } from "@/db/index.ts";
import { users } from "@/db/schema/index.ts";

export class UserService {
  constructor(private db: Database) {}

  async getUser(userId: string) {
    const result = await this.db
      .select({
        userId: users.userId,
        username: users.username,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .limit(1);

    const user = result[0];
    if (!user) {
      return { status: 404 as const, data: { error: "User not found" } };
    }

    return {
      status: 200 as const,
      data: {
        userId: user.userId,
        username: user.username,
        createdAt: user.createdAt.toISOString(),
      },
    };
  }

  async updateUser(userId: string, data: { username?: string }) {
    const existing = await this.db
      .select({ userId: users.userId })
      .from(users)
      .where(and(eq(users.userId, userId), isNull(users.deletedAt)))
      .limit(1);

    if (existing.length === 0) {
      return { status: 404 as const, data: { error: "User not found" } };
    }

    try {
      const [updated] = await this.db
        .update(users)
        .set(data)
        .where(eq(users.userId, userId))
        .returning({
          userId: users.userId,
          username: users.username,
          createdAt: users.createdAt,
        });

      return {
        status: 200 as const,
        data: {
          userId: updated!.userId,
          username: updated!.username,
          createdAt: updated!.createdAt.toISOString(),
        },
      };
    } catch (err) {
      if (isUniqueViolation(err)) {
        return { status: 409 as const, data: { error: "Username already taken" } };
      }
      throw err;
    }
  }
}
