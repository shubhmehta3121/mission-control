import type { FastifyInstance } from 'fastify';
import type { ContextFor } from '../app.js';
import { createSkill, getSettings, listSkills, updateSettings } from '../../services/org.js';
import { getCrewMember, listCrew } from '../../services/people.js';
import { createSkillBody, crewQuery, parse, settingsBody } from '../validation.js';

export function registerOrgRoutes(app: FastifyInstance, ctx: ContextFor): void {
  app.get('/v1/org/settings', async (request) => getSettings(ctx(request)));
  app.patch('/v1/org/settings', async (request) => updateSettings(ctx(request), parse(settingsBody, request.body)));

  app.get('/v1/skills', async (request) => listSkills(ctx(request)));
  app.post('/v1/skills', async (request, reply) =>
    reply.status(201).send(await createSkill(ctx(request), parse(createSkillBody, request.body))),
  );

  app.get('/v1/crew', async (request) => listCrew(ctx(request), parse(crewQuery, request.query)));
  app.get<{ Params: { handle: string } }>('/v1/crew/:handle', async (request) =>
    getCrewMember(ctx(request), request.params.handle),
  );
}
