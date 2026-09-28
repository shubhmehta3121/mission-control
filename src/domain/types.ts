import type { AssignmentStatus, MissionStatus, Role } from '@prisma/client';

export type { AssignmentKind, AssignmentStatus, MissionStatus, Role } from '@prisma/client';

/** The authenticated caller. orgId always comes from the token, never from the request. */
export interface Actor {
  userId: string;
  orgId: string;
  role: Role;
  handle: string;
  name: string;
  org: { slug: string; name: string; keyPrefix: string };
}

const ROLE_RANK: Record<Role, number> = { CREW_MEMBER: 0, MISSION_LEAD: 1, DIRECTOR: 2 };

/** Role hierarchy: DIRECTOR ⊃ MISSION_LEAD ⊃ CREW_MEMBER. */
export function hasRoleAtLeast(actor: Pick<Actor, 'role'>, role: Role): boolean {
  return ROLE_RANK[actor.role] >= ROLE_RANK[role];
}

export const ROLE_LABEL: Record<Role, string> = {
  DIRECTOR: 'Director',
  MISSION_LEAD: 'Mission Lead',
  CREW_MEMBER: 'Crew Member',
};

/** Assignment statuses that occupy a seat. */
export const LIVE_SEAT_STATUSES: readonly AssignmentStatus[] = ['PROPOSED', 'OFFERED', 'ACCEPTED'];

export const TERMINAL_MISSION_STATUSES: readonly MissionStatus[] = ['COMPLETED', 'CANCELLED'];

export function missionKey(keyPrefix: string, number: number): string {
  return `${keyPrefix}-${number}`;
}
