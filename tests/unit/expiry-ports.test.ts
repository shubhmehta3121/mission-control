import { createServer, type Server } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { deadlineWarning, isExpired, offerDeadline } from '../../src/services/expiry.js';
import { findFreePort, portIsFree } from '../../src/lib/ports.js';

const at = (iso: string) => new Date(iso);

describe('offer deadlines', () => {
  const now = at('2026-10-01T09:00:00.000Z');

  it('gives the org TTL when launch is far away', () => {
    expect(offerDeadline(now, at('2026-12-01T00:00:00Z'), 7).toISOString()).toBe('2026-10-08T09:00:00.000Z');
    expect(deadlineWarning(now, at('2026-12-01T00:00:00Z'), 7)).toBeNull();
  });

  it('caps the deadline at 14 days before launch (pre-flight quarantine)', () => {
    // Launch 18 days out → offers must be settled by launch − 14 = 4 days from now, not 7.
    expect(offerDeadline(now, at('2026-10-19T00:00:00Z'), 7).toISOString()).toBe('2026-10-05T00:00:00.000Z');
    expect(deadlineWarning(now, at('2026-10-19T00:00:00Z'), 7)).toMatch(/Launch is in 18 days/);
  });

  it('never gives less than 24 hours, and warns the director', () => {
    const launch = at('2026-10-11T00:00:00Z'); // 10 days out: launch − 14 is already in the past
    expect(offerDeadline(now, launch, 7).toISOString()).toBe('2026-10-02T09:00:00.000Z');
    expect(deadlineWarning(now, launch, 7)).toMatch(/crew only have 24 hours/);
  });

  it('treats an offer as expired from the deadline instant onwards', () => {
    const deadline = at('2026-10-08T09:00:00.000Z');
    expect(isExpired({ status: 'OFFERED', expiresAt: deadline }, at('2026-10-08T08:59:59.999Z'))).toBe(false);
    expect(isExpired({ status: 'OFFERED', expiresAt: deadline }, deadline)).toBe(true);
    expect(isExpired({ status: 'ACCEPTED', expiresAt: deadline }, at('2027-01-01T00:00:00Z'))).toBe(false);
  });
});

describe('finding a free port', () => {
  let blocker: Server | null = null;
  afterEach(async () => {
    await new Promise<void>((resolve) => (blocker ? blocker.close(() => resolve()) : resolve()));
    blocker = null;
  });

  it('skips a port another app is listening on (on any interface) and takes the next one', async () => {
    const start = await findFreePort(39_000, '127.0.0.1');
    blocker = createServer();
    // Listen on the wildcard address, the way Next.js does — a plain bind test on 127.0.0.1 can miss this on Windows.
    await new Promise<void>((resolve) => blocker!.listen(start, '0.0.0.0', () => resolve()));
    expect(await portIsFree(start, '127.0.0.1')).toBe(false);
    expect(await findFreePort(start, '127.0.0.1')).toBeGreaterThan(start);
  });
});
