import { Elysia } from 'elysia';
import { bearer } from '@elysiajs/bearer';
import type { Jwt } from './jwt.ts';
import { TOKEN_TYPES } from './config.ts';

export interface AuthUser {
  userId: string;
  username: string;
  roles: string[];
}

export function makeAuthGuard(jwt: Jwt) {
  return new Elysia({ name: 'auth-guard' })
    .use(bearer())
    .resolve(async ({ bearer }) => {
      if (!bearer) {
        return { user: null as AuthUser | null };
      }
      const payload = await jwt.verify(bearer);
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
