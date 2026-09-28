import type { DayRange } from '../lib/dates.js';
import type { AssignmentStatus } from '../domain/types.js';
import type { Commitment, ScheduleIssue } from '../domain/scheduling.js';

/**
 * Everything the matcher needs, loaded up front. The matcher is a pure function
 * over this snapshot: no I/O, deterministic, unit-testable without a database.
 */
export interface MatchInput {
  mission: { id: string; key: string; window: DayRange };
  roles: RoleInput[];
  crew: CrewSnapshot[];
  skills: ReadonlyMap<string, { key: string; name: string }>;
  settings: { restGapDays: number };
}

export interface RoleInput {
  id: string;
  name: string;
  headcount: number;
  position: number;
  requirements: RoleRequirement[];
  /** Crew already holding a live seat in this role (PROPOSED / OFFERED / ACCEPTED primaries). */
  filledBy: string[];
}

export interface RoleRequirement {
  skillId: string;
  min: number;
}

export interface CrewSnapshot {
  id: string;
  handle: string;
  name: string;
  /** skillId → self-rated proficiency 1–5 */
  skills: ReadonlyMap<string, number>;
  unavailable: DayRange[];
  /** Accepted seats on other missions (approved, active or completed). */
  commitments: Commitment[];
  /** Soft signals: offers or submitted nominations on other missions. Flagged, never filtered. */
  pending: Array<{ missionKey: string; range: DayRange; status: 'OFFERED' | 'PROPOSED' }>;
  history: {
    /** For each completed mission the person crewed: the skill ids that role required. */
    completedRoleSkills: string[][];
    /** Seats ever accepted (including later dropped or released). */
    accepts: number;
    /** Seats dropped after accepting. */
    dropouts: number;
  };
  /** This person's most relevant assignment on the mission being matched, if any. */
  onThisMission: { status: AssignmentStatus; roleId: string } | null;
}

export interface ScoreBreakdown {
  /** 0–100 weighted score. */
  total: number;
  /** total − rarity penalty: what the optimiser ranks by. */
  effective: number;
  /** Each component on a 0–1 scale. */
  components: { skill: number; workload: number; experience: number; commitment: number };
  weights: { skill: number; workload: number; experience: number; commitment: number };
  rarityPenalty: number;
  facts: {
    skills: Array<{ skill: string; name: string; level: number; min: number }>;
    committedDays: number;
    horizonDays: number;
    relevantMissions: number;
    accepts: number;
    dropouts: number;
    rareSkills: Array<{ skill: string; name: string; holders: number }>;
  };
}

export type FilterCode = 'ON_MISSION' | 'SKILL' | 'UNAVAILABLE' | 'CONFLICT' | 'REST_GAP';

export interface Rejection {
  code: FilterCode;
  detail: string;
}

export interface RankedCandidate {
  userId: string;
  handle: string;
  name: string;
  breakdown: ScoreBreakdown;
  flags: string[];
  /** Name of the role the optimiser seated this person in, if any. */
  seatedAs: string | null;
}

export interface RoleResult {
  roleId: string;
  roleName: string;
  headcount: number;
  filled: number;
  open: number;
  funnel: {
    considered: number;
    onMission: number;
    skill: number;
    unavailable: number;
    conflict: number;
    restGap: number;
    eligible: number;
  };
  /** Eligible candidates, best effective score first. */
  ranked: RankedCandidate[];
  nearMisses: Array<{ userId: string; handle: string; name: string; detail: string }>;
}

export interface SeatRecommendation {
  roleId: string;
  roleName: string;
  userId: string;
  handle: string;
  name: string;
  breakdown: ScoreBreakdown;
  notes: string[];
}

export interface MatchResult {
  missionKey: string;
  openSeats: number;
  recommendations: SeatRecommendation[];
  unfilled: Array<{ roleId: string; roleName: string; seats: number; reason: string }>;
  complete: boolean;
  roles: RoleResult[];
}

export interface RoleEvaluation {
  roleId: string;
  roleName: string;
  eligible: boolean;
  rejections: Rejection[];
  breakdown: ScoreBreakdown | null;
  scheduleIssues: ScheduleIssue[];
}
