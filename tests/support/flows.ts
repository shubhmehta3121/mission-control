/** Multi-step flows shared by integration tests, built on the real API. */
import { expect } from 'vitest';
import type { AssignmentStatus } from '@prisma/client';
import { createStandardMission, type TestWorld } from './testApp.js';

/** Draft → nominate (recommended: Leo as Pilot, Sara as Engineer) → submit → approve. */
export async function approvedMission(
  world: TestWorld,
  options: { lead?: string; director?: string; overrides?: Record<string, unknown> } = {},
): Promise<string> {
  const lead = world.as(options.lead ?? 'marcus');
  const key = await createStandardMission(lead, options.overrides);
  expect((await lead.post(`/v1/missions/${key}/nominations`, { recommended: true })).status).toBe(201);
  expect((await lead.post(`/v1/missions/${key}/submit`)).status).toBe(200);
  expect((await world.as(options.director ?? 'ava').post(`/v1/missions/${key}/approve`, {})).status).toBe(200);
  return key;
}

/** Approved, both seats accepted, activated. */
export async function activeMission(world: TestWorld, options: { overrides?: Record<string, unknown> } = {}): Promise<string> {
  const key = await approvedMission(world, options);
  expect((await world.as('leo').post(`/v1/me/offers/${key}/accept`)).status).toBe(200);
  expect((await world.as('sara').post(`/v1/me/offers/${key}/accept`)).status).toBe(200);
  expect((await world.as('marcus').post(`/v1/missions/${key}/activate`)).status).toBe(200);
  return key;
}

export async function missionRow(world: TestWorld, key: string) {
  const [prefix, number] = key.split('-');
  const org = await world.db.organization.findUniqueOrThrow({ where: { keyPrefix: prefix! } });
  return world.db.mission.findUniqueOrThrow({ where: { orgId_number: { orgId: org.id, number: Number(number) } } });
}

export async function seatStatuses(world: TestWorld, key: string, roleName: string): Promise<Record<string, AssignmentStatus>> {
  const mission = await missionRow(world, key);
  const seats = await world.db.assignment.findMany({
    where: { missionId: mission.id, role: { name: roleName } },
    include: { user: { select: { handle: true } } },
  });
  return Object.fromEntries(seats.map((seat) => [seat.user.handle, seat.status]));
}

/**
 * Insert a seat directly, bypassing the API. Used only to recreate the aftermath
 * of a race (e.g. two live offers for one seat) that the API itself now prevents,
 * so the last line of defence (the accept-time seat check) can be tested.
 */
export async function forceSeat(
  world: TestWorld,
  key: string,
  roleName: string,
  handle: string,
  status: AssignmentStatus,
): Promise<void> {
  const mission = await missionRow(world, key);
  const role = await world.db.missionRole.findFirstOrThrow({ where: { missionId: mission.id, name: roleName } });
  const user = await world.db.user.findFirstOrThrow({ where: { orgId: mission.orgId, handle } });
  const now = world.clock.now();
  await world.db.assignment.create({
    data: {
      orgId: mission.orgId,
      missionId: mission.id,
      roleId: role.id,
      userId: user.id,
      status,
      score: 50,
      scoreBreakdown: { forced: true },
      ...(status === 'OFFERED' ? { offeredAt: now, expiresAt: new Date(now.getTime() + 7 * 86_400_000) } : {}),
    },
  });
}
