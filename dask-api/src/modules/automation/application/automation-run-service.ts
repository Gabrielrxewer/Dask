import type { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import {
  isAutomationRunStatus,
  normalizeAutomationLimit,
  type AutomationRunStatus
} from '@/modules/automation/application/workflow-execution-types';
import { AutomationRunEventService } from '@/modules/automation/application/automation-run-event-service';
import { AutomationSideEffectService } from '@/modules/automation/application/automation-side-effect-service';
import { normalizeAutomationError } from '@/modules/automation/runtime/automation-runtime-errors';

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function buildReplayContext(context: Prisma.JsonValue | null, sourceRunId: string): Prisma.InputJsonValue {
  const base = isRecord(context) ? context : { previousContext: context };
  return toJsonValue({
    ...base,
    replayOfRunId: sourceRunId,
    replayedAt: new Date().toISOString()
  });
}

export class AutomationRunService {
  private readonly eventService: AutomationRunEventService;
  private readonly sideEffectService: AutomationSideEffectService;

  public constructor(private readonly prisma: PrismaClient, eventService?: AutomationRunEventService) {
    this.eventService = eventService ?? new AutomationRunEventService(prisma);
    this.sideEffectService = new AutomationSideEffectService(prisma, {
      eventService: this.eventService
    });
  }

  public async createRun(input: {
    workspaceId: string;
    workflowId: string;
    workflowVersionId?: string;
    triggerType: string;
    triggerRefId?: string | null;
    context?: Record<string, unknown>;
    status?: Extract<AutomationRunStatus, 'queued' | 'running'>;
    allowDraftVersion?: boolean;
  }) {
    const resolved = await this.resolveWorkflowVersion({
      workspaceId: input.workspaceId,
      workflowId: input.workflowId,
      workflowVersionId: input.workflowVersionId,
      allowDraftVersion: input.allowDraftVersion ?? false
    });
    const status = input.status ?? 'queued';

    const run = await this.prisma.automationRun.create({
      data: {
        workspaceId: input.workspaceId,
        workflowId: input.workflowId,
        workflowVersionId: resolved.id,
        triggerType: input.triggerType,
        triggerRefId: input.triggerRefId,
        status,
        contextJson: input.context ? toJsonValue(input.context) : undefined,
        startedAt: status === 'running' ? new Date() : undefined
      }
    });

    await this.eventService.createEvent({
      workspaceId: run.workspaceId,
      runId: run.id,
      eventType: 'run.created',
      message: 'Automation run was created.',
      payload: {
        workflowId: run.workflowId,
        workflowVersionId: run.workflowVersionId,
        triggerType: run.triggerType,
        triggerRefId: run.triggerRefId,
        status: run.status
      }
    });

    return run;
  }

  public async getRun(input: { workspaceId: string; runId: string }) {
    const run = await this.prisma.automationRun.findFirst({
      where: {
        id: input.runId,
        workspaceId: input.workspaceId
      },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            status: true
          }
        },
        workflowVersion: {
          select: {
            id: true,
            version: true,
            status: true
          }
        },
        stepRuns: {
          orderBy: [{ createdAt: 'asc' }]
        },
        scheduledSteps: {
          orderBy: [{ executeAt: 'asc' }]
        },
        events: {
          orderBy: [{ createdAt: 'asc' }]
        }
      }
    });

    if (!run) {
      throw new AppError('Automation run not found.', 404);
    }

    return run;
  }

  public async listRuns(input: {
    workspaceId: string;
    workflowId?: string;
    workflowVersionId?: string;
    status?: AutomationRunStatus;
    limit?: number;
  }) {
    if (input.status && !isAutomationRunStatus(input.status)) {
      throw new AppError('Invalid automation run status.', 422);
    }

    return this.prisma.automationRun.findMany({
      where: {
        workspaceId: input.workspaceId,
        workflowId: input.workflowId,
        workflowVersionId: input.workflowVersionId,
        status: input.status
      },
      include: {
        workflow: {
          select: {
            id: true,
            name: true
          }
        },
        workflowVersion: {
          select: {
            id: true,
            version: true
          }
        }
      },
      orderBy: [{ createdAt: 'desc' }],
      take: normalizeAutomationLimit(input.limit)
    });
  }

  public async startRun(input: { workspaceId: string; runId: string }) {
    return this.updateRunStatus({
      workspaceId: input.workspaceId,
      runId: input.runId,
      status: 'running',
      startedAt: new Date()
    });
  }

  public async markRunWaiting(input: { workspaceId: string; runId: string }) {
    return this.updateRunStatus({
      workspaceId: input.workspaceId,
      runId: input.runId,
      status: 'waiting'
    });
  }

  public async completeRun(input: { workspaceId: string; runId: string }) {
    return this.updateRunStatus({
      workspaceId: input.workspaceId,
      runId: input.runId,
      status: 'completed',
      finishedAt: new Date()
    });
  }

  public async failRun(input: {
    workspaceId: string;
    runId: string;
    error: Record<string, unknown> | string;
  }) {
    const error = typeof input.error === 'string'
      ? normalizeAutomationError({ message: input.error })
      : normalizeAutomationError(input.error);

    return this.updateRunStatus({
      workspaceId: input.workspaceId,
      runId: input.runId,
      status: 'failed',
      finishedAt: new Date(),
      errorJson: error
    });
  }

  public async cancelRun(input: {
    workspaceId: string;
    runId: string;
    reason?: string | null;
  }) {
    const run = await this.prisma.$transaction(async (db) => {
      const current = await db.automationRun.findFirst({
        where: {
          id: input.runId,
          workspaceId: input.workspaceId
        },
        select: { id: true, status: true, cancelledAt: true, cancelReason: true }
      });

      if (!current) {
        throw new AppError('Automation run not found.', 404);
      }

      if (!['queued', 'running', 'waiting'].includes(current.status)) {
        throw new AppError('Only queued, running or waiting automation runs can be cancelled.', 422);
      }

      const now = new Date();
      const reason = input.reason ?? current.cancelReason ?? 'Automation run was cancelled.';
      const [scheduledSteps, stepRuns] = await Promise.all([
        db.automationScheduledStep.findMany({
          where: {
            workspaceId: input.workspaceId,
            runId: input.runId,
            status: { in: ['scheduled', 'locked'] }
          },
          select: { id: true, stepRunId: true, nodeId: true, purpose: true }
        }),
        db.automationStepRun.findMany({
          where: {
            workspaceId: input.workspaceId,
            runId: input.runId,
            status: { in: ['queued', 'running', 'waiting'] }
          },
          select: { id: true, nodeId: true, nodeType: true, status: true }
        })
      ]);

      await db.automationScheduledStep.updateMany({
        where: {
          workspaceId: input.workspaceId,
          runId: input.runId,
          status: { in: ['scheduled', 'locked'] }
        },
        data: {
          status: 'cancelled',
          cancelledAt: now,
          cancelReason: reason
        }
      });

      await db.automationStepRun.updateMany({
        where: {
          workspaceId: input.workspaceId,
          runId: input.runId,
          status: { in: ['queued', 'running', 'waiting'] }
        },
        data: {
          status: 'cancelled',
          finishedAt: now
        }
      });

      const run = await db.automationRun.update({
        where: { id: input.runId },
        data: {
          status: 'cancelled',
          cancelledAt: current.cancelledAt ?? now,
          finishedAt: now,
          cancelReason: reason
        }
      });

      const eventDelegate = (db as unknown as {
        automationRunEvent?: {
          createMany: (args: Prisma.AutomationRunEventCreateManyArgs) => Promise<unknown>;
        };
      }).automationRunEvent;

      if (eventDelegate) {
        await eventDelegate.createMany({
          data: [
            {
              workspaceId: input.workspaceId,
              runId: input.runId,
              eventType: 'run.cancelled',
              level: 'info',
              message: 'Automation run was cancelled.',
              payloadJson: toJsonValue({
                reason,
                scheduledStepsCancelled: scheduledSteps.length,
                stepRunsCancelled: stepRuns.length
              })
            },
            ...stepRuns.map((stepRun) => ({
              workspaceId: input.workspaceId,
              runId: input.runId,
              stepRunId: stepRun.id,
              eventType: 'step.cancelled',
              level: 'info',
              message: 'Automation step run was cancelled.',
              payloadJson: toJsonValue({
                reason,
                nodeId: stepRun.nodeId,
                nodeType: stepRun.nodeType,
                previousStatus: stepRun.status
              })
            })),
            ...scheduledSteps.map((scheduledStep) => ({
              workspaceId: input.workspaceId,
              runId: input.runId,
              stepRunId: scheduledStep.stepRunId,
              eventType: 'scheduled_step.cancelled',
              level: 'info',
              message: 'Automation scheduled step was cancelled.',
              payloadJson: toJsonValue({
                reason,
                scheduledStepId: scheduledStep.id,
                nodeId: scheduledStep.nodeId,
                purpose: scheduledStep.purpose
              })
            }))
          ]
        });
      }

      return run;
    });

    if ((this.prisma as unknown as { automationSideEffect?: unknown }).automationSideEffect) {
      await this.sideEffectService.cancelRunSideEffects({
        workspaceId: input.workspaceId,
        runId: input.runId,
        reason: run.cancelReason
      });
    }

    return run;
  }

  public async replayRun(input: {
    workspaceId: string;
    sourceRunId: string;
    triggerType?: string;
    triggerRefId?: string | null;
  }) {
    const source = await this.prisma.automationRun.findFirst({
      where: {
        id: input.sourceRunId,
        workspaceId: input.workspaceId
      }
    });

    if (!source) {
      throw new AppError('Automation run not found.', 404);
    }

    return this.prisma.automationRun.create({
      data: {
        workspaceId: source.workspaceId,
        workflowId: source.workflowId,
        workflowVersionId: source.workflowVersionId,
        triggerType: input.triggerType ?? source.triggerType,
        triggerRefId: input.triggerRefId ?? source.triggerRefId,
        status: 'queued',
        contextJson: buildReplayContext(source.contextJson, source.id)
      }
    });
  }

  private async updateRunStatus(input: {
    workspaceId: string;
    runId: string;
    status: AutomationRunStatus;
    startedAt?: Date;
    finishedAt?: Date;
    errorJson?: Record<string, unknown>;
  }) {
    if (!isAutomationRunStatus(input.status)) {
      throw new AppError('Invalid automation run status.', 422);
    }

    const current = await this.prisma.automationRun.findFirst({
      where: {
        id: input.runId,
        workspaceId: input.workspaceId
      },
      select: { id: true }
    });

    if (!current) {
      throw new AppError('Automation run not found.', 404);
    }

    return this.prisma.automationRun.update({
      where: { id: current.id },
      data: {
        status: input.status,
        startedAt: input.startedAt,
        finishedAt: input.finishedAt,
        errorJson: input.errorJson ? toJsonValue(input.errorJson) : undefined
      }
    });
  }

  private async resolveWorkflowVersion(input: {
    workspaceId: string;
    workflowId: string;
    workflowVersionId?: string;
    allowDraftVersion: boolean;
  }) {
    const workflow = await this.prisma.automationWorkflow.findFirst({
      where: {
        id: input.workflowId,
        workspaceId: input.workspaceId
      },
      select: {
        id: true,
        currentVersionId: true
      }
    });

    if (!workflow) {
      throw new AppError('Automation workflow not found.', 404);
    }

    const workflowVersionId = input.workflowVersionId ?? workflow.currentVersionId;
    if (!workflowVersionId) {
      throw new AppError('Automation workflow does not have a version to run.', 422);
    }

    const version = await this.prisma.automationWorkflowVersion.findFirst({
      where: {
        id: workflowVersionId,
        workflowId: workflow.id,
        workspaceId: input.workspaceId
      },
      select: {
        id: true,
        status: true
      }
    });

    if (!version) {
      throw new AppError('Automation workflow version not found.', 404);
    }

    if (!input.allowDraftVersion && version.status !== 'published') {
      throw new AppError('Only published automation workflow versions can be run.', 422);
    }

    return version;
  }
}
