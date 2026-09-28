/** Thin HTTP client for the Mission Control API. Maps API errors to CLI exit codes. */
import { readServerRecord } from '../lib/discovery.js';
import { CliError, resolveProfile, type ResolvedProfile } from './config.js';

/**
 * Exit codes (documented in README):
 *   0 ok · 1 unexpected · 2 usage · 3 not logged in / bad token · 4 forbidden
 *   5 not found · 6 state conflict or precondition · 7 invalid input · 8 API unreachable / not Mission Control
 */
const EXIT_BY_STATUS: Record<number, number> = { 400: 7, 401: 3, 403: 4, 404: 5, 409: 6, 422: 6 };

export interface Client {
  profile: ResolvedProfile;
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  put<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
}

interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  const error = (value as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  return typeof error?.code === 'string' && typeof error.message === 'string';
}

function unreachable(apiUrl: string): CliError {
  const local = readServerRecord();
  // Nothing at the chosen URL, but a server is running here: the CLI was pointed away from it.
  const advice =
    local && local.url !== apiUrl
      ? `Mission Control is running on this machine at ${local.url}, but this command was pointed at ${apiUrl} ` +
        '(MC_API_URL, or `mc login --api`). Unset MC_API_URL, or log in again without --api, to use it. `mc doctor` shows which applies.'
      : 'Start it with `npm run dev` (it picks a free port and the CLI finds it), then try again.';
  return new CliError(`Can't reach the Mission Control API at ${apiUrl}. ${advice}`, 8);
}

/** Something answered, but it is not Mission Control — typically another dev server on the same port. */
export function notMissionControl(apiUrl: string, detail: string): CliError {
  return new CliError(
    `The server at ${apiUrl} isn't the Mission Control API (${detail}). Another app is probably using that port. ` +
      'Start Mission Control with `npm run dev` — it moves to a free port if 3000 is taken, and the CLI finds it automatically. ' +
      'Or point the CLI at it with MC_API_URL.',
    8,
  );
}

async function parseBody(response: Response, apiUrl: string): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    const type = response.headers.get('content-type') ?? 'unknown content';
    throw notMissionControl(apiUrl, `it replied with ${type.includes('html') ? 'a web page' : type}, HTTP ${response.status}`);
  }
}

export async function call<T>(
  target: { apiUrl: string; token?: string },
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(new URL(path, target.apiUrl), {
      method,
      headers: {
        ...(target.token ? { authorization: `Bearer ${target.token}` } : {}),
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw unreachable(target.apiUrl);
  }
  const payload = await parseBody(response, target.apiUrl);
  if (!response.ok) {
    if (!isApiErrorBody(payload)) throw notMissionControl(target.apiUrl, `HTTP ${response.status} without a Mission Control error body`);
    const hint = response.status === 401 ? ' Log in again with `mc login <token>`.' : '';
    throw new CliError(`${payload.error.message}${hint}`, EXIT_BY_STATUS[response.status] ?? 1, payload.error.code, payload.error.details);
  }
  // Minimal shape check: every Mission Control endpoint returns a JSON object or array.
  if (payload === null || typeof payload !== 'object') {
    throw notMissionControl(target.apiUrl, 'the response was not a JSON object');
  }
  return payload as T;
}

export interface Health {
  status: string;
  service: string;
  version?: string;
}

/** Confirms the URL is a live Mission Control API (used by login and doctor). */
export async function checkHealth(apiUrl: string): Promise<Health> {
  const health = await call<Partial<Health>>({ apiUrl }, 'GET', '/v1/health');
  if (health.service !== 'mission-control') {
    throw notMissionControl(apiUrl, 'its /v1/health does not identify as mission-control');
  }
  return { status: String(health.status), service: health.service, version: health.version };
}

export function client(profileFlag?: string): Client {
  const profile = resolveProfile(profileFlag);
  const target = { apiUrl: profile.apiUrl, token: profile.token };
  return {
    profile,
    get: (path) => call(target, 'GET', path),
    post: (path, body) => call(target, 'POST', path, body),
    put: (path, body) => call(target, 'PUT', path, body),
    patch: (path, body) => call(target, 'PATCH', path, body),
    delete: (path) => call(target, 'DELETE', path),
  };
}
