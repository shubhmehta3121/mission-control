/** Identity, organisation settings (director-managed) and the org's skill taxonomy. */
import { Prisma } from '@prisma/client';
import { AppError } from '../lib/errors.js';
import { ROLE_LABEL, hasRoleAtLeast } from '../domain/types.js';
import type { Ctx } from './context.js';

export async function getMe(ctx: Ctx) {
  const user = await ctx.db.user.findFirstOrThrow({ where: { orgId: ctx.actor.orgId, id: ctx.actor.userId } });
  return {
    handle: user.handle,
    name: user.name,
    email: user.email,
    role: user.role,
    roleLabel: ROLE_LABEL[user.role],
    org: { ...ctx.actor.org },
  };
}

export interface OrgSettings {
  restGapDays: number;
  offerTtlDays: number;
}

export async function getSettings(ctx: Ctx): Promise<OrgSettings & { org: string }> {
  const org = await ctx.db.organization.findUniqueOrThrow({ where: { id: ctx.actor.orgId } });
  return { org: org.name, restGapDays: org.restGapDays, offerTtlDays: org.offerTtlDays };
}

export async function updateSettings(ctx: Ctx, patch: Partial<OrgSettings>): Promise<OrgSettings & { org: string }> {
  if (ctx.actor.role !== 'DIRECTOR') throw new AppError('FORBIDDEN', 'Only directors can change organisation settings.');
  await ctx.db.organization.update({
    where: { id: ctx.actor.orgId },
    data: {
      ...(patch.restGapDays !== undefined ? { restGapDays: patch.restGapDays } : {}),
      ...(patch.offerTtlDays !== undefined ? { offerTtlDays: patch.offerTtlDays } : {}),
    },
  });
  return getSettings(ctx);
}

export async function listSkills(ctx: Ctx) {
  const skills = await ctx.db.skill.findMany({
    where: { orgId: ctx.actor.orgId },
    orderBy: { name: 'asc' },
    include: { holders: { select: { proficiency: true } } },
  });
  const showCounts = hasRoleAtLeast(ctx.actor, 'MISSION_LEAD');
  return skills.map((skill) => ({
    key: skill.key,
    name: skill.name,
    description: skill.description,
    ...(showCounts
      ? {
          holders: skill.holders.length,
          experts: skill.holders.filter((holder) => holder.proficiency >= 4).length,
        }
      : {}),
  }));
}

export async function createSkill(ctx: Ctx, input: { key: string; name: string; description?: string | undefined }) {
  if (ctx.actor.role !== 'DIRECTOR') throw new AppError('FORBIDDEN', "Only directors can change the organisation's skill taxonomy.");
  try {
    const skill = await ctx.db.skill.create({
      data: {
        orgId: ctx.actor.orgId,
        key: input.key.toLowerCase(),
        name: input.name.trim(),
        description: input.description?.trim() || null,
      },
    });
    return { key: skill.key, name: skill.name, description: skill.description };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AppError('DUPLICATE', `A skill with that key or name already exists.`);
    }
    throw error;
  }
}
