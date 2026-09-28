/** Request schemas (zod). Shape validation only; business rules live in the services. */
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { parseIsoDate } from '../lib/dates.js';

export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data;
  const details = result.error.issues.map((issue) => ({
    path: issue.path.map(String).join('.') || '(body)',
    message: issue.message,
  }));
  const first = details[0];
  throw new AppError(
    'VALIDATION_FAILED',
    first ? `Invalid request: ${first.path} — ${first.message}` : 'Invalid request',
    details,
  );
}

export const isoDate = z
  .string()
  .refine((value) => parseIsoDate(value) !== null, { message: 'must be a real date in YYYY-MM-DD format' })
  .transform((value) => parseIsoDate(value)!);

const text = (max: number) => z.string().trim().min(1, 'must not be empty').max(max);

export const handle = z.string().trim().min(1).max(40);
export const skillKey = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z][a-z0-9-]{0,23}$/, 'use lowercase letters, digits and dashes (max 24), e.g. "nav"');
export const level = z.number().int().min(1, 'levels run 1–5').max(5, 'levels run 1–5');

export const roleSpec = z.strictObject({
  name: text(60),
  headcount: z.number().int().min(1).max(20),
  skills: z
    .array(z.strictObject({ skill: skillKey, min: level }))
    .min(1, 'each role needs at least one skill requirement')
    .max(10),
});

export const createMissionBody = z.strictObject({
  title: text(120),
  description: z.string().trim().max(2000).optional(),
  startDate: isoDate,
  endDate: isoDate,
  roles: z.array(roleSpec).max(20).optional(),
});

export const updateMissionBody = z
  .strictObject({
    title: text(120).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
  })
  .refine((body) => Object.values(body).some((value) => value !== undefined), { message: 'nothing to update' });

export const rolesBody = z.strictObject({ roles: z.array(roleSpec).min(1).max(20) });

export const seatRequestBody = z.union([
  z.strictObject({ recommended: z.literal(true), reset: z.boolean().optional() }),
  z.strictObject({ role: text(60), crew: handle, reset: z.boolean().optional() }),
]);

export const noteBody = z.strictObject({ note: z.string().trim().max(1000).optional() });
export const requiredNoteBody = z.strictObject({ note: text(1000) });
export const reasonBody = z.strictObject({ reason: text(500) });
export const optionalReasonBody = z.strictObject({ reason: z.string().trim().max(500).optional() });

export const skillsBody = z.strictObject({
  skills: z.array(z.strictObject({ skill: skillKey, level })).min(1).max(30),
});

export const unavailabilityBody = z.strictObject({
  startDate: isoDate,
  endDate: isoDate,
  note: z.string().trim().max(200).optional(),
});

export const settingsBody = z
  .strictObject({
    restGapDays: z.number().int().min(0).max(120).optional(),
    offerTtlDays: z.number().int().min(1).max(30).optional(),
  })
  .refine((body) => body.restGapDays !== undefined || body.offerTtlDays !== undefined, { message: 'nothing to update' });

export const createSkillBody = z.strictObject({
  key: skillKey,
  name: text(60),
  description: z.string().trim().max(200).optional(),
});

export const listMissionsQuery = z.object({
  status: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(',').map((part) => part.trim().toUpperCase()).filter(Boolean) : undefined))
    .pipe(z.array(z.enum(['DRAFT', 'SUBMITTED', 'REJECTED', 'APPROVED', 'ACTIVE', 'COMPLETED', 'CANCELLED'])).optional()),
  mine: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export const crewQuery = z.object({
  skill: z.string().trim().optional(),
  min: z.coerce.number().int().min(1).max(5).optional(),
});

export const matchQuery = z.object({ explain: handle.optional() });
