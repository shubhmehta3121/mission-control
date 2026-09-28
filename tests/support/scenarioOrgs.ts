/**
 * Scenario organisations for stress tests. Each is built around one kind of
 * pressure; tokens are `tok-<handle>` so tests can act as anyone via world.as().
 * Handles are unique across all orgs (the token → user lookup is global).
 */
import type { PrismaClient, Role } from '@prisma/client';
import { hashToken } from '../../src/lib/tokens.js';

export interface OrgSpec {
  slug: string;
  name: string;
  keyPrefix: string;
  restGapDays?: number;
  offerTtlDays?: number;
  skills: Array<[key: string, name: string]>;
  people: Array<{
    handle: string;
    role: Role;
    skills?: Record<string, number>;
    unavailable?: Array<[start: string, end: string]>;
  }>;
}

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
export const displayName = (handle: string) => handle.charAt(0).toUpperCase() + handle.slice(1);

export async function buildOrg(db: PrismaClient, spec: OrgSpec): Promise<{ id: string }> {
  const org = await db.organization.create({
    data: {
      slug: spec.slug,
      name: spec.name,
      keyPrefix: spec.keyPrefix,
      ...(spec.restGapDays !== undefined ? { restGapDays: spec.restGapDays } : {}),
      ...(spec.offerTtlDays !== undefined ? { offerTtlDays: spec.offerTtlDays } : {}),
    },
  });
  const skillIds = new Map<string, string>();
  for (const [key, name] of spec.skills) {
    skillIds.set(key, (await db.skill.create({ data: { orgId: org.id, key, name } })).id);
  }
  for (const person of spec.people) {
    const user = await db.user.create({
      data: {
        orgId: org.id,
        handle: person.handle,
        name: displayName(person.handle),
        email: `${person.handle}@${spec.slug}.test`,
        role: person.role,
        tokenHash: hashToken(`tok-${person.handle}`),
      },
    });
    for (const [key, level] of Object.entries(person.skills ?? {})) {
      await db.crewSkill.create({ data: { orgId: org.id, userId: user.id, skillId: skillIds.get(key)!, proficiency: level } });
    }
    for (const [start, end] of person.unavailable ?? []) {
      await db.unavailability.create({ data: { orgId: org.id, userId: user.id, startDate: day(start), endDate: day(end) } });
    }
  }
  return { id: org.id };
}

/**
 * Commit crew to an approved mission directly (no API), so a scenario can start
 * with people already booked — for rest-gap and workload set-ups.
 */
export async function commitCrew(
  db: PrismaClient,
  args: { orgSlug: string; owner: string; title: string; start: string; end: string; crew: Array<[handle: string, skill: string]> },
): Promise<string> {
  const org = await db.organization.update({ where: { slug: args.orgSlug }, data: { missionSeq: { increment: 1 } } });
  const owner = await db.user.findFirstOrThrow({ where: { orgId: org.id, handle: args.owner } });
  const mission = await db.mission.create({
    data: {
      orgId: org.id,
      number: org.missionSeq,
      title: args.title,
      startDate: day(args.start),
      endDate: day(args.end),
      status: 'APPROVED',
      ownerId: owner.id,
    },
  });
  for (const [index, [handle, skillKey]] of args.crew.entries()) {
    const skill = await db.skill.findFirstOrThrow({ where: { orgId: org.id, key: skillKey } });
    const role = await db.missionRole.create({
      data: {
        orgId: org.id,
        missionId: mission.id,
        name: `Seat ${index + 1}`,
        headcount: 1,
        position: index,
        requirements: { create: [{ skillId: skill.id, minProficiency: 1 }] },
      },
    });
    const user = await db.user.findFirstOrThrow({ where: { orgId: org.id, handle } });
    await db.assignment.create({
      data: {
        orgId: org.id,
        missionId: mission.id,
        roleId: role.id,
        userId: user.id,
        status: 'ACCEPTED',
        score: 0,
        scoreBreakdown: { seeded: true },
        offeredAt: day(args.start),
        respondedAt: day(args.start),
      },
    });
  }
  return `${org.keyPrefix}-${org.missionSeq}`;
}

/** Deterministic PRNG (mulberry32) — same seed, same "random" org, every run. */
export function rng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Kestrel Orbital: tiny startup — scarcity, dead ends, back-to-back ────────

export const KESTREL: OrgSpec = {
  slug: 'kestrel',
  name: 'Kestrel Orbital',
  keyPrefix: 'KES',
  restGapDays: 0,
  offerTtlDays: 3,
  skills: [
    ['pilot', 'Piloting'],
    ['eng', 'Engineering'],
    ['med', 'Flight Medicine'],
  ],
  people: [
    { handle: 'kdir', role: 'DIRECTOR' },
    { handle: 'klead', role: 'MISSION_LEAD' },
    { handle: 'kara', role: 'CREW_MEMBER', skills: { pilot: 4, eng: 2 } },
    { handle: 'kobe', role: 'CREW_MEMBER', skills: { eng: 4 } },
    { handle: 'kira', role: 'CREW_MEMBER', skills: { med: 3, pilot: 3 } },
  ],
};

// ── Helios Deep Space: large agency — scale, many overlapping multi-seat missions

export const HELIOS_SKILLS: Array<[string, string]> = [
  ['nav', 'Orbital Navigation'],
  ['eva', 'EVA Ops'],
  ['robotics', 'Robotics'],
  ['piloting', 'Piloting'],
  ['comms', 'Comms'],
  ['medic', 'Flight Medicine'],
  ['geology', 'Geology'],
  ['habitat', 'Habitat Engineering'],
  ['lifesupport', 'Life Support'],
  ['science', 'Payload Science'],
  ['eng', 'Systems Engineering'],
  ['cargo', 'Cargo Operations'],
];

export function helios(seed = 20260929): OrgSpec {
  const random = rng(seed);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
  const people: OrgSpec['people'] = [
    ...['hdir1', 'hdir2', 'hdir3'].map((handle) => ({ handle, role: 'DIRECTOR' as const })),
    ...['hlead1', 'hlead2', 'hlead3', 'hlead4', 'hlead5', 'hlead6'].map((handle) => ({ handle, role: 'MISSION_LEAD' as const })),
  ];
  for (let index = 1; index <= 60; index += 1) {
    const skills: Record<string, number> = {};
    const count = 2 + Math.floor(random() * 3); // 2–4 skills
    while (Object.keys(skills).length < count) skills[pick(HELIOS_SKILLS)[0]] = 1 + Math.floor(random() * 5);
    const unavailable: Array<[string, string]> = [];
    if (random() < 0.25) {
      const month = 11 + Math.floor(random() * 4); // Nov 2026 – Feb 2027
      const year = month > 12 ? 2027 : 2026;
      const mm = String(month > 12 ? month - 12 : month).padStart(2, '0');
      const startDay = 1 + Math.floor(random() * 18);
      unavailable.push([`${year}-${mm}-${String(startDay).padStart(2, '0')}`, `${year}-${mm}-${String(startDay + 7).padStart(2, '0')}`]);
    }
    people.push({ handle: `h${String(index).padStart(2, '0')}`, role: 'CREW_MEMBER', skills, unavailable });
  }
  return { slug: 'helios', name: 'Helios Deep Space', keyPrefix: 'HEL', restGapDays: 14, offerTtlDays: 7, skills: HELIOS_SKILLS, people };
}

/** 15 overlapping missions for Helios, deterministic. */
export function heliosMissions(seed = 7): Array<{
  lead: string;
  title: string;
  startDate: string;
  endDate: string;
  roles: Array<{ name: string; headcount: number; skills: Array<{ skill: string; min: number }> }>;
}> {
  const random = rng(seed);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]!;
  const base = Date.UTC(2026, 10, 1); // 2026-11-01
  const iso = (offset: number) => new Date(base + offset * 86_400_000).toISOString().slice(0, 10);
  return Array.from({ length: 15 }, (_, index) => {
    const start = Math.floor(random() * 100);
    const length = 7 + Math.floor(random() * 25);
    const roles = Array.from({ length: 2 + Math.floor(random() * 3) }, (_, roleIndex) => {
      const skills = new Map<string, number>();
      const skillCount = 1 + Math.floor(random() * 2);
      while (skills.size < skillCount) skills.set(pick(HELIOS_SKILLS)[0], 2 + Math.floor(random() * 3));
      return {
        name: `Role ${roleIndex + 1}`,
        headcount: 1 + Math.floor(random() * 3),
        skills: [...skills].map(([skill, min]) => ({ skill, min })),
      };
    });
    return { lead: `hlead${(index % 6) + 1}`, title: `Helios Mission ${index + 1}`, startDate: iso(start), endDate: iso(start + length), roles };
  });
}

// ── Aurora Polar Station: long duration — 45-day rest gap, 2-day offers, dates ─

export const AURORA: OrgSpec = {
  slug: 'aurora',
  name: 'Aurora Polar Station',
  keyPrefix: 'AUR',
  restGapDays: 45,
  offerTtlDays: 2,
  skills: [
    ['glacio', 'Glaciology'],
    ['mech', 'Mechanics'],
    ['medic', 'Station Medicine'],
    ['comms', 'Comms'],
  ],
  people: [
    { handle: 'adir1', role: 'DIRECTOR' },
    { handle: 'adir2', role: 'DIRECTOR' },
    { handle: 'alead', role: 'MISSION_LEAD' },
    { handle: 'anna', role: 'CREW_MEMBER', skills: { glacio: 5, comms: 3 } },
    { handle: 'arne', role: 'CREW_MEMBER', skills: { glacio: 4, mech: 3 } },
    { handle: 'asha', role: 'CREW_MEMBER', skills: { mech: 5 } },
    { handle: 'axel', role: 'CREW_MEMBER', skills: { medic: 4, comms: 4 } },
    { handle: 'ayla', role: 'CREW_MEMBER', skills: { medic: 3, glacio: 3 } },
    { handle: 'abel', role: 'CREW_MEMBER', skills: { mech: 4, medic: 2 } },
  ],
};

// ── Vanguard Contractors: high churn — messy availability, overlapping offers ─

export const VANGUARD: OrgSpec = {
  slug: 'vanguard',
  name: 'Vanguard Contractors',
  keyPrefix: 'VAN',
  restGapDays: 7,
  offerTtlDays: 5,
  skills: [
    ['rig', 'Rigging'],
    ['weld', 'Welding'],
    ['drive', 'Rover Driving'],
    ['comms', 'Comms'],
  ],
  people: [
    { handle: 'vdir1', role: 'DIRECTOR' },
    { handle: 'vdir2', role: 'DIRECTOR' },
    { handle: 'vlead1', role: 'MISSION_LEAD' },
    { handle: 'vlead2', role: 'MISSION_LEAD' },
    { handle: 'val', role: 'CREW_MEMBER', skills: { rig: 4, weld: 3 } },
    { handle: 'vic', role: 'CREW_MEMBER', skills: { weld: 5 } },
    { handle: 'vera', role: 'CREW_MEMBER', skills: { drive: 4, comms: 3 } },
    { handle: 'vito', role: 'CREW_MEMBER', skills: { rig: 3, drive: 3 }, unavailable: [['2026-12-10', '2026-12-15']] },
    { handle: 'vivi', role: 'CREW_MEMBER', skills: { comms: 5, rig: 2 } },
    { handle: 'vance', role: 'CREW_MEMBER', skills: { weld: 4, drive: 2 } },
    { handle: 'veda', role: 'CREW_MEMBER', skills: { rig: 5 }, unavailable: [['2026-11-25', '2026-12-01']] },
    { handle: 'vox', role: 'CREW_MEMBER', skills: { drive: 5 }, unavailable: [['2026-11-20', '2026-11-30']] },
  ],
};
