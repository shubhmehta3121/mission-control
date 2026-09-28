/**
 * Schedule rules shared by the matcher (who is eligible?) and the accept flow
 * (can this person still take the seat?). One implementation, so the matcher
 * never recommends someone the server would then refuse, and vice versa.
 *
 *   UNAVAILABLE  — the person blocked out days inside the mission window
 *   CONFLICT     — the person holds an accepted seat on an overlapping mission
 *   REST_GAP     — fewer than the org's rest days between this mission and another
 *                  (pre-flight quarantine / post-flight recovery)
 */
import { formatRange, gapBetween, overlaps, type DayRange } from '../lib/dates.js';

export interface Commitment {
  missionId: string;
  missionKey: string;
  range: DayRange;
}

export type ScheduleIssue =
  | { kind: 'UNAVAILABLE'; range: DayRange }
  | { kind: 'CONFLICT'; missionKey: string; range: DayRange }
  | { kind: 'REST_GAP'; missionKey: string; range: DayRange; gapDays: number; requiredDays: number };

export interface ScheduleSubject {
  unavailable: readonly DayRange[];
  commitments: readonly Commitment[];
}

export function scheduleIssues(
  window: DayRange,
  subject: ScheduleSubject,
  restGapDays: number,
  ignoreMissionId?: string,
): ScheduleIssue[] {
  const issues: ScheduleIssue[] = [];
  for (const range of subject.unavailable) {
    if (overlaps(window, range)) issues.push({ kind: 'UNAVAILABLE', range });
  }
  for (const commitment of subject.commitments) {
    if (commitment.missionId === ignoreMissionId) continue;
    if (overlaps(window, commitment.range)) {
      issues.push({ kind: 'CONFLICT', missionKey: commitment.missionKey, range: commitment.range });
      continue;
    }
    const gapDays = gapBetween(window, commitment.range);
    if (gapDays < restGapDays) {
      issues.push({
        kind: 'REST_GAP',
        missionKey: commitment.missionKey,
        range: commitment.range,
        gapDays,
        requiredDays: restGapDays,
      });
    }
  }
  return issues;
}

export function describeScheduleIssue(issue: ScheduleIssue): string {
  switch (issue.kind) {
    case 'UNAVAILABLE':
      return `unavailable ${formatRange(issue.range)}`;
    case 'CONFLICT':
      return `committed to ${issue.missionKey} (${formatRange(issue.range)})`;
    case 'REST_GAP':
      return `only ${issue.gapDays} rest day${issue.gapDays === 1 ? '' : 's'} around ${issue.missionKey} (org requires ${issue.requiredDays})`;
    default: {
      const unreachable: never = issue;
      throw new Error(`Unhandled schedule issue ${JSON.stringify(unreachable)}`);
    }
  }
}
