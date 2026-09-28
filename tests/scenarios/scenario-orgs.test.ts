/**
 * Four scenario organisations, each built around one kind of pressure.
 *   Kestrel  — tiny: seats nobody can fill, declines until nobody qualifies,
 *              back-to-back missions (rest gap 0), a director's own mission.
 *   Helios   — large: 60 crew, 12 skills, 15 overlapping multi-seat missions.
 *   Aurora   — long duration: 45-day rest gap, 2-day offers, leap day, New Year.
 *   Vanguard — high churn: messy availability, overlapping offers, rejections.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createTestWorld, type TestWorld } from '../support/testApp.js';
import { missionRow, seatStatuses } from '../support/flows.js';
import { AURORA, KESTREL, VANGUARD, buildOrg, commitCrew, helios, heliosMissions } from '../support/scenarioOrgs.js';

let world: TestWorld | null = null;
afterEach(async () => {
  await world?.close();
  world = null;
});

async function worldWith(...specs: Parameters<typeof buildOrg>[1][]): Promise<TestWorld> {
  world = await createTestWorld('scenario');
  for (const spec of specs) await buildOrg(world.db, spec);
  return world;
}

type Role = { name: string; headcount: number; skills: Array<{ skill: string; min: number }> };
const role = (name: string, headcount: number, skills: Record<string, number>): Role => ({
  name,
  headcount,
  skills: Object.entries(skills).map(([skill, min]) => ({ skill, min })),
});

async function create(w: TestWorld, lead: string, title: string, startDate: string, endDate: string, roles: Role[]): Promise<string> {
  const response = await w.as(lead).post('/v1/missions', { title, startDate, endDate, roles });
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  return response.body.key as string;
}

async function approveWith(w: TestWorld, lead: string, director: string, key: string, nominations: Array<Record<string, unknown>>) {
  for (const body of nominations) {
    const nominated = await w.as(lead).post(`/v1/missions/${key}/nominations`, body);
    expect(nominated.status, JSON.stringify(nominated.body)).toBe(201);
  }
  const submitted = await w.as(lead).post(`/v1/missions/${key}/submit`);
  expect(submitted.status, JSON.stringify(submitted.body)).toBe(200);
  const approved = await w.as(director).post(`/v1/missions/${key}/approve`, {});
  expect(approved.status, JSON.stringify(approved.body)).toBe(200);
  return approved.body;
}

describe('Kestrel Orbital — a tiny startup', () => {
  it('explains exactly why seats cannot be filled, and who is close', async () => {
    const w = await worldWith(KESTREL);
    const key = await create(w, 'klead', 'Big Burn', '2026-11-01', '2026-11-10', [
      role('Pilot', 1, { pilot: 4 }),
      role('Engineer', 2, { eng: 3 }),
      role('Medic', 1, { med: 4 }),
    ]);
    const match = (await w.as('klead').get(`/v1/missions/${key}/match`)).body.result;
    expect(match.complete).toBe(false);
    expect(match.recommendations.map((rec: { roleName: string; handle: string }) => [rec.roleName, rec.handle])).toEqual([
      ['Pilot', 'kara'],
      ['Engineer', 'kobe'],
    ]);
    expect(match.unfilled.map((gap: { roleName: string; seats: number; reason: string }) => [gap.roleName, gap.seats, gap.reason])).toEqual([
      ['Engineer', 1, 'only 1 eligible for 2 open seats'],
      ['Medic', 1, 'no eligible crew (3 lack the skills)'],
    ]);
    const medic = match.roles.find((entry: { roleName: string }) => entry.roleName === 'Medic');
    expect(medic.nearMisses).toMatchObject([{ handle: 'kira', detail: 'Flight Medicine 3 (needs 4)' }]);
  });

  it('keeps backfilling after declines until nobody qualifies, then says why', async () => {
    const w = await worldWith(KESTREL);
    const key = await create(w, 'klead', 'Hop', '2026-11-01', '2026-11-05', [role('Pilot', 1, { pilot: 3 })]);
    await approveWith(w, 'klead', 'kdir', key, [{ recommended: true }]);
    expect((await w.as('kara').post(`/v1/me/offers/${key}/decline`, { reason: 'Sick' })).status).toBe(200);
    const second = await w.as('klead').post(`/v1/missions/${key}/offers`, { recommended: true });
    expect(second.body.created).toMatchObject([{ handle: 'kira' }]);
    expect((await w.as('kira').post(`/v1/me/offers/${key}/decline`, {})).status).toBe(200);
    const last = (await w.as('klead').get(`/v1/missions/${key}/match`)).body.result;
    expect(last.unfilled[0].reason).toBe('no eligible crew (1 lack the skills, 2 already on or out of this mission)');
  });

  it('allows back-to-back missions when the rest gap is 0, but never overlapping ones', async () => {
    const w = await worldWith(KESTREL);
    const engineer = [role('Engineer', 1, { eng: 3 })];
    const first = await create(w, 'klead', 'Leg A', '2026-11-01', '2026-11-10', engineer);
    await approveWith(w, 'klead', 'kdir', first, [{ role: 'Engineer', crew: 'kobe' }]);
    expect((await w.as('kobe').post(`/v1/me/offers/${first}/accept`)).status).toBe(200);

    const next = await create(w, 'klead', 'Leg B', '2026-11-11', '2026-11-20', engineer);
    await approveWith(w, 'klead', 'kdir', next, [{ role: 'Engineer', crew: 'kobe' }]);
    expect((await w.as('kobe').post(`/v1/me/offers/${next}/accept`)).status).toBe(200);

    const overlap = await create(w, 'klead', 'Leg C', '2026-11-10', '2026-11-12', engineer);
    const refused = await w.as('klead').post(`/v1/missions/${overlap}/nominations`, { role: 'Engineer', crew: 'kobe' });
    expect(refused.status).toBe(422);
    expect(refused.body.error.message).toMatch(new RegExp(`committed to ${first}`));
  });

  it("makes a director's own mission a visible dead end when there is no second director", async () => {
    const w = await worldWith(KESTREL);
    const key = await create(w, 'kdir', 'Director special', '2026-11-01', '2026-11-05', [role('Pilot', 1, { pilot: 4 })]);
    await w.as('kdir').post(`/v1/missions/${key}/nominations`, { recommended: true });
    expect((await w.as('kdir').post(`/v1/missions/${key}/submit`)).status).toBe(200);
    expect((await w.as('kdir').post(`/v1/missions/${key}/approve`, {})).body.error.code).toBe('CANNOT_APPROVE_OWN');
    expect((await w.as('klead').post(`/v1/missions/${key}/approve`, {})).status).toBe(403);
    const view = await w.as('kdir').get(`/v1/missions/${key}`);
    expect(view.body.allowedActions.map((entry: { action: string }) => entry.action)).toEqual(['match', 'cancel']);
    expect((await w.as('kdir').get('/v1/inbox')).body.items).toMatchObject([{ kind: 'NO_REVIEWER', missionKey: key }]);
  });
});

describe('Helios Deep Space — a large agency', () => {
  it('staffs 15 overlapping multi-seat missions in turn without a single double booking', async () => {
    const w = await worldWith(helios());
    const directors = ['hdir1', 'hdir2', 'hdir3'];
    let acceptFailures = 0;
    let seatsFilled = 0;
    let seatsRequested = 0;
    let slowestMatchMs = 0;

    for (const [index, plan] of heliosMissions().entries()) {
      const key = await create(w, plan.lead, plan.title, plan.startDate, plan.endDate, plan.roles);
      seatsRequested += plan.roles.reduce((acc, entry) => acc + entry.headcount, 0);
      const started = performance.now();
      const match = (await w.as(plan.lead).get(`/v1/missions/${key}/match`)).body.result;
      slowestMatchMs = Math.max(slowestMatchMs, performance.now() - started);
      for (const gap of match.unfilled) expect(gap.reason.length).toBeGreaterThan(0); // every gap is explained
      if (match.recommendations.length === 0) continue;

      await w.as(plan.lead).post(`/v1/missions/${key}/nominations`, { recommended: true });
      const submit = await w.as(plan.lead).post(`/v1/missions/${key}/submit`);
      if (submit.status !== 200) continue; // a mission that cannot be fully staffed stays a draft — correct behaviour
      await w.as(directors[index % 3]!).post(`/v1/missions/${key}/approve`, {});
      for (const rec of match.recommendations as Array<{ handle: string }>) {
        const accept = await w.as(rec.handle).post(`/v1/me/offers/${key}/accept`);
        if (accept.status === 200) seatsFilled += 1;
        else acceptFailures += 1;
      }
    }

    // Staffed one after another, the matcher always sees earlier commitments, so nobody is ever offered a clash.
    expect(acceptFailures).toBe(0);
    expect(seatsFilled).toBeGreaterThan(0);
    expect(seatsFilled).toBeLessThanOrEqual(seatsRequested);
    expect(slowestMatchMs).toBeLessThan(1500);

    // Database-level invariants across the whole org.
    const accepted = await w.db.assignment.findMany({
      where: { status: 'ACCEPTED', kind: 'PRIMARY', mission: { org: { slug: 'helios' } } },
      include: { mission: true, role: true },
    });
    const byPerson = new Map<string, typeof accepted>();
    for (const seat of accepted) byPerson.set(seat.userId, [...(byPerson.get(seat.userId) ?? []), seat]);
    for (const seats of byPerson.values()) {
      const sorted = seats.sort((a, b) => a.mission.startDate.getTime() - b.mission.startDate.getTime());
      for (let i = 1; i < sorted.length; i += 1) {
        const gapDays = (sorted[i]!.mission.startDate.getTime() - sorted[i - 1]!.mission.endDate.getTime()) / 86_400_000 - 1;
        expect(gapDays).toBeGreaterThanOrEqual(14); // no overlap, and the 14-day rest gap holds
      }
    }
    const perRole = new Map<string, number>();
    for (const seat of accepted) perRole.set(seat.roleId, (perRole.get(seat.roleId) ?? 0) + 1);
    for (const seat of accepted) expect(perRole.get(seat.roleId)).toBeLessThanOrEqual(seat.role.headcount);
  });
});

describe('Aurora Polar Station — long-duration missions', () => {
  it('handles a winter-over across New Year and Feb 29, a 45-day rest gap, and a year-long workload horizon', async () => {
    const w = await worldWith(AURORA);
    const anna = await commitCrew(w.db, { orgSlug: 'aurora', owner: 'alead', title: 'Summer season', start: '2027-06-01', end: '2027-11-01', crew: [['anna', 'glacio']] });
    const arne = await commitCrew(w.db, { orgSlug: 'aurora', owner: 'alead', title: 'Late season', start: '2027-06-01', end: '2027-11-10', crew: [['arne', 'glacio']] });
    const key = await create(w, 'alead', 'Winter-over 2028', '2027-12-20', '2028-06-15', [
      role('Glaciologist', 1, { glacio: 4 }),
      role('Mechanic', 1, { mech: 4 }),
      role('Medic', 1, { medic: 4 }),
    ]);
    const view = await w.as('alead').get(`/v1/missions/${key}`);
    expect(view.body.days).toBe(179); // Dec 20 → Jun 15 inclusive, counting Feb 29 2028

    const arneWhy = (await w.as('alead').get(`/v1/missions/${key}/match?explain=arne`)).body.explanation;
    expect(arneWhy.roles[0].rejections).toEqual([{ code: 'REST_GAP', detail: `only 39 rest days around ${arne} (org requires 45)` }]);
    const annaWhy = (await w.as('alead').get(`/v1/missions/${key}/match?explain=anna`)).body.explanation;
    expect(annaWhy.roles[0]).toMatchObject({ eligible: true, seatedHere: true });
    expect(annaWhy.roles[0].breakdown.facts).toMatchObject({ horizonDays: 359, committedDays: 42 });
    expect(anna).toBe('AUR-1');
  });

  it('gives only 24 hours on a short-notice mission and warns the director', async () => {
    const w = await worldWith(AURORA);
    const key = await create(w, 'alead', 'Emergency resupply', '2026-10-11', '2026-10-20', [role('Mechanic', 1, { mech: 4 })]);
    const approved = await approveWith(w, 'alead', 'adir1', key, [{ recommended: true }]);
    expect(approved.warnings[0]).toMatch(/crew only have 24 hours/);
    expect((await w.as('asha').get('/v1/me/offers')).body[0].expiresAt).toBe('2026-10-02T09:00:00.000Z');
  });

  it('expires offers mid-flow with a 2-day response window', async () => {
    const w = await worldWith(AURORA);
    const key = await create(w, 'alead', 'Spring traverse', '2027-03-01', '2027-03-20', [
      role('Medic', 1, { medic: 4 }),
      role('Mechanic', 1, { mech: 4 }),
    ]);
    await approveWith(w, 'alead', 'adir1', key, [{ recommended: true }]);
    w.clock.advanceDays(1);
    expect((await w.as('axel').post(`/v1/me/offers/${key}/accept`)).status).toBe(200);
    w.clock.advanceDays(1); // exactly at the deadline
    expect((await w.as('asha').post(`/v1/me/offers/${key}/accept`)).body.error.code).toBe('OFFER_EXPIRED');
    const inbox = await w.as('alead').get('/v1/inbox');
    expect(inbox.body.items[0]).toMatchObject({ kind: 'OPEN_SEATS', detail: 'Asha expired' });
  });
});

describe('Vanguard Contractors — high churn', () => {
  it('counts unavailability that touches the first or last day, but not the day before', async () => {
    const w = await worldWith(VANGUARD);
    const key = await create(w, 'vlead1', 'Ridge rig', '2026-12-01', '2026-12-10', [role('Rigger', 1, { rig: 3 }), role('Driver', 1, { drive: 3 })]);
    const why = async (handle: string) => (await w.as('vlead1').get(`/v1/missions/${key}/match?explain=${handle}`)).body.explanation;
    expect((await why('veda')).roles[0].rejections).toEqual([{ code: 'UNAVAILABLE', detail: 'unavailable 2026-11-25 → 2026-12-01' }]);
    expect((await why('vito')).roles[1].rejections).toEqual([{ code: 'UNAVAILABLE', detail: 'unavailable 2026-12-10 → 2026-12-15' }]);
    expect((await why('vox')).roles[1].eligible).toBe(true);
  });

  it('lets one person hold three overlapping offers, accept one, and have the rest backfilled', async () => {
    const w = await worldWith(VANGUARD);
    const welder = [role('Welder', 1, { weld: 4 })];
    const m1 = await create(w, 'vlead1', 'Weld A', '2027-01-05', '2027-01-15', welder);
    const m2 = await create(w, 'vlead2', 'Weld B', '2027-01-10', '2027-01-20', welder);
    const m3 = await create(w, 'vlead1', 'Weld C', '2027-01-12', '2027-01-25', welder);
    for (const [lead, key] of [['vlead1', m1], ['vlead2', m2], ['vlead1', m3]] as const) {
      await approveWith(w, lead, 'vdir1', key, [{ role: 'Welder', crew: 'vic' }]);
    }
    expect((await w.as('vic').get('/v1/me/offers')).body.filter((offer: { status: string }) => offer.status === 'OFFERED')).toHaveLength(3);
    expect((await w.as('vic').post(`/v1/me/offers/${m2}/accept`)).status).toBe(200);
    const blocked = (await w.as('vic').get('/v1/me/offers')).body.filter((offer: { blocked: string | null }) => offer.blocked);
    expect(blocked.map((offer: { key: string }) => offer.key).sort()).toEqual([m1, m3].sort());
    const leadInbox = await w.as('vlead1').get('/v1/inbox');
    expect(leadInbox.body.items.filter((item: { kind: string }) => item.kind === 'BLOCKED_OFFER')).toHaveLength(2);

    await w.as('vlead1').post(`/v1/missions/${m1}/offers/vic/retract`);
    expect((await w.as('vlead1').post(`/v1/missions/${m1}/offers`, { recommended: true })).body.created).toMatchObject([{ handle: 'vance' }]);
    expect((await w.as('vance').post(`/v1/me/offers/${m1}/accept`)).status).toBe(200);
    expect(await seatStatuses(w, m1, 'Welder')).toEqual({ vic: 'WITHDRAWN', vance: 'ACCEPTED' });
  });

  it('keeps the full history through three reject → resubmit rounds', async () => {
    const w = await worldWith(VANGUARD);
    const key = await create(w, 'vlead2', 'Comms mast', '2027-02-01', '2027-02-05', [role('Comms', 1, { comms: 4 })]);
    await w.as('vlead2').post(`/v1/missions/${key}/nominations`, { recommended: true });
    for (const round of [1, 2, 3]) {
      expect((await w.as('vlead2').post(`/v1/missions/${key}/submit`)).status).toBe(200);
      expect((await w.as('vdir1').post(`/v1/missions/${key}/reject`, { note: `Round ${round}: not yet` })).status).toBe(200);
      await w.as('vlead2').patch(`/v1/missions/${key}`, { description: `Revision ${round}` });
    }
    await w.as('vlead2').post(`/v1/missions/${key}/submit`);
    await w.as('vdir2').post(`/v1/missions/${key}/approve`, {});
    const view = await w.as('vlead2').get(`/v1/missions/${key}`);
    expect(view.body.reviews.map((review: { round: number; decision: string }) => `${review.round}:${review.decision}`)).toEqual([
      '4:APPROVED',
      '3:REJECTED',
      '2:REJECTED',
      '1:REJECTED',
    ]);
  });

  it('backfills through a chain of declines and records every step', async () => {
    const w = await worldWith(VANGUARD);
    const key = await create(w, 'vlead1', 'Crane lift', '2027-02-10', '2027-02-14', [role('Rigger', 1, { rig: 3 })]);
    await approveWith(w, 'vlead1', 'vdir1', key, [{ recommended: true }]);
    expect((await w.as('veda').post(`/v1/me/offers/${key}/decline`, {})).status).toBe(200);
    expect((await w.as('vlead1').post(`/v1/missions/${key}/offers`, { recommended: true })).body.created[0].handle).toBe('val');
    expect((await w.as('val').post(`/v1/me/offers/${key}/decline`, {})).status).toBe(200);
    expect((await w.as('vlead1').post(`/v1/missions/${key}/offers`, { recommended: true })).body.created[0].handle).toBe('vito');
    expect((await w.as('vito').post(`/v1/me/offers/${key}/accept`)).status).toBe(200);
    const history = (await w.as('vlead1').get(`/v1/missions/${key}/events`)).body.events.map((event: { type: string }) => event.type);
    expect(history.filter((type: string) => type === 'OFFER_DECLINED')).toHaveLength(2);
    expect(history.filter((type: string) => type === 'OFFER_SENT')).toHaveLength(2);
    expect(history.at(-1)).toBe('OFFER_ACCEPTED');
  });

  it('cancelling an approved mission releases, withdraws, and leaves declines alone', async () => {
    const w = await worldWith(VANGUARD);
    const key = await create(w, 'vlead1', 'Mixed seats', '2027-03-01', '2027-03-05', [
      role('Rigger', 1, { rig: 4 }),
      role('Welder', 1, { weld: 4 }),
      role('Driver', 1, { drive: 4 }),
    ]);
    await approveWith(w, 'vlead1', 'vdir1', key, [{ recommended: true }]);
    const staffing = (await w.as('vlead1').get(`/v1/missions/${key}`)).body.roles;
    const [rigger, welder, driver] = staffing.map((entry: { seats: Array<{ handle: string }> }) => entry.seats[0]!.handle);
    await w.as(rigger).post(`/v1/me/offers/${key}/accept`);
    await w.as(welder).post(`/v1/me/offers/${key}/decline`, {});
    const cancelled = await w.as('vdir2').post(`/v1/missions/${key}/cancel`, { reason: 'Client pulled out' });
    expect(cancelled.body).toMatchObject({ released: 1, withdrawn: 1 });
    expect((await seatStatuses(w, key, 'Rigger'))[rigger]).toBe('RELEASED');
    expect((await seatStatuses(w, key, 'Welder'))[welder]).toBe('DECLINED');
    expect((await seatStatuses(w, key, 'Driver'))[driver]).toBe('WITHDRAWN');
    expect((await missionRow(w, key)).status).toBe('CANCELLED');
  });

  it("lets the second director approve the first director's own mission", async () => {
    const w = await worldWith(VANGUARD);
    const key = await create(w, 'vdir1', 'Director-led', '2027-04-01', '2027-04-03', [role('Driver', 1, { drive: 4 })]);
    await w.as('vdir1').post(`/v1/missions/${key}/nominations`, { recommended: true });
    await w.as('vdir1').post(`/v1/missions/${key}/submit`);
    expect((await w.as('vdir1').post(`/v1/missions/${key}/approve`, {})).body.error.code).toBe('CANNOT_APPROVE_OWN');
    expect((await w.as('vdir2').post(`/v1/missions/${key}/approve`, {})).body.status).toBe('APPROVED');
  });
});
