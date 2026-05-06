import { describe, expect, it, vi } from 'vitest';
import { AutomationRunEventService } from '@/modules/automation/application/automation-run-event-service';

describe('AutomationRunEventService', () => {
  it('persists sanitized run events', async () => {
    const prisma = {
      automationRunEvent: {
        create: vi.fn(async (args) => ({
          id: 'event-1',
          ...args.data
        })),
        findMany: vi.fn()
      }
    };
    const service = new AutomationRunEventService(prisma as any);

    await service.createEvent({
      workspaceId: 'ws-1',
      runId: 'run-1',
      stepRunId: 'step-1',
      eventType: 'step.failed',
      level: 'error',
      message: 'Step failed',
      payload: {
        token: 'secret-token',
        stack: 'do not persist',
        nested: {
          apiKey: 'secret-key',
          safe: true
        }
      }
    });

    expect(prisma.automationRunEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: 'ws-1',
          runId: 'run-1',
          stepRunId: 'step-1',
          eventType: 'step.failed',
          level: 'error',
          payloadJson: {
            token: '[REDACTED]',
            nested: {
              apiKey: '[REDACTED]',
              safe: true
            }
          }
        })
      })
    );
  });

  it('lists run events in timeline order', async () => {
    const prisma = {
      automationRunEvent: {
        create: vi.fn(),
        findMany: vi.fn(async () => [])
      }
    };
    const service = new AutomationRunEventService(prisma as any);

    await service.listEventsForRun({
      workspaceId: 'ws-1',
      runId: 'run-1',
      limit: 9999
    });

    expect(prisma.automationRunEvent.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: 'ws-1',
        runId: 'run-1'
      },
      orderBy: [{ createdAt: 'asc' }],
      take: 1000
    });
  });
});
