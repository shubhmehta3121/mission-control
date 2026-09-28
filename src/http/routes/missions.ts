import type { FastifyInstance } from 'fastify';
import type { ContextFor } from '../app.js';
import {
  activateMission,
  approveMission,
  cancelMission,
  completeMission,
  createMission,
  getMission,
  listEvents,
  listMissions,
  rejectMission,
  setRoles,
  submitMission,
  updateMission,
} from '../../services/missions.js';
import { matchMission, nominate, offerSeats, removeNomination, retractOffer } from '../../services/staffing.js';
import {
  createMissionBody,
  listMissionsQuery,
  matchQuery,
  noteBody,
  parse,
  reasonBody,
  requiredNoteBody,
  rolesBody,
  seatRequestBody,
  updateMissionBody,
} from '../validation.js';

type KeyParams = { Params: { key: string } };
type KeyHandleParams = { Params: { key: string; handle: string } };

export function registerMissionRoutes(app: FastifyInstance, ctx: ContextFor): void {
  app.get('/v1/missions', async (request) => listMissions(ctx(request), parse(listMissionsQuery, request.query)));
  app.post('/v1/missions', async (request, reply) =>
    reply.status(201).send(await createMission(ctx(request), parse(createMissionBody, request.body))),
  );
  app.get<KeyParams>('/v1/missions/:key', async (request) => getMission(ctx(request), request.params.key));
  app.patch<KeyParams>('/v1/missions/:key', async (request) =>
    updateMission(ctx(request), request.params.key, parse(updateMissionBody, request.body)),
  );
  app.put<KeyParams>('/v1/missions/:key/roles', async (request) =>
    setRoles(ctx(request), request.params.key, parse(rolesBody, request.body).roles),
  );
  app.get<KeyParams>('/v1/missions/:key/events', async (request) => listEvents(ctx(request), request.params.key));

  // Staffing
  app.get<KeyParams>('/v1/missions/:key/match', async (request) =>
    matchMission(ctx(request), request.params.key, parse(matchQuery, request.query)),
  );
  app.post<KeyParams>('/v1/missions/:key/nominations', async (request, reply) =>
    reply.status(201).send(await nominate(ctx(request), request.params.key, parse(seatRequestBody, request.body))),
  );
  app.delete<KeyHandleParams>('/v1/missions/:key/nominations/:handle', async (request) =>
    removeNomination(ctx(request), request.params.key, request.params.handle),
  );
  app.post<KeyParams>('/v1/missions/:key/offers', async (request, reply) =>
    reply.status(201).send(await offerSeats(ctx(request), request.params.key, parse(seatRequestBody, request.body))),
  );
  app.post<KeyHandleParams>('/v1/missions/:key/offers/:handle/retract', async (request) =>
    retractOffer(ctx(request), request.params.key, request.params.handle),
  );

  // Lifecycle
  app.post<KeyParams>('/v1/missions/:key/submit', async (request) => submitMission(ctx(request), request.params.key));
  app.post<KeyParams>('/v1/missions/:key/approve', async (request) =>
    approveMission(ctx(request), request.params.key, parse(noteBody, request.body).note),
  );
  app.post<KeyParams>('/v1/missions/:key/reject', async (request) =>
    rejectMission(ctx(request), request.params.key, parse(requiredNoteBody, request.body).note),
  );
  app.post<KeyParams>('/v1/missions/:key/cancel', async (request) =>
    cancelMission(ctx(request), request.params.key, parse(reasonBody, request.body).reason),
  );
  app.post<KeyParams>('/v1/missions/:key/activate', async (request) => activateMission(ctx(request), request.params.key));
  app.post<KeyParams>('/v1/missions/:key/complete', async (request) => completeMission(ctx(request), request.params.key));
}
