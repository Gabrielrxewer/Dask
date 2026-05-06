import { describe, expect, it, vi } from 'vitest';
import { AutomationWorkflowRunnerService } from '@/modules/automation/application/automation-workflow-runner-service';

const now = new Date('2026-05-04T12:00:00.000Z');

function makeRun() {
  return {
    id: 'run-1',
    workspaceId: 'ws-1',
    workflowId: 'workflow-1',
    workflowVersionId: 'version-1',
    triggerType: 'manual',
    triggerRefId: null,
    status: 'queued',
    contextJson: {},
    startedAt: null,
    finishedAt: null,
    cancelledAt: null,
    cancelReason: null,
    errorJson: null,
    createdAt: now,
    updatedAt: now
  };
}

function makeDeps(input?: {
  workspaceFound?: boolean;
  workflowStatus?: string;
  versionStatus?: string;
  currentVersionId?: string | null;
}) {
  const run = makeRun();
  const prisma = {
    workspace: {
      findUnique: vi.fn(async () => (input?.workspaceFound === false ? null : { id: 'ws-1' }))
    },
    automationWorkflow: {
      findFirst: vi.fn(async () => ({
        id: 'workflow-1',
        status: input?.workflowStatus ?? 'active',
        currentVersionId: input?.currentVersionId === undefined ? 'version-1' : input.currentVersionId
      }))
    },
    automationWorkflowVersion: {
      findFirst: vi.fn(async () => ({
        id: 'version-1',
        workflowId: 'workflow-1',
        status: input?.versionStatus ?? 'published',
        workflow: {
          id: 'workflow-1',
          status: input?.workflowStatus ?? 'active'
        }
      }))
    },
    automationRun: {
      create: vi.fn(async () => run)
    }
  };
  const workflowExecutor = {
    executeRun: vi.fn(async () => ({
      runId: 'run-1',
      status: 'completed',
      executedNodeIds: ['trigger']
    }))
  };
  const eventService = {
    createEvent: vi.fn()
  };
  const service = new AutomationWorkflowRunnerService(prisma as any, {
    workflowExecutor: workflowExecutor as any,
    eventService: eventService as any
  });

  return { prisma, workflowExecutor, eventService, service };
}

describe('AutomationWorkflowRunnerService', () => {
  it('creates and starts a run for an active workflow with a published current version', async () => {
    const { prisma, workflowExecutor, eventService, service } = makeDeps();

    const result = await service.startRun({
      workspaceId: 'ws-1',
      workflowId: 'workflow-1',
      triggerType: 'manual',
      context: { source: 'test' },
      now
    });

    expect(result.run.id).toBe('run-1');
    expect(result.executionResult.status).toBe('completed');
    expect(prisma.automationRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: 'ws-1',
          workflowId: 'workflow-1',
          workflowVersionId: 'version-1',
          status: 'queued',
          contextJson: { source: 'test' }
        })
      })
    );
    expect(eventService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'run.created', runId: 'run-1' })
    );
    expect(workflowExecutor.executeRun).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      runId: 'run-1',
      now
    });
  });

  it('rejects paused workflows', async () => {
    const { service } = makeDeps({ workflowStatus: 'paused' });

    await expect(
      service.startRun({
        workspaceId: 'ws-1',
        workflowId: 'workflow-1',
        triggerType: 'manual'
      })
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rejects archived workflows', async () => {
    const { service } = makeDeps({ workflowStatus: 'archived' });

    await expect(
      service.startRun({
        workspaceId: 'ws-1',
        workflowId: 'workflow-1',
        triggerType: 'manual'
      })
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rejects draft workflow versions', async () => {
    const { service } = makeDeps({ versionStatus: 'draft' });

    await expect(
      service.startRun({
        workspaceId: 'ws-1',
        workflowVersionId: 'version-1',
        triggerType: 'manual'
      })
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('validates workspaceId', async () => {
    const { service } = makeDeps({ workspaceFound: false });

    await expect(
      service.startRun({
        workspaceId: 'ws-1',
        workflowId: 'workflow-1',
        triggerType: 'manual'
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
