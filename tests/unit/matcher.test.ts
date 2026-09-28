import { describe, expect, it } from 'vitest';
import { evaluateCandidate, explainCandidate, runMatch } from '../../src/matcher/matcher.js';
import { commitment } from '../../src/matcher/scoring.js';
import { WINDOW, history, matchInput, person, range, role } from '../support/matchFixtures.js';

const seatOf = (result: ReturnType<typeof runMatch>, roleName: string): string[] =>
  result.recommendations.filter((rec) => rec.roleName === roleName).map((rec) => rec.handle);

describe('matcher — seating (Hungarian)', () => {
  it('avoids the greedy trap: the best pilot flies as engineer so both seats fill', () => {
    // A qualifies for both roles and is the stronger pilot; B can only be the pilot.
    // Greedy (role by role) seats A as pilot and leaves engineer empty.
    const input = matchInput({
      roles: [role('Pilot', { nav: 4 }), role('Engineer', { eva: 3 })],
      crew: [person('a', { nav: 5, eva: 4 }), person('b', { nav: 4 })],
    });
    const result = runMatch(input);

    expect(result.complete).toBe(true);
    expect(seatOf(result, 'Pilot')).toEqual(['b']);
    expect(seatOf(result, 'Engineer')).toEqual(['a']);
    const pilotPick = result.recommendations.find((rec) => rec.roleName === 'Pilot')!;
    expect(pilotPick.notes[0]).toMatch(/A scores higher here \(80\.0\) but is needed as Engineer/);
  });

  it('keeps a rare specialist free when a close alternative exists', () => {
    // A: nav 5 + the org's only EVA-5, one relevant mission → 84.0 raw, −5 rarity → 79.0
    // C: nav 5, nothing rare                              → 80.0 raw → 80.0
    const input = matchInput({
      roles: [role('Pilot', { nav: 4 })],
      crew: [person('a', { nav: 5, eva: 5 }, { history: history('nav', 1) }), person('c', { nav: 5 })],
    });
    const result = runMatch(input);
    const [pick] = result.recommendations;

    expect(pick!.handle).toBe('c');
    const ranked = result.roles[0]!.ranked;
    const a = ranked.find((candidate) => candidate.handle === 'a')!;
    expect(a.breakdown.total).toBe(84);
    expect(a.breakdown.rarityPenalty).toBe(5);
    expect(a.breakdown.effective).toBe(79);
    expect(pick!.breakdown.effective).toBe(80);
    expect(pick!.notes[0]).toMatch(/A scores higher \(84\.0\) but is kept free: rare EVA Ops \(only holder\)/);
  });

  it('still picks the rare specialist when they are clearly better (> 5 points)', () => {
    // Three relevant missions: 92.0 raw − 5 = 87.0 effective, beats C's 80.0.
    const input = matchInput({
      roles: [role('Pilot', { nav: 4 })],
      crew: [person('a', { nav: 5, eva: 5 }, { history: history('nav', 3) }), person('c', { nav: 5 })],
    });
    const [pick] = runMatch(input).recommendations;
    expect(pick!.handle).toBe('a');
    expect(pick!.breakdown.total).toBe(92);
    expect(pick!.breakdown.effective).toBe(87);
  });

  it('fills multi-seat roles with the best distinct people', () => {
    const input = matchInput({
      roles: [role('Specialist', { robotics: 3 }, { headcount: 2 })],
      crew: [person('p', { robotics: 3 }), person('q', { robotics: 5 }), person('r', { robotics: 4 })],
    });
    expect(seatOf(runMatch(input), 'Specialist').sort()).toEqual(['q', 'r']);
  });

  it('only matches open seats and never re-seats someone already on the mission', () => {
    const specialist = role('Specialist', { robotics: 3 }, { headcount: 2, filledBy: ['u-x'] });
    const input = matchInput({
      roles: [specialist],
      crew: [
        person('x', { robotics: 5 }, { onThisMission: { status: 'PROPOSED', roleId: specialist.id } }),
        person('y', { robotics: 3 }),
      ],
    });
    const result = runMatch(input);
    expect(result.openSeats).toBe(1);
    expect(seatOf(result, 'Specialist')).toEqual(['y']);
    expect(result.roles[0]!.funnel.onMission).toBe(1);
  });

  it('is deterministic regardless of input order', () => {
    const crew = [
      person('a', { nav: 5, eva: 4 }),
      person('b', { nav: 4, robotics: 4 }),
      person('c', { eva: 4, robotics: 5 }),
      person('d', { nav: 4, eva: 3 }),
    ];
    const roles = [role('Pilot', { nav: 4 }), role('Engineer', { eva: 3 }), role('Specialist', { robotics: 4 })];
    const forward = runMatch(matchInput({ roles, crew }));
    const reversed = runMatch(matchInput({ roles, crew: [...crew].reverse() }));
    expect(reversed.recommendations.map((rec) => [rec.roleName, rec.handle])).toEqual(
      forward.recommendations.map((rec) => [rec.roleName, rec.handle]),
    );
  });
});

describe('matcher — hard filters', () => {
  it('removes unavailable, conflicting and insufficiently skilled crew, and reports the funnel', () => {
    const engineer = role('Engineer', { eva: 4 });
    const input = matchInput({
      roles: [engineer],
      crew: [
        person('sara', { eva: 3 }), // near miss
        person('bob', { nav: 5 }), // no EVA at all
        person('dana', { eva: 5 }, { unavailable: [range('2026-11-10', '2026-11-20')] }),
        person('eli', { eva: 5 }, { commitments: [{ missionId: 'm-x', missionKey: 'AST-9', range: range('2026-11-25', '2026-12-05') }] }),
        person('ella', { eva: 4 }),
        person('fred', { eva: 4 }, { onThisMission: { status: 'DECLINED', roleId: engineer.id } }),
      ],
    });
    const [roleResult] = runMatch(input).roles;
    expect(roleResult!.funnel).toEqual({
      considered: 6,
      onMission: 1,
      skill: 2,
      unavailable: 1,
      conflict: 1,
      restGap: 0,
      eligible: 1,
    });
    expect(roleResult!.ranked.map((candidate) => candidate.handle)).toEqual(['ella']);
    expect(roleResult!.nearMisses).toEqual([
      { userId: 'u-sara', handle: 'sara', name: 'Sara', detail: 'EVA Ops 3 (needs 4)' },
    ]);
  });

  it('enforces the rest gap on both sides of the mission, exactly at the boundary', () => {
    const commitmentOn = (key: string, start: string, end: string) => ({
      commitments: [{ missionId: `m-${key}`, missionKey: key, range: range(start, end) }],
    });
    const input = matchInput({
      restGapDays: 14,
      roles: [role('Pilot', { nav: 3 })],
      crew: [
        person('before14', { nav: 4 }, commitmentOn('AST-2', '2026-10-01', '2026-10-17')), // Oct 18–31 = 14 free days
        person('before13', { nav: 4 }, commitmentOn('AST-3', '2026-10-01', '2026-10-18')), // 13 free days
        person('after14', { nav: 4 }, commitmentOn('AST-4', '2026-12-15', '2026-12-31')), // Dec 1–14 = 14 free days
        person('after13', { nav: 4 }, commitmentOn('AST-5', '2026-12-14', '2026-12-31')),
      ],
    });
    const eligible = runMatch(input).roles[0]!.ranked.map((candidate) => candidate.handle).sort();
    expect(eligible).toEqual(['after14', 'before14']);

    const tooSoon = evaluateCandidate(input, 'u-before13', 'r-pilot');
    expect(tooSoon.rejections).toEqual([
      { code: 'REST_GAP', detail: 'only 13 rest days around AST-3 (org requires 14)' },
    ]);
  });

  it('lets an existing nominee be re-validated without tripping over their own seat', () => {
    const pilot = role('Pilot', { nav: 4 }, { filledBy: ['u-x'] });
    const input = matchInput({
      roles: [pilot],
      crew: [person('x', { nav: 5 }, { onThisMission: { status: 'PROPOSED', roleId: pilot.id } })],
    });
    expect(evaluateCandidate(input, 'u-x', pilot.id).eligible).toBe(false);
    expect(evaluateCandidate(input, 'u-x', pilot.id, { ignoreOwnSeat: true }).eligible).toBe(true);
  });

  it('explains why a role cannot be filled', () => {
    const input = matchInput({
      roles: [role('Surgeon', { medic: 5 })],
      crew: [person('a', { medic: 3 }), person('b', { nav: 5 })],
    });
    const result = runMatch(input);
    expect(result.complete).toBe(false);
    expect(result.unfilled).toEqual([
      { roleId: 'r-surgeon', roleName: 'Surgeon', seats: 1, reason: 'no eligible crew (2 lack the skills)' },
    ]);
  });
});

describe('matcher — scoring', () => {
  it('measures workload over ±90 days, not just inside the window', () => {
    // B returns 20 days after the mission for 42 days (Dec 20 → Jan 30). Horizon = 30 + 180 = 210 days.
    const input = matchInput({
      roles: [role('Pilot', { nav: 4 })],
      crew: [
        person('b', { nav: 4 }, { commitments: [{ missionId: 'm-b', missionKey: 'AST-7', range: range('2026-12-20', '2027-01-30') }] }),
        person('c', { nav: 4 }),
      ],
    });
    const ranked = runMatch(input).roles[0]!.ranked;
    const b = ranked.find((candidate) => candidate.handle === 'b')!;
    const c = ranked.find((candidate) => candidate.handle === 'c')!;
    expect(b.breakdown.facts).toMatchObject({ committedDays: 42, horizonDays: 210 });
    expect(b.breakdown.components.workload).toBe(0.8);
    expect(c.breakdown.components.workload).toBe(1);
    expect(ranked[0]!.handle).toBe('c');
  });

  it('smooths commitment and only counts drop-outs', () => {
    expect(commitment(0, 0)).toBe(1);
    expect(commitment(1, 1)).toBeCloseTo(2 / 3);
    expect(commitment(10, 1)).toBeCloseTo(11 / 12);
  });

  it('flags (but does not exclude) crew with a pending offer on an overlapping mission', () => {
    const input = matchInput({
      roles: [role('Pilot', { nav: 4 })],
      crew: [person('a', { nav: 5 }, { pending: [{ missionKey: 'AST-8', range: range('2026-11-20', '2026-12-10'), status: 'OFFERED' }] })],
    });
    const [pick] = runMatch(input).recommendations;
    expect(pick!.handle).toBe('a');
    expect(pick!.notes).toContain('pending offer on AST-8 (overlapping)');
  });

  it('explains a candidate across every role', () => {
    const input = matchInput({
      roles: [role('Pilot', { nav: 4 }), role('Engineer', { eva: 3 })],
      crew: [person('a', { nav: 5, eva: 4 }), person('b', { nav: 4 }), person('z', { comms: 5 })],
    });
    const why = explainCandidate(input, 'u-z');
    expect(why.seatedAs).toBeNull();
    expect(why.roles.map((entry) => [entry.roleName, entry.eligible, entry.rejections[0]?.detail])).toEqual([
      ['Pilot', false, 'no Orbital Navigation'],
      ['Engineer', false, 'no EVA Ops'],
    ]);
    const a = explainCandidate(input, 'u-a');
    expect(a.seatedAs).toBe('Engineer');
    expect(a.roles[0]).toMatchObject({ roleName: 'Pilot', eligible: true, rank: 1, seatedHere: false });
  });

  it('uses the mission window from the input', () => {
    expect(WINDOW.end - WINDOW.start + 1).toBe(30);
  });
});
