import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createStandardMission, createTestWorld, type TestWorld } from '../support/testApp.js';

let world: TestWorld;
beforeEach(async () => {
  world = await createTestWorld('workflow');
});
afterEach(async () => {
  await world.close();
});

/** Creates, nominates (recommended), submits and gets a mission approved. */
async function approvedMission(lead = 'marcus', director = 'ava', overrides: Record<string, unknown> = {}): Promise<string> {
  const key = await createStandardMission(world.as(lead), overrides);
  expect((await world.as(lead).post(`/v1/missions/${key}/nominations`, { recommended: true })).status).toBe(201);
  expect((await world.as(lead).post(`/v1/missions/${key}/submit`)).status).toBe(200);
  expect((await world.as(director).post(`/v1/missions/${key}/approve`, {})).status).toBe(200);
  return key;
}

describe('happy path: draft → nominate → approve → offers → accept → active → completed', () => {
  it('runs end to end, hiding nominations from crew until approval and the roster until active', async () => {
    const marcus = world.as('marcus');
    const key = await createStandardMission(marcus);
    expect(key).toBe('AST-1');

    const match = await marcus.get(`/v1/missions/${key}/match`);
    expect(match.status).toBe(200);
    expect(match.body.result.complete).toBe(true);
    expect(match.body.result.recommendations.map((rec: any) => [rec.roleName, rec.handle])).toEqual([
      ['Pilot', 'leo'],
      ['Engineer', 'sara'],
    ]);
    const engineer = match.body.result.roles.find((role: any) => role.roleName === 'Engineer');
    expect(engineer.funnel).toMatchObject({ unavailable: 1, eligible: 3 }); // dmitri is on leave

    const nominated = await marcus.post(`/v1/missions/${key}/nominations`, { recommended: true });
    expect(nominated.status).toBe(201);
    expect(nominated.body.created).toHaveLength(2);

    // Nominations are invisible to crew.
    expect((await world.as('leo').get('/v1/me/offers')).body).toEqual([]);
    expect((await world.as('leo').get(`/v1/missions/${key}`)).status).toBe(404);

    const submitted = await marcus.post(`/v1/missions/${key}/submit`);
    expect(submitted.body.status).toBe('SUBMITTED');
    expect(submitted.body.review).toMatchObject({ round: 1, decision: 'PENDING' });

    const inbox = await world.as('ava').get('/v1/inbox');
    expect(inbox.body.items[0]).toMatchObject({ kind: 'REVIEW', missionKey: key });

    const approved = await world.as('ava').post(`/v1/missions/${key}/approve`, { note: 'Go.' });
    expect(approved.body).toMatchObject({ status: 'APPROVED', offersSent: 2 });

    const offers = await world.as('leo').get('/v1/me/offers');
    expect(offers.body).toHaveLength(1);
    // Deadline = min(now + 7 days, launch − 14 days) → 2026-10-08T09:00Z
    expect(offers.body[0]).toMatchObject({ key, role: 'Pilot', status: 'OFFERED', expiresAt: '2026-10-08T09:00:00.000Z' });

    expect((await world.as('leo').post(`/v1/me/offers/${key}/accept`)).body).toMatchObject({ status: 'ACCEPTED', crewComplete: false });
    expect((await world.as('leo').get(`/v1/missions/${key}`)).body.roster).toBeNull();
    expect((await world.as('sara').post(`/v1/me/offers/${key}/accept`)).body.crewComplete).toBe(true);

    const leadInbox = await marcus.get('/v1/inbox');
    expect(leadInbox.body.items.map((item: any) => item.kind)).toContain('READY_TO_ACTIVATE');

    expect((await marcus.post(`/v1/missions/${key}/activate`)).body.status).toBe('ACTIVE');
    const crewView = await world.as('leo').get(`/v1/missions/${key}`);
    expect(crewView.body.roster).toEqual([
      { name: 'Leo', role: 'Pilot' },
      { name: 'Sara', role: 'Engineer' },
    ]);
    expect(JSON.stringify(crewView.body)).not.toMatch(/score|breakdown/);

    expect((await marcus.post(`/v1/missions/${key}/complete`)).body.status).toBe('COMPLETED');
    const history = await marcus.get(`/v1/missions/${key}/events`);
    expect(history.body.events.map((event: any) => event.type)).toEqual([
      'MISSION_CREATED',
      'CREW_NOMINATED',
      'MISSION_SUBMITTED',
      'MISSION_APPROVED',
      'OFFERS_SENT',
      'OFFER_ACCEPTED',
      'OFFER_ACCEPTED',
      'MISSION_ACTIVATED',
      'MISSION_COMPLETED',
    ]);
  });

  it('refuses to submit until every seat is nominated, and to activate until every seat is accepted', async () => {
    const marcus = world.as('marcus');
    const key = await createStandardMission(marcus);
    const early = await marcus.post(`/v1/missions/${key}/submit`);
    expect(early.status).toBe(422);
    expect(early.body.error.details.blockers).toEqual(['Pilot: 0/1 seats nominated', 'Engineer: 0/1 seats nominated']);

    await marcus.post(`/v1/missions/${key}/nominations`, { recommended: true });
    await marcus.post(`/v1/missions/${key}/submit`);
    await world.as('ava').post(`/v1/missions/${key}/approve`, {});
    await world.as('leo').post(`/v1/me/offers/${key}/accept`);
    const activate = await marcus.post(`/v1/missions/${key}/activate`);
    expect(activate.status).toBe(422);
    expect(activate.body.error.details.blockers).toEqual(['Engineer: 0/1 accepted']);
  });
});

describe('director decisions', () => {
  it('reject sends the mission back for changes; the lead edits and resubmits (round 2)', async () => {
    const priya = world.as('priya');
    const key = await createStandardMission(priya);
    await priya.post(`/v1/missions/${key}/nominations`, { recommended: true });
    await priya.post(`/v1/missions/${key}/submit`);

    expect((await world.as('ava').post(`/v1/missions/${key}/reject`, {})).status).toBe(400); // note required
    const rejected = await world.as('ava').post(`/v1/missions/${key}/reject`, { note: 'Shorten to two weeks.' });
    expect(rejected.body.status).toBe('REJECTED');

    const inbox = await priya.get('/v1/inbox');
    expect(inbox.body.items[0]).toMatchObject({ kind: 'CHANGES_REQUESTED', detail: 'Ava: "Shorten to two weeks."' });

    expect((await priya.patch(`/v1/missions/${key}`, { endDate: '2026-11-14' })).status).toBe(200);
    const resubmitted = await priya.post(`/v1/missions/${key}/submit`);
    expect(resubmitted.body.review).toMatchObject({ round: 2, decision: 'PENDING' });
    const approved = await world.as('ava').post(`/v1/missions/${key}/approve`, {});
    expect(approved.body.review).toMatchObject({ round: 2, decision: 'APPROVED', decidedBy: { handle: 'ava' } });
  });

  it('cancel withdraws open offers, releases accepted crew, and tells them', async () => {
    const key = await approvedMission();
    await world.as('leo').post(`/v1/me/offers/${key}/accept`);

    expect((await world.as('marcus').post(`/v1/missions/${key}/cancel`, { reason: 'Budget' })).status).toBe(403);
    expect((await world.as('ava').post(`/v1/missions/${key}/cancel`, {})).status).toBe(400);
    const cancelled = await world.as('ava').post(`/v1/missions/${key}/cancel`, { reason: 'Launch vehicle unavailable' });
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', released: 1, withdrawn: 1 });

    const leoInbox = await world.as('leo').get('/v1/inbox');
    expect(leoInbox.body.items[0]).toMatchObject({
      kind: 'UPDATE',
      title: `${key} Europa Survey was cancelled`,
      detail: 'Mission cancelled: Launch vehicle unavailable',
    });
    const saraOffers = await world.as('sara').get('/v1/me/offers');
    expect(saraOffers.body[0]).toMatchObject({ status: 'WITHDRAWN', reason: 'Mission cancelled: Launch vehicle unavailable' });
  });
});

describe('after approval: declines, backfill, conflicts, expiry', () => {
  it('backfills a declined seat with a direct offer — no re-approval', async () => {
    const key = await approvedMission();
    expect((await world.as('sara').post(`/v1/me/offers/${key}/decline`, { reason: 'Family event' })).body.status).toBe('DECLINED');

    const marcus = world.as('marcus');
    const inbox = await marcus.get('/v1/inbox');
    expect(inbox.body.items[0]).toMatchObject({ kind: 'OPEN_SEATS', detail: 'Sara declined' });

    const match = await marcus.get(`/v1/missions/${key}/match`);
    expect(match.body.result.recommendations.map((rec: any) => [rec.roleName, rec.handle])).toEqual([['Engineer', 'tomas']]);

    // Nominating is a draft-only action; after approval the lead offers directly.
    expect((await marcus.post(`/v1/missions/${key}/nominations`, { recommended: true })).status).toBe(409);
    const offered = await marcus.post(`/v1/missions/${key}/offers`, { recommended: true });
    expect(offered.status).toBe(201);
    expect(offered.body.created).toMatchObject([{ role: 'Engineer', handle: 'tomas' }]);
    expect((await world.as('tomas').post(`/v1/me/offers/${key}/accept`)).body.status).toBe('ACCEPTED');
    expect((await marcus.get(`/v1/missions/${key}`)).body.status).toBe('APPROVED');
  });

  it('prevents double booking at accept time and hides the reason from the other lead', async () => {
    const pilotOnly = (title: string, startDate: string, endDate: string) => ({
      title,
      startDate,
      endDate,
      roles: [{ name: 'Pilot', headcount: 1, skills: [{ skill: 'nav', min: 4 }] }],
    });
    const a = (await world.as('marcus').post('/v1/missions', pilotOnly('Alpha', '2026-11-01', '2026-11-30'))).body.key;
    const b = (await world.as('priya').post('/v1/missions', pilotOnly('Bravo', '2026-11-20', '2026-12-20'))).body.key;
    for (const [lead, key] of [['marcus', a], ['priya', b]] as const) {
      await world.as(lead).post(`/v1/missions/${key}/nominations`, { role: 'Pilot', crew: 'yuki' });
      await world.as(lead).post(`/v1/missions/${key}/submit`);
      await world.as('ava').post(`/v1/missions/${key}/approve`, {});
    }
    const yuki = world.as('yuki');
    expect((await yuki.get('/v1/me/offers')).body).toHaveLength(2);
    expect((await yuki.post(`/v1/me/offers/${a}/accept`)).status).toBe(200);

    const clash = await yuki.post(`/v1/me/offers/${b}/accept`);
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe('SCHEDULE_CONFLICT');
    expect(clash.body.error.message).toMatch(new RegExp(`drop out of ${a}`));

    const leadView = await world.as('priya').get(`/v1/missions/${b}`);
    expect(leadView.body.roles[0].seats[0].blocked).toBe('Candidate is no longer available for these dates');
    expect(JSON.stringify(leadView.body)).not.toContain(a);
    const crewOffers = await yuki.get('/v1/me/offers');
    expect(crewOffers.body.find((offer: any) => offer.key === b).blocked).toMatch(new RegExp(`committed to ${a}`));

    // Switching = drop out of the first (counts as a drop-out there), then accept.
    expect((await yuki.post(`/v1/me/offers/${a}/drop`, { reason: 'Prefer Bravo' })).body.status).toBe('DROPPED');
    expect((await yuki.post(`/v1/me/offers/${b}/accept`)).status).toBe(200);
    const alpha = await world.as('marcus').get(`/v1/missions/${a}`);
    expect(alpha.body.roles[0]).toMatchObject({ open: 1, closed: [{ handle: 'yuki', status: 'DROPPED' }] });
  });

  it('expires unanswered offers lazily and keeps the lapsed crew member out of the backfill', async () => {
    const key = await approvedMission();
    world.clock.advanceDays(8); // deadline was 2026-10-08T09:00Z
    const late = await world.as('leo').post(`/v1/me/offers/${key}/accept`);
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('OFFER_EXPIRED');
    expect((await world.as('leo').get('/v1/me/offers')).body[0].status).toBe('EXPIRED');

    const history = await world.as('marcus').get(`/v1/missions/${key}/events`);
    const expired = history.body.events.filter((event: any) => event.type === 'OFFER_EXPIRED');
    expect(expired).toHaveLength(2);
    expect(expired[0].actor).toBeNull();

    const match = await world.as('marcus').get(`/v1/missions/${key}/match?explain=leo`);
    expect(match.body.explanation.roles[0].rejections[0]).toEqual({ code: 'ON_MISSION', detail: "let this mission's offer expire" });
  });

  it('refuses to let crew block out days they are committed to', async () => {
    const key = await approvedMission();
    await world.as('leo').post(`/v1/me/offers/${key}/accept`);
    const blocked = await world.as('leo').post('/v1/me/unavailability', { startDate: '2026-11-10', endDate: '2026-11-12' });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.message).toMatch(new RegExp(`mc offers drop ${key}`));
    expect((await world.as('leo').post('/v1/me/unavailability', { startDate: '2027-01-10', endDate: '2027-01-12' })).status).toBe(201);
  });
});
