import { Elysia } from "elysia";

import type { AppConfig } from "@/config.ts";
import { makeDb } from "@/db/index.ts";
import { makeAuthGuard, makeAuthPlugin, makeMeResolver } from "@/modules/auth/index.ts";
import { makeJwt } from "@/modules/auth/jwt.ts";
import { makeAllowRoles } from "@/modules/auth/roles.ts";
import { makeUsersPlugin } from "@/modules/users/index.ts";

export async function makeApiPlugin(config: AppConfig) {
  const { db } = makeDb(config.db);
  const jwt = await makeJwt(config.jwt);
  const authGuard = makeAuthGuard(jwt);
  const allowRoles = makeAllowRoles();

  return new Elysia({ prefix: "/api" })
    .use(authGuard)
    .use(makeMeResolver())
    .use(makeAuthPlugin(db, jwt))
    .use(makeUsersPlugin(db, allowRoles));
}
