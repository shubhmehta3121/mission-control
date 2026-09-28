/**
 * Application errors. Every failure the API reports has a stable machine code
 * (what clients and the CLI branch on) and a human message (what people read).
 * Wire format: { "error": { "code", "message", "details"? } }.
 */

export const ERROR_STATUS = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  CANNOT_APPROVE_OWN: 403,
  NOT_FOUND: 404,
  ROUTE_NOT_FOUND: 404,
  INVALID_TRANSITION: 409,
  SCHEDULE_CONFLICT: 409,
  OFFER_EXPIRED: 409,
  ALREADY_RESPONDED: 409,
  ROLE_FILLED: 409,
  DUPLICATE: 409,
  PRECONDITION_FAILED: 422,
  NOT_ELIGIBLE: 422,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }

  toJSON(): { error: { code: ErrorCode; message: string; details?: unknown } } {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details === undefined ? {} : { details: this.details }),
      },
    };
  }
}

/** 404 rather than 403 for anything outside the caller's view — never confirm existence. */
export function notFound(what: string): AppError {
  return new AppError('NOT_FOUND', `${what} not found`);
}

export function forbidden(message: string): AppError {
  return new AppError('FORBIDDEN', message);
}
