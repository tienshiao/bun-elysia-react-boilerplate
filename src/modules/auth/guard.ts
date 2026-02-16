import { Elysia } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { bearer } from '@elysiajs/bearer';
import { importSPKI } from 'jose';
import { TOKEN_TYPES } from './config.ts';

export interface AuthUser {
  userId: string;
  username: string;
  roles: string[];
}

export async function makeAuthGuard(jwtConfig: { publicKey: string }) {
  const publicKey = await importSPKI(jwtConfig.publicKey, 'RS256');

  return new Elysia({ name: 'auth-guard' })
    .use(bearer())
    .use(jwt({
      name: 'jwtVerify',
      secret: publicKey,
      alg: 'RS256',
    }))
    .resolve(async ({ jwtVerify, bearer }) => {
      if (!bearer) {
        return { user: null as AuthUser | null };
      }
      const payload = await jwtVerify.verify(bearer);
      if (!payload || payload.tt !== TOKEN_TYPES.auth) {
        return { user: null as AuthUser | null };
      }
      return {
        user: {
          userId: payload.sub as string,
          username: payload.username as string,
          roles: (payload.roles as string[]) ?? [],
        } as AuthUser | null,
      };
    })
    .as('plugin');
}
