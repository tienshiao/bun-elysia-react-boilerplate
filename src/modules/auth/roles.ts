import { toShortUuid } from "@/db/short-uuid.ts";

import type { AuthUser } from "./guard.ts";

export interface RoleContext {
  user: AuthUser | null;
  params: Record<string, string>;
}

export abstract class Role {
  static resolve(_ctx: RoleContext): boolean {
    throw new Error("Role.resolve() must be implemented");
  }
}

export type RoleClass = typeof Role;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AllowRoles = (...roles: RoleClass[]) => { beforeHandle: (ctx: any) => any };

export class EveryoneRole extends Role {
  static override resolve(_ctx: RoleContext): boolean {
    return true;
  }
}

export class AuthenticatedRole extends Role {
  static override resolve(ctx: RoleContext): boolean {
    return ctx.user !== null;
  }
}

export class AdminRole extends Role {
  static override resolve(ctx: RoleContext): boolean {
    return ctx.user?.roles.includes("admin") ?? false;
  }
}

export class UserOwnerRole extends Role {
  static override resolve(ctx: RoleContext): boolean {
    if (!ctx.user) return false;
    const userId = ctx.params.userId;
    return userId !== undefined && ctx.user.userId === toShortUuid(userId);
  }
}

export function makeAllowRoles(): AllowRoles {
  return function allowRoles(...roles: RoleClass[]) {
    return {
      beforeHandle(ctx: Record<string, unknown>) {
        const { user, params, set } = ctx as {
          user: AuthUser | null;
          params: Record<string, string>;
          set: { status: number };
        };
        const roleCtx: RoleContext = { user, params };

        for (const role of roles) {
          if (role.resolve(roleCtx)) {
            return;
          }
        }

        set.status = 403;
        return { error: "Forbidden" };
      },
    };
  };
}
