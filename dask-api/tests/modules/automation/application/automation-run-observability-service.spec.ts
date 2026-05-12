import { describe, expect, it, vi } from 'vitest';
import { AutomationRunObservabilityService } from '@/modules/automation/application/automation-run-observability-service';

const runCreatedAt = new Date('2026-05-05T12:00:00.000Z');
const startedAt = new Date('2026-05-05T12:00:10.000Z');
const finishedAt = new Date('2026-05-05T12:00:40.000Z');

describe('AutomationRunObservabilityService', () => {
  it('lists runs scoped by workspace with counters and sanitized last event', async () => {
    const prisma = {
      automationRun: {
        findMany: vi.fn(async () => [
          {
            id: 'run-1',
            workspaceId: 'ws-1',
            workflowId: 'workflow-1',
            workflowVersionId: 'version-1',
            triggerType: 'manual',
            triggerRefId: null,
            status: 'completed',
            startedAt,
            finishedAt,
            cancelledAt: null,
            errorJson: null,
            createdAt: runCreatedAt,
            updatedAt: finishedAt,
            workflow: { id: 'workflow-1', name: 'Welcome flow', status: 'active' },
            workflowVersion: { id: 'version-1', version: 3, status: 'published' },
            events: [
              {
                id: 'event-1',
                runId: 'run-1',
                stepRunId: null,
                eventType: 'run.completed',
                level: 'info',
                message: 'Done',
                payloadJson: { authorization: 'Bearer token', status: 'completed' },
                createdAt: finishedAt
              }
            ],
            _count: { stepRuns: 2, sideEffects: 1, events: 4 }
          }
        ])
      },
      automationStepRun: {
        groupBy: vi.fn(async () => [{ runId: 'run-1', _count: { _all: 1 } }])
      }
    };
    const service = new AutomationRunObservabilityService(prisma as any);

    const result = await service.listRuns({
      workspaceId: 'ws-1',
      status: 'completed',
      search: 'Welcome',
      limit: 10
    });

    expect(prisma.automationRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'ws-1',
          status: 'completed'
        })
      })
    );
    expect(result.items[0]).toMatchObject({
      runId: 'run-1',
      workflowName: 'Welcome flow',
      workflowVersion: 3,
      stepsCount: 2,
      failedStepsCount: 1,
      sideEffectsCount: 1,
      durationMs: 30000
    });
    expect(result.items[0].lastEvent?.payload).toMatchObject({
      status: 'completed'
    });
    expect(JSON.stringify(result)).not.toContain('Bearer token');
  });

  it('returns run detail with steps, timeline, side effects and masked contact data', async () => {
    const prisma = {
      automationRun: {
        findFirst: vi.fn(async () => ({
          id: 'run-1',
          workspaceId: 'ws-1',
          workflowId: 'workflow-1',
          workflowVersionId: 'version-1',
          triggerType: 'manual',
          triggerRefId: null,
          status: 'failed',
          contextJson: { apiKey: 'secret-key', workItemId: 'workItem-1' },
          startedAt,
          finishedAt,
          cancelledAt: null,
          cancelReason: null,
          errorJson: { message: 'Provider returned 429 rate limit', code: 'RATE_LIMIT', retryable: true, stack: 'raw' },
          createdAt: runCreatedAt,
          updatedAt: finishedAt,
          workflow: { id: 'workflow-1', name: 'Welcome flow', status: 'active' },
          workflowVersion: { id: 'version-1', version: 3, status: 'published' },
          stepRuns: [
            {
              id: 'step-1',
              runId: 'run-1',
              nodeId: 'email-1',
              nodeType: 'communication.send',
              status: 'failed',
              inputJson: { password: 'hidden', subject: 'Hi' },
              outputJson: null,
              errorJson: { message: 'No quota', code: 'RATE_LIMIT', retryable: true },
              attempt: 2,
              idempotencyKey: 'idem-step',
              startedAt,
              finishedAt,
              createdAt: startedAt,
              updatedAt: finishedAt,
              scheduledSteps: []
            }
          ],
          events: [
            {
              id: 'event-1',
              runId: 'run-1',
              stepRunId: 'step-1',
              eventType: 'step.failed',
              level: 'error',
              message: 'Step failed',
              payloadJson: { error: { message: 'No quota' }, token: 'secret' },
              createdAt: finishedAt
            }
          ],
          sideEffects: [
            {
              id: 'side-effect-1',
              runId: 'run-1',
              stepRunId: 'step-1',
              sideEffectType: 'communication.email',
              channel: 'email',
              provider: 'resend',
              status: 'failed',
              idempotencyKey: 'idem-side-effect',
              payloadJson: { html: '<h1>Hello</h1>', authorization: 'secret' },
              resultJson: { providerMessageId: 'provider-message-1', status: 'sent' },
              errorJson: { message: 'Rate limit', code: 'RATE_LIMIT', retryable: true },
              templateVersionId: 'template-version-1',
              contactId: 'contact-1',
              contactChannelId: 'channel-1',
              attempts: 2,
              maxAttempts: 3,
              nextAttemptAt: finishedAt,
              lockedAt: null,
              cancelledAt: null,
              cancelReason: null,
              processedAt: finishedAt,
              createdAt: startedAt,
              updatedAt: finishedAt,
              contact: {
                id: 'contact-1',
                displayName: 'Jane Doe',
                firstName: 'Jane',
                lastName: 'Doe',
                companyName: 'Acme',
                primaryEmail: 'jane@acme.test',
                primaryPhone: '+5511999999999',
                status: 'active'
              },
              contactChannel: {
                id: 'channel-1',
                channel: 'email',
                address: 'jane@acme.test',
                normalizedAddress: 'jane@acme.test',
                label: 'Work',
                status: 'active'
              },
              providerEvents: []
            }
          ]
        }))
      }
    };
    const service = new AutomationRunObservabilityService(prisma as any);

    const detail = await service.getRunDetail({
      workspaceId: 'ws-1',
      runId: 'run-1'
    });

    expect(detail.run.error).toMatchObject({
      message: 'Provider returned 429 rate limit',
      code: 'RATE_LIMIT',
      retryable: true
    });
    expect(detail.summary).toMatchObject({
      stepsCount: 1,
      failedStepsCount: 1,
      sideEffectsCount: 1,
      retriesCount: 2,
      eventsCount: 1
    });
    expect(detail.steps[0]).toMatchObject({
      nodeId: 'email-1',
      nodeType: 'communication.send',
      idempotencyKey: '[REDACTED]'
    });
    expect(detail.sideEffects[0]).toMatchObject({
      providerMessageId: 'provider-message-1',
      idempotencyKey: '[REDACTED]',
      contact: {
        primaryEmail: 'j***@acme.test',
        primaryPhone: '+55******9999'
      }
    });
    expect(JSON.stringify(detail)).not.toContain('secret-key');
    expect(JSON.stringify(detail)).not.toContain('idem-side-effect');
    expect(JSON.stringify(detail)).not.toContain('jane@acme.test');
  });
});
