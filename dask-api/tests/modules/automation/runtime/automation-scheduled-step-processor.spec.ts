import { describe, expect, it, vi } from 'vitest';
import { AutomationScheduledStepProcessor } from '@/modules/automation/runtime/automation-scheduled-step-processor';

const now = new Date('2026-05-04T12:00:00.000Z');

function makeScheduledStep(overrides: Record<string, unknown> = {}) {
  return {
    id: 'scheduled-1',
    workspaceId: 'ws-1',
    runId: 'run-1',
    stepRunId: 'step-delay',
    nodeId: 'delay',
    purpose: 'resume',
    executeAt: now,
    status: 'locked',
    lockedAt: now,
    lockedBy: 'worker-1',
    cancelledAt: null,
    cancelReason: null,
    attempts: 1,
    idempotencyKey: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function makeDeps(input?: {
  claimedSteps?: unknown[];
  runStatus?: string;
  stepRunStatus?: string;
  resumeStatus?: string;
}) {
  const scheduledStepService = {
    claimDueSteps: vi.fn(async () => input?.claimedSteps ?? [makeScheduledStep()]),
    markExecuted: vi.fn(),
    markFailed: vi.fn(),
    rescheduleLockedStep: vi.fn(),
    cancelScheduledStep: vi.fn()
  };
  const stepRunService = {
    completeStepRun: vi.fn(),
    cancelStepRun: vi.fn()
  };
  const workflowExecutor = {
    resumeAfterNode: vi.fn(async () => ({
      runId: 'run-1',
      status: input?.resumeStatus ?? 'completed',
      executedNodeIds: ['end']
    })),
    executeRun: vi.fn(async () => ({
      runId: 'run-1',
      status: input?.resumeStatus ?? 'completed',
      executedNodeIds: ['delay']
    }))
  };
  const prisma = {
    automationRun: {
      findFirst: vi.fn(async () => ({
        id: 'run-1',
        workspaceId: 'ws-1',
        status: input?.runStatus ?? 'waiting',
        cancelledAt: null
      }))
    },
    automationStepRun: {
      findFirst: vi.fn(async () => ({
        id: 'step-delay',
        status: input?.stepRunStatus ?? 'waiting'
      }))
    }
  };
  const processor = new AutomationScheduledStepProcessor(prisma as any, {
    scheduledStepService: scheduledStepService as any,
    stepRunService: stepRunService as any,
    workflowExecutor: workflowExecutor as any,
    eventService: { createEvent: vi.fn() } as any,
    retryPolicy: {
      maxAttempts: 2,
      backoffMs: 1000,
      backoffMultiplier: 1
    }
  });

  return { processor, scheduledStepService, stepRunService, workflowExecutor };
}

describe('AutomationScheduledStepProcessor', () => {
  it('claims a due step, completes the waiting delay and resumes execution', async () => {
    const { processor, scheduledStepService, stepRunService, workflowExecutor } = makeDeps();

    const result = await processor.processDueSteps({
      lockedBy: 'worker-1',
      now
    });

    expect(result).toMatchObject({
      claimed: 1,
      executed: 1,
      failed: 0
    });
    expect(stepRunService.completeStepRun).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        stepRunId: 'step-delay',
        output: expect.objectContaining({
          scheduledStepId: 'scheduled-1'
        })
      })
    );
    expect(workflowExecutor.resumeAfterNode).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      runId: 'run-1',
      completedNodeId: 'delay',
      now
    });
    expect(scheduledStepService.markExecuted).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      scheduledStepId: 'scheduled-1'
    });
  });

  it('reschedules a locked step that is still in the future', async () => {
    const future = new Date('2026-05-04T13:00:00.000Z');
    const { processor, scheduledStepService, workflowExecutor } = makeDeps({
      claimedSteps: [makeScheduledStep({ executeAt: future })]
    });

    const result = await processor.processDueSteps({
      lockedBy: 'worker-1',
      now
    });

    expect(result).toMatchObject({
      claimed: 1,
      rescheduled: 1,
      executed: 0
    });
    expect(scheduledStepService.rescheduleLockedStep).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      scheduledStepId: 'scheduled-1',
      executeAt: future
    });
    expect(workflowExecutor.resumeAfterNode).not.toHaveBeenCalled();
  });

  it('cancels the scheduled step when the run is cancelled', async () => {
    const { processor, scheduledStepService, stepRunService, workflowExecutor } = makeDeps({
      runStatus: 'cancelled'
    });

    const result = await processor.processDueSteps({
      lockedBy: 'worker-1',
      now
    });

    expect(result).toMatchObject({
      claimed: 1,
      cancelled: 1,
      executed: 0
    });
    expect(scheduledStepService.cancelScheduledStep).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduledStepId: 'scheduled-1'
      })
    );
    expect(stepRunService.cancelStepRun).toHaveBeenCalledWith(
      expect.objectContaining({
        stepRunId: 'step-delay'
      })
    );
    expect(workflowExecutor.resumeAfterNode).not.toHaveBeenCalled();
  });

  it('does not execute a step twice when the lock claim returns it only once', async () => {
    const { processor, scheduledStepService, workflowExecutor } = makeDeps({
      claimedSteps: []
    });
    scheduledStepService.claimDueSteps
      .mockResolvedValueOnce([makeScheduledStep()])
      .mockResolvedValueOnce([]);

    const first = await processor.processDueSteps({ lockedBy: 'worker-1', now });
    const second = await processor.processDueSteps({ lockedBy: 'worker-1', now });

    expect(first.executed).toBe(1);
    expect(second.claimed).toBe(0);
    expect(workflowExecutor.resumeAfterNode).toHaveBeenCalledTimes(1);
  });

  it('executes retry scheduled steps by rerunning the failed node', async () => {
    const { processor, scheduledStepService, stepRunService, workflowExecutor } = makeDeps({
      claimedSteps: [makeScheduledStep({ purpose: 'retry' })],
      stepRunStatus: 'failed'
    });

    const result = await processor.processDueSteps({
      lockedBy: 'worker-1',
      now
    });

    expect(result).toMatchObject({
      claimed: 1,
      executed: 1
    });
    expect(stepRunService.completeStepRun).not.toHaveBeenCalled();
    expect(workflowExecutor.executeRun).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      runId: 'run-1',
      startNodeId: 'delay',
      retryOfStepRunId: 'step-delay',
      now
    });
    expect(scheduledStepService.markExecuted).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      scheduledStepId: 'scheduled-1'
    });
  });

  it('reschedules scheduled step processor failures inside the retry policy', async () => {
    const { processor, scheduledStepService, workflowExecutor } = makeDeps({
      claimedSteps: [makeScheduledStep({ attempts: 1 })]
    });
    workflowExecutor.resumeAfterNode.mockRejectedValueOnce(new Error('database timeout'));

    const result = await processor.processDueSteps({
      lockedBy: 'worker-1',
      now
    });

    expect(result).toMatchObject({
      claimed: 1,
      rescheduled: 1,
      failed: 0
    });
    expect(scheduledStepService.rescheduleLockedStep).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      scheduledStepId: 'scheduled-1',
      executeAt: new Date('2026-05-04T12:00:01.000Z')
    });
    expect(scheduledStepService.markFailed).not.toHaveBeenCalled();
  });

  it('marks scheduled step failed when processor retry attempts are exhausted', async () => {
    const { processor, scheduledStepService, workflowExecutor } = makeDeps({
      claimedSteps: [makeScheduledStep({ attempts: 2 })]
    });
    workflowExecutor.resumeAfterNode.mockRejectedValueOnce(new Error('database timeout'));

    const result = await processor.processDueSteps({
      lockedBy: 'worker-1',
      now
    });

    expect(result).toMatchObject({
      claimed: 1,
      failed: 1,
      rescheduled: 0
    });
    expect(scheduledStepService.markFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduledStepId: 'scheduled-1',
        reason: 'database timeout'
      })
    );
  });
});
