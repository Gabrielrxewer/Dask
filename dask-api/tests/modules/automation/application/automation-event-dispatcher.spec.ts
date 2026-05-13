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
  item?: unknown;
}): PrismaClient {
  const existingRunIds = [...(input?.existingRunIds ?? [])];
  const item = input?.item ?? {
    id: 'item-1',
    type: 'task',
    typeId: 'type-1',
    typeDefinition: { slug: 'commercial' },
    stateId: 'state-1',
    status: 'commercial_intake',
    workflowState: { slug: 'commercial_intake' },
    boardColumnId: 'column-1',
    boardColumn: { slug: 'commercial_intake' }
  };

  return {
    item: {
      findFirst: vi.fn(async () => item)
    },
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

  it('normalizes linked work item document events before matching commercial triggers', async () => {
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
                id: 'trigger-proposal-approved',
                type: 'trigger',
                config: { triggerType: 'proposal_status_changed', status: 'approved', itemTypeSlugs: ['commercial'] }
              }
            ],
            graphEdgesJson: []
          }
        }
      ]
    });
    const startRun = vi.fn(async () => ({
      run: { id: 'run' },
      executionResult: { status: 'completed', executedNodeIds: [] }
    }));
    const dispatcher = new AutomationEventDispatcher(
      prisma,
      { startRun } as unknown as ConstructorParameters<typeof AutomationEventDispatcher>[1]
    );

    await dispatcher.dispatch(buildEvent({
      payload: {
        workspaceId: 'workspace-1',
        status: 'approved',
        linkedEntityType: 'work_item',
        linkedEntityId: 'item-1',
        idempotencyKey: 'proposal.approved:proposal-1:item-1:approved',
        requestedBy: 'user-1'
      }
    }));

    expect(startRun).toHaveBeenCalledWith(expect.objectContaining({
      triggerRefId: 'proposal.approved:proposal-1:item-1:approved:trigger-proposal-approved',
      context: expect.objectContaining({
        itemId: 'item-1',
        workItemId: 'item-1',
        itemTypeSlug: 'commercial',
        event: expect.objectContaining({
          payload: expect.objectContaining({
            itemId: 'item-1',
            workItemId: 'item-1',
            itemTypeSlug: 'commercial'
          })
        })
      })
    }));
  });

  it('does not match commercial triggers for non-commercial work items', async () => {
    const prisma = buildPrisma({
      item: {
        id: 'item-1',
        type: 'task',
        typeId: 'type-1',
        typeDefinition: { slug: 'support' },
        stateId: 'state-1',
        status: 'open',
        workflowState: { slug: 'open' },
        boardColumnId: 'column-1',
        boardColumn: { slug: 'support_queue' }
      },
      workflows: [
        {
          id: 'workflow-1',
          workspaceId: 'workspace-1',
          currentVersion: {
            id: 'version-1',
            definitionJson: {},
            graphNodesJson: [
              {
                id: 'trigger-proposal-approved',
                type: 'trigger',
                config: { triggerType: 'proposal_status_changed', status: 'approved', itemTypeSlugs: ['commercial'] }
              },
              {
                id: 'trigger-commercial-created',
                type: 'trigger',
                config: { triggerType: 'commercial_work_item_created' }
              }
            ],
            graphEdgesJson: []
          }
        }
      ]
    });
    const startRun = vi.fn();
    const dispatcher = new AutomationEventDispatcher(
      prisma,
      { startRun } as unknown as ConstructorParameters<typeof AutomationEventDispatcher>[1]
    );

    await dispatcher.dispatch(buildEvent({
      name: DomainEventNames.CommercialWorkItemCreated,
      payload: {
        workspaceId: 'workspace-1',
        itemId: 'item-1',
        requestedBy: 'user-1'
      }
    }));

    await dispatcher.dispatch(buildEvent({
      payload: {
        workspaceId: 'workspace-1',
        status: 'approved',
        linkedEntityType: 'work_item',
        linkedEntityId: 'item-1',
        requestedBy: 'user-1'
      }
    }));

    expect(startRun).not.toHaveBeenCalled();
  });
});
