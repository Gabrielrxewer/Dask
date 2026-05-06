import { describe, expect, it, vi } from 'vitest';
import { AutomationRunService } from '@/modules/automation/application/automation-run-service';
import { AppError } from '@/core/errors/app-error';

const now = new Date('2026-05-04T12:00:00.000Z');

describe('AutomationRunService', () => {
  it('cancels a run with pending scheduled steps and step runs in cascade', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);

    const prisma = {
      $transaction: vi.fn(async (fn: (db: any) => Promise<unknown>) => fn(prisma)),
      automationRun: {
        findFirst: vi.fn(async () => ({
          id: 'run-1',
          status: 'waiting',
          cancelledAt: null,
          cancelReason: null
        })),
        update: vi.fn(async ({ data }) => ({
          id: 'run-1',
          workspaceId: 'ws-1',
          ...data
        }))
      },
      automationScheduledStep: {
        findMany: vi.fn(async () => [
          { id: 'scheduled-1', stepRunId: 'step-1', nodeId: 'delay', purpose: 'resume' }
        ]),
        updateMany: vi.fn()
      },
      automationStepRun: {
        findMany: vi.fn(async () => [
          { id: 'step-1', nodeId: 'delay', nodeType: 'delay', status: 'waiting' }
        ]),
        updateMany: vi.fn()
      },
      automationRunEvent: {
        createMany: vi.fn()
      }
    };
    const service = new AutomationRunService(prisma as any);

    await service.cancelRun({
      workspaceId: 'ws-1',
      runId: 'run-1',
      reason: 'user requested'
    });

    expect(prisma.automationScheduledStep.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['scheduled', 'locked'] }
        }),
        data: expect.objectContaining({
          status: 'cancelled',
          cancelReason: 'user requested'
        })
      })
    );
    expect(prisma.automationStepRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['queued', 'running', 'waiting'] }
        }),
        data: expect.objectContaining({
          status: 'cancelled'
        })
      })
    );
    expect(prisma.automationRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'cancelled',
          cancelledAt: now,
          cancelReason: 'user requested'
        })
      })
    );
    expect(prisma.automationRunEvent.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ eventType: 'run.cancelled' }),
          expect.objectContaining({ eventType: 'step.cancelled', stepRunId: 'step-1' }),
          expect.objectContaining({ eventType: 'scheduled_step.cancelled', stepRunId: 'step-1' })
        ])
      })
    );

    vi.useRealTimers();
  });

  it('rejects cancelling completed runs', async () => {
    const prisma = {
      $transaction: vi.fn(async (fn: (db: any) => Promise<unknown>) => fn(prisma)),
      automationRun: {
        findFirst: vi.fn(async () => ({
          id: 'run-1',
          status: 'completed',
          cancelledAt: null,
          cancelReason: null
        })),
        update: vi.fn()
      },
      automationScheduledStep: {
        findMany: vi.fn(),
        updateMany: vi.fn()
      },
      automationStepRun: {
        findMany: vi.fn(),
        updateMany: vi.fn()
      }
    };
    const service = new AutomationRunService(prisma as any);

    await expect(service.cancelRun({
      workspaceId: 'ws-1',
      runId: 'run-1'
    })).rejects.toBeInstanceOf(AppError);

    expect(prisma.automationScheduledStep.updateMany).not.toHaveBeenCalled();
    expect(prisma.automationStepRun.updateMany).not.toHaveBeenCalled();
    expect(prisma.automationRun.update).not.toHaveBeenCalled();
  });
});
