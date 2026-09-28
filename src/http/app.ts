/**
 * HTTP layer: authentication, error mapping and routing. Controllers are thin —
 * parse the request, build the service context, call one service function.
 */
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { Prisma, type PrismaClient } from '@prisma/client';
import { AppError } from '../lib/errors.js';
import { systemClock, type Clock } from '../lib/clock.js';
import { hashToken } from '../lib/tokens.js';
import type { Actor } from '../domain/types.js';
import type { Ctx } from '../services/context.js';
import { registerMissionRoutes } from './routes/missions.js';
import { registerMeRoutes } from './routes/me.js';
import { registerOrgRoutes } from './routes/org.js';

declare module 'fastify' {
  interface FastifyRequest {
    actor: Actor | null;
  }
}

export interface AppDeps {
  db: PrismaClient;
  clock?: Clock;
  logger?: boolean | { level: string };
}

export type ContextFor = (request: FastifyRequest) => Ctx;

export function buildApp(deps: AppDeps): FastifyInstance {
  const clock = deps.clock ?? systemClock;
  const app = Fastify({ logger: deps.logger ?? false });
  app.decorateRequest('actor', null);

  // Token → (user, org, role). The org is always derived from the token.
  app.addHook('onRequest', async (request) => {
    if (request.url === '/v1/health') return;
    const header = request.headers.authorization ?? '';
    const token = /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim();
    if (!token) throw new AppError('UNAUTHENTICATED', 'Missing API token. Log in with `mc login <token>`.');
    const user = await deps.db.user.findUnique({ where: { tokenHash: hashToken(token) }, include: { org: true } });
    if (!user) throw new AppError('UNAUTHENTICATED', 'That API token is not valid.');
    request.actor = {
      userId: user.id,
      orgId: user.orgId,
      role: user.role,
      handle: user.handle,
      name: user.name,
      org: { slug: user.org.slug, name: user.org.name, keyPrefix: user.org.keyPrefix },
    };
  });

  const ctx: ContextFor = (request) => {
    if (!request.actor) throw new AppError('UNAUTHENTICATED', 'Not authenticated.');
    return { db: deps.db, clock, actor: request.actor };
  };

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) return reply.status(error.status).send(error.toJSON());
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return reply.status(409).send(new AppError('DUPLICATE', 'That record already exists.').toJSON());
      }
      if (error.code === 'P2003') {
        // Composite (org_id, id) foreign keys make cross-tenant references impossible at the database level.
        return reply
          .status(422)
          .send(new AppError('VALIDATION_FAILED', 'A referenced record does not exist in your organisation.').toJSON());
      }
    }
    const status = (error as { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      const message = error instanceof Error ? error.message : 'Bad request';
      return reply.status(400).send(new AppError('VALIDATION_FAILED', message).toJSON());
    }
    request.log.error(error);
    return reply.status(500).send(new AppError('INTERNAL', 'Something went wrong on the server.').toJSON());
  });

  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send(new AppError('ROUTE_NOT_FOUND', `No route ${request.method} ${request.url}`).toJSON()),
  );

  app.get('/v1/health', async () => {
    await deps.db.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  });

  registerMeRoutes(app, ctx);
  registerOrgRoutes(app, ctx);
  registerMissionRoutes(app, ctx);
  return app;
}
