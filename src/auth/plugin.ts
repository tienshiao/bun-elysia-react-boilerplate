import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { importPKCS8, importSPKI } from 'jose';
import { dbPlugin } from '@/db/index.ts';
import * as handlers from './handlers.ts';

const privateKeyPem = process.env.JWT_PRIVATE_KEY
  ?? await Bun.file('keys/private.pem').text();
const privateKey = await importPKCS8(privateKeyPem, 'RS256');

const publicKeyPem = process.env.JWT_PUBLIC_KEY
  ?? await Bun.file('keys/public.pem').text();
const publicKey = await importSPKI(publicKeyPem, 'RS256');

const authResponseSchema = t.Object({
  authToken: t.String(),
  refreshToken: t.String(),
  user: t.Object({
    userId: t.String(),
    username: t.String(),
  }),
});

export const authPlugin = new Elysia({ prefix: '/auth' })
  .use(dbPlugin)
  .use(jwt({
    name: 'jwt',
    secret: privateKey,
    alg: 'RS256',
  }))
  .use(jwt({
    name: 'jwtRefreshVerify',
    secret: publicKey,
    alg: 'RS256',
  }))
  .post('/sign-up', async ({ jwt, db, body, set }) => {
    const result = await handlers.signUp(db, jwt, body);
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
  .post('/sign-in', async ({ jwt, db, body, set }) => {
    const result = await handlers.signIn(db, jwt, body);
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
  .post('/sign-out', async ({ db, body }) => {
    const result = await handlers.signOut(db, body);
    return result.data;
  }, {
    body: t.Object({
      refreshToken: t.String(),
    }),
    response: {
      200: t.Object({ success: t.Boolean() }),
    },
  })
  .post('/refresh', async ({ jwt, jwtRefreshVerify, db, body, set }) => {
    const result = await handlers.refresh(db, jwt, jwtRefreshVerify, body);
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
