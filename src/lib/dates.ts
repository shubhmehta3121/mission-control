/**
 * Date-only arithmetic.
 *
 * Mission windows and unavailability are calendar dates, not instants. They are
 * stored as UTC midnight and compared as integer day numbers. Every range is
 * inclusive on both ends: 2026-11-01 → 2026-11-30 is 30 days.
 */

/** Days since 1970-01-01 (UTC). */
export type Day = number;

/** Inclusive range of days. */
export interface DayRange {
  start: Day;
  end: Day;
}

const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function toDay(date: Date): Day {
  return Math.floor(date.getTime() / MS_PER_DAY);
}

export function fromDay(day: Day): Date {
  return new Date(day * MS_PER_DAY);
}

export function rangeOf(start: Date, end: Date): DayRange {
  return { start: toDay(start), end: toDay(end) };
}

/** Parses a strict YYYY-MM-DD string into UTC midnight; null if malformed or not a real date. */
export function parseIsoDate(value: string): Date | null {
  if (!ISO_DATE.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatDay(day: Day): string {
  return formatIsoDate(fromDay(day));
}

export function formatRange(range: DayRange): string {
  return `${formatDay(range.start)} → ${formatDay(range.end)}`;
}

export function startOfUtcDay(date: Date): Date {
  return fromDay(toDay(date));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function overlaps(a: DayRange, b: DayRange): boolean {
  return a.start <= b.end && b.start <= a.end;
}

export function lengthInDays(range: DayRange): number {
  return range.end - range.start + 1;
}

export function overlapDays(a: DayRange, b: DayRange): number {
  return Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start) + 1);
}

/**
 * Whole free days strictly between two ranges. Adjacent ranges (one ends on the
 * 5th, the next starts on the 6th) have a gap of 0; overlapping ranges return -1.
 */
export function gapBetween(a: DayRange, b: DayRange): number {
  if (overlaps(a, b)) return -1;
  const [first, second] = a.end < b.start ? [a, b] : [b, a];
  return second.start - first.end - 1;
}
