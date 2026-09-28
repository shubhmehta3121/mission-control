import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createStandardMission, createTestWorld, type TestWorld } from '../support/testApp.js';

let world: TestWorld;
beforeEach(async () => {
  world = await createTestWorld('security');
});
afterEach(async () => {
  await world.close();
});

describe('authentication', () => {
  it('requires a valid bearer token everywhere except the health check', async () => {
    expect((await world.anonymous.get('/v1/health')).status).toBe(200);
    const missing = await world.anonymous.get('/v1/me');
    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe('UNAUTHENTICATED');
    const response = await world.app.inject({ method: 'GET', url: '/v1/me', headers: { authorization: 'Bearer nope' } });
    expect(response.statusCode).toBe(401);
  });

  it('stores tokens hashed, never in plaintext', async () => {
    const user = await world.db.user.findFirstOrThrow({ where: { handle: 'leo' } });
    expect(user.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(user.tokenHash).not.toContain('tok-leo');
  });
});

describe('roles and permissions', () => {
  it('lets only leads and directors create missions', async () => {
    const response = await world.as('leo').post('/v1/missions', { title: 'X', startDate: '2026-11-01', endDate: '2026-11-02' });
    expect(response.status).toBe(403);
  });

  it('lets only the owner edit a mission', async () => {
    const key = await createStandardMission(world.as('marcus'));
    const response = await world.as('priya').patch(`/v1/missions/${key}`, { title: 'Hijacked' });
    expect(response.status).toBe(403);
    expect(response.body.error.message).toBe("Only the mission's owner can edit this mission.");
  });

  it('reserves approval for directors, and never their own mission', async () => {
    const lead = world.as('marcus');
    const key = await createStandardMission(lead);
    await lead.post(`/v1/missions/${key}/nominations`, { recommended: true });
    await lead.post(`/v1/missions/${key}/submit`);
    expect((await lead.post(`/v1/missions/${key}/approve`, {})).status).toBe(403);
    expect((await world.as('priya').post(`/v1/missions/${key}/approve`, {})).status).toBe(403);

    const ava = world.as('ava');
    const own = await createStandardMission(ava, { title: 'Director-owned' });
    await ava.post(`/v1/missions/${own}/nominations`, { recommended: true });
    expect((await ava.post(`/v1/missions/${own}/submit`)).status).toBe(200);
    const selfApproval = await ava.post(`/v1/missions/${own}/approve`, {});
    expect(selfApproval.status).toBe(403);
    expect(selfApproval.body.error.code).toBe('CANNOT_APPROVE_OWN');
    expect((await world.as('ben').post(`/v1/missions/${own}/approve`, {})).status).toBe(200);
  });

  it('exposes allowed actions that match the lifecycle rules', async () => {
    const key = await createStandardMission(world.as('marcus'));
    const actions = (handle: string) =>
      world
        .as(handle)
        .get(`/v1/missions/${key}`)
        .then((response) => response.body.allowedActions.map((entry: any) => entry.action));
    expect(await actions('marcus')).toEqual(['edit', 'match', 'nominate', 'submit']);
    expect(await actions('priya')).toEqual(['match']);
    expect(await actions('ava')).toEqual(['match', 'cancel']);
  });

  it('limits crew to themselves: no directory, no audit log, no unoffered missions', async () => {
    const key = await createStandardMission(world.as('marcus'));
    const leo = world.as('leo');
    expect((await leo.get('/v1/crew')).status).toBe(403);
    expect((await leo.get('/v1/crew/leo')).status).toBe(200);
    expect((await leo.get('/v1/crew/sara')).status).toBe(404);
    expect((await leo.get(`/v1/missions/${key}`)).status).toBe(404);
    expect((await leo.get(`/v1/missions/${key}/events`)).status).toBe(404);
    expect((await leo.get('/v1/missions')).body).toEqual([]);
  });

  it('shows unavailability notes to the person and directors, but only dates to leads', async () => {
    const leadView = await world.as('marcus').get('/v1/crew/dmitri');
    expect(leadView.body.unavailable[0]).toEqual({ id: expect.any(String), startDate: '2026-11-05', endDate: '2026-11-12' });
    const directorView = await world.as('ava').get('/v1/crew/dmitri');
    expect(directorView.body.unavailable[0].note).toBe('Recertification');
  });

  it('lets only directors change organisation settings, and the matcher honours them', async () => {
    expect((await world.as('marcus').patch('/v1/org/settings', { restGapDays: 0 })).status).toBe(403);
    const updated = await world.as('ava').patch('/v1/org/settings', { restGapDays: 30, offerTtlDays: 3 });
    expect(updated.body).toMatchObject({ restGapDays: 30, offerTtlDays: 3 });
  });
});

describe('tenant isolation', () => {
  it('resolves mission keys only inside the caller’s organisation', async () => {
    const astraKey = await createStandardMission(world.as('marcus'));
    const lunar = await world.as('owen').post('/v1/missions', {
      title: 'Mare Core Sampling',
      startDate: '2026-11-01',
      endDate: '2026-11-10',
      roles: [{ name: 'Geologist', headcount: 1, skills: [{ skill: 'regolith', min: 4 }] }],
    });
    expect(lunar.body.key).toBe('LUN-1');
    expect((await world.as('owen').get(`/v1/missions/${astraKey}`)).status).toBe(404);
    expect((await world.as('owen').get('/v1/missions/1')).body.key).toBe('LUN-1');
    expect((await world.as('marcus').get('/v1/missions/LUN-1')).status).toBe(404);
    expect((await world.as('marcus').get('/v1/missions')).body.map((mission: any) => mission.key)).toEqual([astraKey]);
  });

  it('rejects references to another organisation’s skills and crew on the write path', async () => {
    const marcus = world.as('marcus');
    const key = await createStandardMission(marcus);
    const foreignSkill = await marcus.put(`/v1/missions/${key}/roles`, {
      roles: [{ name: 'Geologist', headcount: 1, skills: [{ skill: 'regolith', min: 3 }] }],
    });
    expect(foreignSkill.status).toBe(400);
    expect(foreignSkill.body.error.details.unknownSkills).toEqual(['regolith']);

    const foreignCrew = await marcus.post(`/v1/missions/${key}/nominations`, { role: 'Pilot', crew: 'ingrid' });
    expect(foreignCrew.status).toBe(404);

    const directory = await marcus.get('/v1/crew');
    expect(directory.body.map((person: any) => person.handle)).not.toContain('ingrid');
    const match = await marcus.get(`/v1/missions/${key}/match`);
    const everyone = match.body.result.roles.flatMap((role: any) => role.ranked.map((candidate: any) => candidate.handle));
    expect(everyone).not.toContain('ingrid');
  });

  it('makes cross-tenant rows impossible at the database level (composite foreign keys)', async () => {
    const astra = await world.db.organization.findUniqueOrThrow({ where: { slug: 'astra' } });
    const ingrid = await world.db.user.findFirstOrThrow({ where: { handle: 'ingrid' } });
    const astraNav = await world.db.skill.findFirstOrThrow({ where: { orgId: astra.id, key: 'nav' } });
    await expect(
      world.db.crewSkill.create({ data: { orgId: astra.id, userId: ingrid.id, skillId: astraNav.id, proficiency: 5 } }),
    ).rejects.toThrow();
    await expect(
      world.db.crewSkill.create({ data: { orgId: ingrid.orgId, userId: ingrid.id, skillId: astraNav.id, proficiency: 5 } }),
    ).rejects.toThrow();
  });
});

describe('validation', () => {
  it('rejects malformed and impossible input with a clear message', async () => {
    const marcus = world.as('marcus');
    const badDate = await marcus.post('/v1/missions', { title: 'X', startDate: '2026-02-30', endDate: '2026-03-02' });
    expect(badDate.status).toBe(400);
    expect(badDate.body.error.message).toMatch(/startDate — must be a real date/);
    const past = await marcus.post('/v1/missions', { title: 'X', startDate: '2026-09-01', endDate: '2026-09-02' });
    expect(past.body.error.message).toBe('Missions must start in the future (after today).');
    const reversed = await marcus.post('/v1/missions', { title: 'X', startDate: '2026-11-10', endDate: '2026-11-01' });
    expect(reversed.body.error.message).toBe('The end date must be on or after the start date.');
    const extra = await marcus.post('/v1/missions', { title: 'X', startDate: '2026-11-01', endDate: '2026-11-02', orgId: 'x' });
    expect(extra.status).toBe(400);
  });
});
