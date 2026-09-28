/**
 * Offer deadlines, evaluated lazily: no scheduler. Any read or write that cares
 * about offers first sweeps OFFERED rows past their deadline to EXPIRED (and
 * logs the event), so every caller sees a consistent state.
 */
import { addDays } from '../lib/dates.js';
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

export async function sweepExpiredOffers(db: Db, orgId: string, now: Date): Promise<number> {
  const expired = await db.assignment.findMany({
    where: { orgId, status: 'OFFERED', expiresAt: { lt: now } },
    select: { id: true, missionId: true, user: { select: { handle: true } }, role: { select: { name: true } } },
  });
  if (expired.length === 0) return 0;
  await db.assignment.updateMany({
    where: { orgId, id: { in: expired.map((row) => row.id) }, status: 'OFFERED' },
    data: { status: 'EXPIRED', closedAt: now },
  });
  for (const row of expired) {
    await recordEvent(db, {
      orgId,
      missionId: row.missionId,
      actorId: null,
      type: 'OFFER_EXPIRED',
      payload: { crew: row.user.handle, role: row.role.name },
    });
  }
  return expired.length;
}
