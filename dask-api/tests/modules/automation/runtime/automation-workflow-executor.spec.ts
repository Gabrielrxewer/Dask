import { describe, expect, it, vi } from 'vitest';
import { AutomationWorkflowExecutor } from '@/modules/automation/runtime/automation-workflow-executor';

const baseDate = new Date('2026-05-04T12:00:00.000Z');

function makeRun(status = 'queued', context: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    workspaceId: 'ws-1',
    workflowId: 'workflow-1',
    workflowVersionId: 'version-1',
    triggerType: 'manual',
    triggerRefId: null,
    status,
    contextJson: context,
    startedAt: null,
    finishedAt: null,
    cancelledAt: null,
    cancelReason: null,
    errorJson: null,
    createdAt: baseDate,
    updatedAt: baseDate
  };
}

function makeVersion(nodes: unknown[], edges: unknown[]) {
  return {
    id: 'version-1',
    workspaceId: 'ws-1',
    workflowId: 'workflow-1',
    version: 1,
    status: 'published',
    definitionJson: {},
    graphNodesJson: nodes,
    graphEdgesJson: edges,
    publishedAt: baseDate,
    publishedById: null,
    createdAt: baseDate
  };
}

function makeStepRun(input: { nodeId: string; nodeType: string; status?: string; input?: unknown }) {
  return {
    id: `step-${input.nodeId}`,
    workspaceId: 'ws-1',
    runId: 'run-1',
    nodeId: input.nodeId,
    nodeType: input.nodeType,
    status: input.status ?? 'running',
    inputJson: input.input ?? {},
    outputJson: null,
    errorJson: null,
    attempt: 1,
    idempotencyKey: `automation-run:run-1:node:${input.nodeId}:attempt:1`,
    startedAt: baseDate,
    finishedAt: null,
    createdAt: baseDate,
    updatedAt: baseDate
  };
}

function makeDeps(version: ReturnType<typeof makeVersion>, run = makeRun()) {
  let runStatus = run.status;
  const prisma = {
    automationRun: {
      findFirst: vi.fn(async () => ({
        ...run,
        status: runStatus
      })),
      update: vi.fn(async ({ data }: { data: { status?: string } }) => {
        if (data.status) {
          runStatus = data.status;
        }
        return {
          ...run,
          status: runStatus
        };
      })
    },
    automationWorkflowVersion: {
      findFirst: vi.fn(async () => version)
    },
    automationStepRun: {
      findFirst: vi.fn(),
      updateMany: vi.fn()
    }
  };
  const stepRunService = {
    createStepRun: vi.fn(async (input: { nodeId: string; nodeType: string; status?: string; input?: unknown }) =>
      makeStepRun(input)
    ),
    startStepRun: vi.fn(),
    markStepRunWaiting: vi.fn(),
    completeStepRun: vi.fn(),
    skipStepRun: vi.fn(),
    failStepRun: vi.fn(),
    cancelStepRun: vi.fn()
  };
  const scheduledStepService = {
    scheduleStep: vi.fn(async (input: { executeAt: Date; purpose?: string }) => ({
      id: 'scheduled-1',
      workspaceId: 'ws-1',
      runId: 'run-1',
      stepRunId: 'step-delay',
      nodeId: 'delay',
      purpose: input.purpose ?? 'resume',
      executeAt: input.executeAt,
      status: 'scheduled',
      lockedAt: null,
      lockedBy: null,
      cancelledAt: null,
      cancelReason: null,
      attempts: 0,
      idempotencyKey: null,
      createdAt: baseDate,
      updatedAt: baseDate
    })),
    cancelRunScheduledSteps: vi.fn()
  };
  const eventService = {
    createEvent: vi.fn()
  };
  const executor = new AutomationWorkflowExecutor(prisma as any, {
    stepRunService: stepRunService as any,
    scheduledStepService: scheduledStepService as any,
    eventService: eventService as any,
    retryPolicy: {
      maxAttempts: 2,
      backoffMs: 1000,
      backoffMultiplier: 1
    }
  });

  return { executor, prisma, stepRunService, scheduledStepService, eventService };
}

describe('AutomationWorkflowExecutor', () => {
  it('executes a linear trigger -> noop -> end graph and completes the run', async () => {
    const version = makeVersion(
      [
        { id: 'trigger', type: 'trigger', config: {} },
        { id: 'noop', type: 'noop', config: {} },
        { id: 'end', type: 'end', config: {} }
      ],
      [
        { id: 'edge-1', source: 'trigger', target: 'noop' },
        { id: 'edge-2', source: 'noop', target: 'end' }
      ]
    );
    const { executor, prisma, stepRunService, scheduledStepService, eventService } = makeDeps(version);

    const result = await executor.executeRun({
      workspaceId: 'ws-1',
      runId: 'run-1',
      now: baseDate
    });

    expect(result).toMatchObject({
      status: 'completed',
      executedNodeIds: ['trigger', 'noop', 'end']
    });
    expect(stepRunService.createStepRun.mock.calls.map((call) => call[0].nodeId)).toEqual([
      'trigger',
      'noop',
      'end'
    ]);
    expect(stepRunService.completeStepRun).toHaveBeenCalledTimes(3);
    expect(scheduledStepService.scheduleStep).not.toHaveBeenCalled();
    expect(eventService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'run.started' })
    );
    expect(eventService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'step.started', stepRunId: 'step-trigger' })
    );
    expect(eventService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'run.completed' })
    );
    expect(prisma.automationRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'completed' })
      })
    );
  });

  it('persists delay as waiting and creates a scheduled step', async () => {
    const version = makeVersion(
      [
        {
          id: 'delay',
          type: 'delay',
          config: {
            delayFor: {
              amount: 1,
              unit: 'day'
            }
          }
        },
        { id: 'end', type: 'end', config: {} }
      ],
      [{ id: 'edge-delay-end', source: 'delay', target: 'end' }]
    );
    const { executor, stepRunService, scheduledStepService } = makeDeps(version, makeRun('running'));

    const result = await executor.executeRun({
      workspaceId: 'ws-1',
      runId: 'run-1',
      startNodeId: 'delay',
      now: baseDate
    });

    expect(result).toMatchObject({
      status: 'waiting',
      waitingNodeId: 'delay',
      executedNodeIds: ['delay']
    });
    expect(result.resumeAt?.toISOString()).toBe('2026-05-05T12:00:00.000Z');
    expect(stepRunService.markStepRunWaiting).toHaveBeenCalledWith(
      expect.objectContaining({
        stepRunId: 'step-delay',
        output: expect.objectContaining({
          resumeAt: '2026-05-05T12:00:00.000Z'
        })
      })
    );
    expect(scheduledStepService.scheduleStep).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        runId: 'run-1',
        stepRunId: 'step-delay',
        nodeId: 'delay',
        purpose: 'resume',
        executeAt: new Date('2026-05-05T12:00:00.000Z'),
        markRunWaiting: true,
        markStepWaiting: false
      })
    );
  });

  it('schedules a retry for retryable node errors inside the policy limit', async () => {
    const version = makeVersion(
      [{ id: 'unstable', type: 'unstable', config: {} }],
      []
    );
    const registry = {
      get: vi.fn(() => ({
        type: 'unstable',
        execute: vi.fn(async () => ({
          status: 'failed' as const,
          retryable: true,
          error: {
            message: 'Temporary provider error.',
            code: 'TEMPORARY_PROVIDER_ERROR',
            retryable: true
          }
        }))
      }))
    };
    const { prisma, stepRunService, scheduledStepService, eventService } = makeDeps(version);
    const executor = new AutomationWorkflowExecutor(prisma as any, {
      registry: registry as any,
      stepRunService: stepRunService as any,
      scheduledStepService: scheduledStepService as any,
      eventService: eventService as any,
      retryPolicy: {
        maxAttempts: 2,
        backoffMs: 1000,
        backoffMultiplier: 1
      }
    });

    const result = await executor.executeRun({
      workspaceId: 'ws-1',
      runId: 'run-1',
      startNodeId: 'unstable',
      now: baseDate
    });

    expect(result).toMatchObject({
      status: 'waiting',
      waitingNodeId: 'unstable'
    });
    expect(scheduledStepService.scheduleStep).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: 'retry',
        executeAt: new Date('2026-05-04T12:00:01.000Z')
      })
    );
    expect(eventService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'retry.scheduled' })
    );
  });

  it('marks retryable node errors failed when attempts are exhausted', async () => {
    const version = makeVersion(
      [{ id: 'unstable', type: 'unstable', config: {} }],
      []
    );
    const retryStepRun = {
      ...makeStepRun({ nodeId: 'unstable', nodeType: 'unstable' }),
      id: 'step-unstable-2',
      attempt: 2,
      idempotencyKey: 'automation-run:run-1:node:unstable:attempt:2'
    };
    const { prisma, stepRunService, scheduledStepService, eventService } = makeDeps(version);
    prisma.automationStepRun.findFirst.mockResolvedValue({
      id: 'step-unstable-1',
      nodeId: 'unstable',
      attempt: 1,
      status: 'failed'
    });
    stepRunService.createStepRun.mockResolvedValue(retryStepRun);
    const registry = {
      get: vi.fn(() => ({
        type: 'unstable',
        execute: vi.fn(async () => ({
          status: 'failed' as const,
          retryable: true,
          error: {
            message: 'Still unavailable.',
            code: 'TEMPORARY_PROVIDER_ERROR',
            retryable: true,
            stack: 'secret stack trace'
          }
        }))
      }))
    };
    const executor = new AutomationWorkflowExecutor(prisma as any, {
      registry: registry as any,
      stepRunService: stepRunService as any,
      scheduledStepService: scheduledStepService as any,
      eventService: eventService as any,
      retryPolicy: {
        maxAttempts: 2,
        backoffMs: 1000
      }
    });

    const result = await executor.executeRun({
      workspaceId: 'ws-1',
      runId: 'run-1',
      startNodeId: 'unstable',
      retryOfStepRunId: 'step-unstable-1',
      now: baseDate
    });

    expect(result.status).toBe('failed');
    expect(scheduledStepService.scheduleStep).not.toHaveBeenCalled();
    expect(eventService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'retry.exhausted' })
    );
    expect(prisma.automationRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'failed',
          errorJson: expect.not.objectContaining({ stack: expect.anything() })
        })
      })
    );
  });

  it('fails unknown node types with sanitized error json', async () => {
    const version = makeVersion(
      [{ id: 'email', type: 'send_email', config: {} }],
      []
    );
    const { executor, prisma, eventService } = makeDeps(version);

    const result = await executor.executeRun({
      workspaceId: 'ws-1',
      runId: 'run-1',
      startNodeId: 'email',
      now: baseDate
    });

    expect(result.status).toBe('failed');
    expect(prisma.automationRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'failed',
          errorJson: expect.objectContaining({
            message: 'Automation node executor not registered for type "send_email".',
            retryable: false
          })
        })
      })
    );
    expect(eventService.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'step.failed' })
    );
  });

  it('does not execute terminal runs', async () => {
    const version = makeVersion(
      [{ id: 'noop', type: 'noop', config: {} }],
      []
    );
    const { executor, stepRunService } = makeDeps(version, makeRun('completed'));

    const result = await executor.executeRun({
      workspaceId: 'ws-1',
      runId: 'run-1',
      now: baseDate
    });

    expect(result.status).toBe('completed');
    expect(stepRunService.createStepRun).not.toHaveBeenCalled();
  });
});
