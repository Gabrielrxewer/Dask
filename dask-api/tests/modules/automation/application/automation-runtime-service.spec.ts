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
    columnStateMapping: {
      findFirst: vi.fn()
    },
    boardColumn: {
      findFirst: vi.fn()
    },
    workspaceDocument: {
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    workItemDocumentLink: {
      upsert: vi.fn()
    },
    customer: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn()
    },
    customFieldDefinition: {
      findFirst: vi.fn()
    },
    customFieldValue: {
      upsert: vi.fn()
    },
    item: {
      findFirst: vi.fn(),
      update: vi.fn()
    }
  };

  const service = new AutomationRuntimeService(prisma as any);

  return { prisma, service };
}

function makeCommercialItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    workspaceId: 'ws-1',
    title: 'Venda Dask Core',
    description: 'Implantacao do Dask Core',
    fields: {
      customerId: 'customer-1',
      contactName: 'Ana Cliente',
      interest: 'Dask Core',
      estimatedValue: 1999.9,
      proposalValidity: '2026-05-10',
      paymentTerms: 'A vista'
    },
    metadata: {},
    createdBy: 'user-1',
    updatedBy: null,
    assigneeId: 'user-1',
    assignee: { name: 'Comercial Dask' },
    creator: { name: 'Criador Dask' },
    customFieldValues: [],
    ...overrides
  };
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

  it('creates and interpolates a linked proposal document from a column movement automation', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationRule.findMany.mockResolvedValue([
      {
        id: 'rule-1',
        workspaceId: 'ws-1',
        trigger: { type: 'item.moved' },
        conditions: { toColumnKeys: ['proposal_preparing'] },
        actions: [
          {
            type: 'create_document',
            kind: 'proposal',
            binding: 'commercial_proposal',
            targetFieldSlug: 'proposalId',
            validations: ['commercial.proposal.required_fields']
          }
        ]
      }
    ]);

    prisma.automationExecution.findFirst.mockResolvedValue(null);
    prisma.automationExecution.create.mockResolvedValue({ id: 'exec-1' });
    prisma.automationExecution.update.mockResolvedValue(undefined);
    prisma.item.findFirst
      .mockResolvedValueOnce(makeCommercialItem({
        fields: {},
        assigneeId: null,
        assignee: null,
        customFieldValues: [
          {
            value: 'Projeto piloto',
            field: { slug: 'implementationScope', variableKey: 'implementationScope', name: 'Escopo' }
          }
        ]
      }))
      .mockResolvedValueOnce({ fields: {} });
    prisma.customer.findFirst.mockResolvedValue(null);
    prisma.workspaceDocument.findFirst.mockResolvedValue(null);
    prisma.workspaceDocument.count.mockResolvedValue(0);
    prisma.workspaceDocument.create.mockResolvedValue({ id: 'doc-1' });
    prisma.workItemDocumentLink.upsert.mockResolvedValue(undefined);
    prisma.customFieldDefinition.findFirst.mockResolvedValue({ id: 'field-proposal' });
    prisma.item.update.mockResolvedValue(undefined);
    prisma.customFieldValue.upsert.mockResolvedValue(undefined);

    await service.processEvent({
      eventName: 'item.moved',
      workspaceId: 'ws-1',
      payload: {
        itemId: 'item-1',
        workspaceId: 'ws-1',
        toColumnKey: 'proposal_preparing',
        requestedBy: 'user-1'
      }
    });

    expect(prisma.workspaceDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: 'proposal',
          linkedEntityType: 'work_item',
          linkedEntityId: 'item-1',
          tags: ['Proposta']
        })
      })
    );
    const createCall = prisma.workspaceDocument.create.mock.calls[0]?.[0];
    expect(createCall.data.content).toContain('Projeto piloto');
    expect(createCall.data.content).not.toContain('{{');
    expect(prisma.customFieldValue.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          fieldId: 'field-proposal',
          itemId: 'item-1',
          value: 'doc-1'
        })
      })
    );
  });

  it('updates the linked proposal status when the card moves to sent', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationRule.findMany.mockResolvedValue([
      {
        id: 'rule-1',
        workspaceId: 'ws-1',
        trigger: { type: 'item.moved' },
        conditions: { toColumnKeys: ['proposal_sent'] },
        actions: [
          {
            type: 'update_document_status',
            kind: 'proposal',
            status: 'sent'
          }
        ]
      }
    ]);
    prisma.automationExecution.findFirst.mockResolvedValue(null);
    prisma.automationExecution.create.mockResolvedValue({ id: 'exec-1' });
    prisma.automationExecution.update.mockResolvedValue(undefined);
    prisma.item.findFirst.mockResolvedValue(makeCommercialItem());
    prisma.customer.findFirst.mockResolvedValue(null);
    prisma.workspaceDocument.findFirst.mockResolvedValue({
      id: 'doc-1',
      metadata: { status: 'draft' }
    });
    prisma.workspaceDocument.update.mockResolvedValue(undefined);

    await service.processEvent({
      eventName: 'item.moved',
      workspaceId: 'ws-1',
      payload: {
        itemId: 'item-1',
        workspaceId: 'ws-1',
        toColumnKey: 'proposal_sent',
        requestedBy: 'user-1'
      }
    });

    expect(prisma.workspaceDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1' },
        data: expect.objectContaining({
          metadata: expect.objectContaining({ status: 'sent' })
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

  it('set_work_item_state resolves underscore slugs without converting to dashes', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationRule.findUnique.mockResolvedValue({
      id: 'rule-1',
      workspaceId: 'ws-1',
      trigger: { type: 'manual' },
      conditions: undefined,
      actions: [{ type: 'set_work_item_state', stateSlug: 'contract_preparing' }]
    });

    prisma.automationExecution.findFirst.mockResolvedValue(null);
    prisma.automationExecution.create.mockResolvedValue({ id: 'exec-1' });
    prisma.automationExecution.update.mockResolvedValue(undefined);
    prisma.workflowState.findFirst.mockResolvedValue({ id: 'state-contract', slug: 'contract_preparing' });
    prisma.columnStateMapping.findFirst.mockResolvedValue(null);
    prisma.item.update.mockResolvedValue(undefined);

    await service.runRule({
      ruleId: 'rule-1',
      context: { itemId: 'item-1', workspaceId: 'ws-1' }
    });

    expect(prisma.workflowState.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ slug: 'contract_preparing' })
      })
    );
    expect(prisma.item.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ stateId: 'state-contract', status: 'contract_preparing' })
      })
    );
  });

  it('set_work_item_state also updates boardColumnId when columnStateMapping resolves', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationRule.findUnique.mockResolvedValue({
      id: 'rule-1',
      workspaceId: 'ws-1',
      trigger: { type: 'manual' },
      conditions: undefined,
      actions: [{ type: 'set_work_item_state', stateSlug: 'opportunity_open' }]
    });

    prisma.automationExecution.findFirst.mockResolvedValue(null);
    prisma.automationExecution.create.mockResolvedValue({ id: 'exec-1' });
    prisma.automationExecution.update.mockResolvedValue(undefined);
    prisma.workflowState.findFirst.mockResolvedValue({ id: 'state-opp', slug: 'opportunity_open' });
    prisma.columnStateMapping.findFirst.mockResolvedValue({
      column: { id: 'col-opp', isActive: true }
    });
    prisma.item.update.mockResolvedValue(undefined);

    await service.runRule({
      ruleId: 'rule-1',
      context: { itemId: 'item-1', workspaceId: 'ws-1', requestedBy: 'user-1' }
    });

    expect(prisma.item.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stateId: 'state-opp',
          status: 'opportunity_open',
          boardColumnId: 'col-opp',
          columnId: 'col-opp'
        })
      })
    );
  });

  it('advances commercial card from lead_qualification to opportunity_open crossing perspectives', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationRule.findMany.mockResolvedValue([
      {
        id: 'rule-qualification',
        workspaceId: 'ws-1',
        trigger: { type: 'item.moved' },
        conditions: {
          itemTypeSlugs: ['commercial'],
          toColumnKeys: ['lead_qualification'],
          statuses: ['lead_qualification']
        },
        actions: [{ type: 'set_work_item_state', stateSlug: 'opportunity_open' }]
      }
    ]);

    prisma.automationExecution.findFirst.mockResolvedValue(null);
    prisma.automationExecution.create.mockResolvedValue({ id: 'exec-1' });
    prisma.automationExecution.update.mockResolvedValue(undefined);
    prisma.workflowState.findFirst.mockResolvedValue({ id: 'state-opp', slug: 'opportunity_open' });
    prisma.columnStateMapping.findFirst.mockResolvedValue({
      column: { id: 'col-opp', isActive: true }
    });
    prisma.item.update.mockResolvedValue(undefined);

    await service.processEvent({
      eventName: 'item.moved',
      workspaceId: 'ws-1',
      payload: {
        itemId: 'item-1',
        workspaceId: 'ws-1',
        itemTypeSlug: 'commercial',
        toColumnKey: 'lead_qualification',
        status: 'lead_qualification',
        requestedBy: 'user-1'
      }
    });

    expect(prisma.workflowState.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ slug: 'opportunity_open' })
      })
    );
    expect(prisma.item.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stateId: 'state-opp',
          status: 'opportunity_open',
          boardColumnId: 'col-opp',
          columnId: 'col-opp'
        })
      })
    );
    expect(prisma.automationExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'succeeded' }) })
    );
  });

  it('creates and links a customer when a commercial card reaches contract_accepted', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationRule.findMany.mockResolvedValue([
      {
        id: 'rule-customer',
        workspaceId: 'ws-1',
        trigger: { type: 'item.moved' },
        conditions: {
          itemTypeSlugs: ['commercial'],
          toColumnKeys: ['contract_accepted'],
          statuses: ['contract_accepted']
        },
        actions: [
          {
            type: 'ensure_customer_from_work_item',
            targetFieldSlug: 'customerId',
            status: 'active'
          }
        ]
      }
    ]);

    prisma.automationExecution.findFirst.mockResolvedValue(null);
    prisma.automationExecution.create.mockResolvedValue({ id: 'exec-1' });
    prisma.automationExecution.update.mockResolvedValue(undefined);
    prisma.item.findFirst
      .mockResolvedValueOnce(makeCommercialItem({
        fields: {
          clientName: 'Cliente ABC Ltda',
          companyName: 'ABC',
          contactName: 'Ana Cliente',
          contactEmail: 'ANA@ABC.COM',
          contactPhone: '+55 11 99999-0000',
          clientLogoUrl: 'https://abc.com/logo.png'
        }
      }))
      .mockResolvedValueOnce({ fields: {} });
    prisma.customer.findFirst.mockResolvedValue(null);
    prisma.customer.create.mockResolvedValue({ id: 'customer-new' });
    prisma.customFieldDefinition.findFirst.mockResolvedValue({ id: 'field-customer' });
    prisma.item.update.mockResolvedValue(undefined);
    prisma.customFieldValue.upsert.mockResolvedValue(undefined);

    await service.processEvent({
      eventName: 'item.moved',
      workspaceId: 'ws-1',
      payload: {
        itemId: 'item-1',
        workspaceId: 'ws-1',
        itemTypeSlug: 'commercial',
        toColumnKey: 'contract_accepted',
        status: 'contract_accepted',
        requestedBy: 'user-1'
      }
    });

    expect(prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: 'ws-1',
          name: 'Cliente ABC Ltda',
          tradeName: 'ABC',
          email: 'ana@abc.com',
          phone: '+55 11 99999-0000',
          logoUrl: 'https://abc.com/logo.png',
          status: 'active',
          createdBy: 'user-1',
          updatedBy: 'user-1'
        })
      })
    );
    expect(prisma.customFieldValue.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          fieldId: 'field-customer',
          itemId: 'item-1',
          value: 'customer-new'
        })
      })
    );
    expect(prisma.automationExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'succeeded' }) })
    );
  });

  it('reuses an existing customer instead of creating duplicates on contract_accepted', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationRule.findMany.mockResolvedValue([
      {
        id: 'rule-customer',
        workspaceId: 'ws-1',
        trigger: { type: 'item.moved' },
        conditions: { toColumnKeys: ['contract_accepted'] },
        actions: [{ type: 'ensure_customer_from_work_item', targetFieldSlug: 'customerId', status: 'active' }]
      }
    ]);

    prisma.automationExecution.findFirst.mockResolvedValue(null);
    prisma.automationExecution.create.mockResolvedValue({ id: 'exec-1' });
    prisma.automationExecution.update.mockResolvedValue(undefined);
    prisma.item.findFirst
      .mockResolvedValueOnce(makeCommercialItem({
        fields: {
          clientName: 'Cliente ABC Ltda',
          contactEmail: 'financeiro@abc.com',
          contactPhone: '+55 11 99999-0000'
        }
      }))
      .mockResolvedValueOnce({ fields: {} });
    prisma.customer.findFirst.mockResolvedValue({
      id: 'customer-existing',
      name: 'Cliente ABC Ltda',
      tradeName: null,
      legalName: null,
      document: null,
      email: 'financeiro@abc.com',
      phone: null,
      website: null,
      logoUrl: null,
      status: 'prospect'
    });
    prisma.customer.update.mockResolvedValue({ id: 'customer-existing' });
    prisma.customFieldDefinition.findFirst.mockResolvedValue({ id: 'field-customer' });
    prisma.item.update.mockResolvedValue(undefined);
    prisma.customFieldValue.upsert.mockResolvedValue(undefined);

    await service.processEvent({
      eventName: 'item.moved',
      workspaceId: 'ws-1',
      payload: {
        itemId: 'item-1',
        workspaceId: 'ws-1',
        toColumnKey: 'contract_accepted',
        requestedBy: 'user-1'
      }
    });

    expect(prisma.customer.create).not.toHaveBeenCalled();
    expect(prisma.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'customer-existing' },
        data: expect.objectContaining({
          status: 'active',
          phone: '+55 11 99999-0000',
          updatedBy: 'user-1'
        })
      })
    );
    expect(prisma.customFieldValue.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          value: 'customer-existing'
        })
      })
    );
  });

  it('generates contract and advances state on proposal.approved event', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationRule.findMany.mockResolvedValue([
      {
        id: 'rule-contract',
        workspaceId: 'ws-1',
        trigger: { type: 'proposal.approved' },
        conditions: undefined,
        actions: [
          { type: 'set_work_item_state', stateSlug: 'contract_preparing' },
          {
            type: 'create_document',
            kind: 'contract',
            binding: 'commercial_contract',
            status: 'draft',
            targetFieldSlug: 'contractId',
            validations: ['commercial.contract.required_fields']
          }
        ]
      }
    ]);

    prisma.automationExecution.findFirst.mockResolvedValue(null);
    prisma.automationExecution.create.mockResolvedValue({ id: 'exec-1' });
    prisma.automationExecution.update.mockResolvedValue(undefined);

    prisma.workflowState.findFirst.mockResolvedValue({ id: 'state-contract', slug: 'contract_preparing' });
    prisma.columnStateMapping.findFirst.mockResolvedValue({
      column: { id: 'col-contract', isActive: true }
    });
    prisma.item.update.mockResolvedValue(undefined);

    const commercialItemWithPaymentTerms = makeCommercialItem({
      fields: {
        customerId: 'customer-1',
        contactName: 'Ana Cliente',
        interest: 'Dask Core',
        estimatedValue: 1999.9,
        proposalValidity: '2026-05-10',
        paymentTerms: 'A vista'
      }
    });

    prisma.item.findFirst
      .mockResolvedValueOnce(commercialItemWithPaymentTerms)
      .mockResolvedValueOnce({ fields: {} });

    const customerWithAddress = {
      id: 'customer-1',
      name: 'Empresa ABC',
      tradeName: 'ABC',
      legalName: 'ABC Ltda',
      document: '00.000.000/0001-00',
      email: 'financeiro@abc.com',
      phone: null,
      website: null,
      logoUrl: null,
      address: { street: 'Rua A', number: '10', city: 'Sao Paulo', state: 'SP' }
    };
    prisma.customer.findFirst.mockResolvedValue(customerWithAddress);

    prisma.workspaceDocument.findFirst
      .mockResolvedValueOnce({ id: 'prop-1', metadata: { status: 'approved' } })
      .mockResolvedValueOnce(null);
    prisma.workspaceDocument.count.mockResolvedValue(1);
    prisma.workspaceDocument.create.mockResolvedValue({ id: 'contract-doc-1' });
    prisma.workItemDocumentLink.upsert.mockResolvedValue(undefined);
    prisma.customFieldDefinition.findFirst.mockResolvedValue({ id: 'field-contract' });
    prisma.customFieldValue.upsert.mockResolvedValue(undefined);

    await service.processEvent({
      eventName: 'proposal.approved',
      workspaceId: 'ws-1',
      payload: {
        workspaceId: 'ws-1',
        itemId: 'item-1',
        linkedEntityType: 'work_item',
        linkedEntityId: 'item-1',
        requestedBy: 'user-1'
      }
    });

    expect(prisma.workflowState.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ slug: 'contract_preparing' })
      })
    );
    expect(prisma.item.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stateId: 'state-contract',
          boardColumnId: 'col-contract',
          columnId: 'col-contract'
        })
      })
    );
    expect(prisma.workspaceDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'contract', linkedEntityType: 'work_item' })
      })
    );
    expect(prisma.automationExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'succeeded' }) })
    );
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
