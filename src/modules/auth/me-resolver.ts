import { Elysia } from "elysia";

export function makeMeResolver() {
  return new Elysia({ name: "me-resolver" }).onBeforeHandle({ as: "scoped" }, (ctx) => {
    const params = ctx.params as Record<string, string> | undefined;
    if (params?.userId !== "me") return;

    const user = (ctx as unknown as { user: { userId: string } | null }).user;
    if (!user) {
      ctx.set.status = 401;
      return { error: "Authentication required to resolve 'me'" };
    }

    params.userId = user.userId;
  });
}
