/**
 * Missions: create/edit, roles, the approval lifecycle, and the mission views.
 * Every query is scoped by ctx.actor.orgId; every state change goes through the
 * lifecycle table (assertMissionAction) and a compare-and-set update.
 */
import type { AssignmentKind, AssignmentStatus, Mission, MissionStatus, Prisma, SubmissionDecision } from '@prisma/client';
import { AppError, forbidden, notFound } from '../lib/errors.js';
import { rangeOf, startOfUtcDay, toDay } from '../lib/dates.js';
import { allowedMissionActions, assertMissionAction, ruleFor, type MissionAction } from '../domain/lifecycle.js';
import { scheduleIssues } from '../domain/scheduling.js';
import { LIVE_SEAT_STATUSES, hasRoleAtLeast, missionKey } from '../domain/types.js';
import { evaluateCandidate } from '../matcher/matcher.js';
import { lockMission, moveAssignment, moveMission, parseMissionKey, recordEvent, tx, type Ctx, type Db } from './context.js';
import { deadlineWarning, offerDeadline, sweepExpiredOffers } from './expiry.js';
import { loadMatchInput, loadSchedules } from './snapshot.js';
import { BLOCKED_FOR_LEAD, blockedForCrew, dateOnly, person, windowView } from './views.js';

export interface RoleSpec {
  name: string;
  headcount: number;
  skills: Array<{ skill: string; min: number }>;
}

export interface CreateMissionInput {
  title: string;
  description?: string | undefined;
  startDate: Date;
  endDate: Date;
  roles?: RoleSpec[] | undefined;
}

export interface UpdateMissionInput {
  title?: string | undefined;
  description?: string | null | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
}

// ── Loading & visibility ─────────────────────────────────────────────────────

/**
 * Resolves a mission key for the caller. Leads and directors see every mission
 * in their org; crew only see missions they have actually been offered. Anything
 * else is "not found" — including other organisations' keys.
 */
export async function loadMission(ctx: Ctx, key: string, db: Db = ctx.db): Promise<Mission> {
  const number = parseMissionKey(ctx.actor, key);
  const mission = await db.mission.findUnique({ where: { orgId_number: { orgId: ctx.actor.orgId, number } } });
  if (!mission) throw notFound(`Mission ${key}`);
  if (!hasRoleAtLeast(ctx.actor, 'MISSION_LEAD')) {
    const visible = await db.assignment.findFirst({
      where: { orgId: ctx.actor.orgId, missionId: mission.id, userId: ctx.actor.userId, offeredAt: { not: null } },
      select: { id: true },
    });
    if (!visible) throw notFound(`Mission ${key}`);
  }
  return mission;
}

/**
 * Resolve the key (with the visibility check) outside the transaction — the
 * key → id mapping never changes — then lock the mission row and re-read it as
 * the first thing inside. Every write to a mission or its seats goes through here.
 */
export async function withLockedMission<T>(
  ctx: Ctx,
  key: string,
  fn: (db: Prisma.TransactionClient, mission: Mission) => Promise<T>,
): Promise<T> {
  const ref = await loadMission(ctx, key);
  return tx(ctx, async (db) => {
    await lockMission(db, ctx.actor.orgId, ref.id);
    const mission = await db.mission.findFirstOrThrow({ where: { id: ref.id, orgId: ctx.actor.orgId } });
    return fn(db, mission);
  });
}

function keyOf(ctx: Ctx, mission: { number: number }): string {
  return missionKey(ctx.actor.org.keyPrefix, mission.number);
}

// ── Validation helpers ───────────────────────────────────────────────────────

function assertWindow(ctx: Ctx, startDate: Date, endDate: Date): void {
  if (toDay(endDate) < toDay(startDate)) {
    throw new AppError('VALIDATION_FAILED', 'The end date must be on or after the start date.');
  }
  if (toDay(startDate) <= toDay(ctx.clock.now())) {
    throw new AppError('VALIDATION_FAILED', 'Missions must start in the future (after today).');
  }
}

async function resolveRoleSpecs(
  db: Db,
  orgId: string,
  specs: RoleSpec[],
): Promise<Array<RoleSpec & { skillIds: Array<{ skillId: string; min: number }> }>> {
  const names = specs.map((spec) => spec.name.trim().toLowerCase());
  const duplicate = names.find((name, index) => names.indexOf(name) !== index);
  if (duplicate) throw new AppError('VALIDATION_FAILED', `Role "${duplicate}" is listed twice.`);

  const keys = [...new Set(specs.flatMap((spec) => spec.skills.map((entry) => entry.skill.toLowerCase())))];
  const skills = await db.skill.findMany({ where: { orgId, key: { in: keys } } });
  const byKey = new Map(skills.map((skill) => [skill.key, skill.id]));
  const unknown = keys.filter((key) => !byKey.has(key));
  if (unknown.length > 0) {
    throw new AppError('VALIDATION_FAILED', `Unknown skill${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}. See \`mc skills list\`.`, {
      unknownSkills: unknown,
    });
  }
  return specs.map((spec) => {
    const seen = new Set<string>();
    for (const entry of spec.skills) {
      if (seen.has(entry.skill.toLowerCase())) {
        throw new AppError('VALIDATION_FAILED', `Role "${spec.name}" lists skill "${entry.skill}" twice.`);
      }
      seen.add(entry.skill.toLowerCase());
    }
    return {
      ...spec,
      name: spec.name.trim(),
      skillIds: spec.skills.map((entry) => ({ skillId: byKey.get(entry.skill.toLowerCase())!, min: entry.min })),
    };
  });
}

async function replaceRoles(db: Prisma.TransactionClient, ctx: Ctx, mission: Mission, specs: RoleSpec[]): Promise<number> {
  const resolved = await resolveRoleSpecs(db, ctx.actor.orgId, specs);
  const cleared = await db.assignment.deleteMany({
    where: { orgId: ctx.actor.orgId, missionId: mission.id, status: 'PROPOSED' },
  });
  await db.missionRole.deleteMany({ where: { orgId: ctx.actor.orgId, missionId: mission.id } });
  for (const [position, spec] of resolved.entries()) {
    await db.missionRole.create({
      data: {
        orgId: ctx.actor.orgId,
        missionId: mission.id,
        name: spec.name,
        headcount: spec.headcount,
        position,
        // org_id on each requirement is inherited from the role through the composite key.
        requirements: {
          create: spec.skillIds.map((entry) => ({ skillId: entry.skillId, minProficiency: entry.min })),
        },
      },
    });
  }
  return cleared.count;
}

// ── Commands ─────────────────────────────────────────────────────────────────

export async function createMission(ctx: Ctx, input: CreateMissionInput): Promise<MissionView> {
  if (!hasRoleAtLeast(ctx.actor, 'MISSION_LEAD')) {
    throw new AppError('FORBIDDEN', 'Only mission leads and directors can create missions.');
  }
  assertWindow(ctx, input.startDate, input.endDate);
  const mission = await tx(ctx, async (db) => {
    const org = await db.organization.update({
      where: { id: ctx.actor.orgId },
      data: { missionSeq: { increment: 1 } },
    });
    const created = await db.mission.create({
      data: {
        orgId: ctx.actor.orgId,
        number: org.missionSeq,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        startDate: input.startDate,
        endDate: input.endDate,
        ownerId: ctx.actor.userId,
      },
    });
    if (input.roles?.length) await replaceRoles(db, ctx, created, input.roles);
    await recordEvent(db, {
      orgId: ctx.actor.orgId,
      missionId: created.id,
      actorId: ctx.actor.userId,
      type: 'MISSION_CREATED',
      to: 'DRAFT',
      payload: { title: created.title, roles: input.roles?.length ?? 0 },
    });
    return created;
  });
  return getMissionView(ctx, mission);
}

export async function updateMission(ctx: Ctx, key: string, input: UpdateMissionInput): Promise<MissionView> {
  const mission = await withLockedMission(ctx, key, async (db, current) => {
    assertMissionAction('edit', current, ctx.actor);
    const startDate = input.startDate ?? current.startDate;
    const endDate = input.endDate ?? current.endDate;
    if (input.startDate || input.endDate) assertWindow(ctx, startDate, endDate);
    const updated = await db.mission.update({
      where: { id: current.id, orgId: ctx.actor.orgId },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
        startDate,
        endDate,
      },
    });
    await recordEvent(db, {
      orgId: ctx.actor.orgId,
      missionId: current.id,
      actorId: ctx.actor.userId,
      type: 'MISSION_UPDATED',
      payload: {
        fields: Object.keys(input).filter((field) => input[field as keyof UpdateMissionInput] !== undefined),
      },
    });
    return updated;
  });
  return getMissionView(ctx, mission);
}

export async function setRoles(ctx: Ctx, key: string, specs: RoleSpec[]): Promise<MissionView & { clearedNominations: number }> {
  let cleared = 0;
  const mission = await withLockedMission(ctx, key, async (db, current) => {
    assertMissionAction('edit', current, ctx.actor);
    cleared = await replaceRoles(db, ctx, current, specs);
    await recordEvent(db, {
      orgId: ctx.actor.orgId,
      missionId: current.id,
      actorId: ctx.actor.userId,
      type: 'ROLES_UPDATED',
      payload: { roles: specs.map((spec) => `${spec.name} ×${spec.headcount}`), clearedNominations: cleared },
    });
    return current;
  });
  return { ...(await getMissionView(ctx, mission)), clearedNominations: cleared };
}

export async function submitMission(ctx: Ctx, key: string): Promise<MissionView> {
  const now = ctx.clock.now();
  const mission = await withLockedMission(ctx, key, async (db, current) => {
    assertMissionAction('submit', current, ctx.actor);
    const roles = await rolesWithSeats(db, current);
    const blockers = submitBlockers(current, roles, now);
    if (blockers.length > 0) {
      throw new AppError('PRECONDITION_FAILED', 'This mission is not ready to submit.', { blockers });
    }

    // Re-check every nominee: availability may have changed since nomination.
    const input = await loadMatchInput(db, {
      orgId: ctx.actor.orgId,
      keyPrefix: ctx.actor.org.keyPrefix,
      missionId: current.id,
      now,
    });
    const problems: string[] = [];
    const nominees: Array<{ roleName: string; handle: string; name: string; score: number; breakdown: unknown }> = [];
    for (const role of roles) {
      for (const seat of role.assignments.filter((entry) => entry.status === 'PROPOSED')) {
        const verdict = evaluateCandidate(input, seat.userId, role.id, { ignoreOwnSeat: true });
        if (!verdict.eligible) {
          problems.push(`${seat.user.name} (${role.name}): ${verdict.rejections.map((entry) => entry.detail).join('; ')}`);
          continue;
        }
        await moveAssignment(db, seat, ['PROPOSED'], {
          score: verdict.breakdown!.total,
          scoreBreakdown: verdict.breakdown as unknown as Prisma.InputJsonObject,
        });
        nominees.push({
          roleName: role.name,
          handle: seat.user.handle,
          name: seat.user.name,
          score: verdict.breakdown!.total,
          breakdown: verdict.breakdown,
        });
      }
    }
    if (problems.length > 0) {
      throw new AppError(
        'PRECONDITION_FAILED',
        'Some nominees are no longer eligible. Remove them (`mc missions unnominate`) and nominate again.',
        { blockers: problems },
      );
    }

    const round = (await db.missionSubmission.count({ where: { orgId: ctx.actor.orgId, missionId: current.id } })) + 1;
    const snapshot = {
      title: current.title,
      startDate: dateOnly(current.startDate),
      endDate: dateOnly(current.endDate),
      roles: roles.map((role) => ({
        name: role.name,
        headcount: role.headcount,
        skills: role.requirements.map((req) => ({ skill: req.skill.key, min: req.minProficiency })),
        nominees: nominees.filter((entry) => entry.roleName === role.name).map(({ roleName: _role, ...rest }) => rest),
      })),
    };
    await db.missionSubmission.create({
      data: {
        orgId: ctx.actor.orgId,
        missionId: current.id,
        round,
        submittedById: ctx.actor.userId,
        submittedAt: now,
        snapshot: snapshot as unknown as Prisma.InputJsonObject,
      },
    });
    await moveMission(db, current, ruleFor('submit').from, 'SUBMITTED');
    await recordEvent(db, {
      orgId: ctx.actor.orgId,
      missionId: current.id,
      actorId: ctx.actor.userId,
      type: 'MISSION_SUBMITTED',
      from: current.status,
      to: 'SUBMITTED',
      payload: { round, nominees: nominees.length },
    });
    return current;
  });
  return getMissionView(ctx, mission);
}

async function decide(
  db: Prisma.TransactionClient,
  ctx: Ctx,
  mission: Mission,
  decision: 'APPROVED' | 'REJECTED' | 'CANCELLED',
  note: string | null,
): Promise<number | null> {
  const pending = await db.missionSubmission.findFirst({
    where: { orgId: ctx.actor.orgId, missionId: mission.id, decision: 'PENDING' },
    orderBy: { round: 'desc' },
  });
  if (!pending) return null;
  const { count } = await db.missionSubmission.updateMany({
    where: { id: pending.id, orgId: ctx.actor.orgId, decision: 'PENDING' },
    data: { decision, decidedById: ctx.actor.userId, decidedAt: ctx.clock.now(), note },
  });
  if (count !== 1) throw new AppError('INVALID_TRANSITION', 'This submission was decided while you were reviewing it. Reload and try again.');
  return pending.round;
}

export async function approveMission(
  ctx: Ctx,
  key: string,
  note?: string,
): Promise<MissionView & { offersSent: number; warnings: string[] }> {
  const now = ctx.clock.now();
  let offersSent = 0;
  const warnings: string[] = [];
  const mission = await withLockedMission(ctx, key, async (db, current) => {
    assertMissionAction('approve', current, ctx.actor);
    const round = await decide(db, ctx, current, 'APPROVED', note?.trim() || null);
    await moveMission(db, current, ['SUBMITTED'], 'APPROVED');
    const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.actor.orgId } });
    const expiresAt = offerDeadline(now, current.startDate, org.offerTtlDays);
    const shortNotice = deadlineWarning(now, current.startDate, org.offerTtlDays);
    if (shortNotice) warnings.push(shortNotice);
    const proposed = await db.assignment.findMany({
      where: { orgId: ctx.actor.orgId, missionId: current.id, status: 'PROPOSED' },
      include: { user: { select: { handle: true } } },
    });
    await db.assignment.updateMany({
      where: { orgId: ctx.actor.orgId, missionId: current.id, status: 'PROPOSED' },
      data: { status: 'OFFERED', offeredAt: now, expiresAt },
    });
    offersSent = proposed.length;
    await recordEvent(db, {
      orgId: ctx.actor.orgId,
      missionId: current.id,
      actorId: ctx.actor.userId,
      type: 'MISSION_APPROVED',
      from: 'SUBMITTED',
      to: 'APPROVED',
      payload: { round, note: note?.trim() || null },
    });
    await recordEvent(db, {
      orgId: ctx.actor.orgId,
      missionId: current.id,
      actorId: ctx.actor.userId,
      type: 'OFFERS_SENT',
      payload: { crew: proposed.map((seat) => seat.user.handle), expiresAt: expiresAt.toISOString() },
    });
    return current;
  });
  return { ...(await getMissionView(ctx, mission)), offersSent, warnings };
}

export async function rejectMission(ctx: Ctx, key: string, note: string): Promise<MissionView> {
  const mission = await withLockedMission(ctx, key, async (db, current) => {
    assertMissionAction('reject', current, ctx.actor);
    const round = await decide(db, ctx, current, 'REJECTED', note.trim());
    await moveMission(db, current, ['SUBMITTED'], 'REJECTED');
    await recordEvent(db, {
      orgId: ctx.actor.orgId,
      missionId: current.id,
      actorId: ctx.actor.userId,
      type: 'MISSION_REJECTED',
      from: 'SUBMITTED',
      to: 'REJECTED',
      payload: { round, note: note.trim() },
    });
    return current;
  });
  return getMissionView(ctx, mission);
}

export async function cancelMission(
  ctx: Ctx,
  key: string,
  reason: string,
): Promise<MissionView & { released: number; withdrawn: number }> {
  const now = ctx.clock.now();
  let released = 0;
  let withdrawn = 0;
  const mission = await withLockedMission(ctx, key, async (db, current) => {
    assertMissionAction('cancel', current, ctx.actor);
    const text = `Mission cancelled: ${reason.trim()}`;
    if (current.status === 'SUBMITTED') await decide(db, ctx, current, 'CANCELLED', reason.trim());
    withdrawn = (
      await db.assignment.updateMany({
        where: { orgId: ctx.actor.orgId, missionId: current.id, status: { in: ['PROPOSED', 'OFFERED'] } },
        data: { status: 'WITHDRAWN', reason: text, closedAt: now },
      })
    ).count;
    released = (
      await db.assignment.updateMany({
        where: { orgId: ctx.actor.orgId, missionId: current.id, status: 'ACCEPTED' },
        data: { status: 'RELEASED', reason: text, closedAt: now },
      })
    ).count;
    await moveMission(db, current, ruleFor('cancel').from, 'CANCELLED', { cancelReason: reason.trim() });
    await recordEvent(db, {
      orgId: ctx.actor.orgId,
      missionId: current.id,
      actorId: ctx.actor.userId,
      type: 'MISSION_CANCELLED',
      from: current.status,
      to: 'CANCELLED',
      payload: { reason: reason.trim(), released, withdrawn },
    });
    return current;
  });
  return { ...(await getMissionView(ctx, mission)), released, withdrawn };
}

export async function activateMission(ctx: Ctx, key: string): Promise<MissionView> {
  const mission = await withLockedMission(ctx, key, async (db, current) => {
    assertMissionAction('activate', current, ctx.actor);
    const blockers = activateBlockers(await rolesWithSeats(db, current));
    if (blockers.length > 0) {
      throw new AppError('PRECONDITION_FAILED', 'Every seat must be accepted before the mission can go active.', { blockers });
    }
    await moveMission(db, current, ['APPROVED'], 'ACTIVE');
    await recordEvent(db, {
      orgId: ctx.actor.orgId,
      missionId: current.id,
      actorId: ctx.actor.userId,
      type: 'MISSION_ACTIVATED',
      from: 'APPROVED',
      to: 'ACTIVE',
    });
    return current;
  });
  return getMissionView(ctx, mission);
}

export async function completeMission(ctx: Ctx, key: string): Promise<MissionView> {
  const mission = await withLockedMission(ctx, key, async (db, current) => {
    assertMissionAction('complete', current, ctx.actor);
    await moveMission(db, current, ['ACTIVE'], 'COMPLETED');
    await recordEvent(db, {
      orgId: ctx.actor.orgId,
      missionId: current.id,
      actorId: ctx.actor.userId,
      type: 'MISSION_COMPLETED',
      from: 'ACTIVE',
      to: 'COMPLETED',
    });
    return current;
  });
  return getMissionView(ctx, mission);
}

// ── Guards that need data ────────────────────────────────────────────────────

type RoleWithSeats = Awaited<ReturnType<typeof rolesWithSeats>>[number];

async function rolesWithSeats(db: Db, mission: Mission) {
  return db.missionRole.findMany({
    where: { orgId: mission.orgId, missionId: mission.id },
    orderBy: { position: 'asc' },
    include: {
      requirements: { include: { skill: true } },
      assignments: {
        include: { user: { select: { id: true, handle: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

function countSeats(role: RoleWithSeats, status: 'PROPOSED' | 'OFFERED' | 'ACCEPTED'): number {
  return role.assignments.filter((seat) => seat.kind === 'PRIMARY' && seat.status === status).length;
}

function submitBlockers(mission: Mission, roles: RoleWithSeats[], now: Date): string[] {
  const blockers: string[] = [];
  if (toDay(mission.startDate) <= toDay(startOfUtcDay(now))) blockers.push('The start date has passed — move the dates.');
  if (roles.length === 0) blockers.push('Add at least one role (`mc missions roles set`).');
  for (const role of roles) {
    const nominated = countSeats(role, 'PROPOSED');
    if (nominated < role.headcount) blockers.push(`${role.name}: ${nominated}/${role.headcount} seats nominated`);
    if (nominated > role.headcount) {
      blockers.push(`${role.name}: ${nominated} nominated for ${role.headcount} seat${role.headcount === 1 ? '' : 's'} — remove ${nominated - role.headcount} (mc missions unnominate)`);
    }
  }
  return blockers;
}

function activateBlockers(roles: RoleWithSeats[]): string[] {
  return roles
    .map((role) => ({ role, accepted: countSeats(role, 'ACCEPTED') }))
    .filter(({ role, accepted }) => accepted !== role.headcount)
    .map(({ role, accepted }) =>
      accepted < role.headcount
        ? `${role.name}: ${accepted}/${role.headcount} accepted`
        : `${role.name}: ${accepted} accepted for ${role.headcount} seat${role.headcount === 1 ? '' : 's'} — resolve before activating`,
    );
}

// ── Views ────────────────────────────────────────────────────────────────────

export interface SeatView {
  handle: string;
  name: string;
  kind: AssignmentKind;
  status: AssignmentStatus;
  score: number;
  breakdown: unknown;
  offeredAt: string | null;
  expiresAt: string | null;
  respondedAt: string | null;
  reason: string | null;
  blocked: string | null;
}

export interface ReviewView {
  round: number;
  submittedBy: { handle: string; name: string };
  submittedAt: string;
  decision: SubmissionDecision;
  decidedBy: { handle: string; name: string } | null;
  decidedAt: string | null;
  note: string | null;
}

export interface MissionView {
  key: string;
  title: string;
  description: string | null;
  status: MissionStatus;
  startDate: string;
  endDate: string;
  days: number;
  owner: { handle: string; name: string };
  cancelReason: string | null;
  viewer: 'lead' | 'crew';
  roles?: Array<{
    name: string;
    headcount: number;
    skills: Array<{ key: string; name: string; min: number }>;
    seats: SeatView[];
    closed: SeatView[];
    open: number;
  }>;
  staffing?: { seats: number; proposed: number; offered: number; accepted: number; open: number };
  /** Latest review round. */
  review?: ReviewView | null;
  /** Every review round, newest first (the snapshot of each stays in mission_submissions). */
  reviews?: ReviewView[];
  allowedActions?: Array<{ action: MissionAction; summary: string; blockers: string[] }>;
  assignment?: {
    role: string;
    kind: AssignmentKind;
    status: AssignmentStatus;
    offeredAt: string | null;
    expiresAt: string | null;
    respondedAt: string | null;
    reason: string | null;
    blocked: string | null;
  };
  roster?: Array<{ name: string; role: string }> | null;
  rosterNote?: string | null;
}

export async function getMission(ctx: Ctx, key: string): Promise<MissionView> {
  await sweepExpiredOffers(ctx.db, ctx.actor.orgId, ctx.clock.now());
  return getMissionView(ctx, await loadMission(ctx, key));
}

async function getMissionView(ctx: Ctx, mission: Mission): Promise<MissionView> {
  return hasRoleAtLeast(ctx.actor, 'MISSION_LEAD') ? leadView(ctx, mission.id) : crewView(ctx, mission.id);
}

async function leadView(ctx: Ctx, missionId: string): Promise<MissionView> {
  const { db, actor } = ctx;
  const mission = await db.mission.findFirstOrThrow({
    where: { id: missionId, orgId: actor.orgId },
    include: {
      owner: { select: { handle: true, name: true } },
      submissions: {
        orderBy: { round: 'desc' },
        include: {
          submittedBy: { select: { handle: true, name: true } },
          decidedBy: { select: { handle: true, name: true } },
        },
      },
    },
  });
  const roles = await rolesWithSeats(db, mission);
  const org = await db.organization.findUniqueOrThrow({ where: { id: actor.orgId } });

  const offeredUsers = roles.flatMap((role) =>
    role.assignments.filter((seat) => seat.status === 'OFFERED').map((seat) => seat.userId),
  );
  const schedules = await loadSchedules(db, { orgId: actor.orgId, keyPrefix: actor.org.keyPrefix, userIds: offeredUsers });
  const window = rangeOf(mission.startDate, mission.endDate);

  const seatView = (seat: RoleWithSeats['assignments'][number]): SeatView => {
    const schedule = seat.status === 'OFFERED' ? schedules.get(seat.userId) : undefined;
    const blocked = schedule && scheduleIssues(window, schedule, org.restGapDays, mission.id).length > 0;
    return {
      ...person(seat.user),
      kind: seat.kind,
      status: seat.status,
      score: seat.score,
      breakdown: seat.scoreBreakdown,
      offeredAt: seat.offeredAt?.toISOString() ?? null,
      expiresAt: seat.expiresAt?.toISOString() ?? null,
      respondedAt: seat.respondedAt?.toISOString() ?? null,
      reason: seat.reason,
      blocked: blocked ? BLOCKED_FOR_LEAD : null,
    };
  };

  const roleViews = roles.map((role) => {
    const live = role.assignments.filter((seat) => LIVE_SEAT_STATUSES.includes(seat.status));
    return {
      name: role.name,
      headcount: role.headcount,
      skills: role.requirements.map((req) => ({ key: req.skill.key, name: req.skill.name, min: req.minProficiency })),
      seats: live.map(seatView),
      closed: role.assignments.filter((seat) => !LIVE_SEAT_STATUSES.includes(seat.status)).map(seatView),
      open: Math.max(0, role.headcount - live.filter((seat) => seat.kind === 'PRIMARY').length),
    };
  });

  const totals = { seats: 0, proposed: 0, offered: 0, accepted: 0, open: 0 };
  for (const role of roles) {
    totals.seats += role.headcount;
    totals.proposed += countSeats(role, 'PROPOSED');
    totals.offered += countSeats(role, 'OFFERED');
    totals.accepted += countSeats(role, 'ACCEPTED');
  }
  totals.open = roleViews.reduce((acc, role) => acc + role.open, 0);

  const now = ctx.clock.now();
  const blockersFor = (action: MissionAction): string[] => {
    if (action === 'submit') return submitBlockers(mission, roles, now);
    if (action === 'activate') return activateBlockers(roles);
    return [];
  };
  const reviews: ReviewView[] = mission.submissions.map((submission) => ({
    round: submission.round,
    submittedBy: person(submission.submittedBy),
    submittedAt: submission.submittedAt.toISOString(),
    decision: submission.decision,
    decidedBy: submission.decidedBy ? person(submission.decidedBy) : null,
    decidedAt: submission.decidedAt?.toISOString() ?? null,
    note: submission.note,
  }));

  return {
    key: keyOf(ctx, mission),
    title: mission.title,
    description: mission.description,
    status: mission.status,
    ...windowView(mission),
    owner: person(mission.owner),
    cancelReason: mission.cancelReason,
    viewer: 'lead',
    roles: roleViews,
    staffing: totals,
    review: reviews[0] ?? null,
    reviews,
    allowedActions: allowedMissionActions(mission, actor).map((action) => ({
      action,
      summary: ruleFor(action).summary,
      blockers: blockersFor(action),
    })),
  };
}

async function crewView(ctx: Ctx, missionId: string): Promise<MissionView> {
  const { db, actor } = ctx;
  const mission = await db.mission.findFirstOrThrow({
    where: { id: missionId, orgId: actor.orgId },
    include: { owner: { select: { handle: true, name: true } } },
  });
  const mine = await db.assignment.findFirst({
    where: { orgId: actor.orgId, missionId, userId: actor.userId, offeredAt: { not: null } },
    orderBy: { createdAt: 'desc' },
    include: { role: { select: { name: true } } },
  });
  if (!mine) throw notFound(`Mission ${keyOf(ctx, mission)}`);

  let blocked: string | null = null;
  if (mine.status === 'OFFERED') {
    const org = await db.organization.findUniqueOrThrow({ where: { id: actor.orgId } });
    const schedule = (
      await loadSchedules(db, { orgId: actor.orgId, keyPrefix: actor.org.keyPrefix, userIds: [actor.userId] })
    ).get(actor.userId)!;
    blocked = blockedForCrew(scheduleIssues(rangeOf(mission.startDate, mission.endDate), schedule, org.restGapDays, missionId));
  }

  // The roster is revealed only once the crew is locked (ACTIVE), and only to confirmed crew.
  const rosterVisible = (mission.status === 'ACTIVE' || mission.status === 'COMPLETED') && mine.status === 'ACCEPTED';
  const roster = rosterVisible
    ? (
        await db.assignment.findMany({
          where: { orgId: actor.orgId, missionId, status: 'ACCEPTED', kind: 'PRIMARY' },
          include: { user: { select: { name: true } }, role: { select: { name: true, position: true } } },
        })
      )
        .sort((a, b) => a.role.position - b.role.position || a.user.name.localeCompare(b.user.name))
        .map((seat) => ({ name: seat.user.name, role: seat.role.name }))
    : null;

  return {
    key: keyOf(ctx, mission),
    title: mission.title,
    description: mission.description,
    status: mission.status,
    ...windowView(mission),
    owner: person(mission.owner),
    cancelReason: mission.cancelReason,
    viewer: 'crew',
    assignment: {
      role: mine.role.name,
      kind: mine.kind,
      status: mine.status,
      offeredAt: mine.offeredAt?.toISOString() ?? null,
      expiresAt: mine.expiresAt?.toISOString() ?? null,
      respondedAt: mine.respondedAt?.toISOString() ?? null,
      reason: mine.reason,
      blocked,
    },
    roster,
    rosterNote: roster ? null : 'The full crew is revealed to confirmed crew once the mission is active.',
  };
}

// ── Lists & history ──────────────────────────────────────────────────────────

export interface MissionSummary {
  key: string;
  title: string;
  status: MissionStatus;
  startDate: string;
  endDate: string;
  days: number;
  owner: { handle: string; name: string };
  staffing: { seats: number; accepted: number; offered: number; proposed: number };
  myRole?: string;
  myStatus?: AssignmentStatus;
}

export async function listMissions(
  ctx: Ctx,
  filter: { status?: string[] | undefined; mine?: boolean | undefined },
): Promise<MissionSummary[]> {
  const { db, actor } = ctx;
  await sweepExpiredOffers(db, actor.orgId, ctx.clock.now());
  const isLead = hasRoleAtLeast(actor, 'MISSION_LEAD');
  const missions = await db.mission.findMany({
    where: {
      orgId: actor.orgId,
      ...(filter.status?.length ? { status: { in: filter.status as Mission['status'][] } } : {}),
      ...(isLead
        ? filter.mine
          ? { ownerId: actor.userId }
          : {}
        : { assignments: { some: { userId: actor.userId, offeredAt: { not: null } } } }),
    },
    orderBy: [{ startDate: 'asc' }, { number: 'asc' }],
    include: {
      owner: { select: { handle: true, name: true } },
      roles: { select: { headcount: true } },
      assignments: {
        select: { status: true, kind: true, userId: true, offeredAt: true, role: { select: { name: true } } },
      },
    },
  });
  return missions.map((mission) => {
    const primaries = mission.assignments.filter((seat) => seat.kind === 'PRIMARY');
    const mine = mission.assignments.find((seat) => seat.userId === actor.userId && seat.offeredAt !== null);
    return {
      key: keyOf(ctx, mission),
      title: mission.title,
      status: mission.status,
      ...windowView(mission),
      owner: person(mission.owner),
      staffing: {
        seats: mission.roles.reduce((acc, role) => acc + role.headcount, 0),
        accepted: primaries.filter((seat) => seat.status === 'ACCEPTED').length,
        offered: primaries.filter((seat) => seat.status === 'OFFERED').length,
        proposed: isLead ? primaries.filter((seat) => seat.status === 'PROPOSED').length : 0,
      },
      ...(isLead ? {} : { myRole: mine?.role.name, myStatus: mine?.status }),
    };
  });
}

export async function listEvents(ctx: Ctx, key: string) {
  // Visibility first: a mission crew were never offered stays "not found". One they can see is
  // refused by name, so the CLI never denies the existence of a mission they just looked at.
  const mission = await loadMission(ctx, key);
  if (!hasRoleAtLeast(ctx.actor, 'MISSION_LEAD')) throw forbidden('The audit log is for mission leads and directors.');
  const events = await ctx.db.missionEvent.findMany({
    where: { orgId: ctx.actor.orgId, missionId: mission.id },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: { actor: { select: { handle: true, name: true } } },
  });
  return {
    key: keyOf(ctx, mission),
    title: mission.title,
    events: events.map((event) => ({
      at: event.createdAt.toISOString(),
      type: event.type,
      actor: event.actor ? person(event.actor) : null,
      from: event.fromStatus,
      to: event.toStatus,
      payload: event.payload,
    })),
  };
}
