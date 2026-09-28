/** Injectable time source so lifecycle rules (deadlines, "start must be in the future") are testable. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export function fixedClock(iso: string): Clock {
  const instant = new Date(iso);
  return { now: () => new Date(instant) };
}
