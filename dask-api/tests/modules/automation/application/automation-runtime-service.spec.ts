import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/core/errors/app-error';
import { AutomationRuntimeService } from '@/modules/automation/application/automation-runtime-service';

function makeDeps() {
  const prisma = {
    automationRule: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    automationExecution: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    workItemViewPlacement: {
      upsert: vi.fn(),
      deleteMany: vi.fn()
    },
    automationView: {
      findFirst: vi.fn()
    },
    automationViewColumn: {
      findFirst: vi.fn()
    },
    workflowState: {
      findFirst: vi.fn()
    },
    item: {
      update: vi.fn()
    }
  };

  const service = new AutomationRuntimeService(prisma as any);

  return { prisma, service };
}

describe('AutomationRuntimeService', () => {
  it('returns immediately when no matching rules exist', async () => {
    const { prisma, service } = makeDeps();
    prisma.automationRule.findMany.mockResolvedValue([]);

    await service.processEvent({
      eventName: 'item.moved',
      workspaceId: 'ws-1',
      payload: {}
    });

    expect(prisma.automationExecution.create).not.toHaveBeenCalled();
  });

  it('processes matching rules and marks execution as succeeded', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationRule.findMany.mockResolvedValue([
      {
        id: 'rule-1',
        workspaceId: 'ws-1',
        trigger: { type: 'item.moved' },
        conditions: { sourceViewKeys: ['dev'], toColumnKeys: ['done'] },
        actions: [
          {
            type: 'set_view_column',
            targetViewKey: 'qa',
            targetColumnKey: 'ready-for-test'
          }
        ]
      }
    ]);

    prisma.automationExecution.findFirst.mockResolvedValue(null);
    prisma.automationExecution.create.mockResolvedValue({ id: 'exec-1' });
    prisma.automationView.findFirst.mockResolvedValue({ id: 'view-qa' });
    prisma.automationViewColumn.findFirst.mockResolvedValue({ id: 'col-ready' });
    prisma.workItemViewPlacement.upsert.mockResolvedValue(undefined);
    prisma.automationExecution.update.mockResolvedValue(undefined);

    await service.processEvent({
      eventId: 'evt-1',
      eventName: 'item.moved',
      workspaceId: 'ws-1',
      payload: {
        itemId: 'item-1',
        workspaceId: 'ws-1',
        sourceViewKey: 'dev',
        toColumnKey: 'done',
        requestedBy: 'user-1'
      }
    });

    expect(prisma.workItemViewPlacement.upsert).toHaveBeenCalled();
    expect(prisma.automationExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'succeeded' })
      })
    );
  });

  it('supports set_view_column action with metadata override and id references', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationRule.findMany.mockResolvedValue([
      {
        id: 'rule-1',
        workspaceId: 'ws-1',
        trigger: { type: 'item.moved' },
        conditions: undefined,
        actions: [
          {
            type: 'set_view_column',
            targetViewId: '11111111-1111-4111-8111-111111111111',
            targetColumnId: '22222222-2222-4222-8222-222222222222',
            metadata: { copied: true }
          }
        ]
      }
    ]);

    prisma.automationExecution.findFirst.mockResolvedValue(null);
    prisma.automationExecution.create.mockResolvedValue({ id: 'exec-1' });
    prisma.automationView.findFirst.mockResolvedValue({ id: 'view-qa' });
    prisma.automationViewColumn.findFirst.mockResolvedValue({ id: 'col-ready' });
    prisma.workItemViewPlacement.upsert.mockResolvedValue(undefined);
    prisma.automationExecution.update.mockResolvedValue(undefined);

    await service.processEvent({
      eventName: 'item.moved',
      workspaceId: 'ws-1',
      payload: {
        itemId: 'item-1',
        workspaceId: 'ws-1',
        requestedBy: 'user-1'
      }
    });

    expect(prisma.workItemViewPlacement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          metadata: { copied: true }
        }),
        update: expect.objectContaining({
          metadata: { copied: true }
        })
      })
    );
  });

  it('uses payload metadata fallback and null updatedBy when requester is not a string', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationRule.findMany.mockResolvedValue([
      {
        id: 'rule-1',
        workspaceId: 'ws-1',
        trigger: { type: 'item.moved' },
        conditions: undefined,
        actions: [
          {
            type: 'set_view_column',
            targetViewKey: 'qa',
            targetColumnKey: 'ready-for-test'
          }
        ]
      }
    ]);

    prisma.automationExecution.findFirst.mockResolvedValue(null);
    prisma.automationExecution.create.mockResolvedValue({ id: 'exec-1' });
    prisma.automationView.findFirst.mockResolvedValue({ id: 'view-qa' });
    prisma.automationViewColumn.findFirst.mockResolvedValue({ id: 'col-ready' });
    prisma.workItemViewPlacement.upsert.mockResolvedValue(undefined);
    prisma.automationExecution.update.mockResolvedValue(undefined);

    await service.processEvent({
      eventName: 'item.moved',
      workspaceId: 'ws-1',
      payload: {
        itemId: 'item-1',
        workspaceId: 'ws-1',
        metadata: { copied: 'from-event' },
        requestedBy: 123
      }
    });

    expect(prisma.workItemViewPlacement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          metadata: { copied: 'from-event' },
          updatedBy: null
        }),
        update: expect.objectContaining({
          metadata: undefined,
          updatedBy: null
        })
      })
    );
  });

  it('marks execution as skipped when conditions do not match', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationRule.findMany.mockResolvedValue([
      {
        id: 'rule-1',
        workspaceId: 'ws-1',
        trigger: { type: 'item.moved' },
        conditions: { sourceViewKeys: ['qa'] },
        actions: [
          {
            type: 'remove_from_view',
            targetViewKey: 'qa'
          }
        ]
      }
    ]);

    prisma.automationExecution.findFirst.mockResolvedValue(null);
    prisma.automationExecution.create.mockResolvedValue({ id: 'exec-1' });
    prisma.automationExecution.update.mockResolvedValue(undefined);

    await service.processEvent({
      eventId: 'evt-1',
      eventName: 'item.moved',
      workspaceId: 'ws-1',
      payload: {
        itemId: 'item-1',
        workspaceId: 'ws-1',
        sourceViewKey: 'dev'
      }
    });

    expect(prisma.workItemViewPlacement.deleteMany).not.toHaveBeenCalled();
    expect(prisma.automationExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'skipped' })
      })
    );
  });

  it('ignores duplicated event-rule execution by eventId', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationRule.findMany.mockResolvedValue([
      {
        id: 'rule-1',
        workspaceId: 'ws-1',
        trigger: { type: 'item.moved' },
        conditions: undefined,
        actions: [
          {
            type: 'remove_from_view',
            targetViewKey: 'qa'
          }
        ]
      }
    ]);

    prisma.automationExecution.findFirst.mockResolvedValue({ id: 'existing-exec' });

    await service.processEvent({
      eventId: 'evt-1',
      eventName: 'item.moved',
      workspaceId: 'ws-1',
      payload: {
        itemId: 'item-1',
        workspaceId: 'ws-1'
      }
    });

    expect(prisma.automationExecution.create).not.toHaveBeenCalled();
  });

  it('runs one rule manually and executes remove_from_view action', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationRule.findUnique.mockResolvedValue({
      id: 'rule-1',
      workspaceId: 'ws-1',
      trigger: { type: 'manual' },
      conditions: undefined,
      actions: [
        {
          type: 'remove_from_view',
          targetViewKey: 'qa'
        }
      ]
    });

    prisma.automationExecution.findFirst.mockResolvedValue(null);
    prisma.automationExecution.create.mockResolvedValue({ id: 'exec-1' });
    prisma.automationExecution.update.mockResolvedValue(undefined);
    prisma.automationView.findFirst.mockResolvedValue({ id: 'view-qa' });
    prisma.workItemViewPlacement.deleteMany.mockResolvedValue(undefined);

    await service.runRule({
      ruleId: 'rule-1',
      requestedBy: 'user-1',
      context: {
        itemId: 'item-1',
        workspaceId: 'ws-1'
      }
    });

    expect(prisma.workItemViewPlacement.deleteMany).toHaveBeenCalled();
  });

  it('supports set_work_item_state by state slug', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationRule.findUnique.mockResolvedValue({
      id: 'rule-1',
      workspaceId: 'ws-1',
      trigger: { type: 'manual' },
      conditions: undefined,
      actions: [
        {
          type: 'set_work_item_state',
          stateSlug: 'done'
        }
      ]
    });

    prisma.automationExecution.findFirst.mockResolvedValue(null);
    prisma.automationExecution.create.mockResolvedValue({ id: 'exec-1' });
    prisma.automationExecution.update.mockResolvedValue(undefined);

    prisma.workflowState.findFirst.mockResolvedValue({
      id: 'state-done',
      slug: 'done'
    });

    prisma.item.update.mockResolvedValue(undefined);

    await service.runRule({
      ruleId: 'rule-1',
      context: {
        itemId: 'item-1',
        workspaceId: 'ws-1',
        requestedBy: 'user-1'
      }
    });

    expect(prisma.item.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stateId: 'state-done',
          status: 'done',
          updatedBy: 'user-1'
        })
      })
    );
  });

  it('treats non-finite priority as undefined in event context', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationRule.findMany.mockResolvedValue([
      {
        id: 'rule-1',
        workspaceId: 'ws-1',
        trigger: { type: 'item.moved' },
        conditions: { priorities: [1] },
        actions: [
          {
            type: 'remove_from_view',
            targetViewKey: 'qa'
          }
        ]
      }
    ]);

    prisma.automationExecution.findFirst.mockResolvedValue(null);
    prisma.automationExecution.create.mockResolvedValue({ id: 'exec-1' });
    prisma.automationExecution.update.mockResolvedValue(undefined);

    await service.processEvent({
      eventName: 'item.moved',
      workspaceId: 'ws-1',
      payload: {
        itemId: 'item-1',
        workspaceId: 'ws-1',
        priority: Number.POSITIVE_INFINITY
      }
    });

    expect(prisma.workItemViewPlacement.deleteMany).not.toHaveBeenCalled();
    expect(prisma.automationExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'skipped' })
      })
    );
  });

  it('matches numeric priority conditions when event priority is finite', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationRule.findMany.mockResolvedValue([
      {
        id: 'rule-1',
        workspaceId: 'ws-1',
        trigger: { type: 'item.moved' },
        conditions: { priorities: [3] },
        actions: [
          {
            type: 'remove_from_view',
            targetViewKey: 'qa'
          }
        ]
      }
    ]);

    prisma.automationExecution.findFirst.mockResolvedValue(null);
    prisma.automationExecution.create.mockResolvedValue({ id: 'exec-1' });
    prisma.automationExecution.update.mockResolvedValue(undefined);
    prisma.automationView.findFirst.mockResolvedValue({ id: 'view-qa' });
    prisma.workItemViewPlacement.deleteMany.mockResolvedValue(undefined);

    await service.processEvent({
      eventName: 'item.moved',
      workspaceId: 'ws-1',
      payload: {
        itemId: 'item-1',
        workspaceId: 'ws-1',
        priority: 3
      }
    });

    expect(prisma.workItemViewPlacement.deleteMany).toHaveBeenCalled();
    expect(prisma.automationExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'succeeded' })
      })
    );
  });

  it('supports set_work_item_state by explicit state id and status', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationRule.findUnique.mockResolvedValue({
      id: 'rule-1',
      workspaceId: 'ws-1',
      trigger: { type: 'manual' },
      conditions: undefined,
      actions: [
        {
          type: 'set_work_item_state',
          stateId: '33333333-3333-4333-8333-333333333333',
          status: 'in-progress'
        }
      ]
    });

    prisma.automationExecution.findFirst.mockResolvedValue(null);
    prisma.automationExecution.create.mockResolvedValue({ id: 'exec-1' });
    prisma.automationExecution.update.mockResolvedValue(undefined);
    prisma.item.update.mockResolvedValue(undefined);

    await service.runRule({
      ruleId: 'rule-1',
      context: {
        itemId: 'item-1',
        workspaceId: 'ws-1',
        requestedBy: 42
      }
    });

    expect(prisma.workflowState.findFirst).not.toHaveBeenCalled();
    expect(prisma.item.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stateId: '33333333-3333-4333-8333-333333333333',
          status: 'in-progress',
          updatedBy: undefined
        })
      })
    );
  });

  it('fails when state slug cannot be resolved', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationRule.findUnique.mockResolvedValue({
      id: 'rule-1',
      workspaceId: 'ws-1',
      trigger: { type: 'manual' },
      conditions: undefined,
      actions: [
        {
          type: 'set_work_item_state',
          stateSlug: 'unknown'
        }
      ]
    });
    prisma.automationExecution.findFirst.mockResolvedValue(null);
    prisma.automationExecution.create.mockResolvedValue({ id: 'exec-1' });
    prisma.automationExecution.update.mockResolvedValue(undefined);
    prisma.workflowState.findFirst.mockResolvedValue(null);

    await expect(
      service.runRule({
        ruleId: 'rule-1',
        context: { itemId: 'item-1', workspaceId: 'ws-1' }
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws when manually running a missing rule', async () => {
    const { prisma, service } = makeDeps();
    prisma.automationRule.findUnique.mockResolvedValue(null);

    await expect(
      service.runRule({
        ruleId: 'missing',
        context: {}
      })
    ).rejects.toMatchObject({
      statusCode: 404
    });
  });

  it('marks execution as failed when persisted rule payload is invalid', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationRule.findMany.mockResolvedValue([
      {
        id: 'rule-1',
        workspaceId: 'ws-1',
        trigger: { type: 'item.moved' },
        conditions: null,
        actions: [{ unsupported: true }]
      }
    ]);

    prisma.automationExecution.findFirst.mockResolvedValue(null);
    prisma.automationExecution.create.mockResolvedValue({ id: 'exec-1' });
    prisma.automationExecution.update.mockResolvedValue(undefined);

    await expect(
      service.processEvent({
        eventName: 'item.moved',
        workspaceId: 'ws-1',
        payload: {
          itemId: 'item-1',
          workspaceId: 'ws-1'
        }
      })
    ).rejects.toThrowError(AppError);

    expect(prisma.automationExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed' })
      })
    );
  });

  it('marks execution as failed with unknown error text for non-Error throwables', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationRule.findMany.mockResolvedValue([
      {
        id: 'rule-1',
        workspaceId: 'ws-1',
        trigger: { type: 'item.moved' },
        conditions: undefined,
        actions: [
          {
            type: 'remove_from_view',
            targetViewKey: 'qa'
          }
        ]
      }
    ]);

    prisma.automationExecution.findFirst.mockResolvedValue(null);
    prisma.automationExecution.create.mockResolvedValue({ id: 'exec-1' });
    prisma.automationExecution.update.mockResolvedValue(undefined);

    const executeActionSpy = vi
      .spyOn(service as any, 'executeAction')
      .mockRejectedValueOnce('non-error');

    await expect(
      service.processEvent({
        eventName: 'item.moved',
        workspaceId: 'ws-1',
        payload: {
          itemId: 'item-1',
          workspaceId: 'ws-1'
        }
      })
    ).rejects.toBe('non-error');

    expect(prisma.automationExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'failed',
          error: 'Unknown automation runtime error.'
        })
      })
    );

    executeActionSpy.mockRestore();
  });

  it('throws when event context misses mandatory item id', async () => {
    const { service } = makeDeps();

    await expect(
      (service as any).executeAction(
        { type: 'remove_from_view', targetViewKey: 'qa' },
        { workspaceId: 'ws-1' },
        {}
      )
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('throws when event context misses mandatory workspace id', async () => {
    const { service } = makeDeps();

    await expect(
      (service as any).executeAction(
        { type: 'remove_from_view', targetViewKey: 'qa' },
        { itemId: 'item-1' },
        {}
      )
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('throws for unsupported action type branch', async () => {
    const { service } = makeDeps();

    await expect(
      (service as any).executeAction(
        { type: 'unsupported' },
        { itemId: 'item-1', workspaceId: 'ws-1' },
        {}
      )
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('throws when target view/column references cannot be resolved', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationView.findFirst.mockResolvedValue(null);

    await expect(
      (service as any).resolveView({
        workspaceId: 'ws-1',
        viewId: 'missing'
      })
    ).rejects.toMatchObject({ statusCode: 404 });

    prisma.automationView.findFirst.mockResolvedValue({ id: 'view-1' });
    prisma.automationViewColumn.findFirst.mockResolvedValue(null);

    await expect(
      (service as any).resolveColumn({
        workspaceId: 'ws-1',
        viewId: 'view-1',
        columnId: 'missing'
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
