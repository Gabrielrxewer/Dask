import '@/core/http/request-context';
import { env } from '@/core/config/env';
import { logger } from '@/core/logging/logger';
import { prisma } from '@/infra/db/prisma';
import { createApp } from '@/app';
import { startWorkers } from '@/workers';

const app = createApp();
const workers = startWorkers();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Dask backend listening');
});

const shutdown = async (): Promise<void> => {
  logger.info('Shutting down backend');
  for (const worker of workers) {
    await worker.close();
  }
  await prisma.$disconnect();
  server.close(() => {
    process.exit(0);
  });
};

process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
