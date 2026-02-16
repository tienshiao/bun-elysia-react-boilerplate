import { Elysia } from 'elysia';
import { makeDb } from '@/db/index.ts';
import { makeJwt } from '@/modules/auth/jwt.ts';
import { makeAuthPlugin } from '@/modules/auth/index.ts';
import { makeUsersPlugin } from '@/modules/users/index.ts';
import type { AppConfig } from '@/config.ts';

export async function makeApiPlugin(config: AppConfig) {
  const { db } = makeDb(config.db);
  const jwt = await makeJwt(config.jwt);

  return new Elysia({ prefix: '/api' })
    .use(makeAuthPlugin(db, jwt))
    .use(makeUsersPlugin(db));
}
