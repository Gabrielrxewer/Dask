export type InfraDependencyName = 'database' | 'redis';

export type InfraDependencyState = {
  name: InfraDependencyName;
  healthy: boolean;
  critical: boolean;
  lastCheckedAt: string | null;
  lastHealthyAt: string | null;
  lastError: string | null;
};

const dependencyCatalog: Record<InfraDependencyName, { critical: boolean }> = {
  database: { critical: true },
  redis: { critical: true }
};

const dependencyStates = new Map<InfraDependencyName, InfraDependencyState>(
  (Object.keys(dependencyCatalog) as InfraDependencyName[]).map((name) => [
    name,
    {
      name,
      healthy: false,
      critical: dependencyCatalog[name].critical,
      lastCheckedAt: null,
      lastHealthyAt: null,
      lastError: 'Awaiting first infrastructure check'
    }
  ])
);

function nowIso(): string {
  return new Date().toISOString();
}

function asErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim().slice(0, 500);
  }

  return String(error).slice(0, 500);
}

function getStateOrThrow(name: InfraDependencyName): InfraDependencyState {
  const state = dependencyStates.get(name);

  if (!state) {
    throw new Error(`Unknown infrastructure dependency: ${name}`);
  }

  return state;
}

export function getInfraState(name: InfraDependencyName): InfraDependencyState {
  return { ...getStateOrThrow(name) };
}

export function getInfraStates(): InfraDependencyState[] {
  return (Object.keys(dependencyCatalog) as InfraDependencyName[]).map((name) => getInfraState(name));
}

export function hasCriticalInfraFailure(): boolean {
  return getInfraStates().some((dependency) => dependency.critical && !dependency.healthy);
}

export function markInfraDependencyFailure(name: InfraDependencyName, error: unknown): void {
  const state = getStateOrThrow(name);
  state.healthy = false;
  state.lastCheckedAt = nowIso();
  state.lastError = asErrorMessage(error);
}

export function markInfraDependencyHealthy(name: InfraDependencyName): void {
  const state = getStateOrThrow(name);
  const checkedAt = nowIso();
  state.healthy = true;
  state.lastCheckedAt = checkedAt;
  state.lastHealthyAt = checkedAt;
  state.lastError = null;
}

export function markInfraDependencyHealthyForTests(name: InfraDependencyName): void {
  markInfraDependencyHealthy(name);
}

export function resetInfraStateForTests(): void {
  for (const name of Object.keys(dependencyCatalog) as InfraDependencyName[]) {
    dependencyStates.set(name, {
      name,
      healthy: false,
      critical: dependencyCatalog[name].critical,
      lastCheckedAt: null,
      lastHealthyAt: null,
      lastError: 'Awaiting first infrastructure check'
    });
  }
}
