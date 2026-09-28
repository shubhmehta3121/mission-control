/**
 * Loads the org-scoped snapshot the pure matcher runs on. All reads are scoped
 * by orgId; the matcher itself never touches the database.
 */
import type { AssignmentStatus, MissionStatus } from '@prisma/client';
import { rangeOf } from '../lib/dates.js';
import type { Commitment, ScheduleSubject } from '../domain/scheduling.js';
import { LIVE_SEAT_STATUSES, missionKey } from '../domain/types.js';
import type { CrewSnapshot, MatchInput } from '../matcher/types.js';
import type { Db } from './context.js';

/** Missions whose accepted seats are real commitments (past or future). */
const COMMITTING_STATUSES: readonly MissionStatus[] = ['APPROVED', 'ACTIVE', 'COMPLETED'];

interface AssignmentRow {
  userId: string;
  missionId: string;
  roleId: string;
  status: AssignmentStatus;
  kind: 'PRIMARY' | 'BACKUP';
  expiresAt: Date | null;
  mission: { id: string; number: number; startDate: Date; endDate: Date; status: MissionStatus };
  role: { requirements: Array<{ skillId: string }> };
}

const assignmentSelect = {
  userId: true,
  missionId: true,
  roleId: true,
  status: true,
  kind: true,
  expiresAt: true,
  mission: { select: { id: true, number: true, startDate: true, endDate: true, status: true } },
  role: { select: { requirements: { select: { skillId: true } } } },
} as const;

function commitmentsFrom(rows: AssignmentRow[], keyPrefix: string): Commitment[] {
  return rows
    .filter(
      (row) =>
        row.status === 'ACCEPTED' && row.kind === 'PRIMARY' && COMMITTING_STATUSES.includes(row.mission.status),
    )
    .map((row) => ({
      missionId: row.missionId,
      missionKey: missionKey(keyPrefix, row.mission.number),
      range: rangeOf(row.mission.startDate, row.mission.endDate),
    }));
}

const ON_MISSION_PRIORITY: Record<AssignmentStatus, number> = {
  ACCEPTED: 0,
  OFFERED: 1,
  PROPOSED: 2,
  DECLINED: 3,
  DROPPED: 4,
  EXPIRED: 5,
  WITHDRAWN: 6,
  RELEASED: 7,
};

function buildCrewSnapshot(
  user: {
    id: string;
    handle: string;
    name: string;
    skills: Array<{ skillId: string; proficiency: number }>;
    unavailability: Array<{ startDate: Date; endDate: Date }>;
  },
  rows: AssignmentRow[],
  targetMissionId: string,
  keyPrefix: string,
  now: Date,
): CrewSnapshot {
  const others = rows.filter((row) => row.missionId !== targetMissionId);
  const onTarget = rows
    .filter((row) => row.missionId === targetMissionId)
    .sort((a, b) => ON_MISSION_PRIORITY[a.status] - ON_MISSION_PRIORITY[b.status])[0];

  const pending: CrewSnapshot['pending'] = others
    .filter(
      (row) =>
        (row.status === 'OFFERED' &&
          (row.expiresAt === null || row.expiresAt > now) &&
          (row.mission.status === 'APPROVED' || row.mission.status === 'ACTIVE')) ||
        (row.status === 'PROPOSED' && row.mission.status === 'SUBMITTED'),
    )
    .map((row) => ({
      missionKey: missionKey(keyPrefix, row.mission.number),
      range: rangeOf(row.mission.startDate, row.mission.endDate),
      status: row.status as 'OFFERED' | 'PROPOSED',
    }));

  return {
    id: user.id,
    handle: user.handle,
    name: user.name,
    skills: new Map(user.skills.map((skill) => [skill.skillId, skill.proficiency])),
    unavailable: user.unavailability.map((window) => rangeOf(window.startDate, window.endDate)),
    commitments: commitmentsFrom(others, keyPrefix),
    pending,
    history: {
      completedRoleSkills: others
        .filter((row) => row.status === 'ACCEPTED' && row.mission.status === 'COMPLETED')
        .map((row) => row.role.requirements.map((req) => req.skillId)),
      accepts: rows.filter((row) => ['ACCEPTED', 'DROPPED', 'RELEASED'].includes(row.status)).length,
      dropouts: rows.filter((row) => row.status === 'DROPPED').length,
    },
    onThisMission: onTarget ? { status: onTarget.status, roleId: onTarget.roleId } : null,
  };
}

export async function loadMatchInput(
  db: Db,
  args: { orgId: string; keyPrefix: string; missionId: string; now: Date },
): Promise<MatchInput> {
  const { orgId, keyPrefix, missionId, now } = args;
  const [mission, org, skills, crew] = await Promise.all([
    db.mission.findFirstOrThrow({
      where: { id: missionId, orgId },
      include: {
        roles: {
          orderBy: { position: 'asc' },
          include: {
            requirements: true,
            assignments: { where: { kind: 'PRIMARY', status: { in: [...LIVE_SEAT_STATUSES] } }, select: { userId: true } },
          },
        },
      },
    }),
    db.organization.findUniqueOrThrow({ where: { id: orgId } }),
    db.skill.findMany({ where: { orgId } }),
    db.user.findMany({
      where: { orgId, role: 'CREW_MEMBER' },
      include: { skills: true, unavailability: true },
    }),
  ]);

  const rows = (await db.assignment.findMany({
    where: { orgId, userId: { in: crew.map((user) => user.id) } },
    select: assignmentSelect,
  })) as AssignmentRow[];
  const rowsByUser = new Map<string, AssignmentRow[]>();
  for (const row of rows) rowsByUser.set(row.userId, [...(rowsByUser.get(row.userId) ?? []), row]);

  return {
    mission: {
      id: mission.id,
      key: missionKey(keyPrefix, mission.number),
      window: rangeOf(mission.startDate, mission.endDate),
    },
    roles: mission.roles.map((role) => ({
      id: role.id,
      name: role.name,
      headcount: role.headcount,
      position: role.position,
      requirements: role.requirements.map((req) => ({ skillId: req.skillId, min: req.minProficiency })),
      filledBy: role.assignments.map((assignment) => assignment.userId),
    })),
    crew: crew.map((user) => buildCrewSnapshot(user, rowsByUser.get(user.id) ?? [], mission.id, keyPrefix, now)),
    skills: new Map(skills.map((skill) => [skill.id, { key: skill.key, name: skill.name }])),
    settings: { restGapDays: org.restGapDays },
  };
}

/** Unavailability + accepted commitments for specific people (accept checks, blocked-offer flags). */
export async function loadSchedules(
  db: Db,
  args: { orgId: string; keyPrefix: string; userIds: string[] },
): Promise<Map<string, ScheduleSubject>> {
  const { orgId, keyPrefix, userIds } = args;
  if (userIds.length === 0) return new Map();
  const [windows, rows] = await Promise.all([
    db.unavailability.findMany({ where: { orgId, userId: { in: userIds } } }),
    db.assignment.findMany({
      where: { orgId, userId: { in: userIds }, status: 'ACCEPTED', kind: 'PRIMARY' },
      select: assignmentSelect,
    }) as Promise<AssignmentRow[]>,
  ]);
  const schedules = new Map<string, ScheduleSubject>();
  for (const userId of userIds) {
    schedules.set(userId, {
      unavailable: windows.filter((window) => window.userId === userId).map((window) => rangeOf(window.startDate, window.endDate)),
      commitments: commitmentsFrom(
        rows.filter((row) => row.userId === userId),
        keyPrefix,
      ),
    });
  }
  return schedules;
}
