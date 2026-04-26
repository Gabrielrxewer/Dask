import '@/modules/identity/http/request-context';
import type { AddressInfo } from 'node:net';
import { env } from '@/core/config/env';
import { getLogger } from '@/core/logging/logger';
import { prisma } from '@/infra/db/prisma';
import { startInfraSupervisor } from '@/infra/runtime/infra-supervisor';
import { createApp } from '@/app';
import { startWorkers } from '@/workers';

const appLogger = getLogger('app');
const app = createApp();
const infraSupervisor = startInfraSupervisor({
  retryIntervalMs: 10_000,
  startWorkers: () => startWorkers(),
  stopWorkers: async (workers) => {
    for (const worker of workers) {
      await worker.close();
    }
  }
});

const server = app.listen(env.PORT, () => {
  appLogger.info({ port: env.PORT, logLevel: env.LOG_LEVEL }, 'Dask backend listening');
});

let shutdownPromise: Promise<void> | null = null;

function closeServer(): Promise<void> {
  if (!server.listening) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        if ((error as NodeJS.ErrnoException).code === 'ERR_SERVER_NOT_RUNNING') {
          resolve();
          return;
        }

        reject(error);
        return;
      }

      resolve();
    });
  });
}

function shutdown(signal?: NodeJS.Signals): Promise<void> {
  if (shutdownPromise) {
    return shutdownPromise;
  }

  shutdownPromise = (async () => {
    appLogger.info({ signal: signal ?? null }, 'Shutting down backend');

    try {
      await infraSupervisor.stop();
    } catch (error) {
      appLogger.error({ err: error }, 'Failed to stop infrastructure supervisor');
    }

    try {
      await prisma.$disconnect();
    } catch (error) {
      appLogger.error({ err: error }, 'Failed to disconnect Prisma');
    }

    try {
      await closeServer();
    } catch (error) {
      appLogger.error({ err: error }, 'Failed to close HTTP server');
    }
  })();

  return shutdownPromise;
}

server.on('error', (error: NodeJS.ErrnoException) => {
  const address = server.address() as AddressInfo | null;

  if (error.code === 'EADDRINUSE') {
    appLogger.error(
      {
        err: error,
        port: address?.port ?? env.PORT
      },
      'Port already in use'
    );
  } else {
    appLogger.error({ err: error }, 'HTTP server failed');
  }

  void shutdown().finally(() => {
    process.exit(1);
  });
});

process.on('SIGINT', () => {
  void shutdown('SIGINT').finally(() => {
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM').finally(() => {
    process.exit(0);
  });
});

process.once('SIGUSR2', () => {
  void shutdown('SIGUSR2').finally(() => {
    process.kill(process.pid, 'SIGUSR2');
  });
});

