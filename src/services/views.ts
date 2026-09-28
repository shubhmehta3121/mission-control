/** Response shaping shared by services. Visibility decisions live with the callers. */
import { formatIsoDate, lengthInDays, rangeOf } from '../lib/dates.js';
import { describeScheduleIssue, type ScheduleIssue } from '../domain/scheduling.js';

export function dateOnly(date: Date): string {
  return formatIsoDate(date);
}

export function windowView(mission: { startDate: Date; endDate: Date }): {
  startDate: string;
  endDate: string;
  days: number;
} {
  return {
    startDate: dateOnly(mission.startDate),
    endDate: dateOnly(mission.endDate),
    days: lengthInDays(rangeOf(mission.startDate, mission.endDate)),
  };
}

/** What a lead sees when an offered crew member can no longer take the seat — no personal detail. */
export const BLOCKED_FOR_LEAD = 'Candidate is no longer available for these dates';

/** What the crew member sees about their own blocked offer. */
export function blockedForCrew(issues: ScheduleIssue[]): string | null {
  if (issues.length === 0) return null;
  return `Cannot accept: ${issues.map(describeScheduleIssue).join('; ')}`;
}

export function person(user: { handle: string; name: string }): { handle: string; name: string } {
  return { handle: user.handle, name: user.name };
}
