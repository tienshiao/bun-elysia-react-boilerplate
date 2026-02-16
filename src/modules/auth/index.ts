import { Elysia, t } from "elysia";

import type { Database } from "@/db/index.ts";

import type { Jwt } from "./jwt.ts";
import { AuthService } from "./service.ts";

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

  return new Elysia({ prefix: "/auth", tags: ["Auth"] })
    .post(
      "/sign-up",
      async ({ body, set }) => {
        const result = await service.signUp(body);
        set.status = result.status;
        return result.data;
      },
      {
        body: t.Object({
          email: t.String({ format: "email" }),
          password: t.String({ minLength: 8 }),
          username: t.String({ minLength: 1 }),
        }),
        response: {
          201: authResponseSchema,
          409: t.Object({ error: t.String() }),
        },
        detail: {
          summary: "Register a new user",
          description: "Create a new account with email, password, and username",
        },
      },
    )
    .post(
      "/sign-in",
      async ({ body, set }) => {
        const result = await service.signIn(body);
        set.status = result.status;
        return result.data;
      },
      {
        body: t.Object({
          email: t.String({ format: "email" }),
          password: t.String(),
        }),
        response: {
          200: authResponseSchema,
          401: t.Object({ error: t.String() }),
        },
        detail: {
          summary: "Authenticate with credentials",
          description: "Sign in with email and password to receive auth and refresh tokens",
        },
      },
    )
    .post(
      "/sign-out",
      async ({ body }) => {
        const result = await service.signOut(body);
        return result.data;
      },
      {
        body: t.Object({
          refreshToken: t.String(),
        }),
        response: {
          200: t.Object({ success: t.Boolean() }),
        },
        detail: {
          summary: "Revoke a refresh token",
          description: "Sign out by invalidating the provided refresh token",
        },
      },
    )
    .post(
      "/refresh",
      async ({ body, set }) => {
        const result = await service.refresh(body);
        set.status = result.status;
        return result.data;
      },
      {
        body: t.Object({
          refreshToken: t.String(),
        }),
        response: {
          200: t.Object({ authToken: t.String(), refreshToken: t.String() }),
          401: t.Object({ error: t.String() }),
        },
        detail: {
          summary: "Refresh auth token",
          description: "Exchange a valid refresh token for new auth and refresh tokens",
        },
      },
    );
}

export type { AuthUser } from "./guard.ts";
export { makeAuthGuard } from "./guard.ts";
export { makeMeResolver } from "./me-resolver.ts";
export type { AllowRoles, RoleClass, RoleContext } from "./roles.ts";
export {
  AdminRole,
  AuthenticatedRole,
  EveryoneRole,
  makeAllowRoles,
  UserOwnerRole,
} from "./roles.ts";
