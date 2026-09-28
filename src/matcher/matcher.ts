/**
 * The matching engine.
 *
 *   1. Hard filters, per (person, role), in funnel order:
 *        ON_MISSION  already seated on / declined / dropped / let lapse this mission
 *        SKILL       every required skill at or above the minimum
 *        UNAVAILABLE blocked-out days inside the window
 *        CONFLICT    accepted seat on an overlapping mission
 *        REST_GAP    too few days between this and another mission (org setting)
 *   2. Score every eligible pair (scoring.ts), including the rarity penalty.
 *   3. Seat everyone at once with the Hungarian algorithm. Each open seat × person
 *      gets weight ELIGIBLE_BONUS + effective score. The bonus dwarfs any score
 *      difference, so the optimiser first maximises the number of filled seats
 *      and only then total quality. This is what stops the greedy trap: the best
 *      pilot is placed as engineer when that is the only way both seats fill.
 *   4. Explain: per-role funnel, near misses, ranked alternatives, and a note on
 *      every recommendation that differs from the naive "highest score" pick.
 *
 * Pure and deterministic: crew are processed in handle order and ties resolve
 * to the lowest index, so the same input always yields the same crew.
 */
import { describeScheduleIssue, scheduleIssues, type ScheduleIssue } from '../domain/scheduling.js';
import { overlaps } from '../lib/dates.js';
import { maxWeightAssignment } from './hungarian.js';
import { expertCounts, scoreCandidate } from './scoring.js';
import type {
  CrewSnapshot,
  FilterCode,
  MatchInput,
  MatchResult,
  RankedCandidate,
  Rejection,
  RoleEvaluation,
  RoleInput,
  RoleResult,
  ScoreBreakdown,
  SeatRecommendation,
} from './types.js';

/** Must exceed the largest possible total quality difference (100 seats × 10 000). */
export const ELIGIBLE_BONUS = 1_000_000;

interface Shortfall {
  skillId: string;
  level: number;
  min: number;
}

interface PairEvaluation {
  person: CrewSnapshot;
  rejections: Rejection[];
  shortfalls: Shortfall[];
  issues: ScheduleIssue[];
  breakdown: ScoreBreakdown | null;
}

interface Context {
  input: MatchInput;
  crew: CrewSnapshot[];
  experts: Map<string, number>;
  skillInfo: (skillId: string) => { key: string; name: string };
  skillName: (skillId: string) => string;
  roleName: (roleId: string) => string;
}

function buildContext(input: MatchInput): Context {
  const crew = [...input.crew].sort((a, b) => a.handle.localeCompare(b.handle) || a.id.localeCompare(b.id));
  const roleNames = new Map(input.roles.map((role) => [role.id, role.name]));
  return {
    input,
    crew,
    experts: expertCounts(crew),
    skillInfo: (id) => input.skills.get(id) ?? { key: id, name: id },
    skillName: (id) => input.skills.get(id)?.name ?? id,
    roleName: (id) => roleNames.get(id) ?? 'another role',
  };
}

function onMissionRejection(person: CrewSnapshot, ctx: Context): Rejection | null {
  const current = person.onThisMission;
  if (!current) return null;
  const role = ctx.roleName(current.roleId);
  switch (current.status) {
    case 'PROPOSED':
      return { code: 'ON_MISSION', detail: `already nominated as ${role}` };
    case 'OFFERED':
      return { code: 'ON_MISSION', detail: `already offered ${role}` };
    case 'ACCEPTED':
      return { code: 'ON_MISSION', detail: `already crewing as ${role}` };
    case 'DECLINED':
      return { code: 'ON_MISSION', detail: 'declined this mission' };
    case 'DROPPED':
      return { code: 'ON_MISSION', detail: 'dropped out of this mission' };
    case 'EXPIRED':
      return { code: 'ON_MISSION', detail: "let this mission's offer expire" };
    case 'WITHDRAWN':
    case 'RELEASED':
      return null; // withdrawn or released through no fault of theirs: free to be considered again
    default: {
      const unreachable: never = current.status;
      throw new Error(`Unhandled assignment status ${String(unreachable)}`);
    }
  }
}

function skillShortfalls(person: CrewSnapshot, role: RoleInput): Shortfall[] {
  return role.requirements
    .map((req) => ({ skillId: req.skillId, level: person.skills.get(req.skillId) ?? 0, min: req.min }))
    .filter((entry) => entry.level < entry.min);
}

function describeShortfall(shortfall: Shortfall, ctx: Context): string {
  const name = ctx.skillName(shortfall.skillId);
  return shortfall.level === 0 ? `no ${name}` : `${name} ${shortfall.level} (needs ${shortfall.min})`;
}

const SCHEDULE_CODE: Record<ScheduleIssue['kind'], FilterCode> = {
  UNAVAILABLE: 'UNAVAILABLE',
  CONFLICT: 'CONFLICT',
  REST_GAP: 'REST_GAP',
};

function evaluatePair(person: CrewSnapshot, role: RoleInput, ctx: Context, ignoreOwnSeat: boolean): PairEvaluation {
  const { mission, settings } = ctx.input;
  const rejections: Rejection[] = [];

  const onMission = ignoreOwnSeat ? null : onMissionRejection(person, ctx);
  if (onMission) rejections.push(onMission);

  const shortfalls = skillShortfalls(person, role);
  if (shortfalls.length > 0) {
    rejections.push({ code: 'SKILL', detail: shortfalls.map((entry) => describeShortfall(entry, ctx)).join(', ') });
  }

  const issues = scheduleIssues(mission.window, person, settings.restGapDays, mission.id);
  for (const issue of issues) rejections.push({ code: SCHEDULE_CODE[issue.kind], detail: describeScheduleIssue(issue) });

  const breakdown =
    rejections.length === 0
      ? scoreCandidate({
          person,
          requirements: role.requirements,
          window: mission.window,
          missionId: mission.id,
          experts: ctx.experts,
          skillInfo: ctx.skillInfo,
        })
      : null;

  return { person, rejections, shortfalls, issues, breakdown };
}

function flagsFor(person: CrewSnapshot, ctx: Context): string[] {
  return person.pending
    .filter((entry) => overlaps(entry.range, ctx.input.mission.window))
    .map((entry) =>
      entry.status === 'OFFERED'
        ? `pending offer on ${entry.missionKey} (overlapping)`
        : `nominated on ${entry.missionKey}, awaiting approval (overlapping)`,
    );
}

const FUNNEL_KEY: Record<FilterCode, keyof Omit<RoleResult['funnel'], 'considered' | 'eligible'>> = {
  ON_MISSION: 'onMission',
  SKILL: 'skill',
  UNAVAILABLE: 'unavailable',
  CONFLICT: 'conflict',
  REST_GAP: 'restGap',
};

function byQuality(a: RankedCandidate, b: RankedCandidate): number {
  return (
    b.breakdown.effective - a.breakdown.effective ||
    b.breakdown.total - a.breakdown.total ||
    a.handle.localeCompare(b.handle)
  );
}

export function runMatch(input: MatchInput): MatchResult {
  const ctx = buildContext(input);
  const roles = [...input.roles].sort((a, b) => a.position - b.position);

  // 1–2. Filter and score every (person, role) pair.
  const evaluations = new Map<string, PairEvaluation[]>();
  for (const role of roles) {
    evaluations.set(
      role.id,
      ctx.crew.map((person) => evaluatePair(person, role, ctx, false)),
    );
  }

  // 3. Seat everyone at once.
  const seats: RoleInput[] = [];
  for (const role of roles) {
    const open = Math.max(0, role.headcount - role.filledBy.length);
    for (let i = 0; i < open; i += 1) seats.push(role);
  }
  const candidateIds = new Set<string>();
  for (const role of roles) {
    for (const evaluation of evaluations.get(role.id)!) {
      if (evaluation.breakdown) candidateIds.add(evaluation.person.id);
    }
  }
  const candidates = ctx.crew.filter((person) => candidateIds.has(person.id));
  const pairBreakdown = (roleId: string, personId: string): ScoreBreakdown | null =>
    evaluations.get(roleId)!.find((evaluation) => evaluation.person.id === personId)?.breakdown ?? null;

  const weights = seats.map((role) =>
    candidates.map((person) => {
      const breakdown = pairBreakdown(role.id, person.id);
      return breakdown ? ELIGIBLE_BONUS + Math.round(breakdown.effective * 100) : null;
    }),
  );
  const choice = maxWeightAssignment(weights);

  const seatedAs = new Map<string, RoleInput>();
  const recommendations: SeatRecommendation[] = [];
  seats.forEach((role, seatIndex) => {
    const column = choice[seatIndex] ?? -1;
    if (column < 0) return;
    const person = candidates[column]!;
    seatedAs.set(person.id, role);
    recommendations.push({
      roleId: role.id,
      roleName: role.name,
      userId: person.id,
      handle: person.handle,
      name: person.name,
      breakdown: pairBreakdown(role.id, person.id)!,
      notes: flagsFor(person, ctx),
    });
  });

  // 4. Explain.
  const roleResults: RoleResult[] = roles.map((role) => {
    const funnel: RoleResult['funnel'] = {
      considered: ctx.crew.length,
      onMission: 0,
      skill: 0,
      unavailable: 0,
      conflict: 0,
      restGap: 0,
      eligible: 0,
    };
    const ranked: RankedCandidate[] = [];
    const nearMisses: RoleResult['nearMisses'] = [];
    for (const evaluation of evaluations.get(role.id)!) {
      const first = evaluation.rejections[0];
      if (!first) {
        funnel.eligible += 1;
        ranked.push({
          userId: evaluation.person.id,
          handle: evaluation.person.handle,
          name: evaluation.person.name,
          breakdown: evaluation.breakdown!,
          flags: flagsFor(evaluation.person, ctx),
          seatedAs: seatedAs.get(evaluation.person.id)?.name ?? null,
        });
        continue;
      }
      funnel[FUNNEL_KEY[first.code]] += 1;
      const [onlyShortfall, ...otherShortfalls] = evaluation.shortfalls;
      const onlyShortBy1 =
        evaluation.rejections.length === 1 &&
        first.code === 'SKILL' &&
        onlyShortfall !== undefined &&
        otherShortfalls.length === 0 &&
        onlyShortfall.level === onlyShortfall.min - 1;
      if (onlyShortBy1) {
        nearMisses.push({
          userId: evaluation.person.id,
          handle: evaluation.person.handle,
          name: evaluation.person.name,
          detail: first.detail,
        });
      }
    }
    ranked.sort(byQuality);
    const open = Math.max(0, role.headcount - role.filledBy.length);
    return {
      roleId: role.id,
      roleName: role.name,
      headcount: role.headcount,
      filled: role.filledBy.length,
      open,
      funnel,
      ranked,
      nearMisses,
    };
  });

  for (const recommendation of recommendations) {
    const roleResult = roleResults.find((result) => result.roleId === recommendation.roleId)!;
    const note = explainChoice(recommendation, roleResult, seatedAs);
    if (note) recommendation.notes.unshift(note);
  }

  const unfilled = roleResults
    .map((result) => {
      const seated = recommendations.filter((rec) => rec.roleId === result.roleId).length;
      const seats = result.open - seated;
      return { roleId: result.roleId, roleName: result.roleName, seats, reason: unfilledReason(result, seated) };
    })
    .filter((entry) => entry.seats > 0);

  return {
    missionKey: input.mission.key,
    openSeats: seats.length,
    recommendations,
    unfilled,
    complete: unfilled.length === 0,
    roles: roleResults,
  };
}

/** Why the optimiser did not simply pick the highest raw score for this role. */
function explainChoice(
  chosen: SeatRecommendation,
  role: RoleResult,
  seatedAs: Map<string, RoleInput>,
): string | null {
  const rival = role.ranked
    .filter((candidate) => seatedAs.get(candidate.userId)?.id !== role.roleId)
    .sort((a, b) => b.breakdown.total - a.breakdown.total || a.handle.localeCompare(b.handle))[0];
  if (!rival || rival.breakdown.total <= chosen.breakdown.total) return null;

  const elsewhere = seatedAs.get(rival.userId);
  if (elsewhere) {
    return `${rival.name} scores higher here (${rival.breakdown.total.toFixed(1)}) but is needed as ${elsewhere.name} so every seat fills`;
  }
  if (rival.breakdown.rarityPenalty > 0 && rival.breakdown.effective <= chosen.breakdown.effective) {
    const rare = rival.breakdown.facts.rareSkills
      .map((entry) => `${entry.name} (${entry.holders === 1 ? 'only holder' : `1 of ${entry.holders}`})`)
      .join(', ');
    return `${rival.name} scores higher (${rival.breakdown.total.toFixed(1)}) but is kept free: rare ${rare} not needed for this role`;
  }
  return `${rival.name} scores higher (${rival.breakdown.total.toFixed(1)}); the best overall crew seats ${chosen.name} here`;
}

function unfilledReason(result: RoleResult, seated: number): string {
  if (result.funnel.eligible === 0) {
    const parts: string[] = [];
    const { skill, unavailable, conflict, restGap, onMission } = result.funnel;
    if (skill) parts.push(`${skill} lack the skills`);
    if (unavailable) parts.push(`${unavailable} unavailable`);
    if (conflict) parts.push(`${conflict} committed elsewhere`);
    if (restGap) parts.push(`${restGap} inside the rest gap`);
    if (onMission) parts.push(`${onMission} already on or out of this mission`);
    return `no eligible crew${parts.length ? ` (${parts.join(', ')})` : ''}`;
  }
  const busy = result.funnel.eligible - seated;
  if (busy === 0) return `only ${result.funnel.eligible} eligible for ${result.open} open seats`;
  return `only ${result.funnel.eligible} eligible, and ${busy} ${busy === 1 ? 'is' : 'are'} needed in other roles`;
}

/**
 * Evaluate one person for one role — used for manual nominations/offers and to
 * re-validate nominees at submit time (ignoreOwnSeat skips their existing seat).
 */
export function evaluateCandidate(
  input: MatchInput,
  userId: string,
  roleId: string,
  options: { ignoreOwnSeat?: boolean } = {},
): RoleEvaluation {
  const ctx = buildContext(input);
  const role = input.roles.find((candidate) => candidate.id === roleId);
  const person = ctx.crew.find((candidate) => candidate.id === userId);
  if (!role || !person) throw new Error('evaluateCandidate: unknown role or person');
  const evaluation = evaluatePair(person, role, ctx, options.ignoreOwnSeat ?? false);
  return {
    roleId: role.id,
    roleName: role.name,
    eligible: evaluation.rejections.length === 0,
    rejections: evaluation.rejections,
    breakdown: evaluation.breakdown,
    scheduleIssues: evaluation.issues,
  };
}

export interface CandidateExplanation {
  userId: string;
  handle: string;
  name: string;
  flags: string[];
  roles: Array<
    RoleEvaluation & {
      rank: number | null;
      of: number;
      seatedHere: boolean;
    }
  >;
  seatedAs: string | null;
}

/** "Why (not) this person?" across every role of the mission. */
export function explainCandidate(input: MatchInput, userId: string): CandidateExplanation {
  const ctx = buildContext(input);
  const person = ctx.crew.find((candidate) => candidate.id === userId);
  if (!person) throw new Error('explainCandidate: unknown person');
  const result = runMatch(input);
  const seated = result.recommendations.find((rec) => rec.userId === userId) ?? null;
  const roles = [...input.roles]
    .sort((a, b) => a.position - b.position)
    .map((role) => {
      const evaluation = evaluatePair(person, role, ctx, false);
      const ranked = result.roles.find((entry) => entry.roleId === role.id)!.ranked;
      const index = ranked.findIndex((candidate) => candidate.userId === userId);
      return {
        roleId: role.id,
        roleName: role.name,
        eligible: evaluation.rejections.length === 0,
        rejections: evaluation.rejections,
        breakdown: evaluation.breakdown,
        scheduleIssues: evaluation.issues,
        rank: index >= 0 ? index + 1 : null,
        of: ranked.length,
        seatedHere: seated?.roleId === role.id,
      };
    });
  return {
    userId: person.id,
    handle: person.handle,
    name: person.name,
    flags: flagsFor(person, ctx),
    roles,
    seatedAs: seated?.roleName ?? null,
  };
}

