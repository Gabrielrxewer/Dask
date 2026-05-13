import type { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import {
  isAutomationWorkflowStatus,
  normalizeAutomationLimit,
  type AutomationWorkflowStatus
} from '@/modules/automation/application/workflow-execution-types';

function normalizeOptionalText(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isSystemWorkflow(workflow: {
  origin?: string | null;
  isSystemManaged?: boolean | null;
}): boolean {
  return workflow.origin === 'native' || workflow.isSystemManaged === true;
}

export class AutomationWorkflowService {
  public constructor(private readonly prisma: PrismaClient) {}

  public async createWorkflow(input: {
    workspaceId: string;
    name: string;
    description?: string | null;
    status?: AutomationWorkflowStatus;
    createdById?: string | null;
  }) {
    const name = input.name.trim();
    if (name.length < 2) {
      throw new AppError('Automation workflow name must have at least 2 characters.', 422);
    }

    const status = input.status ?? 'draft';
    if (!isAutomationWorkflowStatus(status)) {
      throw new AppError('Invalid automation workflow status.', 422);
    }

    return this.prisma.automationWorkflow.create({
      data: {
        workspaceId: input.workspaceId,
        name,
        description: normalizeOptionalText(input.description),
        status,
        createdById: normalizeOptionalText(input.createdById)
      }
    });
  }

  public async getWorkflow(input: { workspaceId: string; workflowId: string }) {
    const workflow = await this.prisma.automationWorkflow.findFirst({
      where: {
        id: input.workflowId,
        workspaceId: input.workspaceId
      },
      include: {
        currentVersion: true
      }
    });

    if (!workflow) {
      throw new AppError('Automation workflow not found.', 404);
    }

    return workflow;
  }

  public async listWorkflows(input: {
    workspaceId: string;
    status?: AutomationWorkflowStatus;
    limit?: number;
  }) {
    if (input.status && !isAutomationWorkflowStatus(input.status)) {
      throw new AppError('Invalid automation workflow status.', 422);
    }

    return this.prisma.automationWorkflow.findMany({
      where: {
        workspaceId: input.workspaceId,
        status: input.status
      },
      include: {
        currentVersion: {
          select: {
            id: true,
            version: true,
            status: true,
            publishedAt: true
          }
        }
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: normalizeAutomationLimit(input.limit)
    });
  }

  public async updateWorkflow(input: {
    workspaceId: string;
    workflowId: string;
    name?: string;
    description?: string | null;
    status?: AutomationWorkflowStatus;
  }) {
    const current = await this.requireWorkflow(input.workspaceId, input.workflowId);

    if (input.status && !isAutomationWorkflowStatus(input.status)) {
      throw new AppError('Invalid automation workflow status.', 422);
    }

    if (input.status === 'archived' && current.isProtected) {
      throw new AppError('Protected native automation workflows cannot be archived.', 422);
    }

    if (isSystemWorkflow(current) && current.editableMode !== 'full' && (input.name !== undefined || input.description !== undefined)) {
      throw new AppError('This native automation workflow does not allow editing name or description.', 422);
    }

    if (input.status === 'active') {
      await this.ensurePublishedCurrentVersion(current);
    }

    const data: Prisma.AutomationWorkflowUpdateInput = {};
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (name.length < 2) {
        throw new AppError('Automation workflow name must have at least 2 characters.', 422);
      }
      data.name = name;
    }
    if (input.description !== undefined) {
      data.description = normalizeOptionalText(input.description);
    }
    if (input.status !== undefined) {
      data.status = input.status;
    }

    if (Object.keys(data).length === 0) {
      return current;
    }

    return this.prisma.automationWorkflow.update({
      where: { id: current.id },
      data
    });
  }

  public async setWorkflowStatus(input: {
    workspaceId: string;
    workflowId: string;
    status: AutomationWorkflowStatus;
  }) {
    return this.updateWorkflow(input);
  }

  public async archiveWorkflow(input: { workspaceId: string; workflowId: string }) {
    return this.setWorkflowStatus({
      workspaceId: input.workspaceId,
      workflowId: input.workflowId,
      status: 'archived'
    });
  }

  private async ensurePublishedCurrentVersion(workflow: {
    id: string;
    currentVersionId: string | null;
  }): Promise<void> {
    if (!workflow.currentVersionId) {
      throw new AppError('Automation workflow must have a published current version before activation.', 422);
    }

    const version = await this.prisma.automationWorkflowVersion.findFirst({
      where: {
        id: workflow.currentVersionId,
        workflowId: workflow.id,
        status: 'published'
      },
      select: { id: true }
    });

    if (!version) {
      throw new AppError('Automation workflow must have a published current version before activation.', 422);
    }
  }

  private async requireWorkflow(workspaceId: string, workflowId: string) {
    const workflow = await this.prisma.automationWorkflow.findFirst({
      where: {
        id: workflowId,
        workspaceId
      }
    });

    if (!workflow) {
      throw new AppError('Automation workflow not found.', 404);
    }

    return workflow;
  }

}
