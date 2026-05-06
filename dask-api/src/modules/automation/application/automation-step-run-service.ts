import type { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import {
  isAutomationStepRunStatus,
  type AutomationStepRunStatus
} from '@/modules/automation/application/workflow-execution-types';
import { normalizeAutomationError } from '@/modules/automation/runtime/automation-runtime-errors';

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function normalizeOptionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export class AutomationStepRunService {
  public constructor(private readonly prisma: PrismaClient) {}

  public async createStepRun(input: {
    workspaceId: string;
    runId: string;
    nodeId: string;
    nodeType: string;
    input?: unknown;
    status?: Extract<AutomationStepRunStatus, 'queued' | 'running' | 'waiting'>;
    attempt?: number;
    idempotencyKey?: string | null;
  }) {
    const idempotencyKey = normalizeOptionalText(input.idempotencyKey);
    if (idempotencyKey) {
      const existing = await this.prisma.automationStepRun.findUnique({
        where: {
          workspaceId_idempotencyKey: {
            workspaceId: input.workspaceId,
            idempotencyKey
          }
        }
      });

      if (existing) {
        return existing;
      }
    }

    return this.prisma.$transaction(async (db) => {
      const run = await db.automationRun.findFirst({
        where: {
          id: input.runId,
          workspaceId: input.workspaceId
        },
        select: { id: true }
      });

      if (!run) {
        throw new AppError('Automation run not found.', 404);
      }

      const attempt = input.attempt ?? (await this.nextAttempt(db, input.runId, input.nodeId));
      const status = input.status ?? 'queued';

      return db.automationStepRun.create({
        data: {
          workspaceId: input.workspaceId,
          runId: input.runId,
          nodeId: input.nodeId,
          nodeType: input.nodeType,
          status,
          inputJson: input.input !== undefined ? toJsonValue(input.input) : undefined,
          attempt,
          idempotencyKey,
          startedAt: status === 'running' ? new Date() : undefined
        }
      });
    });
  }

  public async findByIdempotencyKey(input: { workspaceId: string; idempotencyKey: string }) {
    return this.prisma.automationStepRun.findUnique({
      where: {
        workspaceId_idempotencyKey: {
          workspaceId: input.workspaceId,
          idempotencyKey: input.idempotencyKey
        }
      }
    });
  }

  public async listStepRunsForRun(input: { workspaceId: string; runId: string }) {
    return this.prisma.automationStepRun.findMany({
      where: {
        workspaceId: input.workspaceId,
        runId: input.runId
      },
      include: {
        scheduledSteps: {
          orderBy: [{ executeAt: 'asc' }]
        }
      },
      orderBy: [{ createdAt: 'asc' }, { attempt: 'asc' }]
    });
  }

  public async startStepRun(input: { workspaceId: string; stepRunId: string }) {
    return this.updateStepRunStatus({
      workspaceId: input.workspaceId,
      stepRunId: input.stepRunId,
      status: 'running',
      startedAt: new Date()
    });
  }

  public async markStepRunWaiting(input: {
    workspaceId: string;
    stepRunId: string;
    output?: unknown;
  }) {
    return this.updateStepRunStatus({
      workspaceId: input.workspaceId,
      stepRunId: input.stepRunId,
      status: 'waiting',
      output: input.output
    });
  }

  public async completeStepRun(input: {
    workspaceId: string;
    stepRunId: string;
    output?: unknown;
  }) {
    return this.updateStepRunStatus({
      workspaceId: input.workspaceId,
      stepRunId: input.stepRunId,
      status: 'completed',
      output: input.output,
      finishedAt: new Date()
    });
  }

  public async skipStepRun(input: {
    workspaceId: string;
    stepRunId: string;
    output?: unknown;
  }) {
    return this.updateStepRunStatus({
      workspaceId: input.workspaceId,
      stepRunId: input.stepRunId,
      status: 'skipped',
      output: input.output,
      finishedAt: new Date()
    });
  }

  public async failStepRun(input: {
    workspaceId: string;
    stepRunId: string;
    error: Record<string, unknown> | string;
  }) {
    const error = typeof input.error === 'string'
      ? normalizeAutomationError({ message: input.error })
      : normalizeAutomationError(input.error);

    return this.updateStepRunStatus({
      workspaceId: input.workspaceId,
      stepRunId: input.stepRunId,
      status: 'failed',
      error,
      finishedAt: new Date()
    });
  }

  public async cancelStepRun(input: {
    workspaceId: string;
    stepRunId: string;
    reason?: string | null;
  }) {
    return this.prisma.$transaction(async (db) => {
      const stepRun = await db.automationStepRun.findFirst({
        where: {
          id: input.stepRunId,
          workspaceId: input.workspaceId
        },
        select: { id: true }
      });

      if (!stepRun) {
        throw new AppError('Automation step run not found.', 404);
      }

      const now = new Date();
      await db.automationScheduledStep.updateMany({
        where: {
          workspaceId: input.workspaceId,
          stepRunId: input.stepRunId,
          status: { in: ['scheduled', 'locked'] }
        },
        data: {
          status: 'cancelled',
          cancelledAt: now,
          cancelReason: input.reason ?? null
        }
      });

      return db.automationStepRun.update({
        where: { id: stepRun.id },
        data: {
          status: 'cancelled',
          finishedAt: now
        }
      });
    });
  }

  private async updateStepRunStatus(input: {
    workspaceId: string;
    stepRunId: string;
    status: AutomationStepRunStatus;
    output?: unknown;
    error?: Record<string, unknown>;
    startedAt?: Date;
    finishedAt?: Date;
  }) {
    if (!isAutomationStepRunStatus(input.status)) {
      throw new AppError('Invalid automation step run status.', 422);
    }

    const stepRun = await this.prisma.automationStepRun.findFirst({
      where: {
        id: input.stepRunId,
        workspaceId: input.workspaceId
      },
      select: { id: true }
    });

    if (!stepRun) {
      throw new AppError('Automation step run not found.', 404);
    }

    return this.prisma.automationStepRun.update({
      where: { id: stepRun.id },
      data: {
        status: input.status,
        outputJson: input.output !== undefined ? toJsonValue(input.output) : undefined,
        errorJson: input.error ? toJsonValue(input.error) : undefined,
        startedAt: input.startedAt,
        finishedAt: input.finishedAt
      }
    });
  }

  private async nextAttempt(
    db: Prisma.TransactionClient,
    runId: string,
    nodeId: string
  ): Promise<number> {
    const aggregate = await db.automationStepRun.aggregate({
      where: {
        runId,
        nodeId
      },
      _max: { attempt: true }
    });

    return (aggregate._max.attempt ?? 0) + 1;
  }
}
