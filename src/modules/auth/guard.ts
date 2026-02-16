import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { bearer } from '@elysiajs/bearer';
import { importSPKI } from 'jose';
import { TOKEN_TYPES } from './config.ts';

export async function makeAuthGuard(jwtConfig: { publicKey: string }) {
  const publicKey = await importSPKI(jwtConfig.publicKey, 'RS256');

  return new Elysia({ name: 'auth-guard' })
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
}
