import { prisma } from '@/infra/db/prisma';
import { queueConnection } from '@/infra/queue/bullmq-job-queue';
import {
  getInfraState,
  markInfraDependencyFailure,
  markInfraDependencyHealthy,
  type InfraDependencyName,
  type InfraDependencyState
} from '@/core/runtime/infra-state';

export {
  getInfraState,
  getInfraStates,
  hasCriticalInfraFailure,
  markInfraDependencyFailure,
  markInfraDependencyHealthyForTests,
  resetInfraStateForTests
} from '@/core/runtime/infra-state';

type InfraDependencyDefinition = {
  critical: boolean;
  check: () => Promise<void>;
};

const dependencyDefinitions: Record<InfraDependencyName, InfraDependencyDefinition> = {
  database: {
    critical: true,
    check: async () => {
      await prisma.$queryRaw`SELECT 1`;
    }
  },
  redis: {
    critical: true,
    check: async () => {
      const response = await queueConnection.ping();
      if (response !== 'PONG') {
        throw new Error(`Unexpected Redis ping response: ${response}`);
      }
    }
  }
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} check timed out after ${timeoutMs}ms`));
    }, timeoutMs);

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

export async function checkInfraDependency(name: InfraDependencyName): Promise<InfraDependencyState> {
  const definition = dependencyDefinitions[name];

  try {
    await withTimeout(definition.check(), 5_000, name);
    markInfraDependencyHealthy(name);
  } catch (error) {
    markInfraDependencyFailure(name, error);
  }

  return getInfraState(name);
}

export async function checkAllInfraDependencies(): Promise<InfraDependencyState[]> {
  const names = Object.keys(dependencyDefinitions) as InfraDependencyName[];
  return Promise.all(names.map((name) => checkInfraDependency(name)));
}
