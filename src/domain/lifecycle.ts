/**
 * Mission lifecycle and permissions as data.
 *
 * One table answers "who may do what, in which state". It drives:
 *   - enforcement      (assertMissionAction, called by every mission service)
 *   - discoverability  (allowedMissionActions → `allowedActions` in API responses → CLI hints)
 *   - tests            (tests/unit/lifecycle.test.ts walks every status × action × role)
 *
 * State guards that need data (e.g. "every role is fully nominated") live in the
 * services; this table only covers state + actor.
 */
import { AppError, forbidden } from '../lib/errors.js';
import type { Actor, MissionStatus } from './types.js';
import { hasRoleAtLeast } from './types.js';

export type MissionAction =
  | 'edit'
  | 'nominate'
  | 'submit'
  | 'approve'
  | 'reject'
  | 'cancel'
  | 'offer'
  | 'activate'
  | 'complete'
  | 'match';

/** Who may perform an action, relative to the mission. */
export type ActorRule = 'owner' | 'director' | 'directorNotOwner' | 'ownerOrDirector' | 'leadOrAbove';

export interface MissionRule {
  action: MissionAction;
  from: readonly MissionStatus[];
  to?: MissionStatus;
  who: ActorRule;
  /** Used in permission errors: "Only a director can <verb>." */
  verb: string;
  summary: string;
}

const NON_TERMINAL: readonly MissionStatus[] = ['DRAFT', 'SUBMITTED', 'REJECTED', 'APPROVED', 'ACTIVE'];

const rule = (
  action: MissionAction,
  from: readonly MissionStatus[],
  who: ActorRule,
  verb: string,
  summary: string,
  to?: MissionStatus,
): MissionRule => ({ action, from, who, verb, summary, ...(to ? { to } : {}) });

export const MISSION_RULES: readonly MissionRule[] = [
  //   action      from                     who                 verb (errors)                            summary (hints)                                   to
  rule('edit',     ['DRAFT', 'REJECTED'],   'owner',            'edit this mission',                     'change title, dates or roles'),
  rule('match',    NON_TERMINAL,            'leadOrAbove',      'run the matcher',                       'run the matcher (dry run)'),
  rule('nominate', ['DRAFT', 'REJECTED'],   'owner',            'nominate crew for this mission',        'nominate crew (hidden from crew until approval)'),
  rule('submit',   ['DRAFT', 'REJECTED'],   'owner',            'submit this mission',                   'send plan + nominated crew for approval',        'SUBMITTED'),
  rule('approve',  ['SUBMITTED'],           'directorNotOwner', 'approve this mission',                  'approve — offers go to the nominated crew',      'APPROVED'),
  rule('reject',   ['SUBMITTED'],           'directorNotOwner', 'reject this mission',                   'send back for changes',                          'REJECTED'),
  rule('cancel',   NON_TERMINAL,            'director',         'cancel missions',                       'scrap the mission — releases all crew',          'CANCELLED'),
  rule('offer',    ['APPROVED', 'ACTIVE'],  'owner',            "offer or retract this mission's seats", 'backfill open seats or retract offers'),
  rule('activate', ['APPROVED'],            'owner',            'activate this mission',                 'lock the crew (every seat accepted)',            'ACTIVE'),
  rule('complete', ['ACTIVE'],              'ownerOrDirector',  'complete this mission',                 'close out the mission',                          'COMPLETED'),
];

export interface MissionRef {
  status: MissionStatus;
  ownerId: string;
}

export function ruleFor(action: MissionAction): MissionRule {
  const rule = MISSION_RULES.find((candidate) => candidate.action === action);
  if (!rule) throw new Error(`No lifecycle rule for action "${action}"`);
  return rule;
}

function actorAllowed(rule: ActorRule, actor: Actor, mission: MissionRef): boolean {
  const isOwner = actor.userId === mission.ownerId;
  const isDirector = actor.role === 'DIRECTOR';
  switch (rule) {
    case 'owner':
      return isOwner;
    case 'director':
      return isDirector;
    case 'directorNotOwner':
      return isDirector && !isOwner;
    case 'ownerOrDirector':
      return isOwner || isDirector;
    case 'leadOrAbove':
      return hasRoleAtLeast(actor, 'MISSION_LEAD');
    default: {
      const unreachable: never = rule;
      throw new Error(`Unhandled actor rule ${String(unreachable)}`);
    }
  }
}

function actorError(rule: MissionRule, actor: Actor, mission: MissionRef): AppError {
  if (rule.who === 'directorNotOwner' && actor.role === 'DIRECTOR' && actor.userId === mission.ownerId) {
    return new AppError(
      'CANNOT_APPROVE_OWN',
      'You created this mission, so you cannot review it. Another director must approve or reject it.',
    );
  }
  const who: Record<ActorRule, string> = {
    owner: "the mission's owner",
    director: 'a director',
    directorNotOwner: 'a director who did not create the mission',
    ownerOrDirector: "the mission's owner or a director",
    leadOrAbove: 'mission leads and directors',
  };
  return forbidden(`Only ${who[rule.who]} can ${rule.verb}.`);
}

/** Throws FORBIDDEN / CANNOT_APPROVE_OWN (actor) or INVALID_TRANSITION (state). Actor is checked first. */
export function assertMissionAction(action: MissionAction, mission: MissionRef, actor: Actor): MissionRule {
  const rule = ruleFor(action);
  if (!actorAllowed(rule.who, actor, mission)) throw actorError(rule, actor, mission);
  if (!rule.from.includes(mission.status)) {
    throw new AppError(
      'INVALID_TRANSITION',
      `Cannot ${action} a mission that is ${mission.status}. Allowed from: ${rule.from.join(', ')}.`,
      { status: mission.status, action, allowedFrom: rule.from },
    );
  }
  return rule;
}

export function canPerform(action: MissionAction, mission: MissionRef, actor: Actor): boolean {
  const rule = ruleFor(action);
  return rule.from.includes(mission.status) && actorAllowed(rule.who, actor, mission);
}

/** Actions this actor may take on this mission right now (state + actor only). */
export function allowedMissionActions(mission: MissionRef, actor: Actor): MissionAction[] {
  return MISSION_RULES.filter((rule) => canPerform(rule.action, mission, actor)).map((rule) => rule.action);
}
