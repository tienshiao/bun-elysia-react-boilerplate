import { describe, expect, it, beforeEach } from 'bun:test';
import { Elysia, t } from 'elysia';
import { sql } from 'drizzle-orm';
import { loadConfig } from '@/config.ts';
import { makeTestDb } from '@/db/test-helpers.ts';
import { makeJwt } from './jwt.ts';
import { makeAuthPlugin, makeAuthGuard } from './index.ts';
import { makeAllowRoles, AuthenticatedRole } from './roles.ts';

const config = await loadConfig();
const { db: testDb } = await makeTestDb(config.db, 'auth');
const jwt = await makeJwt(config.jwt);
const authGuard = makeAuthGuard(jwt);
const allowRoles = makeAllowRoles();

const apiPlugin = new Elysia({ prefix: '/api' })
  .use(makeAuthPlugin(testDb, jwt));

const testApp = new Elysia()
  .use(apiPlugin)
  .use(authGuard)
  .get('/api/me', ({ user }) => {
    return { userId: user!.userId, username: user!.username };
  }, {
    ...allowRoles(AuthenticatedRole),
    response: {
      200: t.Object({ userId: t.String(), username: t.String() }),
      403: t.Object({ error: t.String() }),
    },
  });

async function signUp(email: string, password: string, username: string) {
  return testApp.handle(
    new Request('http://localhost/api/auth/sign-up', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username }),
    })
  );
}

async function signIn(email: string, password: string) {
  return testApp.handle(
    new Request('http://localhost/api/auth/sign-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
  );
}

async function signOut(refreshToken: string) {
  return testApp.handle(
    new Request('http://localhost/api/auth/sign-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
  );
}

async function refresh(refreshToken: string) {
  return testApp.handle(
    new Request('http://localhost/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
  );
}

async function getMe(authToken: string) {
  return testApp.handle(
    new Request('http://localhost/api/me', {
      headers: { Authorization: `Bearer ${authToken}` },
    })
  );
}

beforeEach(async () => {
  await testDb.execute(sql`DELETE FROM refresh_tokens`);
  await testDb.execute(sql`DELETE FROM user_roles`);
  await testDb.execute(sql`DELETE FROM users_private`);
  await testDb.execute(sql`DELETE FROM users`);
});

describe('Auth API', () => {
  describe('POST /api/auth/sign-up', () => {
    it('creates user and returns both tokens', async () => {
      const res = await signUp('test@test.com', 'password123', 'testuser');
      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body.authToken).toBeString();
      expect(body.refreshToken).toBeString();
      expect(body.user.userId).toBeString();
      expect(body.user.username).toBe('testuser');
    });

    it('returns 409 for duplicate email', async () => {
      await signUp('test@test.com', 'password123', 'user1');

      const res = await signUp('test@test.com', 'password123', 'user2');
      expect(res.status).toBe(409);

      const body = await res.json();
      expect(body.error).toContain('Email');
    });

    it('returns 409 for duplicate username', async () => {
      await signUp('user1@test.com', 'password123', 'testuser');

      const res = await signUp('user2@test.com', 'password123', 'testuser');
      expect(res.status).toBe(409);

      const body = await res.json();
      expect(body.error).toContain('Username');
    });

    it('returns 422 for invalid email format', async () => {
      const res = await signUp('not-an-email', 'password123', 'testuser');
      expect(res.status).toBe(422);
    });

    it('returns 422 for short password', async () => {
      const res = await signUp('test@test.com', 'short', 'testuser');
      expect(res.status).toBe(422);
    });
  });

  describe('POST /api/auth/sign-in', () => {
    it('returns both tokens for valid credentials', async () => {
      await signUp('test@test.com', 'password123', 'testuser');

      const res = await signIn('test@test.com', 'password123');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.authToken).toBeString();
      expect(body.refreshToken).toBeString();
      expect(body.user.username).toBe('testuser');
    });

    it('returns 401 for wrong password', async () => {
      await signUp('test@test.com', 'password123', 'testuser');

      const res = await signIn('test@test.com', 'wrongpassword');
      expect(res.status).toBe(401);
    });

    it('returns 401 for non-existent email', async () => {
      const res = await signIn('nobody@test.com', 'password123');
      expect(res.status).toBe(401);
    });

    it('returns 401 for soft-deleted user', async () => {
      await signUp('test@test.com', 'password123', 'testuser');
      await testDb.execute(sql`UPDATE users SET deleted_at = now()`);

      const res = await signIn('test@test.com', 'password123');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/sign-out', () => {
    it('deletes refresh token from DB', async () => {
      const signUpRes = await signUp('test@test.com', 'password123', 'testuser');
      const { refreshToken } = await signUpRes.json();

      const res = await signOut(refreshToken);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);

      const refreshRes = await refresh(refreshToken);
      expect(refreshRes.status).toBe(401);
    });

    it('succeeds even if token does not exist (idempotent)', async () => {
      const res = await signOut('non-existent-token');
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('returns new auth_token with same refresh_token when TTL is plenty', async () => {
      const signUpRes = await signUp('test@test.com', 'password123', 'testuser');
      const { refreshToken } = await signUpRes.json();

      const res = await refresh(refreshToken);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.authToken).toBeString();
      expect(body.refreshToken).toBe(refreshToken);
    });

    it('returns new refresh_token when near expiry threshold', async () => {
      const signUpRes = await signUp('test@test.com', 'password123', 'testuser');
      const { refreshToken } = await signUpRes.json();

      await testDb.execute(
        sql`UPDATE refresh_tokens SET expires_at = now() + interval '1 day'`
      );

      const res = await refresh(refreshToken);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.refreshToken).not.toBe(refreshToken);
    });

    it('returns 401 for expired refresh token', async () => {
      const signUpRes = await signUp('test@test.com', 'password123', 'testuser');
      const { refreshToken } = await signUpRes.json();

      await testDb.execute(
        sql`UPDATE refresh_tokens SET expires_at = now() - interval '1 day'`
      );

      const res = await refresh(refreshToken);
      expect(res.status).toBe(401);
    });

    it('returns 401 for invalid refresh token', async () => {
      const res = await refresh('totally-invalid-token');
      expect(res.status).toBe(401);
    });

    it('returns 401 for soft-deleted user', async () => {
      const signUpRes = await signUp('test@test.com', 'password123', 'testuser');
      const { refreshToken } = await signUpRes.json();

      await testDb.execute(sql`UPDATE users SET deleted_at = now()`);

      const res = await refresh(refreshToken);
      expect(res.status).toBe(401);
    });
  });

  describe('Auth Guard + allowRoles', () => {
    it('allows access with valid auth_token', async () => {
      const signUpRes = await signUp('test@test.com', 'password123', 'testuser');
      const { authToken } = await signUpRes.json();

      const res = await getMe(authToken);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.username).toBe('testuser');
    });

    it('returns 403 without Authorization header', async () => {
      const res = await testApp.handle(
        new Request('http://localhost/api/me')
      );
      expect(res.status).toBe(403);
    });

    it('returns 403 with invalid auth_token', async () => {
      const res = await getMe('invalid.jwt.token');
      expect(res.status).toBe(403);
    });

    it('returns 403 when using a refresh token as auth token', async () => {
      const signUpRes = await signUp('test@test.com', 'password123', 'testuser');
      const { refreshToken } = await signUpRes.json();

      const res = await getMe(refreshToken);
      expect(res.status).toBe(403);
    });
  });

  describe('Token type validation', () => {
    it('refresh endpoint rejects auth tokens (wrong typ)', async () => {
      const signUpRes = await signUp('test@test.com', 'password123', 'testuser');
      const { authToken } = await signUpRes.json();

      const res = await refresh(authToken);
      expect(res.status).toBe(401);
    });
  });
});
