import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const app = Fastify({ logger: true });

app.get('/v1/health', async () => {
  await prisma.$queryRaw`SELECT 1`;
  return { status: 'ok' };
});

const port = Number(process.env.PORT ?? 3000);

try {
  await app.listen({ port, host: '127.0.0.1' });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
