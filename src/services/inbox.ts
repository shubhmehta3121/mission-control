/**
 * The role-aware inbox: "what needs me right now?". This is the notification
 * surface for v1 — derived entirely from current state, so there is nothing to
 * keep in sync (email/webhook delivery is on ROADMAP.md).
 *
 *   Director  → submitted missions awaiting review
 *   Owner     → drafts that need crew, changes requested, open seats to backfill,
 *               blocked offers, missions ready to activate
 *   Crew      → pending offers (with deadlines), recent cancellations/retractions,
 *               missions where the crew is now confirmed
 */
import { addDays, rangeOf } from '../lib/dates.js';
import { scheduleIssues } from '../domain/scheduling.js';
import { LIVE_SEAT_STATUSES, hasRoleAtLeast, missionKey } from '../domain/types.js';
import type { Ctx } from './context.js';
import { sweepExpiredOffers } from './expiry.js';
import { loadSchedules } from './snapshot.js';
import { BLOCKED_FOR_LEAD, blockedForCrew } from './views.js';

export interface InboxItem {
  kind:
    | 'REVIEW'
    | 'NEEDS_ROLES'
    | 'NEEDS_CREW'
    | 'READY_TO_SUBMIT'
    | 'CHANGES_REQUESTED'
    | 'AWAITING_REVIEW'
    | 'NO_REVIEWER'
    | 'OPEN_SEATS'
    | 'BLOCKED_OFFER'
    | 'AWAITING_CREW'
    | 'READY_TO_ACTIVATE'
    | 'OFFER'
    | 'UPDATE'
    | 'CREW_CONFIRMED';
  urgency: 'action' | 'info';
  missionKey: string;
  title: string;
  detail: string | null;
  next: string | null;
  at: string | null;
}

const RECENT_DAYS = 14;

export async function getInbox(ctx: Ctx): Promise<{ name: string; role: string; org: string; items: InboxItem[] }> {
  const { db, actor } = ctx;
  const now = ctx.clock.now();
  await sweepExpiredOffers(db, actor.orgId, now);
  const items: InboxItem[] = [];
  const org = await db.organization.findUniqueOrThrow({ where: { id: actor.orgId } });
  const key = (number: number) => missionKey(actor.org.keyPrefix, number);

  if (actor.role === 'DIRECTOR') {
    const submitted = await db.mission.findMany({
      where: { orgId: actor.orgId, status: 'SUBMITTED', NOT: { ownerId: actor.userId } },
      include: {
        owner: { select: { name: true } },
        submissions: { orderBy: { round: 'desc' }, take: 1 },
        roles: { select: { headcount: true } },
      },
      orderBy: { startDate: 'asc' },
    });
    for (const mission of submitted) {
      const review = mission.submissions[0];
      const seats = mission.roles.reduce((acc, role) => acc + role.headcount, 0);
      items.push({
        kind: 'REVIEW',
        urgency: 'action',
        missionKey: key(mission.number),
        title: `${key(mission.number)} ${mission.title} is waiting for your review`,
        detail: `Submitted by ${mission.owner.name}${review && review.round > 1 ? ` (round ${review.round})` : ''} · ${mission.roles.length} role${mission.roles.length === 1 ? '' : 's'}, ${seats} seat${seats === 1 ? '' : 's'} nominated`,
        next: `mc missions show ${key(mission.number)}`,
        at: review?.submittedAt.toISOString() ?? null,
      });
    }
  }

  if (hasRoleAtLeast(actor, 'MISSION_LEAD')) {
    const owned = await db.mission.findMany({
      where: { orgId: actor.orgId, ownerId: actor.userId, status: { notIn: ['COMPLETED', 'CANCELLED'] } },
      include: {
        roles: { include: { assignments: { include: { user: { select: { id: true, name: true, handle: true } } } } } },
        submissions: { orderBy: { round: 'desc' }, take: 1, include: { decidedBy: { select: { name: true } } } },
      },
      orderBy: { startDate: 'asc' },
    });
    const offeredIds = owned.flatMap((mission) =>
      mission.roles.flatMap((role) => role.assignments.filter((seat) => seat.status === 'OFFERED').map((seat) => seat.userId)),
    );
    const schedules = await loadSchedules(db, { orgId: actor.orgId, keyPrefix: actor.org.keyPrefix, userIds: offeredIds });

    for (const mission of owned) {
      const k = key(mission.number);
      const seatsTotal = mission.roles.reduce((acc, role) => acc + role.headcount, 0);
      const primaries = mission.roles.flatMap((role) => role.assignments.filter((seat) => seat.kind === 'PRIMARY'));
      const count = (status: string) => primaries.filter((seat) => seat.status === status).length;

      if (mission.status === 'DRAFT' || mission.status === 'REJECTED') {
        const review = mission.submissions[0];
        if (mission.status === 'REJECTED' && review) {
          items.push({
            kind: 'CHANGES_REQUESTED',
            urgency: 'action',
            missionKey: k,
            title: `${k} ${mission.title}: changes requested`,
            detail: `${review.decidedBy?.name ?? 'The director'}: "${review.note ?? ''}"`,
            next: `mc missions show ${k}`,
            at: review.decidedAt?.toISOString() ?? null,
          });
        }
        if (mission.roles.length === 0) {
          items.push({
            kind: 'NEEDS_ROLES',
            urgency: 'action',
            missionKey: k,
            title: `${k} ${mission.title} has no roles yet`,
            detail: null,
            next: `mc missions roles set ${k} --role "Pilot:1:nav=4"`,
            at: null,
          });
        } else if (count('PROPOSED') < seatsTotal) {
          items.push({
            kind: 'NEEDS_CREW',
            urgency: 'action',
            missionKey: k,
            title: `${k} ${mission.title} needs crew`,
            detail: `${count('PROPOSED')}/${seatsTotal} seats nominated`,
            next: `mc missions match ${k}`,
            at: null,
          });
        } else if (mission.status === 'DRAFT') {
          items.push({
            kind: 'READY_TO_SUBMIT',
            urgency: 'action',
            missionKey: k,
            title: `${k} ${mission.title} is fully nominated`,
            detail: 'Send it to a director for approval.',
            next: `mc missions submit ${k}`,
            at: null,
          });
        }
        continue;
      }

      if (mission.status === 'SUBMITTED') {
        // Nobody reviews their own mission, so a director's mission in a one-director org can never be decided.
        const reviewers = await db.user.count({ where: { orgId: actor.orgId, role: 'DIRECTOR', NOT: { id: mission.ownerId } } });
        if (reviewers === 0) {
          items.push({
            kind: 'NO_REVIEWER',
            urgency: 'action',
            missionKey: k,
            title: `${k} ${mission.title} cannot be reviewed`,
            detail: 'You are the only director, and nobody may approve a mission they created. Cancel it, or ask for a second director.',
            next: `mc missions cancel ${k} --reason "…"`,
            at: mission.submissions[0]?.submittedAt.toISOString() ?? null,
          });
          continue;
        }
        items.push({
          kind: 'AWAITING_REVIEW',
          urgency: 'info',
          missionKey: k,
          title: `${k} ${mission.title} is with a director for review`,
          detail: null,
          next: null,
          at: mission.submissions[0]?.submittedAt.toISOString() ?? null,
        });
        continue;
      }

      // APPROVED or ACTIVE
      const window = rangeOf(mission.startDate, mission.endDate);
      for (const role of mission.roles) {
        for (const seat of role.assignments.filter((entry) => entry.status === 'OFFERED')) {
          const schedule = schedules.get(seat.userId);
          if (schedule && scheduleIssues(window, schedule, org.restGapDays, mission.id).length > 0) {
            items.push({
              kind: 'BLOCKED_OFFER',
              urgency: 'action',
              missionKey: k,
              title: `${k} ${role.name}: ${seat.user.name}'s offer can't be accepted`,
              detail: `${BLOCKED_FOR_LEAD}. Retract it and offer the seat to someone else.`,
              next: `mc missions retract ${k} ${seat.user.handle}`,
              at: seat.offeredAt?.toISOString() ?? null,
            });
          }
        }
      }
      const live = primaries.filter((seat) => LIVE_SEAT_STATUSES.includes(seat.status)).length;
      const open = seatsTotal - live;
      if (open > 0) {
        const lost = primaries
          .filter((seat) => ['DECLINED', 'EXPIRED', 'DROPPED'].includes(seat.status) && seat.closedAt && seat.closedAt > addDays(now, -RECENT_DAYS))
          .map((seat) => `${seat.user.name} ${seat.status === 'DROPPED' ? 'dropped out' : seat.status.toLowerCase()}`);
        items.push({
          kind: 'OPEN_SEATS',
          urgency: 'action',
          missionKey: k,
          title: `${k} ${mission.title}: ${open} open seat${open === 1 ? '' : 's'}`,
          detail: lost.length ? lost.join(' · ') : null,
          next: `mc missions match ${k}   then   mc missions offer ${k} --recommended`,
          at: null,
        });
      } else if (mission.status === 'APPROVED' && count('ACCEPTED') === seatsTotal) {
        items.push({
          kind: 'READY_TO_ACTIVATE',
          urgency: 'action',
          missionKey: k,
          title: `${k} ${mission.title}: every seat accepted`,
          detail: 'Lock the crew — the roster is revealed to them when the mission goes active.',
          next: `mc missions activate ${k}`,
          at: null,
        });
      } else if (mission.status === 'APPROVED') {
        items.push({
          kind: 'AWAITING_CREW',
          urgency: 'info',
          missionKey: k,
          title: `${k} ${mission.title}: ${count('ACCEPTED')}/${seatsTotal} accepted`,
          detail: `${count('OFFERED')} offer${count('OFFERED') === 1 ? '' : 's'} pending`,
          next: `mc missions show ${k}`,
          at: null,
        });
      }
    }
  }

  if (actor.role === 'CREW_MEMBER') {
    const mine = await db.assignment.findMany({
      where: { orgId: actor.orgId, userId: actor.userId, offeredAt: { not: null } },
      include: { mission: true, role: { select: { name: true } } },
      orderBy: { offeredAt: 'desc' },
    });
    const schedule = (await loadSchedules(db, { orgId: actor.orgId, keyPrefix: actor.org.keyPrefix, userIds: [actor.userId] })).get(
      actor.userId,
    )!;
    const recent = addDays(now, -RECENT_DAYS);
    for (const seat of mine) {
      const k = key(seat.mission.number);
      if (seat.status === 'OFFERED') {
        const blocked = blockedForCrew(
          scheduleIssues(rangeOf(seat.mission.startDate, seat.mission.endDate), schedule, org.restGapDays, seat.missionId),
        );
        items.push({
          kind: 'OFFER',
          urgency: 'action',
          missionKey: k,
          title: `${k} ${seat.mission.title} — ${seat.kind === 'BACKUP' ? `backup for ${seat.role.name}` : seat.role.name}`,
          detail: blocked ?? `Respond by ${seat.expiresAt?.toISOString().slice(0, 10) ?? '—'}`,
          next: `mc offers accept ${k}   or   mc offers decline ${k}`,
          at: seat.expiresAt?.toISOString() ?? null,
        });
      } else if ((seat.status === 'WITHDRAWN' || seat.status === 'RELEASED') && seat.closedAt && seat.closedAt > recent) {
        items.push({
          kind: 'UPDATE',
          urgency: 'info',
          missionKey: k,
          title: seat.mission.status === 'CANCELLED' ? `${k} ${seat.mission.title} was cancelled` : `${k} ${seat.mission.title}: your offer was withdrawn`,
          detail: seat.reason,
          next: null,
          at: seat.closedAt.toISOString(),
        });
      } else if (seat.status === 'ACCEPTED' && seat.mission.status === 'ACTIVE') {
        items.push({
          kind: 'CREW_CONFIRMED',
          urgency: 'info',
          missionKey: k,
          title: `${k} ${seat.mission.title}: crew confirmed`,
          detail: `You fly as ${seat.role.name}. See who you're flying with.`,
          next: `mc missions show ${k}`,
          at: null,
        });
      }
    }
  }

  const rank = (item: InboxItem) => (item.urgency === 'action' ? 0 : 1);
  items.sort((a, b) => rank(a) - rank(b));
  return { name: actor.name, role: actor.role, org: actor.org.name, items };
}
