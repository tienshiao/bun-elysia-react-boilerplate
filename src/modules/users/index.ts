import { Elysia, t } from 'elysia';
import { UserService } from './service.ts';
import type { Database } from '@/db/index.ts';

const userResponseSchema = t.Object({
  userId: t.String(),
  username: t.String(),
  createdAt: t.String(),
});

const errorSchema = t.Object({ error: t.String() });

const paramsSchema = t.Object({ id: t.String({ format: 'uuid' }) });

export function makeUsersPlugin(db: Database) {
  const service = new UserService(db);

  return new Elysia({ prefix: '/users', tags: ['Users'] })
    .get('/:id', async ({ params, set }) => {
      const result = await service.getUser(params.id);
      set.status = result.status;
      return result.data;
    }, {
      params: paramsSchema,
      response: {
        200: userResponseSchema,
        404: errorSchema,
      },
      detail: { summary: 'Get user profile', description: 'Retrieve a user profile by ID' },
    })
    .patch('/:id', async ({ params, body, set }) => {
      const result = await service.updateUser(params.id, body);
      set.status = result.status;
      return result.data;
    }, {
      params: paramsSchema,
      body: t.Object({
        username: t.Optional(t.String({ minLength: 1 })),
      }),
      response: {
        200: userResponseSchema,
        404: errorSchema,
        409: errorSchema,
      },
      detail: { summary: 'Update user profile', description: 'Update user profile fields such as username' },
    });
}
