import type { AutomationScheduledStep, PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import { redactErrorMessage } from '@/core/security/redaction';
import { AutomationRunEventService } from '@/modules/automation/application/automation-run-event-service';
import { AutomationScheduledStepService } from '@/modules/automation/application/automation-scheduled-step-service';
import { AutomationStepRunService } from '@/modules/automation/application/automation-step-run-service';
import type { AutomationScheduledStepPurpose } from '@/modules/automation/application/workflow-execution-types';
import {
  calculateAutomationRetryAt,
  canRetryAutomationAttempt,
  normalizeAutomationRetryPolicy,
  type AutomationRetryPolicy
} from '@/modules/automation/runtime/automation-retry-policy';
import { normalizeAutomationError } from '@/modules/automation/runtime/automation-runtime-errors';
import { AutomationWorkflowExecutor } from '@/modules/automation/runtime/automation-workflow-executor';

type ScheduledStepServiceLike = Pick<
  AutomationScheduledStepService,
  | 'claimDueSteps'
  | 'markExecuted'
  | 'markFailed'
  | 'rescheduleLockedStep'
  | 'cancelScheduledStep'
>;

type StepRunServiceLike = Pick<AutomationStepRunService, 'completeStepRun' | 'cancelStepRun'>;

type WorkflowExecutorLike = Pick<AutomationWorkflowExecutor, 'resumeAfterNode' | 'executeRun'>;

type RunEventServiceLike = Pick<AutomationRunEventService, 'createEvent'>;

export type AutomationScheduledStepProcessorResult = {
  claimed: number;
  executed: number;
  cancelled: number;
  failed: number;
  rescheduled: number;
  skipped: number;
};

const blockedRunStatuses = new Set(['completed', 'failed', 'cancelled']);

function emptyResult(): AutomationScheduledStepProcessorResult {
  return {
    claimed: 0,
    executed: 0,
    cancelled: 0,
    failed: 0,
    rescheduled: 0,
    skipped: 0
  };
}

function errorMessage(error: unknown): string {
  return redactErrorMessage(error);
}

export class AutomationScheduledStepProcessor {
  private readonly scheduledStepService: ScheduledStepServiceLike;
  private readonly stepRunService: StepRunServiceLike;
  private readonly workflowExecutor: WorkflowExecutorLike;
  private readonly eventService: RunEventServiceLike;
  private readonly retryPolicy: AutomationRetryPolicy;

  public constructor(private readonly prisma: PrismaClient, input?: {
    scheduledStepService?: ScheduledStepServiceLike;
    stepRunService?: StepRunServiceLike;
    workflowExecutor?: WorkflowExecutorLike;
    eventService?: RunEventServiceLike;
    retryPolicy?: Partial<AutomationRetryPolicy>;
  }) {
    this.scheduledStepService = input?.scheduledStepService ?? new AutomationScheduledStepService(prisma);
    this.stepRunService = input?.stepRunService ?? new AutomationStepRunService(prisma);
    this.workflowExecutor = input?.workflowExecutor ?? new AutomationWorkflowExecutor(prisma);
    this.eventService = input?.eventService ?? new AutomationRunEventService(prisma);
    this.retryPolicy = normalizeAutomationRetryPolicy(input?.retryPolicy);
  }

  public async processDueSteps(input: {
    lockedBy: string;
    now?: Date;
    limit?: number;
  }): Promise<AutomationScheduledStepProcessorResult> {
    const now = input.now ?? new Date();
    const result = emptyResult();
    const claimedSteps = await this.scheduledStepService.claimDueSteps({
      lockedBy: input.lockedBy,
      now,
      limit: input.limit
    });
    result.claimed = claimedSteps.length;

    for (const scheduledStep of claimedSteps) {
      await this.logScheduledStepEvent(scheduledStep, {
        eventType: 'scheduled_step.locked',
        message: 'Automation scheduled step was locked.',
        payload: {
          lockedBy: input.lockedBy,
          attempts: scheduledStep.attempts,
          purpose: this.getPurpose(scheduledStep)
        }
      });
      const stepResult = await this.processLockedStep(scheduledStep, now);
      result.executed += stepResult.executed;
      result.cancelled += stepResult.cancelled;
      result.failed += stepResult.failed;
      result.rescheduled += stepResult.rescheduled;
      result.skipped += stepResult.skipped;
    }

    return result;
  }

  private async processLockedStep(
    scheduledStep: AutomationScheduledStep,
    now: Date
  ): Promise<AutomationScheduledStepProcessorResult> {
    const result = emptyResult();

    if (scheduledStep.status !== 'locked') {
      result.skipped = 1;
      return result;
    }

    if (scheduledStep.cancelledAt) {
      await this.cancelScheduledStep(scheduledStep, 'Scheduled step was already cancelled.');
      result.cancelled = 1;
      return result;
    }

    if (scheduledStep.executeAt.getTime() > now.getTime()) {
      await this.scheduledStepService.rescheduleLockedStep({
        workspaceId: scheduledStep.workspaceId,
        scheduledStepId: scheduledStep.id,
        executeAt: scheduledStep.executeAt
      });
      result.rescheduled = 1;
      return result;
    }

    try {
      const [run, stepRun] = await Promise.all([
        this.prisma.automationRun.findFirst({
          where: {
            id: scheduledStep.runId,
            workspaceId: scheduledStep.workspaceId
          },
          select: {
            id: true,
            workspaceId: true,
            status: true,
            cancelledAt: true
          }
        }),
        this.prisma.automationStepRun.findFirst({
          where: {
            id: scheduledStep.stepRunId,
            workspaceId: scheduledStep.workspaceId,
            runId: scheduledStep.runId
          },
          select: {
            id: true,
            status: true,
            attempt: true
          }
        })
      ]);

      if (!run) {
        await this.scheduledStepService.markFailed({
          workspaceId: scheduledStep.workspaceId,
          scheduledStepId: scheduledStep.id,
          reason: 'Automation run not found for scheduled step.'
        });
        result.failed = 1;
        return result;
      }

      if (run.cancelledAt || blockedRunStatuses.has(run.status)) {
        await this.cancelScheduledStep(scheduledStep, 'Automation run is no longer resumable.');
        result.cancelled = 1;
        return result;
      }

      if (!stepRun) {
        await this.scheduledStepService.markFailed({
          workspaceId: scheduledStep.workspaceId,
          scheduledStepId: scheduledStep.id,
          reason: 'Automation step run not found for scheduled step.'
        });
        result.failed = 1;
        return result;
      }

      if (stepRun.status === 'cancelled') {
        await this.cancelScheduledStep(scheduledStep, 'Automation step run was cancelled.');
        result.cancelled = 1;
        return result;
      }

      if (this.getPurpose(scheduledStep) === 'retry') {
        if (stepRun.status !== 'failed') {
          await this.scheduledStepService.markExecuted({
            workspaceId: scheduledStep.workspaceId,
            scheduledStepId: scheduledStep.id
          });
          await this.logScheduledStepEvent(scheduledStep, {
            eventType: 'scheduled_step.executed',
            message: 'Automation retry scheduled step was skipped because the source step is no longer failed.',
            payload: {
              sourceStepStatus: stepRun.status,
              purpose: 'retry'
            }
          });
          result.skipped = 1;
          return result;
        }

        const executionResult = await this.workflowExecutor.executeRun({
          workspaceId: scheduledStep.workspaceId,
          runId: scheduledStep.runId,
          startNodeId: scheduledStep.nodeId,
          retryOfStepRunId: scheduledStep.stepRunId,
          now
        });

        if (executionResult.status === 'cancelled') {
          await this.cancelScheduledStep(scheduledStep, 'Automation run was cancelled during retry.');
          result.cancelled = 1;
          return result;
        }

        await this.scheduledStepService.markExecuted({
          workspaceId: scheduledStep.workspaceId,
          scheduledStepId: scheduledStep.id
        });
        await this.logScheduledStepEvent(scheduledStep, {
          eventType: 'scheduled_step.executed',
          message: 'Automation retry scheduled step was executed.',
          payload: {
            purpose: 'retry',
            executionStatus: executionResult.status
          }
        });
        result.executed = 1;
        return result;
      }

      if (stepRun.status !== 'completed' && stepRun.status !== 'skipped') {
        await this.stepRunService.completeStepRun({
          workspaceId: scheduledStep.workspaceId,
          stepRunId: scheduledStep.stepRunId,
          output: {
            resumedAt: now.toISOString(),
            scheduledStepId: scheduledStep.id
          }
        });
      }

      const executionResult = await this.workflowExecutor.resumeAfterNode({
        workspaceId: scheduledStep.workspaceId,
        runId: scheduledStep.runId,
        completedNodeId: scheduledStep.nodeId,
        now
      });

      if (executionResult.status === 'cancelled') {
        await this.cancelScheduledStep(scheduledStep, 'Automation run was cancelled during resume.');
        result.cancelled = 1;
        return result;
      }

      await this.scheduledStepService.markExecuted({
        workspaceId: scheduledStep.workspaceId,
        scheduledStepId: scheduledStep.id
      });
      await this.logScheduledStepEvent(scheduledStep, {
        eventType: 'scheduled_step.executed',
        message: 'Automation scheduled step was executed.',
        payload: {
          purpose: this.getPurpose(scheduledStep),
          executionStatus: executionResult.status
        }
      });
      result.executed = 1;
      return result;
    } catch (error) {
      const safeError = normalizeAutomationError(error);
      const retryableProcessorError = safeError.retryable || !(error instanceof AppError);
      if (retryableProcessorError && canRetryAutomationAttempt(scheduledStep.attempts, this.retryPolicy)) {
        const retryAt = calculateAutomationRetryAt(scheduledStep.attempts, now, this.retryPolicy);
        await this.scheduledStepService.rescheduleLockedStep({
          workspaceId: scheduledStep.workspaceId,
          scheduledStepId: scheduledStep.id,
          executeAt: retryAt
        });
        await this.logScheduledStepEvent(scheduledStep, {
          eventType: 'retry.scheduled',
          level: 'warn',
          message: 'Automation scheduled step retry was scheduled.',
          payload: {
            attempts: scheduledStep.attempts,
            retryAt: retryAt.toISOString(),
            retryPolicy: this.retryPolicy,
            error: safeError
          }
        });
        result.rescheduled = 1;
      } else {
        await this.scheduledStepService.markFailed({
          workspaceId: scheduledStep.workspaceId,
          scheduledStepId: scheduledStep.id,
          reason: errorMessage(error)
        });
        await this.logScheduledStepEvent(scheduledStep, {
          eventType: 'scheduled_step.failed',
          level: 'error',
          message: 'Automation scheduled step failed.',
          payload: {
            attempts: scheduledStep.attempts,
            error: safeError
          }
        });
        await this.logScheduledStepEvent(scheduledStep, {
          eventType: 'retry.exhausted',
          level: 'error',
          message: 'Automation scheduled step retry policy was exhausted.',
          payload: {
            attempts: scheduledStep.attempts,
            retryPolicy: this.retryPolicy,
            error: safeError
          }
        });
        result.failed = 1;
      }
      return result;
    }
  }

  private async cancelScheduledStep(
    scheduledStep: AutomationScheduledStep,
    reason: string
  ): Promise<void> {
    await this.scheduledStepService.cancelScheduledStep({
      workspaceId: scheduledStep.workspaceId,
      scheduledStepId: scheduledStep.id,
      reason
    });
    await this.logScheduledStepEvent(scheduledStep, {
      eventType: 'scheduled_step.cancelled',
      message: 'Automation scheduled step was cancelled.',
      payload: {
        reason,
        purpose: this.getPurpose(scheduledStep)
      }
    });

    await this.stepRunService.cancelStepRun({
      workspaceId: scheduledStep.workspaceId,
      stepRunId: scheduledStep.stepRunId,
      reason
    });
  }

  private getPurpose(scheduledStep: AutomationScheduledStep): AutomationScheduledStepPurpose {
    return scheduledStep.purpose === 'retry' ? 'retry' : 'resume';
  }

  private async logScheduledStepEvent(
    scheduledStep: AutomationScheduledStep,
    input: {
      eventType: Parameters<RunEventServiceLike['createEvent']>[0]['eventType'];
      level?: Parameters<RunEventServiceLike['createEvent']>[0]['level'];
      message: string;
      payload?: unknown;
    }
  ): Promise<void> {
    await this.eventService.createEvent({
      workspaceId: scheduledStep.workspaceId,
      runId: scheduledStep.runId,
      stepRunId: scheduledStep.stepRunId,
      eventType: input.eventType,
      level: input.level,
      message: input.message,
      payload: {
        scheduledStepId: scheduledStep.id,
        nodeId: scheduledStep.nodeId,
        ...((input.payload ?? {}) as Record<string, unknown>)
      }
    });
  }
}
