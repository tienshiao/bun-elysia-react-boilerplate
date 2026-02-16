import { describe, expect, it, beforeEach } from "bun:test";
import { Elysia } from "elysia";
import { sql, eq } from "drizzle-orm";
import { loadConfig } from "@/config.ts";
import { makeTestDb } from "@/db/test-helpers.ts";
import { users } from "@/db/schema/index.ts";
import { makeJwt } from "@/modules/auth/jwt.ts";
import { makeAuthGuard } from "@/modules/auth/guard.ts";
import { makeAllowRoles } from "@/modules/auth/roles.ts";
import { AUTH_CONFIG, TOKEN_TYPES } from "@/modules/auth/config.ts";
import { makeUsersPlugin } from "./index.ts";

const config = await loadConfig();
const { db: testDb } = await makeTestDb(config.db, "users");
const jwt = await makeJwt(config.jwt);
const authGuard = makeAuthGuard(jwt);
const allowRoles = makeAllowRoles();

const testApp = new Elysia({ prefix: "/api" })
  .use(authGuard)
  .use(makeUsersPlugin(testDb, allowRoles));

async function seedUser(username: string) {
  const [user] = await testDb.insert(users).values({ username }).returning();
  return user!;
}

async function makeAuthToken(userId: string, username: string, userRoleNames: string[] = []) {
  return jwt.sign({
    sub: userId,
    username,
    roles: userRoleNames,
    tt: TOKEN_TYPES.auth,
    exp: `${AUTH_CONFIG.authTokenTTL}s`,
  });
}

async function getUser(id: string, authToken?: string) {
  const headers: Record<string, string> = {};
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  return testApp.handle(new Request(`http://localhost/api/users/${id}`, { headers }));
}

async function patchUser(id: string, body: Record<string, unknown>, authToken?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
  return testApp.handle(
    new Request(`http://localhost/api/users/${id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(body),
    }),
  );
}

beforeEach(async () => {
  await testDb.execute(sql`DELETE FROM refresh_tokens`);
  await testDb.execute(sql`DELETE FROM user_roles`);
  await testDb.execute(sql`DELETE FROM users_private`);
  await testDb.execute(sql`DELETE FROM users`);
  await testDb.execute(sql`DELETE FROM roles`);
});

describe("Users API", () => {
  describe("GET /api/users/:id", () => {
    it("returns 403 without auth token", async () => {
      const user = await seedUser("alice");
      const res = await getUser(user.userId);
      expect(res.status).toBe(403);
    });

    it("returns user profile with valid auth token", async () => {
      const user = await seedUser("alice");
      const token = await makeAuthToken(user.userId, "alice");

      const res = await getUser(user.userId, token);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.userId).toBe(user.userId);
      expect(body.username).toBe("alice");
      expect(body.createdAt).toBeString();
    });

    it("allows any authenticated user to view another user", async () => {
      const alice = await seedUser("alice");
      const bob = await seedUser("bob");
      const token = await makeAuthToken(bob.userId, "bob");

      const res = await getUser(alice.userId, token);
      expect(res.status).toBe(200);
    });

    it("returns 404 for nonexistent user", async () => {
      const user = await seedUser("alice");
      const token = await makeAuthToken(user.userId, "alice");

      const res = await getUser("00000000-0000-0000-0000-000000000000", token);
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error).toBe("User not found");
    });

    it("returns 404 for soft-deleted user", async () => {
      const user = await seedUser("deleted-user");
      const other = await seedUser("viewer");
      const token = await makeAuthToken(other.userId, "viewer");
      await testDb
        .update(users)
        .set({ deletedAt: new Date() })
        .where(eq(users.userId, user.userId));

      const res = await getUser(user.userId, token);
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /api/users/:id", () => {
    it("returns 403 without auth token", async () => {
      const user = await seedUser("old-name");
      const res = await patchUser(user.userId, { username: "new-name" });
      expect(res.status).toBe(403);
    });

    it("returns 403 when authenticated as different non-admin user", async () => {
      const alice = await seedUser("alice");
      const bob = await seedUser("bob");
      const token = await makeAuthToken(bob.userId, "bob");

      const res = await patchUser(alice.userId, { username: "hacked" }, token);
      expect(res.status).toBe(403);
    });

    it("allows user to update their own profile", async () => {
      const user = await seedUser("old-name");
      const token = await makeAuthToken(user.userId, "old-name");

      const res = await patchUser(user.userId, { username: "new-name" }, token);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.username).toBe("new-name");
    });

    it("allows admin to update any user profile", async () => {
      const user = await seedUser("target");
      const admin = await seedUser("admin-user");
      const token = await makeAuthToken(admin.userId, "admin-user", ["admin"]);

      const res = await patchUser(user.userId, { username: "updated" }, token);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.username).toBe("updated");
    });

    it("returns 409 for duplicate username", async () => {
      const user = await seedUser("user-a");
      await seedUser("user-b");
      const token = await makeAuthToken(user.userId, "user-a");

      const res = await patchUser(user.userId, { username: "user-b" }, token);
      expect(res.status).toBe(409);

      const body = await res.json();
      expect(body.error).toContain("Username");
    });

    it("returns 404 for nonexistent user", async () => {
      const admin = await seedUser("admin-user");
      const token = await makeAuthToken(admin.userId, "admin-user", ["admin"]);

      const res = await patchUser("00000000-0000-0000-0000-000000000000", { username: "x" }, token);
      expect(res.status).toBe(404);
    });

    it("returns 404 for soft-deleted user", async () => {
      const user = await seedUser("del-user");
      const token = await makeAuthToken(user.userId, "del-user");
      await testDb
        .update(users)
        .set({ deletedAt: new Date() })
        .where(eq(users.userId, user.userId));

      const res = await patchUser(user.userId, { username: "new" }, token);
      expect(res.status).toBe(404);
    });
  });
});
