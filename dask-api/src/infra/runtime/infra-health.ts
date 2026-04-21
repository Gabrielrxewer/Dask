import { prisma } from '@/infra/db/prisma';
import { queueConnection } from '@/infra/queue/bullmq-job-queue';

export type InfraDependencyName = 'database' | 'redis';

export type InfraDependencyState = {
  name: InfraDependencyName;
  healthy: boolean;
  critical: boolean;
  lastCheckedAt: string | null;
  lastHealthyAt: string | null;
  lastError: string | null;
};

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

const dependencyStates = new Map<InfraDependencyName, InfraDependencyState>(
  (Object.keys(dependencyDefinitions) as InfraDependencyName[]).map((name) => [
    name,
    {
      name,
      healthy: false,
      critical: dependencyDefinitions[name].critical,
      lastCheckedAt: null,
      lastHealthyAt: null,
      lastError: 'Awaiting first infrastructure check'
    }
  ])
);

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

function asErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim().slice(0, 500);
  }

  return String(error).slice(0, 500);
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function checkInfraDependency(name: InfraDependencyName): Promise<InfraDependencyState> {
  const definition = dependencyDefinitions[name];
  const state = dependencyStates.get(name);

  if (!state) {
    throw new Error(`Unknown infrastructure dependency: ${name}`);
  }

  const checkedAt = nowIso();

  try {
    await withTimeout(definition.check(), 5_000, name);

    state.healthy = true;
    state.lastCheckedAt = checkedAt;
    state.lastHealthyAt = checkedAt;
    state.lastError = null;
  } catch (error) {
    state.healthy = false;
    state.lastCheckedAt = checkedAt;
    state.lastError = asErrorMessage(error);
  }

  return { ...state };
}

export async function checkAllInfraDependencies(): Promise<InfraDependencyState[]> {
  const names = Object.keys(dependencyDefinitions) as InfraDependencyName[];
  return Promise.all(names.map((name) => checkInfraDependency(name)));
}

export function getInfraState(name: InfraDependencyName): InfraDependencyState {
  const state = dependencyStates.get(name);

  if (!state) {
    throw new Error(`Unknown infrastructure dependency: ${name}`);
  }

  return { ...state };
}

export function getInfraStates(): InfraDependencyState[] {
  return (Object.keys(dependencyDefinitions) as InfraDependencyName[]).map((name) => getInfraState(name));
}

export function hasCriticalInfraFailure(): boolean {
  return getInfraStates().some((dependency) => dependency.critical && !dependency.healthy);
}

export function markInfraDependencyFailure(name: InfraDependencyName, error: unknown): void {
  const state = dependencyStates.get(name);

  if (!state) {
    throw new Error(`Unknown infrastructure dependency: ${name}`);
  }

  state.healthy = false;
  state.lastCheckedAt = nowIso();
  state.lastError = asErrorMessage(error);
}

export function markInfraDependencyHealthyForTests(name: InfraDependencyName): void {
  const state = dependencyStates.get(name);

  if (!state) {
    throw new Error(`Unknown infrastructure dependency: ${name}`);
  }

  const checkedAt = nowIso();
  state.healthy = true;
  state.lastCheckedAt = checkedAt;
  state.lastHealthyAt = checkedAt;
  state.lastError = null;
}

export function resetInfraStateForTests(): void {
  for (const [name, definition] of Object.entries(dependencyDefinitions) as Array<
    [InfraDependencyName, InfraDependencyDefinition]
  >) {
    dependencyStates.set(name, {
      name,
      healthy: false,
      critical: definition.critical,
      lastCheckedAt: null,
      lastHealthyAt: null,
      lastError: 'Awaiting first infrastructure check'
    });
  }
}
