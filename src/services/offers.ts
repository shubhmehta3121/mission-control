/**
 * The crew member's side: my offers, accept, decline, drop out.
 *
 * Crew may hold several pending offers, even for overlapping missions. The
 * server guarantees there is never a double booking: accepting re-runs the same
 * schedule rules the matcher uses, inside the transaction. To take a different
 * mission, crew drop out of the one they accepted first (which counts as a
 * drop-out on that mission) and then accept.
 */
import type { Assignment, Mission } from '@prisma/client';
import { AppError, notFound } from '../lib/errors.js';
import { rangeOf } from '../lib/dates.js';
import { describeScheduleIssue, scheduleIssues } from '../domain/scheduling.js';
import { missionKey } from '../domain/types.js';
import { recordEvent, tx, type Ctx, type Db } from './context.js';
import { sweepExpiredOffers } from './expiry.js';
import { loadMission } from './missions.js';
import { loadSchedules } from './snapshot.js';
import { blockedForCrew, windowView } from './views.js';

export interface OfferView {
  key: string;
  title: string;
  missionStatus: string;
  startDate: string;
  endDate: string;
  days: number;
  role: string;
  kind: string;
  status: string;
  offeredAt: string | null;
  expiresAt: string | null;
  respondedAt: string | null;
  closedAt: string | null;
  reason: string | null;
  blocked: string | null;
}

const STATUS_ORDER: Record<string, number> = { OFFERED: 0, ACCEPTED: 1 };

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
        offer.status === 'ACCEPTED' && ['COMPLETED', 'CANCELLED'].includes(offer.missionStatus) ? 2 : (STATUS_ORDER[offer.status] ?? 2);
      const byGroup = group(a) - group(b);
      if (byGroup !== 0) return byGroup;
      return group(a) === 2 ? b.startDate.localeCompare(a.startDate) : a.startDate.localeCompare(b.startDate) || a.key.localeCompare(b.key);
    });
}

async function myOffer(ctx: Ctx, db: Db, key: string): Promise<{ mission: Mission; offer: Assignment & { role: { name: string; headcount: number } } }> {
  const mission = await loadMission(ctx, key, db);
  const offer = await db.assignment.findFirst({
    where: { orgId: ctx.actor.orgId, missionId: mission.id, userId: ctx.actor.userId, offeredAt: { not: null } },
    orderBy: { createdAt: 'desc' },
    include: { role: { select: { name: true, headcount: true } } },
  });
  if (!offer) throw notFound(`Offer on mission ${key}`);
  return { mission, offer };
}

function assertOpenOffer(offer: Assignment, mission: Mission, key: string): void {
  switch (offer.status) {
    case 'OFFERED':
      break;
    case 'EXPIRED':
      throw new AppError('OFFER_EXPIRED', `Your offer for ${key} expired on ${offer.expiresAt?.toISOString().slice(0, 10)}.`);
    case 'WITHDRAWN':
    case 'RELEASED':
      throw new AppError('INVALID_TRANSITION', `This offer is no longer open: ${offer.reason ?? 'it was withdrawn'}.`);
    default:
      throw new AppError('ALREADY_RESPONDED', `You already responded to ${key} (${offer.status.toLowerCase()}).`);
  }
  if (mission.status !== 'APPROVED' && mission.status !== 'ACTIVE') {
    throw new AppError('INVALID_TRANSITION', `Mission ${key} is ${mission.status} and is not taking responses.`);
  }
}

export async function acceptOffer(ctx: Ctx, key: string): Promise<{ key: string; role: string; status: string; crewComplete: boolean }> {
  const now = ctx.clock.now();
  await sweepExpiredOffers(ctx.db, ctx.actor.orgId, now);
  return tx(ctx, async (db) => {
    const { mission, offer } = await myOffer(ctx, db, key);
    assertOpenOffer(offer, mission, key);

    const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.actor.orgId } });
    const schedule = (
      await loadSchedules(db, { orgId: ctx.actor.orgId, keyPrefix: ctx.actor.org.keyPrefix, userIds: [ctx.actor.userId] })
    ).get(ctx.actor.userId)!;
    const issues = scheduleIssues(rangeOf(mission.startDate, mission.endDate), schedule, org.restGapDays, mission.id);
    if (issues.length > 0) {
      const conflict = issues.find((issue) => issue.kind !== 'UNAVAILABLE');
      const hint = conflict && 'missionKey' in conflict
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

    await db.assignment.update({
      where: { id: offer.id },
      data: { status: 'ACCEPTED', respondedAt: now },
    });
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
      crewComplete: roles.every((role) => role.assignments.length >= role.headcount),
    };
  });
}

export async function declineOffer(ctx: Ctx, key: string, reason?: string): Promise<{ key: string; status: string }> {
  const now = ctx.clock.now();
  await sweepExpiredOffers(ctx.db, ctx.actor.orgId, now);
  return tx(ctx, async (db) => {
    const { mission, offer } = await myOffer(ctx, db, key);
    assertOpenOffer(offer, mission, key);
    await db.assignment.update({
      where: { id: offer.id },
      data: { status: 'DECLINED', respondedAt: now, closedAt: now, reason: reason?.trim() || null },
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
export async function dropOut(ctx: Ctx, key: string, reason: string): Promise<{ key: string; status: string }> {
  const now = ctx.clock.now();
  return tx(ctx, async (db) => {
    const { mission, offer } = await myOffer(ctx, db, key);
    if (offer.status !== 'ACCEPTED') {
      throw new AppError('INVALID_TRANSITION', `You can only drop out of a seat you accepted (this one is ${offer.status.toLowerCase()}).`);
    }
    if (mission.status !== 'APPROVED' && mission.status !== 'ACTIVE') {
      throw new AppError('INVALID_TRANSITION', `Mission ${key} is ${mission.status}.`);
    }
    await db.assignment.update({
      where: { id: offer.id },
      data: { status: 'DROPPED', closedAt: now, reason: reason.trim() },
    });
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
