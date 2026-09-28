/**
 * Seed: two organisations with distinct skill taxonomies, users per role,
 * availability windows, assignment history (experience + reliability signals),
 * and missions in every lifecycle state so each CLI command has a target.
 *
 * All dates are UTC-midnight date-only. Demo window: 2026-11-01 → 2026-11-30.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

const DEMO_START = day('2026-11-01');
const DEMO_END = day('2026-11-30');

interface SeedUser {
  id: string;
  name: string;
  apiKey: string;
}

async function wipe(): Promise<void> {
  await prisma.missionEvent.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.missionSkillRequirement.deleteMany();
  await prisma.mission.deleteMany();
  await prisma.availabilityWindow.deleteMany();
  await prisma.crewSkill.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
}

async function seedOrg(config: {
  name: string;
  slug: string;
  skills: string[];
  director: { name: string; email: string };
  leads: [{ name: string; email: string }, { name: string; email: string }];
  crew: Array<{ name: string; email: string; skills: Array<[string, number]> }>;
}): Promise<{
  orgId: string;
  skillIds: Map<string, string>;
  director: SeedUser;
  leads: SeedUser[];
  crew: SeedUser[];
}> {
  const org = await prisma.organization.create({
    data: { name: config.name, slug: config.slug },
  });

  const skillIds = new Map<string, string>();
  for (const name of config.skills) {
    const skill = await prisma.skill.create({ data: { orgId: org.id, name } });
    skillIds.set(name, skill.id);
  }

  const makeUser = async (
    name: string,
    email: string,
    role: string,
    apiKey: string,
  ): Promise<SeedUser> => {
    const user = await prisma.user.create({
      data: { orgId: org.id, name, email, role, apiKey },
    });
    return { id: user.id, name, apiKey };
  };

  const director = await makeUser(
    config.director.name,
    config.director.email,
    'DIRECTOR',
    `tok_${config.slug}_director`,
  );
  const leads = await Promise.all([
    makeUser(config.leads[0].name, config.leads[0].email, 'MISSION_LEAD', `tok_${config.slug}_lead1`),
    makeUser(config.leads[1].name, config.leads[1].email, 'MISSION_LEAD', `tok_${config.slug}_lead2`),
  ]);

  const crew: SeedUser[] = [];
  for (const [index, member] of config.crew.entries()) {
    const seeded = await makeUser(
      member.name,
      member.email,
      'CREW_MEMBER',
      `tok_${config.slug}_crew${index + 1}`,
    );
    for (const [skillName, proficiency] of member.skills) {
      const skillId = skillIds.get(skillName);
      if (!skillId) throw new Error(`Unknown skill in seed: ${skillName}`);
      await prisma.crewSkill.create({
        data: { userId: seeded.id, skillId, proficiency },
      });
    }
    crew.push(seeded);
  }

  return { orgId: org.id, skillIds, director, leads, crew };
}

async function createMission(data: {
  orgId: string;
  title: string;
  status: string;
  start: Date;
  end: Date;
  createdBy: string;
  approvedBy?: string;
  submissionCount?: number;
  requirements: Array<{ skillId: string; minProficiency: number; headcount: number }>;
  actorEvents: Array<{ actorId: string; eventType: string; fromStatus?: string; toStatus?: string }>;
}): Promise<{ id: string; requirementIds: Map<string, string> }> {
  const mission = await prisma.mission.create({
    data: {
      orgId: data.orgId,
      title: data.title,
      status: data.status,
      startDate: data.start,
      endDate: data.end,
      createdBy: data.createdBy,
      approvedBy: data.approvedBy ?? null,
      submissionCount: data.submissionCount ?? 0,
    },
  });

  const requirementIds = new Map<string, string>();
  for (const req of data.requirements) {
    const created = await prisma.missionSkillRequirement.create({
      data: {
        missionId: mission.id,
        skillId: req.skillId,
        minProficiency: req.minProficiency,
        headcount: req.headcount,
      },
    });
    requirementIds.set(req.skillId, created.id);
  }

  for (const event of data.actorEvents) {
    await prisma.missionEvent.create({
      data: {
        orgId: data.orgId,
        missionId: mission.id,
        actorId: event.actorId,
        eventType: event.eventType,
        fromStatus: event.fromStatus ?? null,
        toStatus: event.toStatus ?? null,
      },
    });
  }

  return { id: mission.id, requirementIds };
}

async function createAssignment(data: {
  missionId: string;
  requirementId: string;
  userId: string;
  status: string;
  matchScore: number;
  declineReason?: string;
}): Promise<void> {
  await prisma.assignment.create({
    data: {
      missionId: data.missionId,
      requirementId: data.requirementId,
      userId: data.userId,
      status: data.status,
      matchScore: data.matchScore,
      scoreBreakdown: JSON.stringify({ seeded: true }),
      declineReason: data.declineReason ?? null,
      respondedAt: data.status === 'OFFERED' ? null : day('2026-09-01'),
    },
  });
}

async function main(): Promise<void> {
  await wipe();

  // ── Astra Dynamics ─────────────────────────────────────────────────────────
  const astra = await seedOrg({
    name: 'Astra Dynamics',
    slug: 'astra',
    skills: ['Orbital Navigation', 'EVA Ops', 'Robotics', 'Piloting', 'Comms'],
    director: { name: 'Ava Sterling', email: 'ava@astra.example' },
    leads: [
      { name: 'Marcus Chen', email: 'marcus@astra.example' },
      { name: 'Priya Nair', email: 'priya@astra.example' },
    ],
    crew: [
      { name: 'Leo Vasquez', email: 'leo@astra.example', skills: [['Orbital Navigation', 5], ['EVA Ops', 4], ['Comms', 3]] },
      { name: 'Yuki Tanaka', email: 'yuki@astra.example', skills: [['Orbital Navigation', 4], ['EVA Ops', 3], ['Robotics', 4]] },
      { name: 'Amara Okafor', email: 'amara@astra.example', skills: [['Orbital Navigation', 4], ['Piloting', 5], ['Comms', 4]] },
      { name: 'Dmitri Volkov', email: 'dmitri@astra.example', skills: [['EVA Ops', 5], ['Robotics', 3]] },
      { name: 'Sara Lindqvist', email: 'sara@astra.example', skills: [['Orbital Navigation', 3], ['EVA Ops', 4], ['Piloting', 3]] },
      { name: 'Jamal Reyes', email: 'jamal@astra.example', skills: [['Robotics', 5], ['Comms', 4], ['EVA Ops', 2]] },
      { name: 'Elena Petrova', email: 'elena@astra.example', skills: [['Orbital Navigation', 5], ['Comms', 5]] },
      { name: 'Tomás Silva', email: 'tomas@astra.example', skills: [['EVA Ops', 4], ['Robotics', 4], ['Piloting', 2]] },
    ],
  });
  const [leo, yuki, amara, dmitri, sara, jamal, elena, tomas] = astra.crew as [
    SeedUser, SeedUser, SeedUser, SeedUser, SeedUser, SeedUser, SeedUser, SeedUser,
  ];
  const astraSkill = (name: string): string => {
    const id = astra.skillIds.get(name);
    if (!id) throw new Error(`Missing Astra skill ${name}`);
    return id;
  };

  // Availability: Elena overlaps the demo window; Dmitri clips its start.
  await prisma.availabilityWindow.create({
    data: { userId: elena.id, startDate: day('2026-11-10'), endDate: day('2026-11-24'), note: 'Family leave' },
  });
  await prisma.availabilityWindow.create({
    data: { userId: dmitri.id, startDate: day('2026-10-28'), endDate: day('2026-11-04'), note: 'Robotics recertification' },
  });

  // History: completed missions give experience; declines feed reliability.
  const astraHistory = await Promise.all([
    createMission({
      orgId: astra.orgId, title: 'Mercury Flyby', status: 'COMPLETED',
      start: day('2026-03-01'), end: day('2026-03-31'),
      createdBy: astra.leads[0]!.id, approvedBy: astra.director.id, submissionCount: 1,
      requirements: [
        { skillId: astraSkill('Orbital Navigation'), minProficiency: 3, headcount: 1 },
        { skillId: astraSkill('EVA Ops'), minProficiency: 3, headcount: 1 },
      ],
      actorEvents: [{ actorId: astra.leads[0]!.id, eventType: 'CREATED', toStatus: 'DRAFT' }],
    }),
    createMission({
      orgId: astra.orgId, title: 'Vesta Docking', status: 'COMPLETED',
      start: day('2026-05-01'), end: day('2026-05-20'),
      createdBy: astra.leads[0]!.id, approvedBy: astra.director.id, submissionCount: 1,
      requirements: [
        { skillId: astraSkill('Orbital Navigation'), minProficiency: 4, headcount: 1 },
        { skillId: astraSkill('Robotics'), minProficiency: 3, headcount: 1 },
      ],
      actorEvents: [{ actorId: astra.leads[0]!.id, eventType: 'CREATED', toStatus: 'DRAFT' }],
    }),
    createMission({
      orgId: astra.orgId, title: 'Ceres Survey', status: 'COMPLETED',
      start: day('2026-07-01'), end: day('2026-07-25'),
      createdBy: astra.leads[1]!.id, approvedBy: astra.director.id, submissionCount: 1,
      requirements: [
        { skillId: astraSkill('Piloting'), minProficiency: 3, headcount: 1 },
        { skillId: astraSkill('Comms'), minProficiency: 3, headcount: 1 },
      ],
      actorEvents: [{ actorId: astra.leads[1]!.id, eventType: 'CREATED', toStatus: 'DRAFT' }],
    }),
    createMission({
      orgId: astra.orgId, title: 'Io Relay', status: 'COMPLETED',
      start: day('2026-08-05'), end: day('2026-08-28'),
      createdBy: astra.leads[0]!.id, approvedBy: astra.director.id, submissionCount: 1,
      requirements: [{ skillId: astraSkill('Robotics'), minProficiency: 4, headcount: 1 }],
      actorEvents: [{ actorId: astra.leads[0]!.id, eventType: 'CREATED', toStatus: 'DRAFT' }],
    }),
    createMission({
      orgId: astra.orgId, title: 'Europa Pathfinder', status: 'COMPLETED',
      start: day('2026-09-02'), end: day('2026-09-20'),
      createdBy: astra.leads[1]!.id, approvedBy: astra.director.id, submissionCount: 1,
      requirements: [{ skillId: astraSkill('EVA Ops'), minProficiency: 3, headcount: 1 }],
      actorEvents: [{ actorId: astra.leads[1]!.id, eventType: 'CREATED', toStatus: 'DRAFT' }],
    }),
  ]);
  const [mercury, vesta, ceres, io, pathfinder] = astraHistory as [
    { id: string; requirementIds: Map<string, string> },
    { id: string; requirementIds: Map<string, string> },
    { id: string; requirementIds: Map<string, string> },
    { id: string; requirementIds: Map<string, string> },
    { id: string; requirementIds: Map<string, string> },
  ];

  const histAssign = async (
    mission: { id: string; requirementIds: Map<string, string> },
    skillName: string,
    user: SeedUser,
    status: string,
    declineReason?: string,
  ): Promise<void> => {
    const requirementId = mission.requirementIds.get(astraSkill(skillName));
    if (!requirementId) throw new Error(`No requirement for ${skillName}`);
    await createAssignment({
      missionId: mission.id, requirementId, userId: user.id,
      status, matchScore: 0.75, declineReason,
    });
  };

  // Yuki: 5 completed missions (experience = 1.0)
  await histAssign(mercury, 'EVA Ops', yuki, 'ACCEPTED');
  await histAssign(vesta, 'Robotics', yuki, 'ACCEPTED');
  await histAssign(ceres, 'Comms', yuki, 'ACCEPTED');
  await histAssign(io, 'Robotics', yuki, 'ACCEPTED');
  await histAssign(pathfinder, 'EVA Ops', yuki, 'ACCEPTED');
  // Leo: 3 completed missions
  await histAssign(mercury, 'Orbital Navigation', leo, 'ACCEPTED');
  await histAssign(vesta, 'Orbital Navigation', leo, 'ACCEPTED');
  await histAssign(ceres, 'Comms', leo, 'ACCEPTED');
  // Amara, Dmitri, Sara, Tomás: light history
  await histAssign(ceres, 'Piloting', amara, 'ACCEPTED');
  await histAssign(io, 'Robotics', dmitri, 'ACCEPTED');
  await histAssign(pathfinder, 'EVA Ops', sara, 'ACCEPTED');
  await histAssign(io, 'Robotics', tomas, 'DECLINED', 'Conflicting certification exam');
  // Jamal: decline-heavy history (reliability << 1)
  await histAssign(vesta, 'Robotics', jamal, 'DECLINED', 'Personal commitments');
  await histAssign(io, 'Robotics', jamal, 'DECLINED', 'Not interested in relay ops');
  await histAssign(ceres, 'Comms', jamal, 'ACCEPTED');

  // Current missions — one per state for immediate CLI demos.
  const europa = await createMission({
    orgId: astra.orgId, title: 'Europa Survey', status: 'DRAFT',
    start: DEMO_START, end: DEMO_END,
    createdBy: astra.leads[0]!.id,
    requirements: [
      { skillId: astraSkill('Orbital Navigation'), minProficiency: 4, headcount: 1 },
      { skillId: astraSkill('EVA Ops'), minProficiency: 3, headcount: 1 },
    ],
    actorEvents: [{ actorId: astra.leads[0]!.id, eventType: 'CREATED', toStatus: 'DRAFT' }],
  });

  await createMission({
    orgId: astra.orgId, title: 'Titan Relay', status: 'SUBMITTED',
    start: day('2026-12-01'), end: day('2026-12-20'),
    createdBy: astra.leads[1]!.id, submissionCount: 1,
    requirements: [
      { skillId: astraSkill('Comms'), minProficiency: 4, headcount: 1 },
      { skillId: astraSkill('Robotics'), minProficiency: 4, headcount: 1 },
    ],
    actorEvents: [
      { actorId: astra.leads[1]!.id, eventType: 'CREATED', toStatus: 'DRAFT' },
      { actorId: astra.leads[1]!.id, eventType: 'SUBMITTED', fromStatus: 'DRAFT', toStatus: 'SUBMITTED' },
    ],
  });

  const resupply = await createMission({
    orgId: astra.orgId, title: 'ISS Resupply XII', status: 'APPROVED',
    start: day('2026-11-15'), end: day('2026-12-15'),
    createdBy: astra.leads[0]!.id, approvedBy: astra.director.id, submissionCount: 1,
    requirements: [{ skillId: astraSkill('Piloting'), minProficiency: 4, headcount: 1 }],
    actorEvents: [
      { actorId: astra.leads[0]!.id, eventType: 'CREATED', toStatus: 'DRAFT' },
      { actorId: astra.leads[0]!.id, eventType: 'SUBMITTED', fromStatus: 'DRAFT', toStatus: 'SUBMITTED' },
      { actorId: astra.director.id, eventType: 'APPROVED', fromStatus: 'SUBMITTED', toStatus: 'APPROVED' },
    ],
  });
  // A pending offer so `mc offers list` has content on first login.
  await createAssignment({
    missionId: resupply.id,
    requirementId: resupply.requirementIds.get(astraSkill('Piloting'))!,
    userId: amara.id, status: 'OFFERED', matchScore: 0.84,
  });

  const observatory = await createMission({
    orgId: astra.orgId, title: 'Lunar Shadow Observatory', status: 'ACTIVE',
    start: day('2026-10-15'), end: day('2026-11-10'),
    createdBy: astra.leads[0]!.id, approvedBy: astra.director.id, submissionCount: 1,
    requirements: [{ skillId: astraSkill('Orbital Navigation'), minProficiency: 4, headcount: 1 }],
    actorEvents: [
      { actorId: astra.leads[0]!.id, eventType: 'CREATED', toStatus: 'DRAFT' },
      { actorId: astra.leads[0]!.id, eventType: 'SUBMITTED', fromStatus: 'DRAFT', toStatus: 'SUBMITTED' },
      { actorId: astra.director.id, eventType: 'APPROVED', fromStatus: 'SUBMITTED', toStatus: 'APPROVED' },
      { actorId: astra.leads[0]!.id, eventType: 'ACTIVATED', fromStatus: 'APPROVED', toStatus: 'ACTIVE' },
    ],
  });
  // Yuki is committed 2026-11-01 → 11-10 within the demo window (workload 0.67).
  await createAssignment({
    missionId: observatory.id,
    requirementId: observatory.requirementIds.get(astraSkill('Orbital Navigation'))!,
    userId: yuki.id, status: 'ACCEPTED', matchScore: 0.81,
  });

  // ── Lunar Collective ───────────────────────────────────────────────────────
  const lunar = await seedOrg({
    name: 'Lunar Collective',
    slug: 'lunar',
    skills: ['Regolith Assay', 'Life Support Systems', 'Geology', 'Habitat Engineering', 'Comms'],
    director: { name: 'Nora Hale', email: 'nora@lunar.example' },
    leads: [
      { name: 'Owen Park', email: 'owen@lunar.example' },
      { name: 'Fatima Al-Sayed', email: 'fatima@lunar.example' },
    ],
    crew: [
      { name: 'Ingrid Bergstrom', email: 'ingrid@lunar.example', skills: [['Regolith Assay', 5], ['Geology', 4]] },
      { name: 'Kofi Mensah', email: 'kofi@lunar.example', skills: [['Life Support Systems', 5], ['Habitat Engineering', 3]] },
      { name: 'Mei Watanabe', email: 'mei@lunar.example', skills: [['Geology', 5], ['Comms', 3]] },
      { name: 'Rafael Duarte', email: 'rafael@lunar.example', skills: [['Habitat Engineering', 4], ['Life Support Systems', 3]] },
      { name: 'Anya Kowalski', email: 'anya@lunar.example', skills: [['Regolith Assay', 4], ['Comms', 4]] },
      { name: 'Victor Osei', email: 'victor@lunar.example', skills: [['Geology', 3], ['Habitat Engineering', 4]] },
      { name: 'Lucia Fernandez', email: 'lucia@lunar.example', skills: [['Life Support Systems', 4], ['Regolith Assay', 3]] },
      { name: 'Henrik Larsen', email: 'henrik@lunar.example', skills: [['Comms', 5], ['Habitat Engineering', 2]] },
    ],
  });
  const lunarSkill = (name: string): string => {
    const id = lunar.skillIds.get(name);
    if (!id) throw new Error(`Missing Lunar skill ${name}`);
    return id;
  };

  const lunarPast = await createMission({
    orgId: lunar.orgId, title: 'Tranquility Core Drill', status: 'COMPLETED',
    start: day('2026-06-01'), end: day('2026-06-30'),
    createdBy: lunar.leads[0]!.id, approvedBy: lunar.director.id, submissionCount: 1,
    requirements: [
      { skillId: lunarSkill('Regolith Assay'), minProficiency: 4, headcount: 1 },
      { skillId: lunarSkill('Geology'), minProficiency: 3, headcount: 1 },
    ],
    actorEvents: [{ actorId: lunar.leads[0]!.id, eventType: 'CREATED', toStatus: 'DRAFT' }],
  });
  await createAssignment({
    missionId: lunarPast.id,
    requirementId: lunarPast.requirementIds.get(lunarSkill('Regolith Assay'))!,
    userId: lunar.crew[0]!.id, status: 'ACCEPTED', matchScore: 0.88,
  });
  await createAssignment({
    missionId: lunarPast.id,
    requirementId: lunarPast.requirementIds.get(lunarSkill('Geology'))!,
    userId: lunar.crew[2]!.id, status: 'ACCEPTED', matchScore: 0.83,
  });

  await createMission({
    orgId: lunar.orgId, title: 'Mare Core Sampling', status: 'DRAFT',
    start: DEMO_START, end: DEMO_END,
    createdBy: lunar.leads[0]!.id,
    requirements: [
      { skillId: lunarSkill('Regolith Assay'), minProficiency: 4, headcount: 1 },
      { skillId: lunarSkill('Geology'), minProficiency: 4, headcount: 1 },
    ],
    actorEvents: [{ actorId: lunar.leads[0]!.id, eventType: 'CREATED', toStatus: 'DRAFT' }],
  });
  await createMission({
    orgId: lunar.orgId, title: 'South Pole Habitat', status: 'SUBMITTED',
    start: day('2026-12-05'), end: day('2027-01-15'),
    createdBy: lunar.leads[1]!.id, submissionCount: 1,
    requirements: [
      { skillId: lunarSkill('Habitat Engineering'), minProficiency: 4, headcount: 2 },
      { skillId: lunarSkill('Life Support Systems'), minProficiency: 4, headcount: 1 },
    ],
    actorEvents: [
      { actorId: lunar.leads[1]!.id, eventType: 'CREATED', toStatus: 'DRAFT' },
      { actorId: lunar.leads[1]!.id, eventType: 'SUBMITTED', fromStatus: 'DRAFT', toStatus: 'SUBMITTED' },
    ],
  });

  // ── Token table ────────────────────────────────────────────────────────────
  const users = await prisma.user.findMany({
    orderBy: [{ orgId: 'asc' }, { role: 'asc' }, { name: 'asc' }],
    include: { org: true },
  });
  console.log('\nSeed complete. API tokens (use with `mc login --token …`):\n');
  console.log(`${'Organisation'.padEnd(20)}${'Role'.padEnd(15)}${'Name'.padEnd(22)}Token`);
  console.log('-'.repeat(90));
  for (const user of users) {
    console.log(
      `${user.org.name.padEnd(20)}${user.role.padEnd(15)}${user.name.padEnd(22)}${user.apiKey}`,
    );
  }
  console.log('');
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
