import { createPinoLogger } from "@bogeychan/elysia-logger";
import { fromTypes, openapi } from "@elysiajs/openapi";
import { type Context, Elysia } from "elysia";
import { helmet } from "elysia-helmet";

import { makeApiPlugin } from "@/api.ts";
import { loadConfig } from "@/config.ts";

import index from "./frontend/index.html";

declare const __VERSION__: string | undefined;
declare const __GIT_HASH__: string | undefined;

const config = await loadConfig();

const log = createPinoLogger();
const spaPath = `/${crypto.randomUUID()}`;
// SPA Proxy is used to serve the SPA and run through the middleware
// Otherwise Bun shortcircuits the request and returns the SPA directly
// Also shortcircuits the pattern matching with dynamic handlers
// For example, if you try to access spaPath it will return without running through the middleware (logger, etc)
// see also: https://github.com/oven-sh/bun/issues/17595
const spaProxy = async ({ server }: Pick<Context, "server">) => {
  const response = await fetch(`${server?.url}${spaPath}`);
  if (typeof __VERSION__ === "undefined") return response;
  const html = await response.text();
  return new Response(
    html.replace(/<html([^>]*)>/, `<html$1 data-version="${__VERSION__} (${__GIT_HASH__})">`),
    response,
  );
};

const { plugin: apiPlugin, client } = await makeApiPlugin(config);

export const app = new Elysia()
  .use(log.into())
  .derive(({ request }) => {
    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
    return { requestId, requestLog: log.child({ requestId }) };
  })
  .use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "script-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
          "style-src": ["'self'", "https:", "'unsafe-inline'"],
        },
      },
    }),
  )
  .use(
    openapi({
      documentation: {
        info: {
          title: "Bun Elysia React Boilerplate API",
          version: "1.0.50",
          description: "Full-stack monolithic API powered by Bun and Elysia",
        },
        tags: [
          { name: "Auth", description: "Authentication and token management" },
          { name: "Users", description: "User profile operations" },
          { name: "Health", description: "Health check endpoints" },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
          },
        },
      },
      references: fromTypes(),
    }),
  )
  .onBeforeHandle(({ set, requestId }) => {
    set.headers["x-version"] =
      typeof __VERSION__ !== "undefined" ? `${__VERSION__} (${__GIT_HASH__})` : "dev";
    set.headers["x-request-id"] = requestId;
  })
  .onError(({ code, error, set, ...ctx }) => {
    const logger = "requestLog" in ctx ? (ctx.requestLog as typeof log) : log;

    if (code === "VALIDATION") {
      logger.warn({ err: error }, "Validation error");
      return;
    }

    if (code === "NOT_FOUND") {
      set.status = 404;
      return { error: "Not found" };
    }

    logger.error({ err: error }, "Unhandled error");
    set.status = 500;
    return { error: "Internal server error" };
  })
  .use(apiPlugin)
  .get(spaPath, index, { detail: { hide: true } })
  .get("/*", spaProxy, { detail: { hide: true } })
  .listen(config.server.port);

export type App = typeof app;

log.info({ url: app.server?.url?.toString() }, "Server started");
if (typeof __VERSION__ !== "undefined") {
  log.info({ version: __VERSION__, gitHash: __GIT_HASH__ }, "Build info");
}

const shutdown = async (signal: string) => {
  log.info({ signal }, "Shutting down");
  app.stop();
  await client.end();
  log.info("Shutdown complete");
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
