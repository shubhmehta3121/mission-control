/**
 * CLI profiles. One profile per identity (token + API URL), stored in
 * ~/.mission-control/config.json (override the directory with MC_CONFIG_DIR).
 * Switching between director, lead and crew is `mc use <profile>`.
 *
 * Resolution order for a command: --profile flag → MC_PROFILE → MC_TOKEN
 * (ad-hoc, not saved) → the current profile.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export interface Profile {
  token: string;
  apiUrl: string;
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

export const DEFAULT_API_URL = 'http://127.0.0.1:3000';

export function configDir(): string {
  return process.env.MC_CONFIG_DIR ?? path.join(homedir(), '.mission-control');
}

function configPath(): string {
  return path.join(configDir(), 'config.json');
}

export function loadConfig(): ConfigFile {
  const file = configPath();
  if (!existsSync(file)) return { profiles: {} };
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<ConfigFile>;
    return { current: parsed.current, profiles: parsed.profiles ?? {} };
  } catch {
    throw new CliError(`Your CLI config at ${file} is not valid JSON. Fix or delete it, then log in again.`);
  }
}

export function saveConfig(config: ConfigFile): void {
  mkdirSync(configDir(), { recursive: true });
  writeFileSync(configPath(), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  try {
    chmodSync(configPath(), 0o600); // tokens are credentials
  } catch {
    // Best effort on platforms without POSIX permissions.
  }
}

export function defaultApiUrl(): string {
  return process.env.MC_API_URL ?? DEFAULT_API_URL;
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
  profile: Pick<Profile, 'token' | 'apiUrl'> & Partial<Profile>;
}

export function resolveProfile(flag?: string): ResolvedProfile {
  const config = loadConfig();
  const requested = flag ?? process.env.MC_PROFILE;
  if (requested) {
    const name = findProfileName(config, requested);
    return { name, profile: config.profiles[name]! };
  }
  if (process.env.MC_TOKEN) {
    return { name: '(MC_TOKEN)', profile: { token: process.env.MC_TOKEN, apiUrl: defaultApiUrl() } };
  }
  if (config.current && config.profiles[config.current]) {
    return { name: config.current, profile: config.profiles[config.current]! };
  }
  throw new CliError('You are not logged in. Run `mc login <token>` (tokens are printed by `npm run seed`).', 3);
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
