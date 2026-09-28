/** Compact builders for matcher inputs, so each test reads like the scenario it checks. */
import { parseIsoDate, toDay, type DayRange } from '../../src/lib/dates.js';
import type { CrewSnapshot, MatchInput, RoleInput } from '../../src/matcher/types.js';

export const SKILL_NAMES: Record<string, string> = {
  nav: 'Orbital Navigation',
  eva: 'EVA Ops',
  robotics: 'Robotics',
  comms: 'Comms',
  medic: 'Flight Medicine',
  piloting: 'Piloting',
};

export function range(start: string, end: string): DayRange {
  const from = parseIsoDate(start);
  const to = parseIsoDate(end);
  if (!from || !to) throw new Error(`bad range ${start}..${end}`);
  return { start: toDay(from), end: toDay(to) };
}

export const WINDOW = range('2026-11-01', '2026-11-30');

export function person(
  handle: string,
  skills: Record<string, number>,
  extra: Partial<Omit<CrewSnapshot, 'id' | 'handle' | 'skills'>> = {},
): CrewSnapshot {
  return {
    id: `u-${handle}`,
    handle,
    name: handle.charAt(0).toUpperCase() + handle.slice(1),
    skills: new Map(Object.entries(skills)),
    unavailable: [],
    commitments: [],
    pending: [],
    history: { completedRoleSkills: [], accepts: 0, dropouts: 0 },
    onThisMission: null,
    ...extra,
  };
}

export function role(
  name: string,
  requirements: Record<string, number>,
  options: { headcount?: number; position?: number; filledBy?: string[] } = {},
): RoleInput {
  return {
    id: `r-${name.toLowerCase().replace(/\s+/g, '-')}`,
    name,
    headcount: options.headcount ?? 1,
    position: options.position ?? 0,
    requirements: Object.entries(requirements).map(([skillId, min]) => ({ skillId, min })),
    filledBy: options.filledBy ?? [],
  };
}

export function matchInput(args: {
  roles: RoleInput[];
  crew: CrewSnapshot[];
  window?: DayRange;
  restGapDays?: number;
}): MatchInput {
  return {
    mission: { id: 'm-target', key: 'AST-1', window: args.window ?? WINDOW },
    roles: args.roles.map((entry, index) => ({ ...entry, position: entry.position || index })),
    crew: args.crew,
    skills: new Map(Object.entries(SKILL_NAMES).map(([key, name]) => [key, { key, name }])),
    settings: { restGapDays: args.restGapDays ?? 14 },
  };
}

/** N completed missions whose role required `skill` (feeds experience and accepts). */
export function history(skill: string, completed: number, dropouts = 0): CrewSnapshot['history'] {
  return {
    completedRoleSkills: Array.from({ length: completed }, () => [skill]),
    accepts: completed + dropouts,
    dropouts,
  };
}
