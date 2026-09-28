/** Audit event types written to mission_events. Every state change and offer action is recorded. */
export const EVENT_TYPES = [
  'MISSION_CREATED',
  'MISSION_UPDATED',
  'ROLES_UPDATED',
  'CREW_NOMINATED',
  'NOMINATION_REMOVED',
  'MISSION_SUBMITTED',
  'MISSION_APPROVED',
  'MISSION_REJECTED',
  'MISSION_CANCELLED',
  'MISSION_ACTIVATED',
  'MISSION_COMPLETED',
  'OFFERS_SENT',
  'OFFER_SENT',
  'OFFER_RETRACTED',
  'OFFER_ACCEPTED',
  'OFFER_DECLINED',
  'OFFER_EXPIRED',
  'CREW_DROPPED_OUT',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];
