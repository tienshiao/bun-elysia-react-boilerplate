import { Elysia, t } from 'elysia';
import { AuthService } from './service.ts';
import type { Database } from '@/db/index.ts';
import type { Jwt } from './jwt.ts';

const authResponseSchema = t.Object({
  authToken: t.String(),
  refreshToken: t.String(),
  user: t.Object({
    userId: t.String(),
    username: t.String(),
  }),
});

export function makeAuthPlugin(db: Database, jwt: Jwt) {
  const service = new AuthService(db, jwt);

  return new Elysia({ prefix: '/auth' })
    .post('/sign-up', async ({ body, set }) => {
      const result = await service.signUp(body);
      set.status = result.status;
      return result.data;
    }, {
      body: t.Object({
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 8 }),
        username: t.String({ minLength: 1 }),
      }),
      response: {
        201: authResponseSchema,
        409: t.Object({ error: t.String() }),
      },
    })
    .post('/sign-in', async ({ body, set }) => {
      const result = await service.signIn(body);
      set.status = result.status;
      return result.data;
    }, {
      body: t.Object({
        email: t.String({ format: 'email' }),
        password: t.String(),
      }),
      response: {
        200: authResponseSchema,
        401: t.Object({ error: t.String() }),
      },
    })
    .post('/sign-out', async ({ body }) => {
      const result = await service.signOut(body);
      return result.data;
    }, {
      body: t.Object({
        refreshToken: t.String(),
      }),
      response: {
        200: t.Object({ success: t.Boolean() }),
      },
    })
    .post('/refresh', async ({ body, set }) => {
      const result = await service.refresh(body);
      set.status = result.status;
      return result.data;
    }, {
      body: t.Object({
        refreshToken: t.String(),
      }),
      response: {
        200: t.Object({ authToken: t.String(), refreshToken: t.String() }),
        401: t.Object({ error: t.String() }),
      },
    });
}

export { makeAuthGuard } from './guard.ts';
