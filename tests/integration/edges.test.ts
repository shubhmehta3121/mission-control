/**
 * Regression tests for the edge cases the audit listed (AUDIT.md §6, §9):
 * double responses, cancel from every state, drop-out while ACTIVE, deadline
 * caps, per-org rest gaps, exact seat counts, validation and privacy details.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createStandardMission, createTestWorld, type TestWorld } from '../support/testApp.js';
import { activeMission, approvedMission, forceSeat, missionRow, seatStatuses } from '../support/flows.js';

let world: TestWorld;
beforeEach(async () => {
  world = await createTestWorld('edges');
});
afterEach(async () => {
  await world.close();
});

describe('responding to offers', () => {
  it('rejects a second accept, a second decline, and accept after decline with ALREADY_RESPONDED', async () => {
    const key = await approvedMission(world);
    expect((await world.as('leo').post(`/v1/me/offers/${key}/accept`)).status).toBe(200);
    const again = await world.as('leo').post(`/v1/me/offers/${key}/accept`);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_RESPONDED');

    expect((await world.as('sara').post(`/v1/me/offers/${key}/decline`, {})).status).toBe(200);
    expect((await world.as('sara').post(`/v1/me/offers/${key}/decline`, {})).body.error.code).toBe('ALREADY_RESPONDED');
    expect((await world.as('sara').post(`/v1/me/offers/${key}/accept`)).body.error.code).toBe('ALREADY_RESPONDED');

    const mission = await missionRow(world, key);
    const accepts = await world.db.missionEvent.count({ where: { missionId: mission.id, type: 'OFFER_ACCEPTED' } });
    expect(accepts).toBe(1);
  });

  it('allows declining without a reason but requires one to drop out', async () => {
    const key = await approvedMission(world);
    expect((await world.as('sara').post(`/v1/me/offers/${key}/decline`, {})).status).toBe(200);
    await world.as('leo').post(`/v1/me/offers/${key}/accept`);
    expect((await world.as('leo').post(`/v1/me/offers/${key}/drop`, {})).status).toBe(400);
    expect((await seatStatuses(world, key, 'Pilot')).leo).toBe('ACCEPTED');
  });

  it('treats an offer as expired at the exact deadline instant', async () => {
    const key = await approvedMission(world);
    const offers = await world.as('leo').get('/v1/me/offers');
    world.clock.set(offers.body[0].expiresAt);
    const late = await world.as('leo').post(`/v1/me/offers/${key}/accept`);
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('OFFER_EXPIRED');
  });

  it('refuses responses once the mission is cancelled', async () => {
    const key = await approvedMission(world);
    await world.as('ava').post(`/v1/missions/${key}/cancel`, { reason: 'Scrubbed' });
    const response = await world.as('leo').post(`/v1/me/offers/${key}/accept`);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('never lets a role go over headcount, even if a second live offer exists for the seat', async () => {
    const key = await approvedMission(world);
    await forceSeat(world, key, 'Pilot', 'yuki', 'OFFERED'); // the aftermath of a race the API now prevents
    expect((await world.as('leo').post(`/v1/me/offers/${key}/accept`)).status).toBe(200);
    const second = await world.as('yuki').post(`/v1/me/offers/${key}/accept`);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('ROLE_FILLED');
  });
});

describe('mission lifecycle edges', () => {
  it('cancels from DRAFT, SUBMITTED, REJECTED and ACTIVE', async () => {
    const draft = await createStandardMission(world.as('marcus'));
    expect((await world.as('ava').post(`/v1/missions/${draft}/cancel`, { reason: 'Not needed' })).body.status).toBe('CANCELLED');

    const submitted = await createStandardMission(world.as('marcus'));
    await world.as('marcus').post(`/v1/missions/${submitted}/nominations`, { recommended: true });
    await world.as('marcus').post(`/v1/missions/${submitted}/submit`);
    expect((await world.as('ava').post(`/v1/missions/${submitted}/cancel`, { reason: 'Budget' })).body.review.decision).toBe('CANCELLED');
    const inbox = await world.as('ava').get('/v1/inbox');
    expect(inbox.body.items.map((item: { missionKey: string }) => item.missionKey)).not.toContain(submitted);

    const rejected = await createStandardMission(world.as('priya'));
    await world.as('priya').post(`/v1/missions/${rejected}/nominations`, { recommended: true });
    await world.as('priya').post(`/v1/missions/${rejected}/submit`);
    await world.as('ava').post(`/v1/missions/${rejected}/reject`, { note: 'Rethink' });
    expect((await world.as('ava').post(`/v1/missions/${rejected}/cancel`, { reason: 'Shelved' })).body.status).toBe('CANCELLED');

    const active = await activeMission(world, { overrides: { title: 'Active one' } });
    const cancelled = await world.as('ava').post(`/v1/missions/${active}/cancel`, { reason: 'Medical evacuation' });
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', released: 2, withdrawn: 0 });
    expect(await seatStatuses(world, active, 'Pilot')).toEqual({ leo: 'RELEASED' });
    const leoInbox = await world.as('leo').get('/v1/inbox');
    expect(leoInbox.body.items.find((item: { missionKey: string }) => item.missionKey === active)).toMatchObject({
      kind: 'UPDATE',
      detail: 'Mission cancelled: Medical evacuation',
    });
  });

  it('lets a director complete a lead’s mission, but not before it is active', async () => {
    const approved = await approvedMission(world);
    expect((await world.as('marcus').post(`/v1/missions/${approved}/complete`)).status).toBe(409);
    await world.as('leo').post(`/v1/me/offers/${approved}/accept`);
    await world.as('sara').post(`/v1/me/offers/${approved}/accept`);
    await world.as('marcus').post(`/v1/missions/${approved}/activate`);
    expect((await world.as('ava').post(`/v1/missions/${approved}/complete`)).body.status).toBe('COMPLETED');
  });

  it('refuses double submit, submit without roles, and edits while under review', async () => {
    const empty = await createStandardMission(world.as('marcus'), { roles: undefined, title: 'Empty' });
    const noRoles = await world.as('marcus').post(`/v1/missions/${empty}/submit`);
    expect(noRoles.status).toBe(422);
    expect(noRoles.body.error.details.blockers).toContain('Add at least one role (`mc missions roles set`).');

    const key = await createStandardMission(world.as('marcus'));
    await world.as('marcus').post(`/v1/missions/${key}/nominations`, { recommended: true });
    expect((await world.as('marcus').post(`/v1/missions/${key}/submit`)).status).toBe(200);
    expect((await world.as('marcus').post(`/v1/missions/${key}/submit`)).body.error.code).toBe('INVALID_TRANSITION');
    expect((await world.as('marcus').patch(`/v1/missions/${key}`, { title: 'Sneaky' })).body.error.code).toBe('INVALID_TRANSITION');
    const mission = await missionRow(world, key);
    expect(await world.db.missionSubmission.count({ where: { missionId: mission.id } })).toBe(1);
  });

  it('rejects every change to a completed or cancelled mission', async () => {
    const done = await activeMission(world);
    await world.as('marcus').post(`/v1/missions/${done}/complete`);
    const scrapped = await createStandardMission(world.as('marcus'), { title: 'Scrapped' });
    await world.as('ava').post(`/v1/missions/${scrapped}/cancel`, { reason: 'No' });

    for (const key of [done, scrapped]) {
      const attempts = await Promise.all([
        world.as('marcus').patch(`/v1/missions/${key}`, { title: 'x' }),
        world.as('marcus').post(`/v1/missions/${key}/submit`),
        world.as('marcus').post(`/v1/missions/${key}/nominations`, { recommended: true }),
        world.as('marcus').post(`/v1/missions/${key}/offers`, { recommended: true }),
        world.as('marcus').post(`/v1/missions/${key}/activate`),
        world.as('marcus').post(`/v1/missions/${key}/complete`),
        world.as('ava').post(`/v1/missions/${key}/approve`, {}),
        world.as('ava').post(`/v1/missions/${key}/reject`, { note: 'x' }),
        world.as('ava').post(`/v1/missions/${key}/cancel`, { reason: 'x' }),
      ]);
      for (const attempt of attempts) {
        expect(attempt.status).toBe(409);
        expect(attempt.body.error.code).toBe('INVALID_TRANSITION');
      }
    }
  });

  it('keeps an ACTIVE mission running when a crew member drops out, and backfills the seat', async () => {
    const key = await activeMission(world);
    expect((await world.as('leo').post(`/v1/me/offers/${key}/drop`, { reason: 'Injury' })).body.status).toBe('DROPPED');
    const view = await world.as('marcus').get(`/v1/missions/${key}`);
    expect(view.body.status).toBe('ACTIVE');
    expect(view.body.roles[0]).toMatchObject({ name: 'Pilot', open: 1 });
    const inbox = await world.as('marcus').get('/v1/inbox');
    expect(inbox.body.items[0]).toMatchObject({ kind: 'OPEN_SEATS', detail: 'Leo dropped out' });
    const backfill = await world.as('marcus').post(`/v1/missions/${key}/offers`, { recommended: true });
    expect(backfill.body.created).toMatchObject([{ role: 'Pilot', handle: 'yuki' }]);
  });

  it('refuses to submit with more nominees than seats', async () => {
    const key = await createStandardMission(world.as('marcus'));
    await world.as('marcus').post(`/v1/missions/${key}/nominations`, { recommended: true });
    await forceSeat(world, key, 'Pilot', 'yuki', 'PROPOSED');
    const response = await world.as('marcus').post(`/v1/missions/${key}/submit`);
    expect(response.status).toBe(422);
    expect(response.body.error.details.blockers).toContain('Pilot: 2 nominated for 1 seat — remove 1 (mc missions unnominate)');
  });

  it('shows every review round, newest first', async () => {
    const key = await createStandardMission(world.as('marcus'));
    await world.as('marcus').post(`/v1/missions/${key}/nominations`, { recommended: true });
    await world.as('marcus').post(`/v1/missions/${key}/submit`);
    await world.as('ava').post(`/v1/missions/${key}/reject`, { note: 'Add a medic' });
    await world.as('marcus').post(`/v1/missions/${key}/submit`);
    await world.as('ava').post(`/v1/missions/${key}/approve`, {});
    const view = await world.as('marcus').get(`/v1/missions/${key}`);
    expect(view.body.reviews.map((review: { round: number; decision: string }) => [review.round, review.decision])).toEqual([
      [2, 'APPROVED'],
      [1, 'REJECTED'],
    ]);
  });
});

describe('deadlines, settings and staffing edges', () => {
  it('caps offer deadlines at 14 days before launch and warns the director', async () => {
    const key = await createStandardMission(world.as('marcus'), { startDate: '2026-10-19', endDate: '2026-10-25' });
    await world.as('marcus').post(`/v1/missions/${key}/nominations`, { recommended: true });
    await world.as('marcus').post(`/v1/missions/${key}/submit`);
    const approved = await world.as('ava').post(`/v1/missions/${key}/approve`, {});
    expect(approved.body.warnings[0]).toMatch(/Launch is in 18 days/);
    const offers = await world.as('leo').get('/v1/me/offers');
    expect(offers.body[0].expiresAt).toBe('2026-10-05T00:00:00.000Z');
  });

  it('gives at least 24 hours for short-notice missions', async () => {
    const key = await createStandardMission(world.as('marcus'), { startDate: '2026-10-11', endDate: '2026-10-15' });
    await world.as('marcus').post(`/v1/missions/${key}/nominations`, { recommended: true });
    await world.as('marcus').post(`/v1/missions/${key}/submit`);
    const approved = await world.as('ava').post(`/v1/missions/${key}/approve`, {});
    expect(approved.body.warnings[0]).toMatch(/crew only have 24 hours/);
    expect((await world.as('leo').get('/v1/me/offers')).body[0].expiresAt).toBe('2026-10-02T09:00:00.000Z');
  });

  it('applies the same deadline rule to backfill offers', async () => {
    const key = await approvedMission(world);
    await world.as('sara').post(`/v1/me/offers/${key}/decline`, {});
    const backfill = await world.as('marcus').post(`/v1/missions/${key}/offers`, { recommended: true });
    expect(backfill.body.created[0].expiresAt).toBe('2026-10-08T09:00:00.000Z');
    expect(backfill.body.warnings).toEqual([]);
  });

  it('refuses a manual nomination that fails the hard filters, and creates nothing', async () => {
    const key = await createStandardMission(world.as('marcus'));
    const response = await world.as('marcus').post(`/v1/missions/${key}/nominations`, { role: 'Pilot', crew: 'sara' });
    expect(response.status).toBe(422);
    expect(response.body.error).toMatchObject({ code: 'NOT_ELIGIBLE' });
    expect(response.body.error.message).toMatch(/no Orbital Navigation/);
    const mission = await missionRow(world, key);
    expect(await world.db.assignment.count({ where: { missionId: mission.id } })).toBe(0);
    const approved = await approvedMission(world, { overrides: { title: 'Approved' } });
    expect((await world.as('marcus').post(`/v1/missions/${approved}/offers/yuki/retract`)).status).toBe(404);
  });

  it('uses each organisation’s own rest gap', async () => {
    const first = await approvedMission(world);
    await world.as('leo').post(`/v1/me/offers/${first}/accept`); // Leo flies Nov 1–30
    const second = await createStandardMission(world.as('marcus'), { title: 'Follow-on', startDate: '2026-12-14', endDate: '2026-12-20' });
    const before = await world.as('marcus').get(`/v1/missions/${second}/match?explain=leo`);
    expect(before.body.explanation.roles[0].rejections).toEqual([
      { code: 'REST_GAP', detail: `only 13 rest days around ${first} (org requires 14)` },
    ]);
    await world.as('ava').patch('/v1/org/settings', { restGapDays: 13 });
    const after = await world.as('marcus').get(`/v1/missions/${second}/match?explain=leo`);
    expect(after.body.explanation.roles[0].eligible).toBe(true);
    expect((await world.as('nora').get('/v1/org/settings')).body.restGapDays).toBe(14); // Lunar unaffected
  });

  it('re-checks nominees at submit and names the one who is no longer eligible', async () => {
    const key = await createStandardMission(world.as('marcus'));
    await world.as('marcus').post(`/v1/missions/${key}/nominations`, { recommended: true });
    expect((await world.as('leo').post('/v1/me/unavailability', { startDate: '2026-11-10', endDate: '2026-11-12' })).status).toBe(201);
    const response = await world.as('marcus').post(`/v1/missions/${key}/submit`);
    expect(response.status).toBe(422);
    expect(response.body.error.details.blockers).toEqual(['Leo (Pilot): unavailable 2026-11-10 → 2026-11-12']);
  });
});

describe('privacy and validation details', () => {
  it('hides nominations from the crew mission list', async () => {
    const key = await createStandardMission(world.as('marcus'));
    await world.as('marcus').post(`/v1/missions/${key}/nominations`, { recommended: true });
    expect((await world.as('leo').get('/v1/missions')).body).toEqual([]);
  });

  it('refuses crew the audit log of a mission they can see by name, and hides one they cannot', async () => {
    const key = await approvedMission(world);
    const mission = await missionRow(world, key);
    const offered = await world.db.assignment.findFirstOrThrow({
      where: { missionId: mission.id, status: 'OFFERED' },
      include: { user: { select: { handle: true } } },
    });
    const crew = world.as(offered.user.handle);
    expect((await crew.get(`/v1/missions/${key}`)).status).toBe(200);
    const history = await crew.get(`/v1/missions/${key}/events`);
    expect(history.status).toBe(403);
    expect(history.body.error.message).toMatch(/audit log is for mission leads and directors/);
    const unseen = await createStandardMission(world.as('marcus'));
    expect((await crew.get(`/v1/missions/${unseen}/events`)).status).toBe(404);
  });

  it('shows crew their counts but not their commitment score; leads see the score', async () => {
    const own = await world.as('leo').get('/v1/me/profile');
    expect(own.body.record).toEqual({ completedMissions: 0, accepts: 0, dropouts: 0 });
    const lead = await world.as('marcus').get('/v1/crew/leo');
    expect(lead.body.record).toMatchObject({ commitment: 1 });
  });

  it('rejects keys with leading zeros, repeated skills, overlapping unavailability and unknown query params', async () => {
    const key = await createStandardMission(world.as('marcus'));
    expect((await world.as('marcus').get(`/v1/missions/${key.replace('-', '-0')}`)).status).toBe(404);
    const repeated = await world.as('leo').put('/v1/me/skills', { skills: [{ skill: 'nav', level: 5 }, { skill: 'nav', level: 3 }] });
    expect(repeated.status).toBe(400);
    const overlapping = await world.as('dmitri').post('/v1/me/unavailability', { startDate: '2026-11-10', endDate: '2026-11-15' });
    expect(overlapping.status).toBe(400);
    expect(overlapping.body.error.message).toMatch(/overlaps days you already blocked out \(2026-11-05 → 2026-11-12\)/);
    expect((await world.as('marcus').get('/v1/missions?orgId=someone-else')).status).toBe(400);
  });

  it('identifies itself on the health check so the CLI can tell it apart from other apps', async () => {
    expect((await world.anonymous.get('/v1/health')).body).toMatchObject({ status: 'ok', service: 'mission-control' });
  });
});
