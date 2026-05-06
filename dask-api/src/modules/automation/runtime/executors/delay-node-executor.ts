import type {
  AutomationNodeExecutionInput,
  AutomationNodeExecutionResult,
  AutomationNodeExecutor
} from '@/modules/automation/runtime/automation-node-executor';

const unitToMs: Record<string, number> = {
  millisecond: 1,
  milliseconds: 1,
  ms: 1,
  second: 1000,
  seconds: 1000,
  minute: 60 * 1000,
  minutes: 60 * 1000,
  hour: 60 * 60 * 1000,
  hours: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
  week: 7 * 24 * 60 * 60 * 1000,
  weeks: 7 * 24 * 60 * 60 * 1000
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseDelayUntil(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseDelayFor(config: Record<string, unknown>, now: Date): Date | null {
  if (!isRecord(config.delayFor)) {
    return null;
  }

  const amount = Number(config.delayFor.amount);
  const rawUnit = typeof config.delayFor.unit === 'string' ? config.delayFor.unit.trim().toLowerCase() : '';
  const unitMs = unitToMs[rawUnit];
  if (!Number.isFinite(amount) || amount < 0 || !unitMs) {
    return null;
  }

  return new Date(now.getTime() + amount * unitMs);
}

export class DelayNodeExecutor implements AutomationNodeExecutor {
  public readonly type = 'delay';

  public async execute(input: AutomationNodeExecutionInput): Promise<AutomationNodeExecutionResult> {
    const delayUntil = parseDelayUntil(input.node.config.delayUntil);
    const resumeAt = delayUntil ?? parseDelayFor(input.node.config, input.now);

    if (!resumeAt) {
      return {
        status: 'failed',
        error: {
          message: 'Delay node requires a valid delayUntil or delayFor config.',
          nodeId: input.node.id
        }
      };
    }

    return {
      status: 'waiting',
      resumeAt,
      reason: 'delay',
      output: {
        resumeAt: resumeAt.toISOString(),
        delayUntil: delayUntil ? resumeAt.toISOString() : undefined,
        delayFor: isRecord(input.node.config.delayFor) ? input.node.config.delayFor : undefined
      }
    };
  }
}
