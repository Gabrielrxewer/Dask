import { getLogger } from '@/core/logging/logger';
import {
  checkAllInfraDependencies,
  getInfraStates,
  hasCriticalInfraFailure
} from '@/infra/runtime/infra-health';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type Closeable = {
  close(): Promise<void>;
};

export type InfraSupervisorHandle = {
  stop(): Promise<void>;
};

type InfraSupervisorOptions = {
  retryIntervalMs?: number;
  startWorkers: () => Closeable[];
  stopWorkers: (workers: Closeable[]) => Promise<void>;
};

const infraLogger = getLogger('infra');

export function startInfraSupervisor(options: InfraSupervisorOptions): InfraSupervisorHandle {
  const retryIntervalMs = options.retryIntervalMs ?? 10_000;
  let stopped = false;
  let loopRunning = false;
  let activeWorkers: Closeable[] = [];

  const stopWorkersIfRunning = async (): Promise<void> => {
    if (activeWorkers.length === 0) {
      return;
    }

    const workers = activeWorkers;
    activeWorkers = [];
    await options.stopWorkers(workers);
  };

  const ensureWorkersStarted = async (): Promise<void> => {
    if (activeWorkers.length > 0) {
      return;
    }

    activeWorkers = options.startWorkers();

    if (activeWorkers.length > 0) {
      infraLogger.info('Background workers started');
    }
  };

  const loop = async (): Promise<void> => {
    if (loopRunning) {
      return;
    }

    loopRunning = true;

    try {
      while (!stopped) {
        try {
          const states = await checkAllInfraDependencies();
          const unhealthyDependencies = states.filter((dependency) => !dependency.healthy);

          if (unhealthyDependencies.length === 0) {
            await ensureWorkersStarted();
          } else {
            await stopWorkersIfRunning();
            infraLogger.warn(
              {
                event: 'infra.unavailable',
                retryInSeconds: Math.floor(retryIntervalMs / 1000),
                dependencies: getInfraStates()
              },
              'Infrastructure unavailable; retrying dependency checks'
            );
          }
        } catch (error) {
          await stopWorkersIfRunning();
          infraLogger.error(
            {
              event: 'infra.supervisor.failed',
              retryInSeconds: Math.floor(retryIntervalMs / 1000),
              err: error
            },
            'Infrastructure supervisor cycle failed'
          );
        }

        if (stopped) {
          break;
        }

        await sleep(hasCriticalInfraFailure() ? retryIntervalMs : retryIntervalMs);
      }
    } finally {
      loopRunning = false;
    }
  };

  void loop();

  return {
    stop: async () => {
      stopped = true;
      await stopWorkersIfRunning();

      while (loopRunning) {
        await sleep(25);
      }
    }
  };
}
