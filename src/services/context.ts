import type { MissionStatus, Prisma, PrismaClient } from '@prisma/client';
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

/** Accepts "AST-12", "ast-12" or "12". A key with another org's prefix is simply not found. */
export function parseMissionKey(actor: Actor, key: string): number {
  const match = /^(?:([A-Za-z]+)-)?(\d+)$/.exec(key.trim());
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
