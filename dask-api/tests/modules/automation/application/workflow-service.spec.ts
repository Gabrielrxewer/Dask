import { describe, expect, it, vi } from 'vitest';
import { AutomationWorkflowService } from '@/modules/automation/application/workflow-service';

function makePrisma(workflowPatch: Record<string, unknown> = {}) {
  const workflow = {
    id: 'workflow-1',
    workspaceId: 'workspace-1',
    name: 'Native workflow',
    description: null,
    status: 'active',
    currentVersionId: 'version-1',
    origin: 'native',
    nativeKey: 'native.workflow',
    nativeDomain: 'commercial',
    isSystemManaged: true,
    isProtected: true,
    editableMode: 'config_only',
    ...workflowPatch
  };

  return {
    automationWorkflow: {
      findFirst: vi.fn(async () => workflow),
      update: vi.fn(async (args: { data: Record<string, unknown> }) => ({ ...workflow, ...args.data }))
    },
    automationWorkflowVersion: {
      findFirst: vi.fn(async () => ({ id: workflow.currentVersionId }))
    }
  };
}

describe('AutomationWorkflowService native workflow rules', () => {
  it('blocks archiving protected native workflows', async () => {
    const prisma = makePrisma();
    const service = new AutomationWorkflowService(prisma as any);

    await expect(
      service.archiveWorkflow({
        workspaceId: 'workspace-1',
        workflowId: 'workflow-1'
      })
    ).rejects.toMatchObject({ statusCode: 422 });

    expect(prisma.automationWorkflow.update).not.toHaveBeenCalled();
  });

  it('blocks name and description edits outside full edit mode', async () => {
    const prisma = makePrisma();
    const service = new AutomationWorkflowService(prisma as any);

    await expect(
      service.updateWorkflow({
        workspaceId: 'workspace-1',
        workflowId: 'workflow-1',
        name: 'Edited native workflow'
      })
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('allows pausing protected native workflows without archiving them', async () => {
    const prisma = makePrisma();
    const service = new AutomationWorkflowService(prisma as any);

    await service.setWorkflowStatus({
      workspaceId: 'workspace-1',
      workflowId: 'workflow-1',
      status: 'paused'
    });

    expect(prisma.automationWorkflow.update).toHaveBeenCalledWith({
      where: { id: 'workflow-1' },
      data: { status: 'paused' }
    });
  });

  it('requires a published current version before activation', async () => {
    const prisma = makePrisma({ currentVersionId: null, isProtected: false });
    const service = new AutomationWorkflowService(prisma as any);

    await expect(
      service.setWorkflowStatus({
        workspaceId: 'workspace-1',
        workflowId: 'workflow-1',
        status: 'active'
      })
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});
