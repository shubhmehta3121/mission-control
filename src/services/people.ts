/**
 * Crew directory (leads and directors) and the caller's own profile: skills
 * (self-rated) and unavailability. Crew members can only ever see themselves.
 */
import type { Role } from '@prisma/client';
import { AppError, notFound } from '../lib/errors.js';
import { rangeOf, toDay, overlaps } from '../lib/dates.js';
import { describeScheduleIssue } from '../domain/scheduling.js';
import { hasRoleAtLeast, missionKey } from '../domain/types.js';
import { commitment } from '../matcher/scoring.js';
import { lockUser, tx, type Ctx } from './context.js';
import { loadSchedules } from './snapshot.js';
import { dateOnly } from './views.js';

const personInclude = {
  skills: { include: { skill: true } },
  unavailability: { orderBy: { startDate: 'asc' } },
  assignments: {
    include: {
      mission: { select: { number: true, title: true, startDate: true, endDate: true, status: true } },
      role: { select: { name: true } },
    },
  },
} as const;

type PersonRow = Awaited<ReturnType<typeof loadPeople>>[number];

function loadPeople(ctx: Ctx, where: { handle?: string; id?: string } = {}) {
  return ctx.db.user.findMany({
    where: { orgId: ctx.actor.orgId, role: 'CREW_MEMBER', ...where },
    include: personInclude,
    orderBy: { name: 'asc' },
  });
}

function personView(ctx: Ctx, row: PersonRow, options: { self: boolean; now: Date }) {
  const today = toDay(options.now);
  const accepted = row.assignments.filter((seat) => seat.status === 'ACCEPTED' && seat.kind === 'PRIMARY');
  const upcoming = accepted
    .filter((seat) => ['APPROVED', 'ACTIVE'].includes(seat.mission.status) && toDay(seat.mission.endDate) >= today)
    .sort((a, b) => a.mission.startDate.getTime() - b.mission.startDate.getTime())
    .map((seat) => ({
      key: missionKey(ctx.actor.org.keyPrefix, seat.mission.number),
      title: seat.mission.title,
      role: seat.role.name,
      startDate: dateOnly(seat.mission.startDate),
      endDate: dateOnly(seat.mission.endDate),
    }));
  const accepts = row.assignments.filter((seat) => ['ACCEPTED', 'DROPPED', 'RELEASED'].includes(seat.status)).length;
  const dropouts = row.assignments.filter((seat) => seat.status === 'DROPPED').length;
  const canSeeNotes = options.self || ctx.actor.role === 'DIRECTOR';
  // D14: crew never see scores — their own record shows plain counts; the commitment score is for leads.
  const canSeeScores = hasRoleAtLeast(ctx.actor, 'MISSION_LEAD');
  return {
    handle: row.handle,
    name: row.name,
    email: row.email,
    skills: row.skills
      .map((entry) => ({ key: entry.skill.key, name: entry.skill.name, level: entry.proficiency }))
      .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name)),
    unavailable: row.unavailability
      .filter((window) => toDay(window.endDate) >= today)
      .map((window) => ({
        id: window.id,
        startDate: dateOnly(window.startDate),
        endDate: dateOnly(window.endDate),
        ...(canSeeNotes ? { note: window.note } : {}),
      })),
    upcoming,
    record: {
      completedMissions: accepted.filter((seat) => seat.mission.status === 'COMPLETED').length,
      accepts,
      dropouts,
      ...(canSeeScores ? { commitment: Math.round(commitment(accepts, dropouts) * 1000) / 1000 } : {}),
    } as { completedMissions: number; accepts: number; dropouts: number; commitment?: number },
  };
}

export type PersonView = ReturnType<typeof personView>;

export async function listCrew(ctx: Ctx, filter: { skill?: string | undefined; min?: number | undefined }): Promise<PersonView[]> {
  if (!hasRoleAtLeast(ctx.actor, 'MISSION_LEAD')) throw new AppError('FORBIDDEN', 'Only mission leads and directors can browse the crew directory.');
  const now = ctx.clock.now();
  let people = (await loadPeople(ctx)).map((row) => personView(ctx, row, { self: false, now }));
  if (filter.skill) {
    const key = filter.skill.toLowerCase();
    const min = filter.min ?? 1;
    const exists = await ctx.db.skill.findUnique({ where: { orgId_key: { orgId: ctx.actor.orgId, key } } });
    if (!exists) throw new AppError('VALIDATION_FAILED', `Unknown skill "${filter.skill}". See \`mc skills list\`.`);
    people = people
      .filter((entry) => entry.skills.some((skill) => skill.key === key && skill.level >= min))
      .sort((a, b) => (b.skills.find((s) => s.key === key)?.level ?? 0) - (a.skills.find((s) => s.key === key)?.level ?? 0));
  }
  return people;
}

export async function getCrewMember(ctx: Ctx, handle: string): Promise<PersonView> {
  const self = handle.toLowerCase() === ctx.actor.handle;
  if (!self && !hasRoleAtLeast(ctx.actor, 'MISSION_LEAD')) throw notFound(`Crew member "${handle}"`);
  const [row] = await loadPeople(ctx, { handle: handle.toLowerCase() });
  if (!row) throw notFound(`Crew member "${handle}"`);
  return personView(ctx, row, { self, now: ctx.clock.now() });
}

export async function getMyProfile(ctx: Ctx): Promise<PersonView & { role: Role }> {
  const row = await ctx.db.user.findFirstOrThrow({
    where: { orgId: ctx.actor.orgId, id: ctx.actor.userId },
    include: personInclude,
  });
  return { ...personView(ctx, row, { self: true, now: ctx.clock.now() }), role: row.role };
}

export async function setMySkills(ctx: Ctx, entries: Array<{ skill: string; level: number }>): Promise<PersonView & { role: Role }> {
  const keys = entries.map((entry) => entry.skill.toLowerCase());
  const repeated = keys.filter((key, index) => keys.indexOf(key) !== index);
  if (repeated.length > 0) {
    throw new AppError('VALIDATION_FAILED', `Skill "${repeated[0]}" is listed more than once — give each skill one level.`);
  }
  await tx(ctx, async (db) => {
    const skills = await db.skill.findMany({ where: { orgId: ctx.actor.orgId, key: { in: keys } } });
    const byKey = new Map(skills.map((skill) => [skill.key, skill.id]));
    const unknown = keys.filter((key) => !byKey.has(key));
    if (unknown.length > 0) throw new AppError('VALIDATION_FAILED', `Unknown skill${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}. See \`mc skills list\`.`);
    for (const entry of entries) {
      const skillId = byKey.get(entry.skill.toLowerCase())!;
      await db.crewSkill.upsert({
        where: { userId_skillId: { userId: ctx.actor.userId, skillId } },
        create: { orgId: ctx.actor.orgId, userId: ctx.actor.userId, skillId, proficiency: entry.level },
        update: { proficiency: entry.level },
      });
    }
  });
  return getMyProfile(ctx);
}

export async function removeMySkill(ctx: Ctx, key: string): Promise<PersonView & { role: Role }> {
  const skill = await ctx.db.skill.findUnique({ where: { orgId_key: { orgId: ctx.actor.orgId, key: key.toLowerCase() } } });
  if (!skill) throw notFound(`Skill "${key}"`);
  const { count } = await ctx.db.crewSkill.deleteMany({ where: { orgId: ctx.actor.orgId, userId: ctx.actor.userId, skillId: skill.id } });
  if (count === 0) throw notFound(`Skill "${key}" on your profile`);
  return getMyProfile(ctx);
}

export async function addUnavailability(
  ctx: Ctx,
  input: { startDate: Date; endDate: Date; note?: string | undefined },
): Promise<{ id: string; startDate: string; endDate: string; note: string | null }> {
  if (toDay(input.endDate) < toDay(input.startDate)) {
    throw new AppError('VALIDATION_FAILED', 'The end date must be on or after the start date.');
  }
  return tx(ctx, async (db) => {
    // Same lock as accepting an offer, so "block out these days" and "accept a seat on them" can't both succeed.
    await lockUser(db, ctx.actor.orgId, ctx.actor.userId);
    // Blocking out days you already committed to would silently break a mission: drop out explicitly instead.
    const schedule = (
      await loadSchedules(db, { orgId: ctx.actor.orgId, keyPrefix: ctx.actor.org.keyPrefix, userIds: [ctx.actor.userId] })
    ).get(ctx.actor.userId)!;
    const range = rangeOf(input.startDate, input.endDate);
    const clash = schedule.commitments.find((entry) => overlaps(range, entry.range));
    if (clash) {
      throw new AppError(
        'SCHEDULE_CONFLICT',
        `You're committed to ${clash.missionKey} during those dates. Drop out first if you can no longer fly: mc offers drop ${clash.missionKey} --reason "…"`,
        { issues: [describeScheduleIssue({ kind: 'CONFLICT', missionKey: clash.missionKey, range: clash.range })] },
      );
    }
    const existing = await db.unavailability.findMany({ where: { orgId: ctx.actor.orgId, userId: ctx.actor.userId } });
    const overlap = existing.find((window) => overlaps(range, rangeOf(window.startDate, window.endDate)));
    if (overlap) {
      throw new AppError(
        'VALIDATION_FAILED',
        `That overlaps days you already blocked out (${dateOnly(overlap.startDate)} → ${dateOnly(overlap.endDate)}). Remove that window first (mc profile unavailable remove ${overlap.id}) and add one range covering both.`,
      );
    }
    const created = await db.unavailability.create({
      data: {
        orgId: ctx.actor.orgId,
        userId: ctx.actor.userId,
        startDate: input.startDate,
        endDate: input.endDate,
        note: input.note?.trim() || null,
      },
    });
    return { id: created.id, startDate: dateOnly(created.startDate), endDate: dateOnly(created.endDate), note: created.note };
  });
}

export async function removeUnavailability(ctx: Ctx, id: string): Promise<{ removed: string }> {
  const { count } = await ctx.db.unavailability.deleteMany({
    where: { id, orgId: ctx.actor.orgId, userId: ctx.actor.userId },
  });
  if (count === 0) throw notFound('Unavailability window');
  return { removed: id };
}
