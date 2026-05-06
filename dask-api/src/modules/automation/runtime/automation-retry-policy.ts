export type AutomationRetryPolicy = {
  maxAttempts: number;
  backoffMs: number;
  backoffMultiplier?: number;
};

export const defaultAutomationRetryPolicy: AutomationRetryPolicy = {
  maxAttempts: 3,
  backoffMs: 30_000,
  backoffMultiplier: 2
};

export function normalizeAutomationRetryPolicy(
  input: Partial<AutomationRetryPolicy> | undefined
): AutomationRetryPolicy {
  const maxAttempts = Number.isFinite(input?.maxAttempts)
    ? Math.max(1, Math.trunc(input?.maxAttempts ?? defaultAutomationRetryPolicy.maxAttempts))
    : defaultAutomationRetryPolicy.maxAttempts;
  const backoffMs = Number.isFinite(input?.backoffMs)
    ? Math.max(0, Math.trunc(input?.backoffMs ?? defaultAutomationRetryPolicy.backoffMs))
    : defaultAutomationRetryPolicy.backoffMs;
  const backoffMultiplier = Number.isFinite(input?.backoffMultiplier)
    ? Math.max(1, input?.backoffMultiplier ?? defaultAutomationRetryPolicy.backoffMultiplier ?? 1)
    : defaultAutomationRetryPolicy.backoffMultiplier;

  return {
    maxAttempts,
    backoffMs,
    backoffMultiplier
  };
}

export function canRetryAutomationAttempt(attempt: number, policy: AutomationRetryPolicy): boolean {
  return attempt < policy.maxAttempts;
}

export function calculateAutomationRetryAt(
  attempt: number,
  now: Date,
  policy: AutomationRetryPolicy
): Date {
  const multiplier = policy.backoffMultiplier ?? 1;
  const exponent = Math.max(0, attempt - 1);
  const delayMs = Math.trunc(policy.backoffMs * (multiplier ** exponent));

  return new Date(now.getTime() + delayMs);
}
