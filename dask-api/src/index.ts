import '@/modules/identity/http/request-context';
import type { AddressInfo } from 'node:net';
import { env } from '@/core/config/env';
import { getLogger } from '@/core/logging/logger';
import { prisma } from '@/infra/db/prisma';
import { closeQueueResources } from '@/infra/queue/bullmq-job-queue';
import { startInfraSupervisor, type InfraSupervisorHandle } from '@/infra/runtime/infra-supervisor';
import { createApp } from '@/app';
import { startWorkers } from '@/workers';

const appLogger = getLogger('app');
const app = createApp();
let infraSupervisor: InfraSupervisorHandle | null = null;
const shutdownStepTimeoutMs = 5_000;
const shutdownTimeoutMs = 8_000;

const server = app.listen(env.PORT, () => {
  infraSupervisor = startInfraSupervisor({
    retryIntervalMs: 10_000,
    startWorkers: () => startWorkers(),
    stopWorkers: async (workers) => {
      const results = await Promise.allSettled(workers.map((worker) => worker.close(true)));

      for (const result of results) {
        if (result.status === 'rejected') {
          appLogger.error({ err: result.reason }, 'Failed to stop worker');
        }
      }
    }
  });

  appLogger.info({ port: env.PORT, logLevel: env.LOG_LEVEL }, 'Dask backend listening');
});

let shutdownPromise: Promise<void> | null = null;

function closeServer(): Promise<void> {
  if (!server.listening) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const forceCloseTimer = setTimeout(() => {
      server.closeIdleConnections?.();
      server.closeAllConnections?.();
    }, 1_000);
    forceCloseTimer.unref?.();

    server.close((error) => {
      clearTimeout(forceCloseTimer);

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

    server.closeIdleConnections?.();
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    timer.unref?.();

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function runShutdownStep(label: string, step: () => Promise<void>): Promise<void> {
  try {
    await withTimeout(step(), shutdownStepTimeoutMs, label);
  } catch (error) {
    appLogger.error({ err: error }, `Failed to ${label}`);
  }
}

function shutdown(signal?: NodeJS.Signals): Promise<void> {
  if (shutdownPromise) {
    return shutdownPromise;
  }

  shutdownPromise = (async () => {
    appLogger.info({ signal: signal ?? null }, 'Shutting down backend');

    await runShutdownStep('close HTTP server', closeServer);
    await runShutdownStep('stop infrastructure supervisor', async () => {
      await infraSupervisor?.stop();
    });
    await runShutdownStep('close queue resources', closeQueueResources);
    await runShutdownStep('disconnect Prisma', async () => {
      await prisma.$disconnect();
    });
  })();

  return shutdownPromise;
}

function shutdownAndExit(signal: NodeJS.Signals | undefined, exitCode: number): void {
  void withTimeout(shutdown(signal), shutdownTimeoutMs, 'shutdown').finally(() => {
    process.exit(exitCode);
  });
}

function shutdownAndRestart(): void {
  void withTimeout(shutdown('SIGUSR2'), shutdownTimeoutMs, 'shutdown').finally(() => {
    process.kill(process.pid, 'SIGUSR2');
  });
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

  shutdownAndExit(undefined, 1);
});

process.on('SIGINT', () => {
  shutdownAndExit('SIGINT', 0);
});

process.on('SIGTERM', () => {
  shutdownAndExit('SIGTERM', 0);
});

process.once('SIGUSR2', () => {
  shutdownAndRestart();
});

