/**
 * Local server discovery. The API may not get its preferred port (another app
 * is often already on 3000), so on startup it records the address it actually
 * bound in ~/.mission-control/server.json. The CLI reads that record, so it
 * finds a local server wherever it landed. MC_CONFIG_DIR overrides the directory.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export interface ServerRecord {
  url: string;
  pid: number;
  startedAt: string;
}

export function configDir(): string {
  return process.env.MC_CONFIG_DIR ?? path.join(homedir(), '.mission-control');
}

function serverFile(): string {
  return path.join(configDir(), 'server.json');
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0); // signal 0 only checks the process exists (works on Windows too)
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export function writeServerRecord(record: ServerRecord): void {
  mkdirSync(configDir(), { recursive: true });
  writeFileSync(serverFile(), `${JSON.stringify(record, null, 2)}\n`, 'utf8');
}

/** The running local server, or null if there is none (a record left by a dead process is ignored). */
export function readServerRecord(): ServerRecord | null {
  const file = serverFile();
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<ServerRecord>;
    if (typeof parsed.url !== 'string' || typeof parsed.pid !== 'number' || typeof parsed.startedAt !== 'string') return null;
    return isAlive(parsed.pid) ? { url: parsed.url, pid: parsed.pid, startedAt: parsed.startedAt } : null;
  } catch {
    return null;
  }
}

/** Remove the record, but only if it still belongs to this process. */
export function clearServerRecord(pid: number): void {
  const file = serverFile();
  if (!existsSync(file)) return;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Partial<ServerRecord>;
    if (parsed.pid === pid) rmSync(file, { force: true });
  } catch {
    // Unreadable record: leave it; readServerRecord ignores it.
  }
}
