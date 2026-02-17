import { Elysia } from "elysia";

import type { AppConfig } from "@/config.ts";
import { makeDb } from "@/db/index.ts";
import { makeAuthGuard, makeAuthPlugin, makeMeResolver } from "@/modules/auth/index.ts";
import { makeJwt } from "@/modules/auth/jwt.ts";
import { makeAllowRoles } from "@/modules/auth/roles.ts";
import { makeHealthPlugin } from "@/modules/health/index.ts";
import { makeUsersPlugin } from "@/modules/users/index.ts";

export async function makeApiPlugin(config: AppConfig) {
  const { db, client } = makeDb(config.db);
  const jwt = await makeJwt(config.jwt);
  const authGuard = makeAuthGuard(jwt);
  const allowRoles = makeAllowRoles();

  const plugin = new Elysia({ prefix: "/api" })
    .use(makeHealthPlugin(db))
    .use(authGuard)
    .use(makeMeResolver())
    .use(makeAuthPlugin(db, jwt))
    .use(makeUsersPlugin(db, allowRoles));

  return { plugin, client };
}
