/**
 * Offer deadlines, evaluated lazily: no scheduler. Any read or write that cares
 * about offers first sweeps OFFERED rows past their deadline to EXPIRED (and
 * logs the event), so every caller sees a consistent state. An offer is expired
 * from the deadline instant onwards (`now >= expiresAt`) — the sweep and the
 * accept path use the same rule.
 */
import { addDays, formatIsoDate, toDay } from '../lib/dates.js';
import { recordEvent, type Db } from './context.js';

/** Offers must be answered before pre-flight quarantine starts. */
export const OFFER_CUTOFF_DAYS_BEFORE_START = 14;

/** min(now + org TTL, start − 14 days), but never less than 24 hours from now. */
export function offerDeadline(now: Date, missionStart: Date, ttlDays: number): Date {
  const byTtl = addDays(now, ttlDays);
  const cutoff = addDays(missionStart, -OFFER_CUTOFF_DAYS_BEFORE_START);
  const floor = addDays(now, 1);
  const deadline = byTtl < cutoff ? byTtl : cutoff;
  return deadline < floor ? floor : deadline;
}

/**
 * A heads-up when launch is close enough that crew get less than the org's usual
 * response time. Approval still goes ahead (short-notice missions are legitimate);
 * the director just sees what they are asking of the crew.
 */
export function deadlineWarning(now: Date, missionStart: Date, ttlDays: number): string | null {
  const deadline = offerDeadline(now, missionStart, ttlDays);
  if (deadline >= addDays(now, ttlDays)) return null;
  const daysToLaunch = toDay(missionStart) - toDay(now);
  const hours = Math.round((deadline.getTime() - now.getTime()) / 3_600_000);
  const window = hours <= 36 ? `${hours} hours` : `${Math.round(hours / 24)} days`;
  return `Launch is in ${daysToLaunch} days, so crew only have ${window} (until ${formatIsoDate(deadline)}) to respond instead of the usual ${ttlDays} — offers must be settled ${OFFER_CUTOFF_DAYS_BEFORE_START} days before launch.`;
}

export function isExpired(offer: { status: string; expiresAt: Date | null }, now: Date): boolean {
  return offer.status === 'OFFERED' && offer.expiresAt !== null && offer.expiresAt.getTime() <= now.getTime();
}

export async function sweepExpiredOffers(db: Db, orgId: string, now: Date): Promise<number> {
  const due = await db.assignment.findMany({
    where: { orgId, status: 'OFFERED', expiresAt: { lte: now } },
    select: { id: true, missionId: true, user: { select: { handle: true } }, role: { select: { name: true } } },
  });
  let expired = 0;
  for (const row of due) {
    // Row by row with compare-and-set, so two overlapping sweeps never log the same expiry twice.
    const { count } = await db.assignment.updateMany({
      where: { orgId, id: row.id, status: 'OFFERED' },
      data: { status: 'EXPIRED', closedAt: now },
    });
    if (count !== 1) continue;
    expired += 1;
    await recordEvent(db, {
      orgId,
      missionId: row.missionId,
      actorId: null,
      type: 'OFFER_EXPIRED',
      payload: { crew: row.user.handle, role: row.role.name },
    });
  }
  return expired;
}
