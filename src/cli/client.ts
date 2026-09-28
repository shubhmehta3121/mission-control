/** Thin HTTP client for the Mission Control API. Maps API errors to CLI exit codes. */
import { CliError, resolveProfile, type ResolvedProfile } from './config.js';

/**
 * Exit codes (documented in README):
 *   0 ok · 1 unexpected · 2 usage · 3 not logged in / bad token · 4 forbidden
 *   5 not found · 6 state conflict or precondition · 7 invalid input · 8 API unreachable
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

export async function call<T>(
  target: { apiUrl: string; token: string },
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(new URL(path, target.apiUrl), {
      method,
      headers: {
        authorization: `Bearer ${target.token}`,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new CliError(
      `Can't reach the Mission Control API at ${target.apiUrl}. Is the server running? Start it with \`npm run dev\`.`,
      8,
    );
  }
  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    const hint = response.status === 401 ? ' Log in again with `mc login <token>`.' : '';
    throw new CliError(
      `${error?.message ?? `Request failed (${response.status})`}${hint}`,
      EXIT_BY_STATUS[response.status] ?? 1,
      error?.code,
      error?.details,
    );
  }
  return payload as T;
}

export function client(profileFlag?: string): Client {
  const profile = resolveProfile(profileFlag);
  const target = { apiUrl: profile.profile.apiUrl, token: profile.profile.token };
  return {
    profile,
    get: (path) => call(target, 'GET', path),
    post: (path, body) => call(target, 'POST', path, body),
    put: (path, body) => call(target, 'PUT', path, body),
    patch: (path, body) => call(target, 'PATCH', path, body),
    delete: (path) => call(target, 'DELETE', path),
  };
}
