/**
 * The crew member's side: my offers, accept, decline, drop out.
 *
 * Crew may hold several pending offers, even for overlapping missions. The
 * server guarantees there is never a double booking: accepting re-runs the same
 * schedule rules the matcher uses, inside the transaction. To take a different
 * mission, crew drop out of the one they accepted first (which counts as a
 * drop-out on that mission) and then accept.
 *
 * Every response follows the lock → re-read → compare-and-set shape described
 * in services/context.ts, so two simultaneous requests (two people accepting
 * the last seat, or accept racing a retract or a cancel) resolve to exactly one
 * outcome, with a clear 409 for the other.
 */
import type { Assignment, AssignmentKind, AssignmentStatus, Mission, MissionStatus, Prisma } from '@prisma/client';
import { AppError, notFound } from '../lib/errors.js';
import { rangeOf } from '../lib/dates.js';
import { describeScheduleIssue, scheduleIssues } from '../domain/scheduling.js';
import { missionKey } from '../domain/types.js';
import { lockMission, lockUser, moveAssignment, recordEvent, tx, type Ctx, type Db } from './context.js';
import { isExpired, sweepExpiredOffers } from './expiry.js';
import { loadMission } from './missions.js';
import { loadSchedules } from './snapshot.js';
import { blockedForCrew, windowView } from './views.js';

export interface OfferView {
  key: string;
  title: string;
  missionStatus: MissionStatus;
  startDate: string;
  endDate: string;
  days: number;
  role: string;
  kind: AssignmentKind;
  status: AssignmentStatus;
  offeredAt: string | null;
  expiresAt: string | null;
  respondedAt: string | null;
  closedAt: string | null;
  reason: string | null;
  blocked: string | null;
}

const STATUS_ORDER: Partial<Record<AssignmentStatus, number>> = { OFFERED: 0, ACCEPTED: 1 };

export async function listMyOffers(ctx: Ctx): Promise<OfferView[]> {
  const { db, actor } = ctx;
  await sweepExpiredOffers(db, actor.orgId, ctx.clock.now());
  const rows = await db.assignment.findMany({
    where: { orgId: actor.orgId, userId: actor.userId, offeredAt: { not: null } },
    include: { mission: true, role: { select: { name: true } } },
  });
  const org = await db.organization.findUniqueOrThrow({ where: { id: actor.orgId } });
  const schedule = (await loadSchedules(db, { orgId: actor.orgId, keyPrefix: actor.org.keyPrefix, userIds: [actor.userId] })).get(
    actor.userId,
  )!;
  return rows
    .map((row) => ({
      key: missionKey(actor.org.keyPrefix, row.mission.number),
      title: row.mission.title,
      missionStatus: row.mission.status,
      ...windowView(row.mission),
      role: row.role.name,
      kind: row.kind,
      status: row.status,
      offeredAt: row.offeredAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      respondedAt: row.respondedAt?.toISOString() ?? null,
      closedAt: row.closedAt?.toISOString() ?? null,
      reason: row.reason,
      blocked:
        row.status === 'OFFERED'
          ? blockedForCrew(scheduleIssues(rangeOf(row.mission.startDate, row.mission.endDate), schedule, org.restGapDays, row.missionId))
          : null,
    }))
    .sort((a, b) => {
      // Open offers first, then seats still ahead of you, then history (most recent first).
      const group = (offer: OfferView) =>
        offer.status === 'ACCEPTED' && (offer.missionStatus === 'COMPLETED' || offer.missionStatus === 'CANCELLED')
          ? 2
          : (STATUS_ORDER[offer.status] ?? 2);
      const byGroup = group(a) - group(b);
      if (byGroup !== 0) return byGroup;
      return group(a) === 2 ? b.startDate.localeCompare(a.startDate) : a.startDate.localeCompare(b.startDate) || a.key.localeCompare(b.key);
    });
}

type OfferRow = Assignment & { role: { name: string; headcount: number } };

/**
 * Run `fn` on the caller's offer for a mission, inside a transaction that has
 * locked the mission (and, for accept, the person) and re-read the offer.
 */
async function withLockedOffer<T>(
  ctx: Ctx,
  key: string,
  options: { lockPerson: boolean },
  fn: (db: Prisma.TransactionClient, mission: Mission, offer: OfferRow) => Promise<T>,
): Promise<T> {
  const ref = await loadMission(ctx, key); // visibility check; the key → id mapping never changes
  return tx(ctx, async (db) => {
    if (options.lockPerson) await lockUser(db, ctx.actor.orgId, ctx.actor.userId);
    await lockMission(db, ctx.actor.orgId, ref.id);
    const mission = await db.mission.findFirstOrThrow({ where: { id: ref.id, orgId: ctx.actor.orgId } });
    const offer = await myOffer(ctx, db, mission);
    if (!offer) throw notFound(`Offer on mission ${key}`);
    return fn(db, mission, offer);
  });
}

function myOffer(ctx: Ctx, db: Db, mission: Mission): Promise<OfferRow | null> {
  return db.assignment.findFirst({
    where: { orgId: ctx.actor.orgId, missionId: mission.id, userId: ctx.actor.userId, offeredAt: { not: null } },
    orderBy: { createdAt: 'desc' },
    include: { role: { select: { name: true, headcount: true } } },
  });
}

function assertOpenOffer(offer: Assignment, mission: Mission, key: string, now: Date): void {
  const status = offer.status;
  switch (status) {
    case 'OFFERED':
      if (isExpired(offer, now)) {
        throw new AppError('OFFER_EXPIRED', `Your offer for ${key} expired on ${offer.expiresAt?.toISOString().slice(0, 10)}.`);
      }
      break;
    case 'EXPIRED':
      throw new AppError('OFFER_EXPIRED', `Your offer for ${key} expired on ${offer.expiresAt?.toISOString().slice(0, 10)}.`);
    case 'WITHDRAWN':
    case 'RELEASED':
      throw new AppError('INVALID_TRANSITION', `This offer is no longer open: ${offer.reason ?? 'it was withdrawn'}.`);
    case 'ACCEPTED':
    case 'DECLINED':
    case 'DROPPED':
      throw new AppError('ALREADY_RESPONDED', `You already responded to ${key} (${status.toLowerCase()}).`);
    case 'PROPOSED':
      throw notFound(`Offer on mission ${key}`); // never offered: invisible to crew
    default: {
      const unreachable: never = status;
      throw new Error(`Unhandled assignment status ${String(unreachable)}`);
    }
  }
  if (mission.status !== 'APPROVED' && mission.status !== 'ACTIVE') {
    throw new AppError('INVALID_TRANSITION', `Mission ${key} is ${mission.status} and is not taking responses.`);
  }
}

export async function acceptOffer(ctx: Ctx, key: string): Promise<{ key: string; role: string; status: AssignmentStatus; crewComplete: boolean }> {
  const now = ctx.clock.now();
  await sweepExpiredOffers(ctx.db, ctx.actor.orgId, now);
  return withLockedOffer(ctx, key, { lockPerson: true }, async (db, mission, offer) => {
    assertOpenOffer(offer, mission, key, now);

    // Checked after the locks: nothing another request did can slip in between the check and the write.
    const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.actor.orgId } });
    const schedule = (
      await loadSchedules(db, { orgId: ctx.actor.orgId, keyPrefix: ctx.actor.org.keyPrefix, userIds: [ctx.actor.userId] })
    ).get(ctx.actor.userId)!;
    const issues = scheduleIssues(rangeOf(mission.startDate, mission.endDate), schedule, org.restGapDays, mission.id);
    if (issues.length > 0) {
      const conflict = issues.find((issue) => issue.kind !== 'UNAVAILABLE');
      const hint =
        conflict && 'missionKey' in conflict
          ? ` To take this seat instead, first drop out of ${conflict.missionKey}: mc offers drop ${conflict.missionKey} --reason "…"`
          : ' Remove the overlapping unavailability first (mc profile unavailable list).';
      throw new AppError('SCHEDULE_CONFLICT', `You can't accept ${key}: ${issues.map(describeScheduleIssue).join('; ')}.${hint}`, {
        issues: issues.map(describeScheduleIssue),
      });
    }

    const accepted = await db.assignment.count({
      where: { orgId: ctx.actor.orgId, roleId: offer.roleId, status: 'ACCEPTED', kind: 'PRIMARY' },
    });
    if (accepted >= offer.role.headcount) {
      throw new AppError('ROLE_FILLED', `All ${offer.role.name} seats on ${key} are already taken.`);
    }

    await moveAssignment(db, offer, ['OFFERED'], { status: 'ACCEPTED', respondedAt: now });
    await recordEvent(db, {
      orgId: ctx.actor.orgId,
      missionId: mission.id,
      actorId: ctx.actor.userId,
      type: 'OFFER_ACCEPTED',
      payload: { crew: ctx.actor.handle, role: offer.role.name },
    });

    const roles = await db.missionRole.findMany({
      where: { orgId: ctx.actor.orgId, missionId: mission.id },
      include: { assignments: { where: { status: 'ACCEPTED', kind: 'PRIMARY' }, select: { id: true } } },
    });
    return {
      key: missionKey(ctx.actor.org.keyPrefix, mission.number),
      role: offer.role.name,
      status: 'ACCEPTED',
      crewComplete: roles.every((role) => role.assignments.length === role.headcount),
    };
  });
}

export async function declineOffer(ctx: Ctx, key: string, reason?: string): Promise<{ key: string; status: AssignmentStatus }> {
  const now = ctx.clock.now();
  await sweepExpiredOffers(ctx.db, ctx.actor.orgId, now);
  return withLockedOffer(ctx, key, { lockPerson: false }, async (db, mission, offer) => {
    assertOpenOffer(offer, mission, key, now);
    await moveAssignment(db, offer, ['OFFERED'], {
      status: 'DECLINED',
      respondedAt: now,
      closedAt: now,
      reason: reason?.trim() || null,
    });
    await recordEvent(db, {
      orgId: ctx.actor.orgId,
      missionId: mission.id,
      actorId: ctx.actor.userId,
      type: 'OFFER_DECLINED',
      payload: { crew: ctx.actor.handle, role: offer.role.name, reason: reason?.trim() || null },
    });
    return { key: missionKey(ctx.actor.org.keyPrefix, mission.number), status: 'DECLINED' };
  });
}

/** Withdraw after accepting. The seat reopens for the lead; the mission itself is untouched. */
export async function dropOut(ctx: Ctx, key: string, reason: string): Promise<{ key: string; status: AssignmentStatus }> {
  const now = ctx.clock.now();
  return withLockedOffer(ctx, key, { lockPerson: false }, async (db, mission, offer) => {
    if (offer.status !== 'ACCEPTED') {
      throw new AppError('INVALID_TRANSITION', `You can only drop out of a seat you accepted (this one is ${offer.status.toLowerCase()}).`);
    }
    if (mission.status !== 'APPROVED' && mission.status !== 'ACTIVE') {
      throw new AppError('INVALID_TRANSITION', `Mission ${key} is ${mission.status}.`);
    }
    await moveAssignment(db, offer, ['ACCEPTED'], { status: 'DROPPED', closedAt: now, reason: reason.trim() });
    await recordEvent(db, {
      orgId: ctx.actor.orgId,
      missionId: mission.id,
      actorId: ctx.actor.userId,
      type: 'CREW_DROPPED_OUT',
      payload: { crew: ctx.actor.handle, role: offer.role.name, reason: reason.trim() },
    });
    return { key: missionKey(ctx.actor.org.keyPrefix, mission.number), status: 'DROPPED' };
  });
}
