/**
 * Candidate scoring. Every weight and threshold is a named constant here, so
 * tuning the engine is a one-file change and the design doc can quote them.
 *
 *   score = 100 × (0.45·skill + 0.25·workload + 0.20·experience + 0.10·commitment)
 *
 *   skill       mean of (level / 5) over the role's required skills
 *   workload    1 − committed mission-days in a ±90-day horizon around the mission / horizon length
 *   experience  min(1, completed missions in a role using any of these skills / 5)
 *   commitment  (accepts − dropouts + 2) / (accepts + 2) — smoothed; only drop-outs count
 *
 * Rarity (applied on top, max −5 points): for each expert-level skill the person
 * holds that this role does NOT need, add 1 / (org crew holding it at that level).
 * Close candidates then favour whoever is less rare, keeping scarce people free;
 * a clearly better candidate (> 5 points) still wins.
 */
import { lengthInDays, overlapDays, type DayRange } from '../lib/dates.js';
import type { Commitment } from '../domain/scheduling.js';
import type { CrewSnapshot, RoleRequirement, ScoreBreakdown } from './types.js';

export const WEIGHTS = { skill: 0.45, workload: 0.25, experience: 0.2, commitment: 0.1 } as const;
export const MAX_PROFICIENCY = 5;
export const EXPERIENCE_CAP = 5;
export const WORKLOAD_HORIZON_DAYS = 90;
export const COMMITMENT_PRIOR = 2;
export const RARE_LEVEL = 4;
export const RARITY_MAX_PENALTY = 5;

const round1 = (value: number): number => Math.round(value * 10) / 10;
const round3 = (value: number): number => Math.round(value * 1000) / 1000;

export function skillFit(requirements: readonly RoleRequirement[], skills: ReadonlyMap<string, number>): number {
  if (requirements.length === 0) return 1;
  const sum = requirements.reduce((acc, req) => acc + (skills.get(req.skillId) ?? 0) / MAX_PROFICIENCY, 0);
  return sum / requirements.length;
}

export function workload(
  window: DayRange,
  commitments: readonly Commitment[],
  ignoreMissionId?: string,
): { value: number; committedDays: number; horizonDays: number } {
  const horizon: DayRange = { start: window.start - WORKLOAD_HORIZON_DAYS, end: window.end + WORKLOAD_HORIZON_DAYS };
  const horizonDays = lengthInDays(horizon);
  const committedDays = commitments
    .filter((commitment) => commitment.missionId !== ignoreMissionId)
    .reduce((acc, commitment) => acc + overlapDays(horizon, commitment.range), 0);
  return { value: Math.max(0, 1 - committedDays / horizonDays), committedDays, horizonDays };
}

export function experience(
  completedRoleSkills: readonly string[][],
  requirements: readonly RoleRequirement[],
): { value: number; relevantMissions: number } {
  const needed = new Set(requirements.map((req) => req.skillId));
  const relevantMissions = completedRoleSkills.filter((skillIds) => skillIds.some((id) => needed.has(id))).length;
  return { value: Math.min(1, relevantMissions / EXPERIENCE_CAP), relevantMissions };
}

export function commitment(accepts: number, dropouts: number): number {
  return (accepts - dropouts + COMMITMENT_PRIOR) / (accepts + COMMITMENT_PRIOR);
}

/** skillId → number of crew in the org holding it at RARE_LEVEL or above. */
export function expertCounts(crew: readonly CrewSnapshot[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const person of crew) {
    for (const [skillId, level] of person.skills) {
      if (level >= RARE_LEVEL) counts.set(skillId, (counts.get(skillId) ?? 0) + 1);
    }
  }
  return counts;
}

export function rarity(
  skills: ReadonlyMap<string, number>,
  requirements: readonly RoleRequirement[],
  experts: ReadonlyMap<string, number>,
): { value: number; rareSkills: Array<{ skillId: string; holders: number }> } {
  const needed = new Set(requirements.map((req) => req.skillId));
  const rareSkills: Array<{ skillId: string; holders: number }> = [];
  let value = 0;
  for (const [skillId, level] of skills) {
    if (level < RARE_LEVEL || needed.has(skillId)) continue;
    const holders = experts.get(skillId) ?? 1;
    value += 1 / holders;
    rareSkills.push({ skillId, holders });
  }
  rareSkills.sort((a, b) => a.holders - b.holders || a.skillId.localeCompare(b.skillId));
  return { value: Math.min(1, value), rareSkills };
}

export function scoreCandidate(args: {
  person: CrewSnapshot;
  requirements: readonly RoleRequirement[];
  window: DayRange;
  missionId: string;
  experts: ReadonlyMap<string, number>;
  skillInfo: (skillId: string) => { key: string; name: string };
}): ScoreBreakdown {
  const { person, requirements, window, missionId, experts, skillInfo } = args;
  const skill = skillFit(requirements, person.skills);
  const load = workload(window, person.commitments, missionId);
  const exp = experience(person.history.completedRoleSkills, requirements);
  const reliability = commitment(person.history.accepts, person.history.dropouts);
  const rare = rarity(person.skills, requirements, experts);

  const total = round1(
    100 *
      (WEIGHTS.skill * skill +
        WEIGHTS.workload * load.value +
        WEIGHTS.experience * exp.value +
        WEIGHTS.commitment * reliability),
  );
  const rarityPenalty = round1(RARITY_MAX_PENALTY * rare.value);

  return {
    total,
    effective: round1(total - rarityPenalty),
    components: {
      skill: round3(skill),
      workload: round3(load.value),
      experience: round3(exp.value),
      commitment: round3(reliability),
    },
    weights: { ...WEIGHTS },
    rarityPenalty,
    facts: {
      skills: requirements.map((req) => ({
        skill: skillInfo(req.skillId).key,
        name: skillInfo(req.skillId).name,
        level: person.skills.get(req.skillId) ?? 0,
        min: req.min,
      })),
      committedDays: load.committedDays,
      horizonDays: load.horizonDays,
      relevantMissions: exp.relevantMissions,
      accepts: person.history.accepts,
      dropouts: person.history.dropouts,
      rareSkills: rare.rareSkills.map((entry) => ({ ...skillInfo(entry.skillId), skill: skillInfo(entry.skillId).key, holders: entry.holders })),
    },
  };
}
