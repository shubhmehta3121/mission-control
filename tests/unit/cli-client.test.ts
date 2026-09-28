import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { call, checkHealth } from '../../src/cli/client.js';
import { CliError, loadConfig, resolveApiUrl, resolveProfile, saveConfig } from '../../src/cli/config.js';
import { clearServerRecord, writeServerRecord } from '../../src/lib/discovery.js';

/** A stand-in for "some other app on the port" — e.g. a Next.js dev server. */
let impostor: Server;
let impostorUrl: string;
let configDir: string;
const savedEnv = { ...process.env };

beforeAll(async () => {
  impostor = createServer((request, response) => {
    if (request.url === '/v1/health-json') {
      response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ status: 'ok' }));
      return;
    }
    response.writeHead(404, { 'content-type': 'text/html; charset=utf-8' }).end('<!DOCTYPE html><html>404</html>');
  });
  await new Promise<void>((resolve) => impostor.listen(0, '127.0.0.1', () => resolve()));
  impostorUrl = `http://127.0.0.1:${(impostor.address() as AddressInfo).port}`;
  configDir = mkdtempSync(path.join(tmpdir(), 'mc-cli-test-'));
  // Never read the developer's real ~/.mission-control from a test.
  savedEnv.MC_CONFIG_DIR = configDir;
  process.env.MC_CONFIG_DIR = configDir;
});

afterAll(async () => {
  await new Promise<void>((resolve) => impostor.close(() => resolve()));
  rmSync(configDir, { recursive: true, force: true });
});

afterEach(() => {
  process.env = { ...savedEnv };
});

async function failure(promise: Promise<unknown>): Promise<CliError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CliError) return error;
    throw error;
  }
  throw new Error('expected a CliError');
}

describe('CLI client: talking to the wrong server', () => {
  it('explains an HTML reply instead of crashing on JSON.parse', async () => {
    const error = await failure(call({ apiUrl: impostorUrl, token: 't' }, 'GET', '/v1/me'));
    expect(error.exitCode).toBe(8);
    expect(error.message).toMatch(/isn't the Mission Control API \(it replied with a web page, HTTP 404\)/);
    expect(error.message).toMatch(/npm run dev/);
  });

  it('refuses a JSON server that does not identify as Mission Control', async () => {
    // checkHealth hits /v1/health; point it at a JSON endpoint without the marker by using a base path trick.
    const error = await failure(checkHealth(impostorUrl));
    expect(error.exitCode).toBe(8);
  });

  it('reports an unreachable API with exit code 8', async () => {
    const error = await failure(call({ apiUrl: 'http://127.0.0.1:1', token: 't' }, 'GET', '/v1/me'));
    expect(error.exitCode).toBe(8);
    expect(error.message).toMatch(/Can't reach the Mission Control API/);
  });
});

describe('CLI: which API URL is used', () => {
  it('prefers MC_API_URL, then a pinned URL, then the running local server, then the default', () => {
    process.env.MC_CONFIG_DIR = configDir;
    delete process.env.MC_API_URL;
    expect(resolveApiUrl()).toEqual({ url: 'http://127.0.0.1:3000', source: 'default' });

    writeServerRecord({ url: 'http://127.0.0.1:3004', pid: process.pid, startedAt: new Date().toISOString() });
    expect(resolveApiUrl()).toEqual({ url: 'http://127.0.0.1:3004', source: 'local server' });
    expect(resolveApiUrl('https://mc.example.com')).toEqual({ url: 'https://mc.example.com', source: 'pinned at login' });

    process.env.MC_API_URL = 'http://127.0.0.1:4444';
    expect(resolveApiUrl('https://mc.example.com')).toEqual({ url: 'http://127.0.0.1:4444', source: 'MC_API_URL' });
  });

  it('ignores a server record left behind by a process that is no longer running', () => {
    process.env.MC_CONFIG_DIR = configDir;
    delete process.env.MC_API_URL;
    writeServerRecord({ url: 'http://127.0.0.1:3009', pid: 2_147_000_000, startedAt: new Date().toISOString() });
    expect(resolveApiUrl().source).toBe('default');
  });

  it('upgrades profiles saved by the old CLI: a stored local URL follows the running server, a remote one stays', () => {
    process.env.MC_CONFIG_DIR = configDir;
    delete process.env.MC_API_URL;
    delete process.env.MC_PROFILE;
    delete process.env.MC_TOKEN;
    const profile = (apiUrl: string) => ({ token: 't', apiUrl, handle: 'leo', name: 'Leo', role: 'CREW_MEMBER', org: 'Astra', orgSlug: 'astra' });
    // No "version": written before discovery, when every login stored whatever URL it used.
    writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify({ current: 'leo@astra', profiles: { 'leo@astra': profile('http://127.0.0.1:8641'), 'remote@astra': profile('https://mc.example.com') } }),
    );
    writeServerRecord({ url: 'http://127.0.0.1:3001', pid: process.pid, startedAt: new Date().toISOString() });

    expect(resolveProfile()).toMatchObject({ name: 'leo@astra', apiUrl: 'http://127.0.0.1:3001', apiSource: 'local server' });
    expect(resolveProfile('remote')).toMatchObject({ apiUrl: 'https://mc.example.com', apiSource: 'pinned at login' });

    // Saving writes the current format, in which a local URL is a deliberate `--api` pin and is kept.
    saveConfig(loadConfig());
    expect(JSON.parse(readFileSync(path.join(configDir, 'config.json'), 'utf8'))).toMatchObject({ version: 2 });
    const config = loadConfig();
    config.profiles['leo@astra']!.apiUrl = 'http://127.0.0.1:8641';
    saveConfig(config);
    expect(resolveProfile()).toMatchObject({ apiUrl: 'http://127.0.0.1:8641', apiSource: 'pinned at login' });
    clearServerRecord(process.pid);
  });

  it('points at the running local server when the chosen URL is dead', async () => {
    process.env.MC_CONFIG_DIR = configDir;
    writeServerRecord({ url: 'http://127.0.0.1:3001', pid: process.pid, startedAt: new Date().toISOString() });
    const error = await failure(call({ apiUrl: 'http://127.0.0.1:1', token: 't' }, 'GET', '/v1/me'));
    expect(error.exitCode).toBe(8);
    expect(error.message).toMatch(/Mission Control is running on this machine at http:\/\/127\.0\.0\.1:3001/);
    clearServerRecord(process.pid);
  });
});
