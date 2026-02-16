import { Elysia, t } from "elysia";

import type { Database } from "@/db/index.ts";
import { SHORT_UUID_PATTERN } from "@/db/short-uuid.ts";
import type { AllowRoles } from "@/modules/auth/roles.ts";
import { AdminRole, AuthenticatedRole, UserOwnerRole } from "@/modules/auth/roles.ts";

import { UserService } from "./service.ts";

const userResponseSchema = t.Object({
  userId: t.String(),
  username: t.String(),
  createdAt: t.String(),
});

const errorSchema = t.Object({ error: t.String() });

const paramsSchema = t.Object({ userId: t.String({ pattern: SHORT_UUID_PATTERN }) });

export function makeUsersPlugin(db: Database, allowRoles: AllowRoles) {
  const service = new UserService(db);

  return new Elysia({ prefix: "/users", tags: ["Users"] })
    .get(
      "/:userId",
      async ({ params, set }) => {
        const result = await service.getUser(params.userId);
        set.status = result.status;
        return result.data;
      },
      {
        ...allowRoles(AuthenticatedRole),
        params: paramsSchema,
        response: {
          200: userResponseSchema,
          404: errorSchema,
        },
        detail: {
          summary: "Get user profile",
          description: "Retrieve a user profile by ID",
          security: [{ bearerAuth: [] }],
        },
      },
    )
    .patch(
      "/:userId",
      async ({ params, body, set }) => {
        const result = await service.updateUser(params.userId, body);
        set.status = result.status;
        return result.data;
      },
      {
        ...allowRoles(AdminRole, UserOwnerRole),
        params: paramsSchema,
        body: t.Object({
          username: t.Optional(t.String({ minLength: 1 })),
        }),
        response: {
          200: userResponseSchema,
          404: errorSchema,
          409: errorSchema,
        },
        detail: {
          summary: "Update user profile",
          description:
            "Update user profile fields such as username. Requires admin role or ownership of the profile.",
          security: [{ bearerAuth: [] }],
        },
      },
    );
}
