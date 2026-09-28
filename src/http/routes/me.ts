import type { FastifyInstance } from 'fastify';
import type { ContextFor } from '../app.js';
import { getInbox } from '../../services/inbox.js';
import { getMe } from '../../services/org.js';
import { acceptOffer, declineOffer, dropOut, listMyOffers } from '../../services/offers.js';
import {
  addUnavailability,
  getMyProfile,
  removeMySkill,
  removeUnavailability,
  setMySkills,
} from '../../services/people.js';
import { optionalReasonBody, parse, reasonBody, skillsBody, unavailabilityBody } from '../validation.js';

type KeyParams = { Params: { key: string } };

export function registerMeRoutes(app: FastifyInstance, ctx: ContextFor): void {
  app.get('/v1/me', async (request) => getMe(ctx(request)));
  app.get('/v1/inbox', async (request) => getInbox(ctx(request)));

  app.get('/v1/me/profile', async (request) => getMyProfile(ctx(request)));
  app.put('/v1/me/skills', async (request) => setMySkills(ctx(request), parse(skillsBody, request.body).skills));
  app.delete<{ Params: { key: string } }>('/v1/me/skills/:key', async (request) => removeMySkill(ctx(request), request.params.key));

  app.get('/v1/me/unavailability', async (request) => (await getMyProfile(ctx(request))).unavailable);
  app.post('/v1/me/unavailability', async (request, reply) => {
    const created = await addUnavailability(ctx(request), parse(unavailabilityBody, request.body));
    return reply.status(201).send(created);
  });
  app.delete<{ Params: { id: string } }>('/v1/me/unavailability/:id', async (request) =>
    removeUnavailability(ctx(request), request.params.id),
  );

  app.get('/v1/me/offers', async (request) => listMyOffers(ctx(request)));
  app.post<KeyParams>('/v1/me/offers/:key/accept', async (request) => acceptOffer(ctx(request), request.params.key));
  app.post<KeyParams>('/v1/me/offers/:key/decline', async (request) =>
    declineOffer(ctx(request), request.params.key, parse(optionalReasonBody, request.body).reason),
  );
  app.post<KeyParams>('/v1/me/offers/:key/drop', async (request) =>
    dropOut(ctx(request), request.params.key, parse(reasonBody, request.body).reason),
  );
}
