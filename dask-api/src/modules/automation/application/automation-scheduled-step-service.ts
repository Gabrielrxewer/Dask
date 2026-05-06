import type { AutomationScheduledStep, PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import {
  isAutomationScheduledStepPurpose,
  isAutomationScheduledStepStatus,
  normalizeAutomationLimit,
  type AutomationScheduledStepPurpose,
  type AutomationScheduledStepStatus
} from '@/modules/automation/application/workflow-execution-types';

const terminalRunStatuses = new Set(['completed', 'failed', 'cancelled']);

function normalizeOptionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildScheduledStepIdempotencyKey(input: {
  runId: string;
  stepRunId: string;
  nodeId: string;
  purpose: AutomationScheduledStepPurpose;
}): string {
  return [
    'automation-run',
    input.runId,
    'scheduled-step',
    input.purpose,
    input.stepRunId,
    input.nodeId
  ].join(':');
}

export class AutomationScheduledStepService {
  public constructor(private readonly prisma: PrismaClient) {}

  public async scheduleStep(input: {
    workspaceId: string;
    runId: string;
    stepRunId: string;
    nodeId: string;
    executeAt: Date;
    purpose?: AutomationScheduledStepPurpose;
    idempotencyKey?: string | null;
    markRunWaiting?: boolean;
    markStepWaiting?: boolean;
  }) {
    if (Number.isNaN(input.executeAt.getTime())) {
      throw new AppError('Scheduled step executeAt must be a valid date.', 422);
    }

    const purpose = input.purpose ?? 'resume';
    if (!isAutomationScheduledStepPurpose(purpose)) {
      throw new AppError('Invalid automation scheduled step purpose.', 422);
    }

    const idempotencyKey = normalizeOptionalText(input.idempotencyKey)
      ?? buildScheduledStepIdempotencyKey({
        runId: input.runId,
        stepRunId: input.stepRunId,
        nodeId: input.nodeId,
        purpose
      });

    return this.prisma.$transaction(async (db) => {
      const [run, stepRun] = await Promise.all([
        db.automationRun.findFirst({
          where: {
            id: input.runId,
            workspaceId: input.workspaceId
          },
          select: {
            id: true,
            status: true,
            cancelledAt: true
          }
        }),
        db.automationStepRun.findFirst({
          where: {
            id: input.stepRunId,
            workspaceId: input.workspaceId,
            runId: input.runId
          },
          select: {
            id: true
          }
        })
      ]);

      if (!run) {
        throw new AppError('Automation run not found.', 404);
      }

      if (run.cancelledAt || terminalRunStatuses.has(run.status)) {
        throw new AppError('Cannot schedule a step for a finished automation run.', 422);
      }

      if (!stepRun) {
        throw new AppError('Automation step run not found.', 404);
      }

      if (input.markRunWaiting !== false) {
        await db.automationRun.update({
          where: { id: run.id },
          data: { status: 'waiting' }
        });
      }

      if (input.markStepWaiting !== false) {
        await db.automationStepRun.update({
          where: { id: stepRun.id },
          data: { status: 'waiting' }
        });
      }

      const existingScheduledStep = await db.automationScheduledStep.findFirst({
        where: {
          OR: [
            {
              workspaceId: input.workspaceId,
              idempotencyKey
            },
            {
              workspaceId: input.workspaceId,
              runId: input.runId,
              stepRunId: input.stepRunId,
              nodeId: input.nodeId,
              purpose,
              status: { in: ['scheduled', 'locked'] }
            }
          ]
        },
        orderBy: [{ createdAt: 'asc' }]
      });

      if (existingScheduledStep) {
        return db.automationScheduledStep.update({
          where: { id: existingScheduledStep.id },
          data: {
            executeAt: input.executeAt,
            purpose,
            status: 'scheduled',
            lockedAt: null,
            lockedBy: null,
            cancelledAt: null,
            cancelReason: null,
            idempotencyKey
          }
        });
      }

      return db.automationScheduledStep.create({
        data: {
          workspaceId: input.workspaceId,
          runId: input.runId,
          stepRunId: input.stepRunId,
          nodeId: input.nodeId,
          purpose,
          executeAt: input.executeAt,
          status: 'scheduled',
          idempotencyKey
        }
      });
    });
  }

  public async listDueSteps(input: {
    workspaceId?: string;
    now?: Date;
    limit?: number;
  }): Promise<AutomationScheduledStep[]> {
    const now = input.now ?? new Date();
    if (Number.isNaN(now.getTime())) {
      throw new AppError('Scheduled step lookup date must be a valid date.', 422);
    }

    return this.prisma.automationScheduledStep.findMany({
      where: {
        workspaceId: input.workspaceId,
        status: 'scheduled',
        executeAt: { lte: now }
      },
      orderBy: [{ executeAt: 'asc' }, { createdAt: 'asc' }],
      take: normalizeAutomationLimit(input.limit, 50, 1000)
    });
  }

  public async lockDueSteps(input: {
    lockedBy: string;
    now?: Date;
    limit?: number;
  }): Promise<AutomationScheduledStep[]> {
    return this.claimDueSteps(input);
  }

  public async claimDueSteps(input: {
    lockedBy: string;
    now?: Date;
    limit?: number;
  }): Promise<AutomationScheduledStep[]> {
    const lockedBy = input.lockedBy.trim();
    if (lockedBy.length === 0) {
      throw new AppError('lockedBy is required to claim scheduled automation steps.', 422);
    }

    const now = input.now ?? new Date();
    const limit = normalizeAutomationLimit(input.limit, 50, 1000);

    return this.prisma.$transaction(async (db) => {
      return db.$queryRaw<AutomationScheduledStep[]>`
        UPDATE "AutomationScheduledStep"
        SET
          "status" = 'locked',
          "lockedAt" = ${now},
          "lockedBy" = ${lockedBy},
          "attempts" = "attempts" + 1,
          "updatedAt" = ${now}
        WHERE "id" IN (
          SELECT "id"
          FROM "AutomationScheduledStep"
          WHERE "status" = 'scheduled'
            AND "executeAt" <= ${now}
          ORDER BY "executeAt" ASC, "createdAt" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT ${limit}
        )
        RETURNING *
      `;
    });
  }

  public async markExecuted(input: { workspaceId: string; scheduledStepId: string }) {
    return this.updateScheduledStepStatus({
      workspaceId: input.workspaceId,
      scheduledStepId: input.scheduledStepId,
      status: 'executed'
    });
  }

  public async markFailed(input: { workspaceId: string; scheduledStepId: string; reason?: string | null }) {
    return this.updateScheduledStepStatus({
      workspaceId: input.workspaceId,
      scheduledStepId: input.scheduledStepId,
      status: 'failed',
      cancelReason: input.reason ?? null
    });
  }

  public async rescheduleLockedStep(input: {
    workspaceId: string;
    scheduledStepId: string;
    executeAt: Date;
  }) {
    if (Number.isNaN(input.executeAt.getTime())) {
      throw new AppError('Scheduled step executeAt must be a valid date.', 422);
    }

    const scheduledStep = await this.requireScheduledStep(input.workspaceId, input.scheduledStepId);

    return this.prisma.automationScheduledStep.update({
      where: { id: scheduledStep.id },
      data: {
        status: 'scheduled',
        executeAt: input.executeAt,
        lockedAt: null,
        lockedBy: null
      }
    });
  }

  public async cancelScheduledStep(input: {
    workspaceId: string;
    scheduledStepId: string;
    reason?: string | null;
  }) {
    return this.updateScheduledStepStatus({
      workspaceId: input.workspaceId,
      scheduledStepId: input.scheduledStepId,
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelReason: input.reason ?? null
    });
  }

  public async cancelRunScheduledSteps(input: {
    workspaceId: string;
    runId: string;
    reason?: string | null;
  }) {
    const now = new Date();
    return this.prisma.automationScheduledStep.updateMany({
      where: {
        workspaceId: input.workspaceId,
        runId: input.runId,
        status: { in: ['scheduled', 'locked'] }
      },
      data: {
        status: 'cancelled',
        cancelledAt: now,
        cancelReason: input.reason ?? null
      }
    });
  }

  public async listScheduledSteps(input: {
    workspaceId: string;
    runId?: string;
    status?: AutomationScheduledStepStatus;
    limit?: number;
  }) {
    if (input.status && !isAutomationScheduledStepStatus(input.status)) {
      throw new AppError('Invalid automation scheduled step status.', 422);
    }

    return this.prisma.automationScheduledStep.findMany({
      where: {
        workspaceId: input.workspaceId,
        runId: input.runId,
        status: input.status
      },
      orderBy: [{ executeAt: 'asc' }, { createdAt: 'asc' }],
      take: normalizeAutomationLimit(input.limit)
    });
  }

  private async updateScheduledStepStatus(input: {
    workspaceId: string;
    scheduledStepId: string;
    status: AutomationScheduledStepStatus;
    cancelledAt?: Date;
    cancelReason?: string | null;
  }) {
    if (!isAutomationScheduledStepStatus(input.status)) {
      throw new AppError('Invalid automation scheduled step status.', 422);
    }

    const scheduledStep = await this.requireScheduledStep(input.workspaceId, input.scheduledStepId);

    return this.prisma.automationScheduledStep.update({
      where: { id: scheduledStep.id },
      data: {
        status: input.status,
        cancelledAt: input.cancelledAt,
        cancelReason: input.cancelReason,
        lockedAt: input.status === 'scheduled' ? null : undefined,
        lockedBy: input.status === 'scheduled' ? null : undefined
      }
    });
  }

  private async requireScheduledStep(workspaceId: string, scheduledStepId: string) {
    const scheduledStep = await this.prisma.automationScheduledStep.findFirst({
      where: {
        id: scheduledStepId,
        workspaceId
      },
      select: { id: true }
    });

    if (!scheduledStep) {
      throw new AppError('Automation scheduled step not found.', 404);
    }

    return scheduledStep;
  }
}
