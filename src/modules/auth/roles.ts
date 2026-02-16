import type { AuthUser } from "./guard.ts";
import { toShortUuid } from "@/db/short-uuid.ts";

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

export type AllowRoles = (...roles: RoleClass[]) => {
  beforeHandle: (ctx: { user: AuthUser | null; params: Record<string, string> }) => Response | void;
};

export class EveryoneRole extends Role {
  static resolve(_ctx: RoleContext): boolean {
    return true;
  }
}

export class AuthenticatedRole extends Role {
  static resolve(ctx: RoleContext): boolean {
    return ctx.user !== null;
  }
}

export class AdminRole extends Role {
  static resolve(ctx: RoleContext): boolean {
    return ctx.user?.roles.includes("admin") ?? false;
  }
}

export class UserOwnerRole extends Role {
  static resolve(ctx: RoleContext): boolean {
    if (!ctx.user) return false;
    const userId = ctx.params.userId;
    return userId !== undefined && ctx.user.userId === toShortUuid(userId);
  }
}

export function makeAllowRoles(): AllowRoles {
  return function allowRoles(...roles: RoleClass[]) {
    return {
      beforeHandle({ user, params }: { user: AuthUser | null; params: Record<string, string> }) {
        const ctx: RoleContext = { user, params };

        for (const role of roles) {
          if (role.resolve(ctx)) {
            return;
          }
        }

        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        });
      },
    };
  };
}
