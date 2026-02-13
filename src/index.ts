import { logger } from "@bogeychan/elysia-logger";
import { openapi, fromTypes } from "@elysiajs/openapi";
import { Elysia } from "elysia";

import index from './index.html'

export const app = new Elysia()
  .use(logger())
	.use(
		openapi({
			references: fromTypes()
		})
	)
  .get('/', index)
	.get('/message', { message: 'Hello from server' } as const)
	.listen(3000)

console.log(
  `🦊 Elysia is running at ${app.server?.url}`
);
