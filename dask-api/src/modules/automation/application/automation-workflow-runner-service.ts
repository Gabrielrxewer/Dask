import type { AutomationRun, Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import { AutomationRunEventService } from '@/modules/automation/application/automation-run-event-service';
import type { AutomationWorkflowExecutionResult } from '@/modules/automation/runtime/automation-runtime-context';
import { AutomationWorkflowExecutor } from '@/modules/automation/runtime/automation-workflow-executor';

type WorkflowExecutorLike = Pick<AutomationWorkflowExecutor, 'executeRun'>;

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export class AutomationWorkflowRunnerService {
  private readonly workflowExecutor: WorkflowExecutorLike;
  private readonly eventService: AutomationRunEventService;

  public constructor(private readonly prisma: PrismaClient, input?: {
    workflowExecutor?: WorkflowExecutorLike;
    eventService?: AutomationRunEventService;
  }) {
    this.workflowExecutor = input?.workflowExecutor ?? new AutomationWorkflowExecutor(prisma);
    this.eventService = input?.eventService ?? new AutomationRunEventService(prisma);
  }

  public async startRun(input: {
    workspaceId: string;
    workflowId?: string;
    workflowVersionId?: string;
    triggerType: string;
    triggerRefId?: string | null;
    context?: Record<string, unknown>;
    now?: Date;
  }): Promise<{
    run: AutomationRun;
    executionResult: AutomationWorkflowExecutionResult;
  }> {
    const workspaceId = input.workspaceId.trim();
    if (!workspaceId) {
      throw new AppError('workspaceId is required to start an automation workflow run.', 422);
    }

    const triggerType = input.triggerType.trim();
    if (!triggerType) {
      throw new AppError('triggerType is required to start an automation workflow run.', 422);
    }

    await this.ensureWorkspace(workspaceId);
    const resolved = await this.resolvePublishedWorkflowVersion({
      workspaceId,
      workflowId: input.workflowId,
      workflowVersionId: input.workflowVersionId
    });

    const run = await this.prisma.automationRun.create({
      data: {
        workspaceId,
        workflowId: resolved.workflowId,
        workflowVersionId: resolved.workflowVersionId,
        triggerType,
        triggerRefId: input.triggerRefId ?? null,
        status: 'queued',
        contextJson: input.context ? toJsonValue(input.context) : undefined
      }
    });

    await this.eventService.createEvent({
      workspaceId,
      runId: run.id,
      eventType: 'run.created',
      message: 'Automation run was created by the workflow runner service.',
      payload: {
        workflowId: run.workflowId,
        workflowVersionId: run.workflowVersionId,
        triggerType: run.triggerType,
        triggerRefId: run.triggerRefId
      }
    });

    const executionResult = await this.workflowExecutor.executeRun({
      workspaceId,
      runId: run.id,
      now: input.now
    });

    return {
      run,
      executionResult
    };
  }

  private async ensureWorkspace(workspaceId: string): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true }
    });

    if (!workspace) {
      throw new AppError('Workspace not found for automation workflow run.', 404);
    }
  }

  private async resolvePublishedWorkflowVersion(input: {
    workspaceId: string;
    workflowId?: string;
    workflowVersionId?: string;
  }): Promise<{
    workflowId: string;
    workflowVersionId: string;
  }> {
    if (!input.workflowId && !input.workflowVersionId) {
      throw new AppError('workflowId or workflowVersionId is required to start an automation workflow run.', 422);
    }

    const version = input.workflowVersionId
      ? await this.resolveExplicitVersion(input.workspaceId, input.workflowVersionId, input.workflowId)
      : await this.resolveCurrentVersion(input.workspaceId, input.workflowId as string);

    if (version.workflow.status === 'paused') {
      throw new AppError('Paused automation workflows cannot be run.', 422);
    }

    if (version.workflow.status === 'archived') {
      throw new AppError('Archived automation workflows cannot be run.', 422);
    }

    if (version.workflow.status !== 'active') {
      throw new AppError('Automation workflow must be active to run.', 422);
    }

    if (version.status !== 'published') {
      throw new AppError('Only published automation workflow versions can be run.', 422);
    }

    return {
      workflowId: version.workflowId,
      workflowVersionId: version.id
    };
  }

  private async resolveExplicitVersion(
    workspaceId: string,
    workflowVersionId: string,
    workflowId?: string
  ) {
    const version = await this.prisma.automationWorkflowVersion.findFirst({
      where: {
        id: workflowVersionId,
        workspaceId,
        workflowId
      },
      select: {
        id: true,
        workflowId: true,
        status: true,
        workflow: {
          select: {
            id: true,
            status: true
          }
        }
      }
    });

    if (!version) {
      throw new AppError('Automation workflow version not found.', 404);
    }

    return version;
  }

  private async resolveCurrentVersion(workspaceId: string, workflowId: string) {
    const workflow = await this.prisma.automationWorkflow.findFirst({
      where: {
        id: workflowId,
        workspaceId
      },
      select: {
        id: true,
        status: true,
        currentVersionId: true
      }
    });

    if (!workflow) {
      throw new AppError('Automation workflow not found.', 404);
    }

    if (!workflow.currentVersionId) {
      throw new AppError('Automation workflow does not have a published current version.', 422);
    }

    return this.resolveExplicitVersion(workspaceId, workflow.currentVersionId, workflow.id);
  }
}
