import { PrismaClient } from '@prisma/client';
import { config } from './config.js';
import { buildApp } from './http/app.js';
import { clearServerRecord, writeServerRecord } from './lib/discovery.js';
import { findFreePort } from './lib/ports.js';

const db = new PrismaClient();
const app = buildApp({ db, logger: { level: config.logLevel, redact: ['req.headers.authorization'] } });

const shutdown = async (): Promise<void> => {
  clearServerRecord(process.pid);
  await app.close();
  await db.$disconnect();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

try {
  const port = await findFreePort(config.port, config.host);
  await app.listen({ port, host: config.host });
  const url = `http://${config.host}:${port}`;
  writeServerRecord({ url, pid: process.pid, startedAt: new Date().toISOString() });
  const moved = port !== config.port ? ` (port ${config.port} was busy, so it moved to ${port})` : '';
  console.log(`\n  ✓ Mission Control API listening on ${url}${moved}`);
  console.log('    The mc CLI finds this address automatically. Stop with Ctrl+C.\n');
} catch (error) {
  console.error(`\n  ✗ Could not start the API: ${error instanceof Error ? error.message : String(error)}\n`);
  await db.$disconnect();
  process.exit(1);
}
