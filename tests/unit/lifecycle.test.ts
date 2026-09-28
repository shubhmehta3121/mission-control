import { describe, expect, it } from 'vitest';
import {
  MISSION_RULES,
  allowedMissionActions,
  assertMissionAction,
  type MissionAction,
} from '../../src/domain/lifecycle.js';
import type { Actor, MissionStatus, Role } from '../../src/domain/types.js';
import { AppError } from '../../src/lib/errors.js';

const STATUSES: MissionStatus[] = ['DRAFT', 'SUBMITTED', 'REJECTED', 'APPROVED', 'ACTIVE', 'COMPLETED', 'CANCELLED'];
const ACTIONS = MISSION_RULES.map((rule) => rule.action);

const actor = (id: string, role: Role): Actor => ({
  userId: id,
  orgId: 'org',
  role,
  handle: id,
  name: id,
  org: { slug: 'astra', name: 'Astra', keyPrefix: 'AST' },
});

const OWNER_LEAD = actor('owner', 'MISSION_LEAD');
const OTHER_LEAD = actor('lead2', 'MISSION_LEAD');
const DIRECTOR = actor('director', 'DIRECTOR');
const CREW = actor('crew', 'CREW_MEMBER');

function outcome(action: MissionAction, status: MissionStatus, who: Actor, ownerId = 'owner'): string {
  try {
    assertMissionAction(action, { status, ownerId }, who);
    return 'ok';
  } catch (error) {
    if (error instanceof AppError) return error.code;
    throw error;
  }
}

describe('mission lifecycle rules', () => {
  it('lets only the owner edit, nominate and submit — from DRAFT or REJECTED', () => {
    for (const action of ['edit', 'nominate', 'submit'] as const) {
      expect(outcome(action, 'DRAFT', OWNER_LEAD)).toBe('ok');
      expect(outcome(action, 'REJECTED', OWNER_LEAD)).toBe('ok');
      expect(outcome(action, 'SUBMITTED', OWNER_LEAD)).toBe('INVALID_TRANSITION');
      expect(outcome(action, 'DRAFT', OTHER_LEAD)).toBe('FORBIDDEN');
      expect(outcome(action, 'DRAFT', DIRECTOR)).toBe('FORBIDDEN');
    }
  });

  it('reserves approve/reject for directors, never on their own mission', () => {
    for (const action of ['approve', 'reject'] as const) {
      expect(outcome(action, 'SUBMITTED', DIRECTOR)).toBe('ok');
      expect(outcome(action, 'SUBMITTED', OWNER_LEAD)).toBe('FORBIDDEN');
      expect(outcome(action, 'SUBMITTED', OTHER_LEAD)).toBe('FORBIDDEN');
      expect(outcome(action, 'SUBMITTED', DIRECTOR, 'director')).toBe('CANNOT_APPROVE_OWN');
      expect(outcome(action, 'DRAFT', DIRECTOR)).toBe('INVALID_TRANSITION');
    }
  });

  it('lets only directors cancel, from any non-terminal state', () => {
    for (const status of STATUSES) {
      const terminal = status === 'COMPLETED' || status === 'CANCELLED';
      expect(outcome('cancel', status, DIRECTOR)).toBe(terminal ? 'INVALID_TRANSITION' : 'ok');
      expect(outcome('cancel', status, OWNER_LEAD)).toBe('FORBIDDEN');
    }
  });

  it('lets the owner activate an approved mission and owner or director complete it', () => {
    expect(outcome('activate', 'APPROVED', OWNER_LEAD)).toBe('ok');
    expect(outcome('activate', 'APPROVED', DIRECTOR)).toBe('FORBIDDEN');
    expect(outcome('complete', 'ACTIVE', OWNER_LEAD)).toBe('ok');
    expect(outcome('complete', 'ACTIVE', DIRECTOR)).toBe('ok');
    expect(outcome('complete', 'APPROVED', OWNER_LEAD)).toBe('INVALID_TRANSITION');
  });

  it('never lets crew members act on missions', () => {
    for (const status of STATUSES) {
      for (const action of ACTIONS) expect(outcome(action, status, CREW)).toBe('FORBIDDEN');
    }
  });

  it('allowedMissionActions agrees with enforcement for every status × action × actor', () => {
    for (const who of [OWNER_LEAD, OTHER_LEAD, DIRECTOR, CREW]) {
      for (const status of STATUSES) {
        const allowed = allowedMissionActions({ status, ownerId: 'owner' }, who);
        for (const action of ACTIONS) {
          expect(allowed.includes(action)).toBe(outcome(action, status, who) === 'ok');
        }
      }
    }
  });
});
