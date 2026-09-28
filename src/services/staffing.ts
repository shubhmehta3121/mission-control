/**
 * Staffing: run the matcher, nominate crew into a draft, and — after approval —
 * backfill open seats with direct offers (no re-approval: a personnel swap
 * inside an approved plan is operations, not policy).
 */
import type { Mission, Prisma } from '@prisma/client';
import { AppError, notFound } from '../lib/errors.js';
import { assertMissionAction } from '../domain/lifecycle.js';
import { missionKey } from '../domain/types.js';
import { evaluateCandidate, explainCandidate, runMatch, type CandidateExplanation } from '../matcher/matcher.js';
import type { MatchInput, MatchResult, ScoreBreakdown } from '../matcher/types.js';
import { recordEvent, tx, type Ctx, type Db } from './context.js';
import { offerDeadline, sweepExpiredOffers } from './expiry.js';
import { loadMission } from './missions.js';
import { loadMatchInput } from './snapshot.js';
import { windowView } from './views.js';

export interface MatchResponse {
  mission: { key: string; title: string; status: string; startDate: string; endDate: string; days: number };
  restGapDays: number;
  result: MatchResult;
  explanation?: CandidateExplanation;
}

async function snapshotFor(ctx: Ctx, db: Db, mission: Mission): Promise<MatchInput> {
  return loadMatchInput(db, {
    orgId: ctx.actor.orgId,
    keyPrefix: ctx.actor.org.keyPrefix,
    missionId: mission.id,
    now: ctx.clock.now(),
  });
}

async function crewByHandle(ctx: Ctx, db: Db, handle: string) {
  const user = await db.user.findUnique({
    where: { orgId_handle: { orgId: ctx.actor.orgId, handle: handle.toLowerCase() } },
  });
  if (!user || user.role !== 'CREW_MEMBER') throw notFound(`Crew member "${handle}"`);
  return user;
}

export async function matchMission(ctx: Ctx, key: string, options: { explain?: string | undefined } = {}): Promise<MatchResponse> {
  await sweepExpiredOffers(ctx.db, ctx.actor.orgId, ctx.clock.now());
  const mission = await loadMission(ctx, key);
  assertMissionAction('match', mission, ctx.actor);
  const input = await snapshotFor(ctx, ctx.db, mission);
  const org = await ctx.db.organization.findUniqueOrThrow({ where: { id: ctx.actor.orgId } });
  const response: MatchResponse = {
    mission: {
      key: missionKey(ctx.actor.org.keyPrefix, mission.number),
      title: mission.title,
      status: mission.status,
      ...windowView(mission),
    },
    restGapDays: org.restGapDays,
    result: runMatch(input),
  };
  if (options.explain) {
    const user = await crewByHandle(ctx, ctx.db, options.explain);
    response.explanation = explainCandidate(input, user.id);
  }
  return response;
}

export type SeatRequest = { recommended: true } | { role: string; crew: string };

export interface StaffingResult {
  key: string;
  created: Array<{ role: string; handle: string; name: string; score: number; expiresAt: string | null }>;
  unfilled: MatchResult['unfilled'];
}

interface SeatPlan {
  roleId: string;
  roleName: string;
  userId: string;
  handle: string;
  name: string;
  breakdown: ScoreBreakdown;
}

/** Turns a request into concrete seats, validating manual picks against the same hard filters. */
async function planSeats(ctx: Ctx, db: Db, mission: Mission, request: SeatRequest): Promise<{ plan: SeatPlan[]; unfilled: MatchResult['unfilled'] }> {
  const input = await snapshotFor(ctx, db, mission);
  if ('recommended' in request) {
    const result = runMatch(input);
    return {
      plan: result.recommendations.map((rec) => ({
        roleId: rec.roleId,
        roleName: rec.roleName,
        userId: rec.userId,
        handle: rec.handle,
        name: rec.name,
        breakdown: rec.breakdown,
      })),
      unfilled: result.unfilled,
    };
  }

  const role = input.roles.find((candidate) => candidate.name.toLowerCase() === request.role.trim().toLowerCase());
  if (!role) {
    throw new AppError('VALIDATION_FAILED', `This mission has no role "${request.role}". Roles: ${input.roles.map((entry) => entry.name).join(', ')}.`);
  }
  if (role.filledBy.length >= role.headcount) {
    throw new AppError('ROLE_FILLED', `${role.name} already has ${role.headcount} of ${role.headcount} seats taken.`);
  }
  const user = await crewByHandle(ctx, db, request.crew);
  const verdict = evaluateCandidate(input, user.id, role.id);
  if (!verdict.eligible) {
    throw new AppError('NOT_ELIGIBLE', `${user.name} is not eligible for ${role.name}: ${verdict.rejections.map((entry) => entry.detail).join('; ')}.`, {
      rejections: verdict.rejections,
    });
  }
  return {
    plan: [{ roleId: role.id, roleName: role.name, userId: user.id, handle: user.handle, name: user.name, breakdown: verdict.breakdown! }],
    unfilled: [],
  };
}

/** Draft stage: PROPOSED seats, invisible to crew until the director approves. */
export async function nominate(ctx: Ctx, key: string, request: SeatRequest & { reset?: boolean }): Promise<StaffingResult> {
  return tx(ctx, async (db) => {
    const mission = await loadMission(ctx, key, db);
    assertMissionAction('nominate', mission, ctx.actor);
    if (request.reset) {
      const { count } = await db.assignment.deleteMany({
        where: { orgId: ctx.actor.orgId, missionId: mission.id, status: 'PROPOSED' },
      });
      if (count > 0) {
        await recordEvent(db, {
          orgId: ctx.actor.orgId,
          missionId: mission.id,
          actorId: ctx.actor.userId,
          type: 'NOMINATION_REMOVED',
          payload: { cleared: count },
        });
      }
    }
    const { plan, unfilled } = await planSeats(ctx, db, mission, request);
    for (const seat of plan) {
      await db.assignment.create({
        data: {
          orgId: ctx.actor.orgId,
          missionId: mission.id,
          roleId: seat.roleId,
          userId: seat.userId,
          status: 'PROPOSED',
          score: seat.breakdown.total,
          scoreBreakdown: seat.breakdown as unknown as Prisma.InputJsonObject,
        },
      });
    }
    if (plan.length > 0) {
      await recordEvent(db, {
        orgId: ctx.actor.orgId,
        missionId: mission.id,
        actorId: ctx.actor.userId,
        type: 'CREW_NOMINATED',
        payload: { seats: plan.map((seat) => ({ role: seat.roleName, crew: seat.handle, score: seat.breakdown.total })) },
      });
    }
    return {
      key: missionKey(ctx.actor.org.keyPrefix, mission.number),
      created: plan.map((seat) => ({ role: seat.roleName, handle: seat.handle, name: seat.name, score: seat.breakdown.total, expiresAt: null })),
      unfilled,
    };
  });
}

export async function removeNomination(ctx: Ctx, key: string, handle: string): Promise<{ key: string; removed: string }> {
  return tx(ctx, async (db) => {
    const mission = await loadMission(ctx, key, db);
    assertMissionAction('nominate', mission, ctx.actor);
    const user = await crewByHandle(ctx, db, handle);
    const { count } = await db.assignment.deleteMany({
      where: { orgId: ctx.actor.orgId, missionId: mission.id, userId: user.id, status: 'PROPOSED' },
    });
    if (count === 0) throw notFound(`Nomination for "${handle}" on this mission`);
    await recordEvent(db, {
      orgId: ctx.actor.orgId,
      missionId: mission.id,
      actorId: ctx.actor.userId,
      type: 'NOMINATION_REMOVED',
      payload: { crew: user.handle },
    });
    return { key: missionKey(ctx.actor.org.keyPrefix, mission.number), removed: user.handle };
  });
}

/** Post-approval backfill: direct OFFERED seats with a respond-by deadline. */
export async function offerSeats(ctx: Ctx, key: string, request: SeatRequest): Promise<StaffingResult> {
  const now = ctx.clock.now();
  await sweepExpiredOffers(ctx.db, ctx.actor.orgId, now);
  return tx(ctx, async (db) => {
    const mission = await loadMission(ctx, key, db);
    assertMissionAction('offer', mission, ctx.actor);
    const org = await db.organization.findUniqueOrThrow({ where: { id: ctx.actor.orgId } });
    const expiresAt = offerDeadline(now, mission.startDate, org.offerTtlDays);
    const { plan, unfilled } = await planSeats(ctx, db, mission, request);
    for (const seat of plan) {
      await db.assignment.create({
        data: {
          orgId: ctx.actor.orgId,
          missionId: mission.id,
          roleId: seat.roleId,
          userId: seat.userId,
          status: 'OFFERED',
          score: seat.breakdown.total,
          scoreBreakdown: seat.breakdown as unknown as Prisma.InputJsonObject,
          offeredAt: now,
          expiresAt,
        },
      });
    }
    if (plan.length > 0) {
      await recordEvent(db, {
        orgId: ctx.actor.orgId,
        missionId: mission.id,
        actorId: ctx.actor.userId,
        type: 'OFFER_SENT',
        payload: {
          seats: plan.map((seat) => ({ role: seat.roleName, crew: seat.handle, score: seat.breakdown.total })),
          expiresAt: expiresAt.toISOString(),
        },
      });
    }
    return {
      key: missionKey(ctx.actor.org.keyPrefix, mission.number),
      created: plan.map((seat) => ({
        role: seat.roleName,
        handle: seat.handle,
        name: seat.name,
        score: seat.breakdown.total,
        expiresAt: expiresAt.toISOString(),
      })),
      unfilled,
    };
  });
}

export async function retractOffer(ctx: Ctx, key: string, handle: string): Promise<{ key: string; retracted: string }> {
  const now = ctx.clock.now();
  return tx(ctx, async (db) => {
    const mission = await loadMission(ctx, key, db);
    assertMissionAction('offer', mission, ctx.actor);
    const user = await crewByHandle(ctx, db, handle);
    const { count } = await db.assignment.updateMany({
      where: { orgId: ctx.actor.orgId, missionId: mission.id, userId: user.id, status: 'OFFERED' },
      data: { status: 'WITHDRAWN', reason: 'Offer retracted by the mission lead', closedAt: now },
    });
    if (count === 0) throw notFound(`Open offer for "${handle}" on this mission`);
    await recordEvent(db, {
      orgId: ctx.actor.orgId,
      missionId: mission.id,
      actorId: ctx.actor.userId,
      type: 'OFFER_RETRACTED',
      payload: { crew: user.handle },
    });
    return { key: missionKey(ctx.actor.org.keyPrefix, mission.number), retracted: user.handle };
  });
}

