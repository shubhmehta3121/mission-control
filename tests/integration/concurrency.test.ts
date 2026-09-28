/**
 * Simultaneous requests (AUDIT.md §4, §8). Each test fires competing requests
 * with Promise.all and checks there is exactly one winner, a clean 409 for the
 * loser, and a consistent database afterwards.
 *
 * Honest caveat: Prisma runs SQLite transactions one at a time, so these tests
 * verify outcomes rather than reproduce a true interleaving. The lock →
 * re-read → compare-and-set code (services/context.ts) is what keeps the same
 * outcomes on Postgres; the last test exercises compare-and-set directly.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { moveAssignment } from '../../src/services/context.js';
import { AppError } from '../../src/lib/errors.js';
import { createStandardMission, createTestWorld, type TestWorld } from '../support/testApp.js';
import { approvedMission, forceSeat, missionRow, seatStatuses } from '../support/flows.js';

let world: TestWorld;
beforeEach(async () => {
  world = await createTestWorld('concurrency');
});
afterEach(async () => {
  await world.close();
});

const statuses = (responses: Array<{ status: number }>) => responses.map((response) => response.status).sort();

describe('simultaneous requests', () => {
  it('two people accepting the last seat: exactly one gets it', async () => {
    const key = await approvedMission(world);
    await forceSeat(world, key, 'Pilot', 'yuki', 'OFFERED'); // two live offers for one seat (the race's aftermath)
    const results = await Promise.all([
      world.as('leo').post(`/v1/me/offers/${key}/accept`),
      world.as('yuki').post(`/v1/me/offers/${key}/accept`),
    ]);
    expect(statuses(results)).toEqual([200, 409]);
    expect(results.find((result) => result.status === 409)!.body.error.code).toBe('ROLE_FILLED');
    const pilots = await seatStatuses(world, key, 'Pilot');
    expect(Object.values(pilots).filter((status) => status === 'ACCEPTED')).toHaveLength(1);
  });

  it('accept racing a retract ends in one consistent state', async () => {
    const key = await approvedMission(world);
    const [accept, retract] = await Promise.all([
      world.as('leo').post(`/v1/me/offers/${key}/accept`),
      world.as('marcus').post(`/v1/missions/${key}/offers/leo/retract`),
    ]);
    const final = (await seatStatuses(world, key, 'Pilot')).leo;
    if (accept.status === 200) {
      expect(retract.status).toBe(404);
      expect(final).toBe('ACCEPTED');
    } else {
      expect(retract.status).toBe(200);
      expect(accept.status).toBe(409);
      expect(final).toBe('WITHDRAWN');
    }
  });

  it('accept racing decline on the same offer: one wins, the other is told', async () => {
    const key = await approvedMission(world);
    const results = await Promise.all([
      world.as('leo').post(`/v1/me/offers/${key}/accept`),
      world.as('leo').post(`/v1/me/offers/${key}/decline`, {}),
    ]);
    expect(statuses(results)).toEqual([200, 409]);
    const final = (await seatStatuses(world, key, 'Pilot')).leo;
    expect(['ACCEPTED', 'DECLINED']).toContain(final);
  });

  it('a double-clicked backfill offers the seat once', async () => {
    const key = await approvedMission(world);
    await world.as('sara').post(`/v1/me/offers/${key}/decline`, {});
    await Promise.all([
      world.as('marcus').post(`/v1/missions/${key}/offers`, { recommended: true }),
      world.as('marcus').post(`/v1/missions/${key}/offers`, { recommended: true }),
    ]);
    const engineers = await seatStatuses(world, key, 'Engineer');
    expect(Object.values(engineers).filter((status) => status === 'OFFERED')).toHaveLength(1);
  });

  it('a double-clicked nominate fills each seat once', async () => {
    const key = await createStandardMission(world.as('marcus'));
    await Promise.all([
      world.as('marcus').post(`/v1/missions/${key}/nominations`, { recommended: true }),
      world.as('marcus').post(`/v1/missions/${key}/nominations`, { recommended: true }),
    ]);
    const mission = await missionRow(world, key);
    expect(await world.db.assignment.count({ where: { missionId: mission.id, status: 'PROPOSED' } })).toBe(2);
  });

  it('two directors approving at once: one approval, one set of offers', async () => {
    const key = await createStandardMission(world.as('marcus'));
    await world.as('marcus').post(`/v1/missions/${key}/nominations`, { recommended: true });
    await world.as('marcus').post(`/v1/missions/${key}/submit`);
    const results = await Promise.all([
      world.as('ava').post(`/v1/missions/${key}/approve`, {}),
      world.as('ben').post(`/v1/missions/${key}/approve`, {}),
    ]);
    expect(statuses(results)).toEqual([200, 409]);
    const mission = await missionRow(world, key);
    expect(await world.db.missionEvent.count({ where: { missionId: mission.id, type: 'OFFERS_SENT' } })).toBe(1);
    expect(await world.db.assignment.count({ where: { missionId: mission.id, status: 'OFFERED' } })).toBe(2);
  });

  it('compare-and-set refuses to overwrite a seat that changed underneath', async () => {
    const key = await approvedMission(world);
    const mission = await missionRow(world, key);
    const offer = await world.db.assignment.findFirstOrThrow({ where: { missionId: mission.id, status: 'OFFERED' } });
    // Someone else responded after we read the row…
    await world.db.assignment.update({ where: { id: offer.id }, data: { status: 'DECLINED' } });
    // …so a write that assumes it is still OFFERED must fail instead of overwriting.
    await expect(moveAssignment(world.db, offer, ['OFFERED'], { status: 'ACCEPTED' })).rejects.toBeInstanceOf(AppError);
    expect((await world.db.assignment.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe('DECLINED');
  });
});
