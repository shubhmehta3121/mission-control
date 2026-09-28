import { PrismaClient } from '@prisma/client';
import { config } from './config.js';
import { buildApp } from './http/app.js';

const db = new PrismaClient();
const app = buildApp({ db, logger: { level: config.logLevel } });

const shutdown = async (): Promise<void> => {
  await app.close();
  await db.$disconnect();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

try {
  await app.listen({ port: config.port, host: config.host });
} catch (error) {
  app.log.error(error);
  await db.$disconnect();
  process.exit(1);
}
