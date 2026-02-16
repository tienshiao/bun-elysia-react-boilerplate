import { createPinoLogger } from "@bogeychan/elysia-logger";
import { openapi, fromTypes } from "@elysiajs/openapi";
import { Elysia, type Context } from "elysia";
import { helmet } from 'elysia-helmet';
import { loadConfig } from '@/config.ts';
import { makeDb } from '@/db/index.ts';
import { makeJwt } from '@/modules/auth/jwt.ts';
import { makeAuthPlugin } from '@/modules/auth/index.ts';

import index from './frontend/index.html'

declare const __VERSION__: string | undefined;
declare const __GIT_HASH__: string | undefined;

const config = await loadConfig();
const { db } = makeDb(config.db);
const jwt = await makeJwt(config.jwt);

const log = createPinoLogger();

const apiPrefix = '/api';
const spaPath = `/${crypto.randomUUID()}`;
// SPA Proxy is used to serve the SPA and run through the middleware
// Otherwise Bun shortcircuits the request and returns the SPA directly
// Also shortcircuits the pattern matching with dynamic handlers
// For example, if you try to access spaPath it will return without running through the middleware (logger, etc)
// see also: https://github.com/oven-sh/bun/issues/17595
const spaProxy = async ({ server }: Pick<Context, 'server'>) => {
  const response = await fetch(`${server?.url}${spaPath}`);
  if (typeof __VERSION__ === 'undefined') return response;
  const html = await response.text();
  return new Response(
    html.replace(/<html([^>]*)>/, `<html$1 data-version="${__VERSION__} (${__GIT_HASH__})">`),
    response,
  );
}

export const app = new Elysia()
  .use(log.into())
  .use(helmet({
    contentSecurityPolicy: {
      directives: {
        "script-src": ["'self'", "'unsafe-inline'"],
        "style-src": ["'self'", "https:", "'unsafe-inline'"],
      },
    },
  }))
	.use(
		openapi({
			references: fromTypes()
		})
	)
  .onBeforeHandle(({ set }) => {
    set.headers['x-version'] = typeof __VERSION__ !== 'undefined'
      ? `${__VERSION__} (${__GIT_HASH__})`
      : 'dev';
  })
  .use(makeAuthPlugin(db, jwt))
  .get(spaPath, index)
	.get('/message', { message: 'Hello from server' } as const)
	.get('/*', spaProxy)
	.listen(config.server.port)

export type App = typeof app;

log.info({ url: app.server?.url?.toString() }, 'Server started');
if (typeof __VERSION__ !== 'undefined') {
  log.info({ version: __VERSION__, gitHash: __GIT_HASH__ }, 'Build info');
}
