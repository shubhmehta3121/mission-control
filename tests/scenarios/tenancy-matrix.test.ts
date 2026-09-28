/**
 * Six organisations, every ordered pair (30 directions): nobody can see,
 * reference or staff anything belonging to another organisation — on reads,
 * on writes, and in matcher output.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestWorld, type TestWorld } from '../support/testApp.js';
import { AURORA, KESTREL, VANGUARD, buildOrg, helios } from '../support/scenarioOrgs.js';

interface Tenant {
  slug: string;
  lead: string;
  director: string;
  crew: string;
  skill: string;
  missionKey?: string;
}

const TENANTS: Tenant[] = [
  { slug: 'astra', lead: 'marcus', director: 'ava', crew: 'leo', skill: 'nav' },
  { slug: 'lunar', lead: 'owen', director: 'nora', crew: 'ingrid', skill: 'regolith' },
  { slug: 'kestrel', lead: 'klead', director: 'kdir', crew: 'kara', skill: 'pilot' },
  { slug: 'helios', lead: 'hlead1', director: 'hdir1', crew: 'h01', skill: 'cargo' },
  { slug: 'aurora', lead: 'alead', director: 'adir1', crew: 'anna', skill: 'glacio' },
  { slug: 'vanguard', lead: 'vlead1', director: 'vdir1', crew: 'val', skill: 'weld' },
];

let world: TestWorld;
const skillKeys = new Map<string, Set<string>>();

beforeAll(async () => {
  world = await createTestWorld('tenancy');
  for (const spec of [KESTREL, helios(), AURORA, VANGUARD]) await buildOrg(world.db, spec);
  for (const tenant of TENANTS) {
    const created = await world.as(tenant.lead).post('/v1/missions', {
      title: `${tenant.slug} mission`,
      startDate: '2026-11-01',
      endDate: '2026-11-10',
      roles: [{ name: 'Seat', headcount: 1, skills: [{ skill: tenant.skill, min: 1 }] }],
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    tenant.missionKey = created.body.key;
    const skills = (await world.as(tenant.lead).get('/v1/skills')).body as Array<{ key: string }>;
    skillKeys.set(tenant.slug, new Set(skills.map((skill) => skill.key)));
  }
}, 120_000);

afterAll(async () => {
  await world.close();
});

const pairs = TENANTS.flatMap((from) => TENANTS.filter((to) => to !== from).map((to) => [from, to] as const));

describe('cross-tenant isolation across six organisations', () => {
  it.each(pairs.map(([from, to]) => [from.slug, to.slug, from, to] as const))(
    '%s cannot reach %s',
    async (_fromSlug, _toSlug, from, to) => {
      // Reads: another org's mission key and crew profile do not exist.
      expect((await world.as(from.lead).get(`/v1/missions/${to.missionKey}`)).status).toBe(404);
      expect((await world.as(from.director).get(`/v1/crew/${to.crew}`)).status).toBe(404);
      expect((await world.as(from.crew).get(`/v1/missions/${to.missionKey}`)).status).toBe(404);

      // Writes: another org's crew cannot be nominated; another org's skills cannot be required.
      const nominate = await world.as(from.lead).post(`/v1/missions/${from.missionKey}/nominations`, { role: 'Seat', crew: to.crew });
      expect(nominate.status).toBe(404);
      const foreignOnly = [...skillKeys.get(to.slug)!].find((key) => !skillKeys.get(from.slug)!.has(key));
      if (foreignOnly) {
        const roles = await world.as(from.lead).put(`/v1/missions/${from.missionKey}/roles`, {
          roles: [{ name: 'Seat', headcount: 1, skills: [{ skill: foreignOnly, min: 1 }] }],
        });
        expect(roles.status).toBe(400);
        expect(roles.body.error.details.unknownSkills).toEqual([foreignOnly]);
      }

      // Matcher output never contains another org's people.
      const match = await world.as(from.lead).get(`/v1/missions/${from.missionKey}/match`);
      const everyone = match.body.result.roles.flatMap((roleResult: { ranked: Array<{ handle: string }> }) =>
        roleResult.ranked.map((candidate) => candidate.handle),
      );
      expect(everyone).not.toContain(to.crew);
    },
  );

  it('lists only the caller’s own missions and crew', async () => {
    for (const tenant of TENANTS) {
      const missions = (await world.as(tenant.lead).get('/v1/missions')).body as Array<{ key: string }>;
      expect(missions.map((mission) => mission.key)).toEqual([tenant.missionKey]);
      const crew = (await world.as(tenant.lead).get('/v1/crew')).body as Array<{ handle: string }>;
      const foreign = TENANTS.filter((other) => other !== tenant).map((other) => other.crew);
      expect(crew.map((person) => person.handle).filter((handle) => foreign.includes(handle))).toEqual([]);
    }
  });
});
