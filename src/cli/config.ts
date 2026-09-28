/**
 * CLI profiles. One profile per identity, stored in ~/.mission-control/config.json
 * (override the directory with MC_CONFIG_DIR). Switching between director, lead
 * and crew is `mc use <profile>`.
 *
 * Which profile a command runs as: --profile flag → MC_PROFILE → MC_TOKEN
 * (ad-hoc, not saved) → the current profile.
 *
 * Which API it talks to: MC_API_URL → a URL pinned at login (`mc login --api …`)
 * → the local server's own record of where it is running (see lib/discovery.ts)
 * → http://127.0.0.1:3000. So with a local server you never configure a URL,
 * even when it had to move off a busy port.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { configDir, readServerRecord } from '../lib/discovery.js';

export { configDir };

export interface Profile {
  token: string;
  /** Only set when pinned with `mc login --api <url>`; otherwise the local server is found automatically. */
  apiUrl?: string;
  handle: string;
  name: string;
  role: string;
  org: string;
  orgSlug: string;
}

interface ConfigFile {
  current?: string;
  profiles: Record<string, Profile>;
}

/**
 * Version 2 = profiles only carry apiUrl when pinned with --api. Files without a
 * version were written by the CLI before discovery, which saved whatever URL it
 * happened to use at login on every profile.
 */
const CONFIG_VERSION = 2;

export const DEFAULT_API_URL = 'http://127.0.0.1:3000';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isLoopbackUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return LOOPBACK_HOSTS.has(hostname) || hostname.endsWith('.localhost');
  } catch {
    return false;
  }
}

export type ApiSource = 'MC_API_URL' | 'pinned at login' | 'local server' | 'default';

function configPath(): string {
  return path.join(configDir(), 'config.json');
}

function isProfile(value: unknown): value is Profile {
  const candidate = value as Partial<Profile> | null;
  return typeof candidate?.token === 'string' && typeof candidate.handle === 'string' && typeof candidate.name === 'string';
}

export function loadConfig(): ConfigFile {
  const file = configPath();
  if (!existsSync(file)) return { profiles: {} };
  let parsed: { version?: unknown; current?: unknown; profiles?: unknown };
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8')) as typeof parsed;
  } catch {
    throw new CliError(`Your CLI config at ${file} is not valid JSON. Fix or delete it, then log in again.`);
  }
  const legacy = parsed.version !== CONFIG_VERSION;
  const profiles: Record<string, Profile> = {};
  if (parsed.profiles && typeof parsed.profiles === 'object') {
    for (const [name, profile] of Object.entries(parsed.profiles as Record<string, unknown>)) {
      if (!isProfile(profile)) continue; // skip damaged entries instead of crashing
      // A local URL in an old profile was never a deliberate pin, just where the server was that day:
      // drop it so the CLI follows the running server. A remote URL was chosen on purpose; keep it.
      if (legacy && profile.apiUrl && isLoopbackUrl(profile.apiUrl)) delete profile.apiUrl;
      profiles[name] = profile;
    }
  }
  return { current: typeof parsed.current === 'string' ? parsed.current : undefined, profiles };
}

export function saveConfig(config: ConfigFile): void {
  mkdirSync(configDir(), { recursive: true });
  writeFileSync(configPath(), `${JSON.stringify({ version: CONFIG_VERSION, ...config }, null, 2)}\n`, 'utf8');
  try {
    chmodSync(configPath(), 0o600); // tokens are credentials
  } catch {
    // Best effort on platforms without POSIX permissions.
  }
}

/** Where the CLI should send requests, and why. */
export function resolveApiUrl(pinned?: string): { url: string; source: ApiSource } {
  if (process.env.MC_API_URL) return { url: process.env.MC_API_URL, source: 'MC_API_URL' };
  if (pinned) return { url: pinned, source: 'pinned at login' };
  const local = readServerRecord();
  if (local) return { url: local.url, source: 'local server' };
  return { url: DEFAULT_API_URL, source: 'default' };
}

/** Exact name, or a unique prefix ("marcus" → "marcus@astra"). */
export function findProfileName(config: ConfigFile, query: string): string {
  if (config.profiles[query]) return query;
  const matches = Object.keys(config.profiles).filter((name) => name.startsWith(query));
  if (matches.length === 1) return matches[0]!;
  if (matches.length > 1) {
    throw new CliError(`"${query}" matches several profiles: ${matches.join(', ')}. Be more specific.`);
  }
  throw new CliError(`No profile "${query}". See \`mc profiles\`, or log in with \`mc login <token>\`.`, 3);
}

export interface ResolvedProfile {
  name: string;
  token: string;
  apiUrl: string;
  apiSource: ApiSource;
  profile: Partial<Profile>;
}

export function resolveProfile(flag?: string): ResolvedProfile {
  const config = loadConfig();
  const requested = flag ?? process.env.MC_PROFILE;
  const resolve = (name: string, profile: Partial<Profile> & { token: string }): ResolvedProfile => {
    const api = resolveApiUrl(profile.apiUrl);
    return { name, token: profile.token, apiUrl: api.url, apiSource: api.source, profile };
  };
  if (requested) {
    const name = findProfileName(config, requested);
    return resolve(name, config.profiles[name]!);
  }
  if (process.env.MC_TOKEN) return resolve('(MC_TOKEN)', { token: process.env.MC_TOKEN });
  if (config.current && config.profiles[config.current]) return resolve(config.current, config.profiles[config.current]!);
  throw new CliError('You are not logged in. Run `mc login <token>` (tokens are printed by `npm run setup`).', 3);
}

/** A user-facing failure with an exit code. */
export class CliError extends Error {
  constructor(
    message: string,
    readonly exitCode = 1,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}
