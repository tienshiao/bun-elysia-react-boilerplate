import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { bearer } from '@elysiajs/bearer';
import { importSPKI } from 'jose';
import { TOKEN_TYPES } from './config.ts';

const publicKeyPem = process.env.JWT_PUBLIC_KEY
  ?? await Bun.file('keys/public.pem').text();
const publicKey = await importSPKI(publicKeyPem, 'RS256');

export const authGuard = new Elysia({ name: 'auth-guard' })
  .use(bearer())
  .use(jwt({
    name: 'jwtVerify',
    secret: publicKey,
    alg: 'RS256',
  }))
  .resolve(async ({ jwtVerify, bearer, set }) => {
    if (!bearer) {
      set.status = 401;
      throw new Error('Unauthorized');
    }
    const payload = await jwtVerify.verify(bearer);
    if (!payload || payload.tt !== TOKEN_TYPES.auth) {
      set.status = 401;
      throw new Error('Unauthorized');
    }
    return {
      user: {
        userId: payload.sub as string,
        username: payload.username as string,
      },
    };
  })
  .as('plugin');
