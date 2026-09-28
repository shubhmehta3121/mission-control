/**
 * Randomised invariant testing for the matcher. 2,000 random organisations from
 * a fixed seed; after every run, rules that must always hold are checked with
 * code written independently of the matcher:
 *   1. every recommended person passes every hard filter (independent re-check);
 *   2. the matcher's eligible set equals the independent eligible set, per role;
 *   3. nobody is seated twice, and no role gets more than its open seats;
 *   4. the number of filled seats equals the true maximum (separate algorithm: Kuhn's augmenting paths);
 *   5. on small instances, the chosen crew has the best possible total quality (brute force);
 *   6. the same input in a different order gives the same crew;
 *   7. elimination counts add up; unfilled seats are explained; scores are sane.
 * A failure message names the run number, so any counter-example can be replayed.
 */
import { describe, expect, it } from 'vitest';
import { runMatch, ELIGIBLE_BONUS } from '../../src/matcher/matcher.js';
import type { CrewSnapshot, MatchInput, RoleInput } from '../../src/matcher/types.js';
import type { AssignmentStatus } from '../../src/domain/types.js';
import type { DayRange } from '../../src/lib/dates.js';
import { rng } from '../support/scenarioOrgs.js';

const RUNS = 2000;
const BASE_SEED = Number(process.env.PROPERTY_SEED ?? 1000); // PROPERTY_SEED=… to explore other organisations
const STATUSES: AssignmentStatus[] = ['PROPOSED', 'OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN', 'RELEASED', 'DROPPED'];
const EXCLUDED: AssignmentStatus[] = ['PROPOSED', 'OFFERED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'DROPPED'];

function generate(seed: number): MatchInput {
  const random = rng(seed);
  const int = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));
  const skills = Array.from({ length: int(2, 8) }, (_, index) => `s${index}`);
  const start = int(0, 400);
  const window: DayRange = { start, end: start + int(0, 120) };
  const around = (): DayRange => {
    const from = start + int(-200, 250);
    return { start: from, end: from + int(0, 60) };
  };

  const roles: RoleInput[] = Array.from({ length: int(1, 5) }, (_, index) => {
    const required = new Map<string, number>();
    const count = int(1, 3);
    while (required.size < Math.min(count, skills.length)) required.set(skills[int(0, skills.length - 1)]!, int(1, 5));
    return {
      id: `r${index}`,
      name: `Role ${index}`,
      headcount: int(1, 4),
      position: index,
      requirements: [...required].map(([skillId, min]) => ({ skillId, min })),
      filledBy: [],
    };
  });

  const crew: CrewSnapshot[] = Array.from({ length: int(0, 60) }, (_, index) => {
    const owned = new Map<string, number>();
    for (const skill of skills) if (random() < 0.45) owned.set(skill, int(1, 5));
    let onThisMission: CrewSnapshot['onThisMission'] = null;
    if (random() < 0.12) {
      const role = roles[int(0, roles.length - 1)]!;
      const status = STATUSES[int(0, STATUSES.length - 1)]!;
      const live = status === 'PROPOSED' || status === 'OFFERED' || status === 'ACCEPTED';
      if (!live || role.filledBy.length < role.headcount) {
        onThisMission = { status, roleId: role.id };
        if (live) role.filledBy.push(`u${index}`);
      }
    }
    const accepts = int(0, 10);
    return {
      id: `u${index}`,
      handle: `crew${String(index).padStart(2, '0')}`,
      name: `Crew ${index}`,
      skills: owned,
      unavailable: Array.from({ length: int(0, 2) }, around),
      commitments: Array.from({ length: int(0, 3) }, (_, c) => ({ missionId: `m${index}-${c}`, missionKey: `X-${index}${c}`, range: around() })),
      pending: Array.from({ length: int(0, 2) }, (_, p) => ({ missionKey: `P-${index}${p}`, range: around(), status: random() < 0.5 ? 'OFFERED' : 'PROPOSED' })),
      history: {
        completedRoleSkills: Array.from({ length: int(0, 6) }, () => [skills[int(0, skills.length - 1)]!]),
        accepts,
        dropouts: int(0, accepts),
      },
      onThisMission,
    };
  });

  return {
    mission: { id: 'target', key: 'T-1', window },
    roles,
    crew,
    skills: new Map(skills.map((key) => [key, { key, name: key.toUpperCase() }])),
    settings: { restGapDays: int(0, 45) },
  };
}

// ── Independent reference implementations (deliberately not using matcher code) ──

const overlaps = (a: DayRange, b: DayRange) => a.start <= b.end && b.start <= a.end;
const gap = (a: DayRange, b: DayRange) => (a.end < b.start ? b.start - a.end - 1 : a.start - b.end - 1);

function eligible(person: CrewSnapshot, role: RoleInput, input: MatchInput): boolean {
  if (person.onThisMission && EXCLUDED.includes(person.onThisMission.status)) return false;
  if (role.requirements.some((req) => (person.skills.get(req.skillId) ?? 0) < req.min)) return false;
  const window = input.mission.window;
  if (person.unavailable.some((range) => overlaps(range, window))) return false;
  for (const commitment of person.commitments) {
    if (overlaps(commitment.range, window)) return false;
    if (gap(commitment.range, window) < input.settings.restGapDays) return false;
  }
  return true;
}

/** Maximum bipartite matching (Kuhn's algorithm): seats × people. */
function maxMatching(input: MatchInput): number {
  const seats: RoleInput[] = input.roles.flatMap((role) => Array.from({ length: Math.max(0, role.headcount - role.filledBy.length) }, () => role));
  const owner = new Map<string, number>();
  const tryAssign = (seatIndex: number, seen: Set<string>): boolean => {
    for (const person of input.crew) {
      if (seen.has(person.id) || !eligible(person, seats[seatIndex]!, input)) continue;
      seen.add(person.id);
      const current = owner.get(person.id);
      if (current === undefined || tryAssign(current, seen)) {
        owner.set(person.id, seatIndex);
        return true;
      }
    }
    return false;
  };
  let matched = 0;
  for (let seat = 0; seat < seats.length; seat += 1) if (tryAssign(seat, new Set())) matched += 1;
  return matched;
}

/** Best achievable total weight, by exhaustive search (small instances only). */
function bruteForceBest(seats: string[], candidates: string[], weight: (seat: number, person: string) => number | null): number {
  let best = 0;
  const used = new Set<string>();
  const walk = (seat: number, total: number) => {
    if (seat === seats.length) {
      best = Math.max(best, total);
      return;
    }
    walk(seat + 1, total);
    for (const person of candidates) {
      const value = weight(seat, person);
      if (used.has(person) || value === null) continue;
      used.add(person);
      walk(seat + 1, total + value);
      used.delete(person);
    }
  };
  walk(0, 0);
  return best;
}

function shuffled<T>(items: T[], seed: number): T[] {
  const random = rng(seed);
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

describe(`matcher invariants over ${RUNS} random organisations`, () => {
  it('always holds', () => {
    let seatsSeen = 0;
    let bruteForced = 0;
    for (let run = 0; run < RUNS; run += 1) {
      const input = generate(BASE_SEED + run);
      const result = runMatch(input);
      const at = `run ${run} (seed ${BASE_SEED + run})`;
      const people = new Map(input.crew.map((person) => [person.id, person]));
      const roles = new Map(input.roles.map((role) => [role.id, role]));

      // 1 + 3: recommendations are eligible, unique, and within each role's open seats.
      const seated = new Set<string>();
      const perRole = new Map<string, number>();
      for (const rec of result.recommendations) {
        expect(eligible(people.get(rec.userId)!, roles.get(rec.roleId)!, input), `${at}: ${rec.handle} is not eligible for ${rec.roleName}`).toBe(true);
        expect(seated.has(rec.userId), `${at}: ${rec.handle} seated twice`).toBe(false);
        seated.add(rec.userId);
        perRole.set(rec.roleId, (perRole.get(rec.roleId) ?? 0) + 1);
      }
      for (const role of input.roles) {
        const open = Math.max(0, role.headcount - role.filledBy.length);
        expect(perRole.get(role.id) ?? 0, `${at}: ${role.name} over its open seats`).toBeLessThanOrEqual(open);
      }

      // 2 + 7: the eligible set matches the reference exactly, and the funnel adds up.
      for (const roleResult of result.roles) {
        const role = roles.get(roleResult.roleId)!;
        const expected = input.crew.filter((person) => eligible(person, role, input)).map((person) => person.id).sort();
        expect(roleResult.ranked.map((candidate) => candidate.userId).sort(), `${at}: eligible set for ${role.name}`).toEqual(expected);
        const { considered, onMission, skill, unavailable, conflict, restGap, eligible: count } = roleResult.funnel;
        expect(onMission + skill + unavailable + conflict + restGap + count, `${at}: funnel for ${role.name}`).toBe(considered);
        expect(considered).toBe(input.crew.length);
        for (const candidate of roleResult.ranked) {
          const { total, effective, rarityPenalty, components } = candidate.breakdown;
          expect(Number.isFinite(total) && total >= 0 && total <= 100, `${at}: total ${total}`).toBe(true);
          expect(rarityPenalty >= 0 && rarityPenalty <= 5, `${at}: penalty ${rarityPenalty}`).toBe(true);
          expect(Math.abs(effective - (total - rarityPenalty)), `${at}: effective`).toBeLessThanOrEqual(0.11);
          for (const value of Object.values(components)) expect(value >= 0 && value <= 1, `${at}: component ${value}`).toBe(true);
        }
      }

      // 4: as many seats as is possible at all.
      expect(result.recommendations.length, `${at}: filled seats vs true maximum`).toBe(maxMatching(input));
      const unfilled = result.unfilled.reduce((acc, gapEntry) => acc + gapEntry.seats, 0);
      expect(unfilled, `${at}: unfilled count`).toBe(result.openSeats - result.recommendations.length);
      expect(result.complete).toBe(unfilled === 0);
      for (const gapEntry of result.unfilled) expect(gapEntry.reason.length, `${at}: unexplained gap`).toBeGreaterThan(0);

      // 5: on small instances, the best total quality (brute force over the matcher's own scores).
      const seatRoles = input.roles.flatMap((role) => Array.from({ length: Math.max(0, role.headcount - role.filledBy.length) }, () => role));
      const candidates = [...new Set(result.roles.flatMap((roleResult) => roleResult.ranked.map((candidate) => candidate.userId)))];
      if (seatRoles.length <= 4 && candidates.length <= 6) {
        const effectiveOf = (roleId: string, userId: string) =>
          result.roles.find((roleResult) => roleResult.roleId === roleId)!.ranked.find((candidate) => candidate.userId === userId)?.breakdown.effective;
        const weight = (seat: number, userId: string) => {
          const value = effectiveOf(seatRoles[seat]!.id, userId);
          return value === undefined ? null : ELIGIBLE_BONUS + Math.round(value * 100);
        };
        const chosen = result.recommendations.reduce((acc, rec) => acc + ELIGIBLE_BONUS + Math.round(rec.breakdown.effective * 100), 0);
        expect(chosen, `${at}: not the best total`).toBe(bruteForceBest(seatRoles.map((role) => role.id), candidates, weight));
        bruteForced += 1;
      }

      // 6: order does not matter.
      const again = runMatch({ ...input, crew: shuffled(input.crew, run) });
      const pairs = (r: typeof result) => r.recommendations.map((rec) => `${rec.roleId}:${rec.userId}`).sort();
      expect(pairs(again), `${at}: result depends on input order`).toEqual(pairs(result));

      seatsSeen += result.openSeats;
    }
    expect(seatsSeen).toBeGreaterThan(RUNS); // the generator really exercised the engine
    expect(bruteForced).toBeGreaterThan(200); // …including enough small cases for the optimality check
  }, 120_000);
});
