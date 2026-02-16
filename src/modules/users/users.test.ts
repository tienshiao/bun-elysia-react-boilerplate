import { describe, expect, it, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { sql } from 'drizzle-orm';
import { loadConfig } from '@/config.ts';
import { makeTestDb } from '@/db/test-helpers.ts';
import { users, usersPrivate } from '@/db/schema/index.ts';
import { makeUsersPlugin } from './index.ts';

const config = await loadConfig();
const { db: testDb } = await makeTestDb(config.db, 'users');

const testApp = new Elysia({ prefix: '/api' })
  .use(makeUsersPlugin(testDb));

async function seedUser(username: string) {
  const [user] = await testDb.insert(users).values({ username }).returning();
  return user!;
}

async function getUser(id: string) {
  return testApp.handle(
    new Request(`http://localhost/api/users/${id}`)
  );
}

async function patchUser(id: string, body: Record<string, unknown>) {
  return testApp.handle(
    new Request(`http://localhost/api/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(async () => {
  await testDb.execute(sql`DELETE FROM refresh_tokens`);
  await testDb.execute(sql`DELETE FROM user_roles`);
  await testDb.execute(sql`DELETE FROM users_private`);
  await testDb.execute(sql`DELETE FROM users`);
});

describe('Users API', () => {
  describe('GET /api/users/:id', () => {
    it('returns user profile', async () => {
      const user = await seedUser('alice');

      const res = await getUser(user.userId);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.userId).toBe(user.userId);
      expect(body.username).toBe('alice');
      expect(body.createdAt).toBeString();
    });

    it('returns 404 for nonexistent user', async () => {
      const res = await getUser('00000000-0000-0000-0000-000000000000');
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error).toBe('User not found');
    });

    it('returns 404 for soft-deleted user', async () => {
      const user = await seedUser('deleted-user');
      await testDb.execute(sql`UPDATE users SET deleted_at = now() WHERE user_id = ${user.userId}`);

      const res = await getUser(user.userId);
      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /api/users/:id', () => {
    it('updates username', async () => {
      const user = await seedUser('old-name');

      const res = await patchUser(user.userId, { username: 'new-name' });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.username).toBe('new-name');
    });

    it('returns 409 for duplicate username', async () => {
      const user = await seedUser('user-a');
      await seedUser('user-b');

      const res = await patchUser(user.userId, { username: 'user-b' });
      expect(res.status).toBe(409);

      const body = await res.json();
      expect(body.error).toContain('Username');
    });

    it('returns 404 for nonexistent user', async () => {
      const res = await patchUser('00000000-0000-0000-0000-000000000000', { username: 'x' });
      expect(res.status).toBe(404);
    });

    it('returns 404 for soft-deleted user', async () => {
      const user = await seedUser('del-user');
      await testDb.execute(sql`UPDATE users SET deleted_at = now() WHERE user_id = ${user.userId}`);

      const res = await patchUser(user.userId, { username: 'new' });
      expect(res.status).toBe(404);
    });
  });
});
