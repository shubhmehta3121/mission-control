/**
 * Integration harness: a fresh copy of the migrated template DB per test file,
 * the real Fastify app driven through inject(), a controllable clock, and a
 * small two-organisation world.
 */
import { copyFileSync } from 'node:fs';
import { PrismaClient, type Role } from '@prisma/client';
import { inject } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/http/app.js';
import { hashToken } from '../../src/lib/tokens.js';
import type { Clock } from '../../src/lib/clock.js';

export interface TestClock extends Clock {
  set(iso: string): void;
  advanceDays(days: number): void;
}

export function testClock(iso: string): TestClock {
  let current = new Date(iso);
  return {
    now: () => new Date(current),
    set: (next) => {
      current = new Date(next);
    },
    advanceDays: (days) => {
      current = new Date(current.getTime() + days * 86_400_000);
    },
  };
}

export interface ApiResponse<T = any> {
  status: number;
  body: T;
}

export interface Api {
  get<T = any>(url: string): Promise<ApiResponse<T>>;
  post<T = any>(url: string, body?: unknown): Promise<ApiResponse<T>>;
  put<T = any>(url: string, body?: unknown): Promise<ApiResponse<T>>;
  patch<T = any>(url: string, body?: unknown): Promise<ApiResponse<T>>;
  delete<T = any>(url: string): Promise<ApiResponse<T>>;
}

export interface TestWorld {
  app: FastifyInstance;
  db: PrismaClient;
  clock: TestClock;
  as(handle: string): Api;
  anonymous: Api;
  close(): Promise<void>;
}

let counter = 0;

export async function createTestWorld(name: string): Promise<TestWorld> {
  const template = inject('templateDb');
  counter += 1;
  const file = template.replace(/template\.db$/, `${name}-${process.pid}-${counter}.db`);
  copyFileSync(template, file);
  const db = new PrismaClient({ datasourceUrl: `file:${file}` });
  const clock = testClock('2026-10-01T09:00:00.000Z');
  const app = buildApp({ db, clock, logger: process.env.MC_TEST_LOG ? { level: 'error' } : false });
  await app.ready();
  await seedWorld(db);

  const client = (token: string | null): Api => {
    const call = async (method: string, url: string, body?: unknown): Promise<ApiResponse> => {
      const response = await app.inject({
        method: method as 'GET',
        url,
        headers: token ? { authorization: `Bearer ${token}` } : {},
        ...(body === undefined ? {} : { payload: body as object }),
      });
      return { status: response.statusCode, body: response.body ? response.json() : null };
    };
    return {
      get: (url) => call('GET', url),
      post: (url, body) => call('POST', url, body),
      put: (url, body) => call('PUT', url, body),
      patch: (url, body) => call('PATCH', url, body),
      delete: (url) => call('DELETE', url),
    };
  };

  return {
    app,
    db,
    clock,
    as: (handle) => client(`tok-${handle}`),
    anonymous: client(null),
    close: async () => {
      await app.close();
      await db.$disconnect();
    },
  };
}

/**
 * Astra (AST): director ava (+ ben), leads marcus and priya, five crew.
 * Lunar (LUN):  director nora, lead owen, one crew — the "other tenant".
 */
async function seedWorld(db: PrismaClient): Promise<void> {
  const org = async (slug: string, name: string, keyPrefix: string, skills: Array<[string, string]>) => {
    const created = await db.organization.create({ data: { slug, name, keyPrefix } });
    const ids = new Map<string, string>();
    for (const [key, skillName] of skills) {
      const skill = await db.skill.create({ data: { orgId: created.id, key, name: skillName } });
      ids.set(key, skill.id);
    }
    return { id: created.id, skills: ids };
  };
  const user = async (
    orgRef: { id: string; skills: Map<string, string> },
    handle: string,
    role: Role,
    skills: Record<string, number> = {},
  ) => {
    const created = await db.user.create({
      data: {
        orgId: orgRef.id,
        handle,
        name: handle.charAt(0).toUpperCase() + handle.slice(1),
        email: `${handle}@${orgRef.id}.test`,
        role,
        tokenHash: hashToken(`tok-${handle}`),
      },
    });
    for (const [key, level] of Object.entries(skills)) {
      await db.crewSkill.create({
        data: { orgId: orgRef.id, userId: created.id, skillId: orgRef.skills.get(key)!, proficiency: level },
      });
    }
    return created;
  };

  const astra = await org('astra', 'Astra Dynamics', 'AST', [
    ['nav', 'Orbital Navigation'],
    ['eva', 'EVA Ops'],
    ['robotics', 'Robotics'],
  ]);
  await user(astra, 'ava', 'DIRECTOR');
  await user(astra, 'ben', 'DIRECTOR');
  await user(astra, 'marcus', 'MISSION_LEAD');
  await user(astra, 'priya', 'MISSION_LEAD');
  await user(astra, 'leo', 'CREW_MEMBER', { nav: 5, eva: 4 });
  await user(astra, 'yuki', 'CREW_MEMBER', { nav: 4 });
  await user(astra, 'sara', 'CREW_MEMBER', { eva: 4 });
  await user(astra, 'tomas', 'CREW_MEMBER', { robotics: 4, eva: 3 });
  const dmitri = await user(astra, 'dmitri', 'CREW_MEMBER', { eva: 5 });
  await db.unavailability.create({
    data: {
      orgId: astra.id,
      userId: dmitri.id,
      startDate: new Date('2026-11-05T00:00:00Z'),
      endDate: new Date('2026-11-12T00:00:00Z'),
      note: 'Recertification',
    },
  });

  const lunar = await org('lunar', 'Lunar Collective', 'LUN', [
    ['regolith', 'Regolith Assay'],
    ['nav', 'Orbital Navigation'],
  ]);
  await user(lunar, 'nora', 'DIRECTOR');
  await user(lunar, 'owen', 'MISSION_LEAD');
  await user(lunar, 'ingrid', 'CREW_MEMBER', { regolith: 5, nav: 5 });
}

/** Two-role mission (Pilot nav≥4, Engineer eva≥3) in November, owned by `lead`. */
export async function createStandardMission(api: Api, overrides: Record<string, unknown> = {}): Promise<string> {
  const response = await api.post('/v1/missions', {
    title: 'Europa Survey',
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    roles: [
      { name: 'Pilot', headcount: 1, skills: [{ skill: 'nav', min: 4 }] },
      { name: 'Engineer', headcount: 1, skills: [{ skill: 'eva', min: 3 }] },
    ],
    ...overrides,
  });
  if (response.status !== 201) throw new Error(`createStandardMission failed: ${JSON.stringify(response.body)}`);
  return response.body.key as string;
}
