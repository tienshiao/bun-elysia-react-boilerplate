import { Elysia } from 'elysia';
import { makeDb } from '@/db/index.ts';
import { makeJwt } from '@/modules/auth/jwt.ts';
import { makeAuthPlugin, makeAuthGuard } from '@/modules/auth/index.ts';
import { makeAllowRoles } from '@/modules/auth/roles.ts';
import { makeUsersPlugin } from '@/modules/users/index.ts';
import type { AppConfig } from '@/config.ts';

export async function makeApiPlugin(config: AppConfig) {
  const { db } = makeDb(config.db);
  const jwt = await makeJwt(config.jwt);
  const authGuard = await makeAuthGuard(config.jwt);
  const allowRoles = makeAllowRoles();

  return new Elysia({ prefix: '/api' })
    .use(authGuard)
    .use(makeAuthPlugin(db, jwt))
    .use(makeUsersPlugin(db, allowRoles));
}
