import { describe, expect, it } from 'vitest';
import { gapBetween, lengthInDays, overlapDays, overlaps, parseIsoDate } from '../../src/lib/dates.js';
import { scheduleIssues } from '../../src/domain/scheduling.js';
import { range } from '../support/matchFixtures.js';

describe('date ranges (inclusive)', () => {
  it('parses only real YYYY-MM-DD dates', () => {
    expect(parseIsoDate('2026-11-01')?.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(parseIsoDate('2026-02-30')).toBeNull();
    expect(parseIsoDate('2026-1-5')).toBeNull();
    expect(parseIsoDate('01/11/2026')).toBeNull();
  });

  it('treats ranges as inclusive on both ends', () => {
    expect(lengthInDays(range('2026-11-01', '2026-11-30'))).toBe(30);
    expect(overlaps(range('2026-11-01', '2026-11-10'), range('2026-11-10', '2026-11-20'))).toBe(true);
    expect(overlaps(range('2026-11-01', '2026-11-09'), range('2026-11-10', '2026-11-20'))).toBe(false);
    expect(overlapDays(range('2026-11-01', '2026-11-10'), range('2026-11-08', '2026-11-20'))).toBe(3);
  });

  it('counts free days between ranges', () => {
    expect(gapBetween(range('2026-10-01', '2026-10-25'), range('2026-11-01', '2026-11-30'))).toBe(6);
    expect(gapBetween(range('2026-11-01', '2026-11-05'), range('2026-11-06', '2026-11-09'))).toBe(0);
    expect(gapBetween(range('2026-11-01', '2026-11-05'), range('2026-11-05', '2026-11-09'))).toBe(-1);
  });
});

describe('scheduleIssues', () => {
  const window = range('2026-11-01', '2026-11-30');

  it('reports unavailability, conflicts and rest-gap violations, ignoring the mission itself', () => {
    const issues = scheduleIssues(
      window,
      {
        unavailable: [range('2026-11-28', '2026-12-02')],
        commitments: [
          { missionId: 'self', missionKey: 'AST-1', range: window },
          { missionId: 'a', missionKey: 'AST-2', range: range('2026-10-01', '2026-10-25') },
          { missionId: 'b', missionKey: 'AST-3', range: range('2026-11-15', '2026-11-18') },
        ],
      },
      14,
      'self',
    );
    expect(issues.map((issue) => issue.kind)).toEqual(['UNAVAILABLE', 'REST_GAP', 'CONFLICT']);
  });
});
