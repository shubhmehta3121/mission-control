/**
 * Randomised workflow simulation: 500 random API actions, by random users,
 * across six organisations, with the clock moving forward. Actions include
 * illegal ones (crew trying to approve, leads probing other orgs). After every
 * step, rules that must always hold are checked against the database:
 *   - no one holds overlapping accepted seats, and rest gaps hold;
 *   - no role goes over headcount; nobody holds two live seats on one mission;
 *   - no request ever fails with a server error (5xx);
 *   - crew responses never contain scores, breakdowns or nominations;
 *   - mission statuses only ever move along the lifecycle table.
 * Fixed seed: a failure prints the step log, and the run is replayable.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { MissionStatus } from '@prisma/client';
import { createTestWorld, type ApiResponse, type TestWorld } from '../support/testApp.js';
import { AURORA, KESTREL, VANGUARD, buildOrg, helios, rng } from '../support/scenarioOrgs.js';

const STEPS = 500;
const SEED = Number(process.env.SIM_SEED ?? 424242); // SIM_SEED=… npm test to explore other histories

const ALLOWED: Record<MissionStatus, MissionStatus[]> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  REJECTED: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

interface OrgPeople {
  id: string;
  slug: string;
  restGapDays: number;
  skills: string[];
  leads: string[];
  directors: string[];
  crew: string[];
}

let world: TestWorld;
let orgs: OrgPeople[] = [];

beforeAll(async () => {
  world = await createTestWorld('simulation');
  for (const spec of [KESTREL, helios(), AURORA, VANGUARD]) await buildOrg(world.db, spec);
  const rows = await world.db.organization.findMany({
    include: { users: true, skills: { include: { holders: { where: { proficiency: { gte: 2 } } } } } },
  });
  orgs = rows.map((org) => ({
    id: org.id,
    slug: org.slug,
    restGapDays: org.restGapDays,
    skills: org.skills.filter((skill) => skill.holders.length > 0).map((skill) => skill.key),
    leads: org.users.filter((user) => user.role === 'MISSION_LEAD').map((user) => user.handle),
    directors: org.users.filter((user) => user.role === 'DIRECTOR').map((user) => user.handle),
    crew: org.users.filter((user) => user.role === 'CREW_MEMBER').map((user) => user.handle),
  }));
}, 120_000);

afterAll(async () => {
  await world.close();
});

describe(`workflow simulation: ${STEPS} random actions across six organisations`, () => {
  it('never breaks an invariant', async () => {
    const random = rng(SEED);
    const pick = <T>(items: readonly T[]): T | undefined => (items.length ? items[Math.floor(random() * items.length)] : undefined);
    const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
    const log: string[] = [];
    const tally = new Map<string, number>();
    const count = (label: string) => tally.set(label, (tally.get(label) ?? 0) + 1);
    const lastStatus = new Map<string, MissionStatus>();

    const call = async (label: string, promise: Promise<ApiResponse>): Promise<ApiResponse> => {
      const response = await promise;
      log.push(`${label} → ${response.status}${response.status >= 400 ? ` ${response.body?.error?.code ?? ''}` : ''}`);
      count(`${label.split(' ')[0]} ${response.status < 400 ? 'ok' : response.status}`);
      expect(response.status, `server error on "${label}"\n${log.slice(-15).join('\n')}`).toBeLessThan(500);
      return response;
    };

    const missionsOf = (org: OrgPeople, statuses?: MissionStatus[]) =>
      world.db.mission.findMany({
        where: { orgId: org.id, ...(statuses ? { status: { in: statuses } } : {}) },
        include: { owner: { select: { handle: true } }, org: { select: { keyPrefix: true } } },
      });
    const keyOf = (mission: { number: number; org: { keyPrefix: string } }) => `${mission.org.keyPrefix}-${mission.number}`;

    for (let step = 0; step < STEPS; step += 1) {
      const org = pick(orgs)!;
      const roll = random();
      const today = world.clock.now().getTime();
      const iso = (offset: number) => new Date(today + offset * 86_400_000).toISOString().slice(0, 10);

      if (roll < 0.12) {
        const lead = pick(org.leads)!;
        const start = int(20, 200);
        const roles = Array.from({ length: int(1, 3) }, (_, index) => ({
          name: `Role ${index + 1}`,
          headcount: int(1, 2),
          skills: [{ skill: pick(org.skills)!, min: int(1, 3) }],
        }));
        await call(`create ${org.slug}`, world.as(lead).post('/v1/missions', { title: `Sim ${step}`, startDate: iso(start), endDate: iso(start + int(2, 40)), roles }));
      } else if (roll < 0.25) {
        const mission = pick(await missionsOf(org, ['DRAFT', 'REJECTED']));
        if (mission) await call(`nominate ${keyOf(mission)}`, world.as(mission.owner.handle).post(`/v1/missions/${keyOf(mission)}/nominations`, { recommended: true, ...(random() < 0.2 ? { reset: true } : {}) }));
      } else if (roll < 0.37) {
        const drafts = await world.db.mission.findMany({
          where: { orgId: org.id, status: { in: ['DRAFT', 'REJECTED'] } },
          include: {
            owner: { select: { handle: true } },
            org: { select: { keyPrefix: true } },
            roles: { include: { assignments: { where: { status: 'PROPOSED' } } } },
          },
        });
        const ready = drafts.filter((draft) => draft.roles.length > 0 && draft.roles.every((r) => r.assignments.length === r.headcount));
        const mission = random() < 0.8 && ready.length ? pick(ready) : pick(drafts);
        if (mission) await call(`submit ${keyOf(mission)}`, world.as(mission.owner.handle).post(`/v1/missions/${keyOf(mission)}/submit`));
      } else if (roll < 0.5) {
        const mission = pick(await missionsOf(org, ['SUBMITTED']));
        const director = pick(org.directors)!;
        if (mission) {
          const decision = random();
          if (decision < 0.72) await call(`approve ${keyOf(mission)}`, world.as(director).post(`/v1/missions/${keyOf(mission)}/approve`, {}));
          else if (decision < 0.95) await call(`reject ${keyOf(mission)}`, world.as(director).post(`/v1/missions/${keyOf(mission)}/reject`, { note: 'Try again' }));
          else await call(`cancel ${keyOf(mission)}`, world.as(director).post(`/v1/missions/${keyOf(mission)}/cancel`, { reason: 'Sim' }));
        }
      } else if (roll < 0.7) {
        const withOffers = await world.db.assignment.findMany({ where: { status: 'OFFERED' }, include: { user: { select: { handle: true } } } });
        const handle = random() < 0.8 && withOffers.length ? pick(withOffers)!.user.handle : pick(org.crew)!;
        const offers = (await call(`offers ${handle}`, world.as(handle).get('/v1/me/offers'))).body as Array<{ key: string; status: string }>;
        expect(JSON.stringify(offers), 'crew payload leaked scores').not.toMatch(/"score"|breakdown|PROPOSED/);
        const open = pick(offers.filter((offer) => offer.status === 'OFFERED'));
        if (open) {
          if (random() < 0.75) await call(`accept ${open.key} ${handle}`, world.as(handle).post(`/v1/me/offers/${open.key}/accept`));
          else await call(`decline ${open.key} ${handle}`, world.as(handle).post(`/v1/me/offers/${open.key}/decline`, {}));
        }
      } else if (roll < 0.73) {
        const handle = pick(org.crew)!;
        const offers = (await world.as(handle).get('/v1/me/offers')).body as Array<{ key: string; status: string; missionStatus: string }>;
        const accepted = pick(offers.filter((offer) => offer.status === 'ACCEPTED' && ['APPROVED', 'ACTIVE'].includes(offer.missionStatus)));
        if (accepted) await call(`drop ${accepted.key} ${handle}`, world.as(handle).post(`/v1/me/offers/${accepted.key}/drop`, { reason: 'Sim' }));
      } else if (roll < 0.82) {
        const mission = pick(await missionsOf(org, ['APPROVED', 'ACTIVE']));
        if (mission) {
          const lead = world.as(mission.owner.handle);
          if (random() < 0.5) await call(`backfill ${keyOf(mission)}`, lead.post(`/v1/missions/${keyOf(mission)}/offers`, { recommended: true }));
          else if (mission.status === 'APPROVED') await call(`activate ${keyOf(mission)}`, lead.post(`/v1/missions/${keyOf(mission)}/activate`));
          else await call(`complete ${keyOf(mission)}`, lead.post(`/v1/missions/${keyOf(mission)}/complete`));
        }
      } else if (roll < 0.85) {
        const mission = pick(await missionsOf(org, ['APPROVED', 'ACTIVE']));
        if (mission) {
          const offered = await world.db.assignment.findFirst({ where: { missionId: mission.id, status: 'OFFERED' }, include: { user: true } });
          if (offered) await call(`retract ${keyOf(mission)}`, world.as(mission.owner.handle).post(`/v1/missions/${keyOf(mission)}/offers/${offered.user.handle}/retract`));
        }
      } else if (roll < 0.89) {
        const handle = pick(org.crew)!;
        const start = int(10, 250);
        await call(`unavailable ${handle}`, world.as(handle).post('/v1/me/unavailability', { startDate: iso(start), endDate: iso(start + int(0, 10)) }));
      } else if (roll < 0.91) {
        const mission = pick(await missionsOf(org, ['DRAFT', 'SUBMITTED', 'REJECTED', 'APPROVED', 'ACTIVE']));
        if (mission) await call(`cancel ${keyOf(mission)}`, world.as(pick(org.directors)!).post(`/v1/missions/${keyOf(mission)}/cancel`, { reason: 'Sim cancel' }));
      } else if (roll < 0.96) {
        // Illegal probes: crew trying to approve; a lead reaching into another org.
        const mission = pick(await missionsOf(org));
        if (mission) {
          const crewTry = await call(`illegal-approve ${keyOf(mission)}`, world.as(pick(org.crew)!).post(`/v1/missions/${keyOf(mission)}/approve`, {}));
          expect([403, 404]).toContain(crewTry.status);
          const outsider = pick(orgs.filter((other) => other.id !== org.id))!;
          const probe = await call(`illegal-probe ${keyOf(mission)}`, world.as(pick(outsider.leads)!).get(`/v1/missions/${keyOf(mission)}`));
          expect(probe.status).toBe(404);
        }
      } else {
        world.clock.advanceDays(int(0, 3));
        log.push(`clock → ${world.clock.now().toISOString().slice(0, 10)}`);
      }

      // ── Invariants, checked against the database after every step ──
      const context = () => `after step ${step}\n${log.slice(-12).join('\n')}`;
      const missions = await world.db.mission.findMany();
      for (const mission of missions) {
        const before = lastStatus.get(mission.id);
        if (before && before !== mission.status) {
          expect(ALLOWED[before], `illegal transition ${before} → ${mission.status} ${context()}`).toContain(mission.status);
        }
        lastStatus.set(mission.id, mission.status);
      }

      const seats = await world.db.assignment.findMany({ include: { mission: true, role: true } });
      const live = seats.filter((seat) => ['PROPOSED', 'OFFERED', 'ACCEPTED'].includes(seat.status) && seat.kind === 'PRIMARY');
      const perRole = new Map<string, { live: number; accepted: number; headcount: number }>();
      const perPersonMission = new Set<string>();
      for (const seat of live) {
        const entry = perRole.get(seat.roleId) ?? { live: 0, accepted: 0, headcount: seat.role.headcount };
        entry.live += 1;
        if (seat.status === 'ACCEPTED') entry.accepted += 1;
        perRole.set(seat.roleId, entry);
        const pair = `${seat.userId}:${seat.missionId}`;
        expect(perPersonMission.has(pair), `two live seats on one mission ${context()}`).toBe(false);
        perPersonMission.add(pair);
      }
      for (const entry of perRole.values()) {
        expect(entry.live, `live seats over headcount ${context()}`).toBeLessThanOrEqual(entry.headcount);
        expect(entry.accepted, `accepted over headcount ${context()}`).toBeLessThanOrEqual(entry.headcount);
      }

      const committed = seats.filter(
        (seat) => seat.status === 'ACCEPTED' && seat.kind === 'PRIMARY' && ['APPROVED', 'ACTIVE', 'COMPLETED'].includes(seat.mission.status),
      );
      const byPerson = new Map<string, typeof committed>();
      for (const seat of committed) byPerson.set(seat.userId, [...(byPerson.get(seat.userId) ?? []), seat]);
      for (const personSeats of byPerson.values()) {
        const sorted = personSeats.sort((a, b) => a.mission.startDate.getTime() - b.mission.startDate.getTime());
        const restGap = orgs.find((entry) => entry.id === sorted[0]!.orgId)!.restGapDays;
        for (let i = 1; i < sorted.length; i += 1) {
          const gapDays = (sorted[i]!.mission.startDate.getTime() - sorted[i - 1]!.mission.endDate.getTime()) / 86_400_000 - 1;
          expect(gapDays, `overlap or rest-gap breach ${context()}`).toBeGreaterThanOrEqual(restGap);
        }
      }
    }

    // The simulation must actually have exercised the flows, not just bounced off errors.
    const ok = (label: string) => tally.get(`${label} ok`) ?? 0;
    const summary = JSON.stringify(Object.fromEntries([...tally].sort()), null, 1);
    expect(ok('create'), summary).toBeGreaterThan(30);
    expect(ok('submit'), summary).toBeGreaterThan(5);
    expect(ok('approve'), summary).toBeGreaterThan(3);
    expect(ok('accept'), summary).toBeGreaterThan(5);
  }, 300_000);
});
