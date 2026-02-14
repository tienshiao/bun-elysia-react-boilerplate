import { logger } from "@bogeychan/elysia-logger";
import { openapi, fromTypes } from "@elysiajs/openapi";
import { Elysia, type Context } from "elysia";
import { helmet } from 'elysia-helmet';


import index from './frontend/index.html'

const apiPrefix = '/api';
const spaPath = `/${crypto.randomUUID()}`;
// SPA Proxy is used to serve the SPA and run through the middleware
// Otherwise Bun shortcircuits the request and returns the SPA directly
// Also shortcircuits the pattern matching with dynamic handlers
// For example, if you try to access spaPath it will return without running through the middleware (logger, etc)
// see also: https://github.com/oven-sh/bun/issues/17595
const spaProxy = async ({ server }: Pick<Context, 'server'>) => {
  // Potentially can rewrite content as well
  return await fetch(`${server?.url}${spaPath}`);
}

export const app = new Elysia()
  .use(logger())
  .use(helmet())
	.use(
		openapi({
			references: fromTypes()
		})
	)
  .get(spaPath, index)
	.get('/message', { message: 'Hello from server' } as const)
	.get('/*', spaProxy)
	.listen(4000)

export type App = typeof app;

console.log(
  `🦊 Elysia is running at ${app.server?.url}`
);
