import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { DomainEventNames } from '@/core/events/event-names';
import type { DomainEvent } from '@/core/events/domain-event';
import { AutomationEventDispatcher } from '@/modules/automation/application/automation-event-dispatcher';

function buildEvent(overrides: Partial<DomainEvent> = {}): DomainEvent {
  return {
    id: 'event-1',
    name: DomainEventNames.ProposalApproved,
    aggregateType: 'document',
    aggregateId: 'proposal-1',
    occurredAt: new Date('2026-05-09T12:00:00.000Z'),
    payload: {
      workspaceId: 'workspace-1',
      status: 'approved',
      itemId: 'item-1',
      requestedBy: 'user-1'
    },
    ...overrides
  };
}

function buildPrisma(input?: {
  existingRunIds?: Array<string | null>;
  workflows?: unknown[];
}): PrismaClient {
  const existingRunIds = [...(input?.existingRunIds ?? [])];

  return {
    automationWorkflow: {
      findMany: vi.fn(async () => input?.workflows ?? [
        {
          id: 'workflow-1',
          workspaceId: 'workspace-1',
          currentVersion: {
            id: 'version-1',
            definitionJson: {},
            graphNodesJson: [
              {
                id: 'trigger-status',
                type: 'trigger',
                config: { triggerType: 'proposal_status_changed', status: 'approved' }
              },
              {
                id: 'trigger-explicit',
                type: 'trigger',
                config: { eventName: DomainEventNames.ProposalApproved }
              },
              { id: 'end', type: 'end', config: {} }
            ],
            graphEdgesJson: [
              { id: 'edge-status', source: 'trigger-status', target: 'end' },
              { id: 'edge-explicit', source: 'trigger-explicit', target: 'end' }
            ]
          }
        }
      ])
    },
    automationRun: {
      findFirst: vi.fn(async () => {
        const id = existingRunIds.shift();
        return id ? { id } : null;
      })
    }
  } as unknown as PrismaClient;
}

describe('AutomationEventDispatcher', () => {
  it('starts one run per matching trigger and preserves the trigger node id', async () => {
    const prisma = buildPrisma();
    const startRun = vi.fn(async () => ({
        run: { id: 'run' },
        executionResult: { status: 'completed', executedNodeIds: [] }
      }));
    const runner = { startRun } as unknown as ConstructorParameters<typeof AutomationEventDispatcher>[1];
    const dispatcher = new AutomationEventDispatcher(prisma, runner);

    await dispatcher.dispatch(buildEvent());

    expect(startRun).toHaveBeenCalledTimes(2);
    expect(startRun).toHaveBeenNthCalledWith(1, expect.objectContaining({
      workspaceId: 'workspace-1',
      workflowId: 'workflow-1',
      triggerType: DomainEventNames.ProposalApproved,
      triggerRefId: 'event-1:trigger-status',
      startNodeId: 'trigger-status'
    }));
    expect(startRun).toHaveBeenNthCalledWith(2, expect.objectContaining({
      triggerRefId: 'event-1:trigger-explicit',
      startNodeId: 'trigger-explicit'
    }));
  });

  it('skips already processed trigger runs without suppressing other matching triggers', async () => {
    const prisma = buildPrisma({ existingRunIds: ['existing-run', null] });
    const startRun = vi.fn(async () => ({
        run: { id: 'run' },
        executionResult: { status: 'completed', executedNodeIds: [] }
      }));
    const runner = { startRun } as unknown as ConstructorParameters<typeof AutomationEventDispatcher>[1];
    const dispatcher = new AutomationEventDispatcher(prisma, runner);

    await dispatcher.dispatch(buildEvent());

    expect(startRun).toHaveBeenCalledTimes(1);
    expect(startRun).toHaveBeenCalledWith(expect.objectContaining({
      triggerRefId: 'event-1:trigger-explicit',
      startNodeId: 'trigger-explicit'
    }));
  });

  it('filters by workspace and commercial trigger config', async () => {
    const prisma = buildPrisma({
      workflows: [
        {
          id: 'workflow-1',
          workspaceId: 'workspace-1',
          currentVersion: {
            id: 'version-1',
            definitionJson: {},
            graphNodesJson: [
              {
                id: 'trigger-rejected',
                type: 'trigger',
                config: { triggerType: 'proposal_status_changed', status: 'rejected' }
              }
            ],
            graphEdgesJson: []
          }
        }
      ]
    });
    const startRun = vi.fn();
    const runner = { startRun } as unknown as ConstructorParameters<typeof AutomationEventDispatcher>[1];
    const dispatcher = new AutomationEventDispatcher(prisma, runner);

    await dispatcher.dispatch(buildEvent());

    expect(prisma.automationWorkflow.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: 'workspace-1' })
    }));
    expect(startRun).not.toHaveBeenCalled();
  });
});
