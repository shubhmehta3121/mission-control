import type { AssignmentStatus, MissionStatus, Prisma, PrismaClient } from '@prisma/client';
import type { Clock } from '../lib/clock.js';
import { AppError, notFound } from '../lib/errors.js';
import type { EventType } from '../domain/events.js';
import type { Actor } from '../domain/types.js';

/** Everything a service call needs. Built per request from the authenticated token. */
export interface Ctx {
  db: PrismaClient;
  clock: Clock;
  actor: Actor;
}

/** A client or an open transaction — helpers accept either. */
export type Db = PrismaClient | Prisma.TransactionClient;

export function tx<T>(ctx: Ctx, fn: (db: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return ctx.db.$transaction(fn);
}

/** Accepts "AST-12", "ast-12" or "12" (no leading zeros). A key with another org's prefix is simply not found. */
export function parseMissionKey(actor: Actor, key: string): number {
  const match = /^(?:([A-Za-z]+)-)?([1-9]\d{0,8})$/.exec(key.trim());
  if (!match) throw notFound(`Mission ${key}`);
  const [, prefix, digits] = match;
  if (prefix && prefix.toUpperCase() !== actor.org.keyPrefix) throw notFound(`Mission ${key}`);
  return Number(digits);
}

export async function recordEvent(
  db: Db,
  args: {
    orgId: string;
    missionId: string;
    actorId: string | null;
    type: EventType;
    from?: MissionStatus;
    to?: MissionStatus;
    payload?: Prisma.InputJsonObject;
  },
): Promise<void> {
  await db.missionEvent.create({
    data: {
      orgId: args.orgId,
      missionId: args.missionId,
      actorId: args.actorId,
      type: args.type,
      fromStatus: args.from ?? null,
      toStatus: args.to ?? null,
      payload: args.payload ?? {},
    },
  });
}

// ── Concurrency ──────────────────────────────────────────────────────────────
//
// Every transaction that changes a mission or its seats follows the same shape:
//   1. lock the rows it depends on (person first, then mission — one fixed order,
//      so two transactions can never wait on each other);
//   2. re-read everything it is about to check (offer still open? seat free?
//      schedule clear?) — nothing read before the lock is trusted;
//   3. write with compare-and-set, so a write only lands if the row is still in
//      the state the checks saw.
// SQLite already runs transactions one at a time; these steps keep the logic
// correct on Postgres or with several API instances, where they do not.

/**
 * Take a row lock by touching the row. On Postgres this is a row-level write
 * lock held until commit; on SQLite it takes the database write lock. Other
 * transactions that lock the same row wait instead of interleaving.
 */
export async function lockMission(db: Prisma.TransactionClient, orgId: string, missionId: string): Promise<void> {
  await db.$executeRaw`UPDATE "missions" SET "id" = "id" WHERE "id" = ${missionId} AND "org_id" = ${orgId}`;
}

export async function lockUser(db: Prisma.TransactionClient, orgId: string, userId: string): Promise<void> {
  await db.$executeRaw`UPDATE "users" SET "id" = "id" WHERE "id" = ${userId} AND "org_id" = ${orgId}`;
}

/**
 * Compare-and-set status change: succeeds only if the mission is still in one of
 * the expected states, so two concurrent approvals cannot both win.
 */
export async function moveMission(
  db: Db,
  mission: { id: string; orgId: string },
  from: readonly MissionStatus[],
  to: MissionStatus,
  extra: Prisma.MissionUpdateManyMutationInput = {},
): Promise<void> {
  const { count } = await db.mission.updateMany({
    where: { id: mission.id, orgId: mission.orgId, status: { in: [...from] } },
    data: { ...extra, status: to },
  });
  if (count !== 1) {
    throw new AppError('INVALID_TRANSITION', 'The mission changed while you were acting on it. Reload and try again.');
  }
}

/** Compare-and-set for a seat: the write lands only if the assignment is still in an expected state. */
export async function moveAssignment(
  db: Db,
  assignment: { id: string; orgId: string },
  from: readonly AssignmentStatus[],
  data: Prisma.AssignmentUpdateManyMutationInput,
): Promise<void> {
  const { count } = await db.assignment.updateMany({
    where: { id: assignment.id, orgId: assignment.orgId, status: { in: [...from] } },
    data,
  });
  if (count !== 1) {
    throw new AppError('ALREADY_RESPONDED', 'This seat changed while you were acting on it. Reload and try again.');
  }
}
