/**
 * Seed: two organisations with different skill taxonomies, settings and crew,
 * missions in every lifecycle state, and a history that gives the matcher real
 * signals (experience, workload, a drop-out).
 *
 * Dates are relative to today, so the demo works whenever it is run.
 * Past missions are inserted directly; every current mission goes through the
 * real services (create → nominate → submit → approve → accept), so seeded
 * state is exactly what the API would have produced.
 *
 * The Astra draft "Europa Survey" is staged to show the engine's judgement:
 *   - Leo is the best pilot, but the only person who can fill Flight Engineer,
 *     so the optimiser seats him there and Yuki flies (greedy would leave a gap).
 *   - Tomás outscores Jamal as Mission Specialist but holds the org's only
 *     Flight Medicine qualification, so he is kept free.
 *   - Elena is inside the 14-day rest gap after her current mission; Amara is
 *     committed to an overlapping mission; Dmitri is on leave; Sara is a near
 *     miss for Pilot (Orbital Navigation 3 of 4); Jamal has a pending offer
 *     on an overlapping mission (flagged, not excluded).
 */
import { PrismaClient, type AssignmentStatus, type Prisma, type Role } from '@prisma/client';
import { addDays, formatIsoDate, startOfUtcDay } from '../src/lib/dates.js';
import { systemClock } from '../src/lib/clock.js';
import { hashToken } from '../src/lib/tokens.js';
import type { Actor } from '../src/domain/types.js';
import type { Ctx } from '../src/services/context.js';
import { approveMission, createMission, rejectMission, submitMission, type RoleSpec } from '../src/services/missions.js';
import { nominate } from '../src/services/staffing.js';
import { acceptOffer } from '../src/services/offers.js';

const db = new PrismaClient();
const today = startOfUtcDay(new Date());
const day = (offset: number): Date => addDays(today, offset);

interface OrgSpec {
  slug: string;
  name: string;
  keyPrefix: string;
  restGapDays: number;
  offerTtlDays: number;
  skills: Array<[key: string, name: string]>;
  people: Array<{ handle: string; name: string; role: Role; skills?: Record<string, number> }>;
}

interface SeededOrg {
  id: string;
  spec: OrgSpec;
  skillIds: Map<string, string>;
  users: Map<string, { id: string; name: string; role: Role; token: string }>;
}

const token = (slug: string, handle: string): string => `mct_${slug}_${handle}`;

async function wipe(): Promise<void> {
  await db.missionEvent.deleteMany();
  await db.missionSubmission.deleteMany();
  await db.assignment.deleteMany();
  await db.roleSkillRequirement.deleteMany();
  await db.missionRole.deleteMany();
  await db.mission.deleteMany();
  await db.unavailability.deleteMany();
  await db.crewSkill.deleteMany();
  await db.skill.deleteMany();
  await db.user.deleteMany();
  await db.organization.deleteMany();
}

async function seedOrg(spec: OrgSpec): Promise<SeededOrg> {
  const org = await db.organization.create({
    data: {
      slug: spec.slug,
      name: spec.name,
      keyPrefix: spec.keyPrefix,
      restGapDays: spec.restGapDays,
      offerTtlDays: spec.offerTtlDays,
    },
  });
  const skillIds = new Map<string, string>();
  for (const [key, name] of spec.skills) {
    skillIds.set(key, (await db.skill.create({ data: { orgId: org.id, key, name } })).id);
  }
  const users: SeededOrg['users'] = new Map();
  for (const person of spec.people) {
    const plain = token(spec.slug, person.handle);
    const user = await db.user.create({
      data: {
        orgId: org.id,
        handle: person.handle,
        name: person.name,
        email: `${person.handle}@${spec.slug}.example`,
        role: person.role,
        tokenHash: hashToken(plain),
      },
    });
    for (const [key, level] of Object.entries(person.skills ?? {})) {
      await db.crewSkill.create({ data: { orgId: org.id, userId: user.id, skillId: skillIds.get(key)!, proficiency: level } });
    }
    users.set(person.handle, { id: user.id, name: person.name, role: person.role, token: plain });
  }
  return { id: org.id, spec, skillIds, users };
}

function ctxFor(org: SeededOrg, handle: string): Ctx {
  const user = org.users.get(handle);
  if (!user) throw new Error(`Unknown seed user ${handle}`);
  const actor: Actor = {
    userId: user.id,
    orgId: org.id,
    role: user.role,
    handle,
    name: user.name,
    org: { slug: org.spec.slug, name: org.spec.name, keyPrefix: org.spec.keyPrefix },
  };
  return { db, clock: systemClock, actor };
}

/**
 * Past or already-running missions can't go through the services (they refuse
 * start dates in the past), so they are written directly — including their
 * approval record and audit events.
 */
async function insertMission(
  org: SeededOrg,
  args: {
    title: string;
    owner: string;
    approver: string;
    status: 'COMPLETED' | 'ACTIVE';
    start: number;
    end: number;
    roles: Array<{ name: string; skills: Record<string, number>; crew: Array<[handle: string, status: AssignmentStatus]> }>;
  },
): Promise<void> {
  const seq = await db.organization.update({ where: { id: org.id }, data: { missionSeq: { increment: 1 } } });
  const owner = org.users.get(args.owner)!;
  const approver = org.users.get(args.approver)!;
  const mission = await db.mission.create({
    data: {
      orgId: org.id,
      number: seq.missionSeq,
      title: args.title,
      startDate: day(args.start),
      endDate: day(args.end),
      status: args.status,
      ownerId: owner.id,
      createdAt: day(args.start - 60),
    },
  });
  for (const [position, role] of args.roles.entries()) {
    const created = await db.missionRole.create({
      data: {
        orgId: org.id,
        missionId: mission.id,
        name: role.name,
        headcount: role.crew.filter(([, status]) => status === 'ACCEPTED').length,
        position,
        requirements: {
          create: Object.entries(role.skills).map(([key, min]) => ({ skillId: org.skillIds.get(key)!, minProficiency: min })),
        },
      },
    });
    for (const [handle, status] of role.crew) {
      await db.assignment.create({
        data: {
          orgId: org.id,
          missionId: mission.id,
          roleId: created.id,
          userId: org.users.get(handle)!.id,
          status,
          score: 0,
          scoreBreakdown: { seeded: true } as Prisma.InputJsonObject,
          offeredAt: day(args.start - 40),
          respondedAt: day(args.start - 38),
          ...(status === 'DROPPED' ? { closedAt: day(args.start - 10), reason: 'Medical hold' } : {}),
        },
      });
    }
  }
  await db.missionSubmission.create({
    data: {
      orgId: org.id,
      missionId: mission.id,
      round: 1,
      submittedById: owner.id,
      submittedAt: day(args.start - 50),
      snapshot: { seeded: true } as Prisma.InputJsonObject,
      decision: 'APPROVED',
      decidedById: approver.id,
      decidedAt: day(args.start - 45),
    },
  });
  const events: Array<{ type: string; actor: string; at: number; from?: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'ACTIVE'; to?: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'ACTIVE' | 'COMPLETED' }> = [
    { type: 'MISSION_CREATED', actor: owner.id, at: args.start - 60, to: 'DRAFT' },
    { type: 'MISSION_SUBMITTED', actor: owner.id, at: args.start - 50, from: 'DRAFT', to: 'SUBMITTED' },
    { type: 'MISSION_APPROVED', actor: approver.id, at: args.start - 45, from: 'SUBMITTED', to: 'APPROVED' },
    { type: 'MISSION_ACTIVATED', actor: owner.id, at: args.start - 5, from: 'APPROVED', to: 'ACTIVE' },
  ];
  if (args.status === 'COMPLETED') {
    events.push({ type: 'MISSION_COMPLETED', actor: owner.id, at: args.end + 1, from: 'ACTIVE', to: 'COMPLETED' });
  }
  for (const event of events) {
    await db.missionEvent.create({
      data: {
        orgId: org.id,
        missionId: mission.id,
        actorId: event.actor,
        type: event.type,
        fromStatus: event.from ?? null,
        toStatus: event.to ?? null,
        payload: { seeded: true },
        createdAt: day(event.at),
      },
    });
  }
}

const role = (name: string, headcount: number, skills: Record<string, number>): RoleSpec => ({
  name,
  headcount,
  skills: Object.entries(skills).map(([skill, min]) => ({ skill, min })),
});

async function draftMission(org: SeededOrg, owner: string, title: string, start: number, end: number, roles: RoleSpec[], description?: string) {
  return createMission(ctxFor(org, owner), {
    title,
    description,
    startDate: day(start),
    endDate: day(end),
    roles,
  });
}

// ── Astra Dynamics ───────────────────────────────────────────────────────────

async function seedAstra(): Promise<SeededOrg> {
  const astra = await seedOrg({
    slug: 'astra',
    name: 'Astra Dynamics',
    keyPrefix: 'AST',
    restGapDays: 14,
    offerTtlDays: 7,
    skills: [
      ['nav', 'Orbital Navigation'],
      ['eva', 'EVA Ops'],
      ['robotics', 'Robotics'],
      ['piloting', 'Piloting'],
      ['comms', 'Comms'],
      ['medic', 'Flight Medicine'],
    ],
    people: [
      { handle: 'ava', name: 'Ava Sterling', role: 'DIRECTOR' },
      { handle: 'marcus', name: 'Marcus Chen', role: 'MISSION_LEAD' },
      { handle: 'priya', name: 'Priya Nair', role: 'MISSION_LEAD' },
      { handle: 'leo', name: 'Leo Vasquez', role: 'CREW_MEMBER', skills: { nav: 5, eva: 4, comms: 3 } },
      { handle: 'yuki', name: 'Yuki Tanaka', role: 'CREW_MEMBER', skills: { nav: 4, robotics: 3 } },
      { handle: 'amara', name: 'Amara Okafor', role: 'CREW_MEMBER', skills: { nav: 4, piloting: 5, comms: 4 } },
      { handle: 'dmitri', name: 'Dmitri Volkov', role: 'CREW_MEMBER', skills: { eva: 5, comms: 3, robotics: 3 } },
      { handle: 'sara', name: 'Sara Lindqvist', role: 'CREW_MEMBER', skills: { nav: 3, eva: 4, piloting: 3 } },
      { handle: 'jamal', name: 'Jamal Reyes', role: 'CREW_MEMBER', skills: { robotics: 5, comms: 3, eva: 2 } },
      { handle: 'elena', name: 'Elena Petrova', role: 'CREW_MEMBER', skills: { nav: 5, comms: 5 } },
      { handle: 'tomas', name: 'Tomás Silva', role: 'CREW_MEMBER', skills: { eva: 4, robotics: 5, medic: 5, piloting: 2 } },
    ],
  });

  // History (feeds experience, workload and commitment).
  await insertMission(astra, {
    title: 'Mercury Flyby', owner: 'marcus', approver: 'ava', status: 'COMPLETED', start: -200, end: -170,
    roles: [
      { name: 'Navigator', skills: { nav: 3 }, crew: [['leo', 'ACCEPTED']] },
      { name: 'EVA Lead', skills: { eva: 3 }, crew: [['sara', 'ACCEPTED']] },
    ],
  });
  await insertMission(astra, {
    title: 'Vesta Docking', owner: 'marcus', approver: 'ava', status: 'COMPLETED', start: -120, end: -95,
    roles: [
      { name: 'Navigator', skills: { nav: 4 }, crew: [['yuki', 'ACCEPTED']] },
      { name: 'Robotics Operator', skills: { robotics: 3 }, crew: [['tomas', 'ACCEPTED']] },
    ],
  });
  await insertMission(astra, {
    title: 'Ceres Survey', owner: 'priya', approver: 'ava', status: 'COMPLETED', start: -80, end: -60,
    roles: [
      { name: 'Pilot', skills: { piloting: 3 }, crew: [['amara', 'ACCEPTED']] },
      { name: 'Comms Officer', skills: { comms: 3 }, crew: [['jamal', 'DROPPED'], ['elena', 'ACCEPTED']] },
    ],
  });
  await insertMission(astra, {
    title: 'Io Relay', owner: 'marcus', approver: 'ava', status: 'COMPLETED', start: -50, end: -36,
    roles: [
      { name: 'Navigator', skills: { nav: 4 }, crew: [['leo', 'ACCEPTED']] },
      { name: 'Robotics Operator', skills: { robotics: 4 }, crew: [['jamal', 'ACCEPTED']] },
    ],
  });
  // In flight now; Elena lands 5 days before Europa Survey would launch.
  await insertMission(astra, {
    title: 'Lunar Shadow Observatory', owner: 'priya', approver: 'ava', status: 'ACTIVE', start: -20, end: 29,
    roles: [{ name: 'Navigator', skills: { nav: 4 }, crew: [['elena', 'ACCEPTED']] }],
  });

  await db.unavailability.create({
    data: {
      orgId: astra.id,
      userId: astra.users.get('dmitri')!.id,
      startDate: day(40),
      endDate: day(52),
      note: 'Parental leave',
    },
  });

  // Draft — the demo starts here.
  await draftMission(
    astra, 'marcus', 'Europa Survey', 35, 64,
    [
      role('Pilot', 1, { nav: 4 }),
      role('Flight Engineer', 1, { eva: 4, comms: 3 }),
      role('Mission Specialist', 1, { robotics: 4 }),
    ],
    'Ice-shell survey from low Europa orbit.',
  );

  // Approved: Amara accepted (a real commitment), Jamal's offer is pending.
  const resupply = await draftMission(astra, 'priya', 'ISS Resupply XII', 45, 75, [
    role('Commander', 1, { piloting: 4 }),
    role('Payload Specialist', 1, { comms: 3 }),
  ]);
  await nominate(ctxFor(astra, 'priya'), resupply.key, { role: 'Commander', crew: 'amara' });
  await nominate(ctxFor(astra, 'priya'), resupply.key, { role: 'Payload Specialist', crew: 'jamal' });
  await submitMission(ctxFor(astra, 'priya'), resupply.key);
  await approveMission(ctxFor(astra, 'ava'), resupply.key, 'Cleared for launch.');
  await acceptOffer(ctxFor(astra, 'amara'), resupply.key);

  // Submitted: waiting in Ava's inbox.
  const titan = await draftMission(astra, 'priya', 'Titan Relay', 100, 120, [
    role('Comms Officer', 1, { comms: 4 }),
    role('Navigator', 1, { nav: 4 }),
  ]);
  await nominate(ctxFor(astra, 'priya'), titan.key, { recommended: true });
  await submitMission(ctxFor(astra, 'priya'), titan.key);

  return astra;
}

// ── Lunar Collective ─────────────────────────────────────────────────────────

async function seedLunar(): Promise<SeededOrg> {
  const lunar = await seedOrg({
    slug: 'lunar',
    name: 'Lunar Collective',
    keyPrefix: 'LUN',
    restGapDays: 21,
    offerTtlDays: 5,
    skills: [
      ['regolith', 'Regolith Assay'],
      ['lifesupport', 'Life Support Systems'],
      ['geology', 'Geology'],
      ['habitat', 'Habitat Engineering'],
      ['comms', 'Comms'],
    ],
    people: [
      { handle: 'nora', name: 'Nora Hale', role: 'DIRECTOR' },
      { handle: 'owen', name: 'Owen Park', role: 'MISSION_LEAD' },
      { handle: 'fatima', name: 'Fatima Al-Sayed', role: 'MISSION_LEAD' },
      { handle: 'ingrid', name: 'Ingrid Bergström', role: 'CREW_MEMBER', skills: { regolith: 5, geology: 4 } },
      { handle: 'kofi', name: 'Kofi Mensah', role: 'CREW_MEMBER', skills: { lifesupport: 5, habitat: 3 } },
      { handle: 'mei', name: 'Mei Watanabe', role: 'CREW_MEMBER', skills: { geology: 5, comms: 3 } },
      { handle: 'rafael', name: 'Rafael Duarte', role: 'CREW_MEMBER', skills: { habitat: 4, lifesupport: 3 } },
      { handle: 'anya', name: 'Anya Kowalski', role: 'CREW_MEMBER', skills: { regolith: 4, comms: 4 } },
      { handle: 'victor', name: 'Victor Osei', role: 'CREW_MEMBER', skills: { geology: 3, habitat: 4 } },
      { handle: 'lucia', name: 'Lucia Fernández', role: 'CREW_MEMBER', skills: { lifesupport: 4, regolith: 3 } },
      { handle: 'henrik', name: 'Henrik Larsen', role: 'CREW_MEMBER', skills: { comms: 5, habitat: 2 } },
    ],
  });

  await insertMission(lunar, {
    title: 'Tranquility Core Drill', owner: 'owen', approver: 'nora', status: 'COMPLETED', start: -90, end: -61,
    roles: [
      { name: 'Assayer', skills: { regolith: 4 }, crew: [['ingrid', 'ACCEPTED']] },
      { name: 'Geologist', skills: { geology: 3 }, crew: [['mei', 'ACCEPTED']] },
    ],
  });

  await draftMission(lunar, 'owen', 'Mare Core Sampling', 40, 60, [
    role('Assayer', 1, { regolith: 4 }),
    role('Geologist', 1, { geology: 4 }),
  ]);

  const habitat = await draftMission(lunar, 'fatima', 'South Pole Habitat', 70, 110, [
    role('Habitat Engineer', 2, { habitat: 4 }),
    role('Life Support Lead', 1, { lifesupport: 4 }),
  ]);
  await nominate(ctxFor(lunar, 'fatima'), habitat.key, { recommended: true });
  await submitMission(ctxFor(lunar, 'fatima'), habitat.key);

  const crater = await draftMission(lunar, 'owen', 'Crater Rim Survey', 50, 57, [role('Surveyor', 1, { geology: 3 })]);
  await nominate(ctxFor(lunar, 'owen'), crater.key, { recommended: true });
  await submitMission(ctxFor(lunar, 'owen'), crater.key);
  await rejectMission(ctxFor(lunar, 'nora'), crater.key, 'Overlaps the regolith campaign — move it after LUN-2 finishes.');

  return lunar;
}

// ── Output ───────────────────────────────────────────────────────────────────

function printLogins(orgs: SeededOrg[]): void {
  const roleLabel: Record<Role, string> = { DIRECTOR: 'Director', MISSION_LEAD: 'Mission Lead', CREW_MEMBER: 'Crew' };
  console.log(`\nSeeded ${orgs.length} organisations (dates relative to ${formatIsoDate(today)}).\n`);
  for (const org of orgs) {
    console.log(`${org.spec.name}  ·  keys ${org.spec.keyPrefix}-n  ·  rest gap ${org.spec.restGapDays}d  ·  offers expire after ${org.spec.offerTtlDays}d`);
    for (const [handle, user] of org.users) {
      console.log(`  ${roleLabel[user.role].padEnd(13)} ${user.name.padEnd(18)} mc login ${user.token}`);
    }
    console.log('');
  }
  console.log('Each login creates a profile named <handle>@<org>; switch with `mc use marcus@astra`.');
  console.log('Start with:  mc login mct_astra_marcus && mc inbox\n');
}

async function main(): Promise<void> {
  await wipe();
  const astra = await seedAstra();
  const lunar = await seedLunar();
  printLogins([astra, lunar]);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void db.$disconnect();
  });
