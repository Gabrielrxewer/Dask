import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { AutomationService } from '@/modules/automation/application/automation-service';
import { DomainEventNames } from '@/core/events/event-names';

function makeDeps() {
  const prisma = {
    $transaction: vi.fn(async (fn: (db: any) => Promise<unknown>) => fn(prisma as any)),
    automationRule: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn()
    },
    automationExecution: {
      findMany: vi.fn()
    }
  };

  const eventPublisher = {
    publish: vi.fn().mockResolvedValue(undefined),
    publishInTransaction: vi.fn().mockResolvedValue(undefined),
    runInTransaction: vi.fn(
      async (fn: (db: any, publisher: { publishInTransaction: (...args: unknown[]) => Promise<void> }) => Promise<unknown>) =>
        fn(prisma as any, eventPublisher as any)
    )
  };

  const jobQueue = {
    enqueue: vi.fn().mockResolvedValue(undefined)
  };

  const workspaceConfigService = {
    ensureReadableWorkspace: vi.fn().mockResolvedValue(undefined),
    ensureConfigWritableWorkspace: vi.fn().mockResolvedValue(undefined)
  };

  const service = new AutomationService(
    prisma as any,
    eventPublisher as any,
    jobQueue as any,
    workspaceConfigService as any
  );

  return { prisma, eventPublisher, jobQueue, workspaceConfigService, service };
}

describe('AutomationService', () => {
  it('lists rules filtering disabled by default', async () => {
    const { prisma, service, workspaceConfigService } = makeDeps();
    prisma.automationRule.findMany.mockResolvedValue([
      {
        id: 'rule-1',
        workspaceId: 'ws-1',
        name: 'Sync done to QA',
        description: null,
        triggerType: 'item.moved',
        trigger: { type: 'item.moved' },
        conditions: { sourceViewKeys: ['dev'] },
        actions: [{ type: 'remove_from_view', targetViewKey: 'legacy' }],
        enabled: true,
        priority: 100,
        version: 1,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02')
      }
    ]);

    const result = await service.listRules({
      workspaceId: 'ws-1',
      userId: 'user-1'
    });

    expect(workspaceConfigService.ensureReadableWorkspace).toHaveBeenCalledWith('ws-1', 'user-1');
    expect(prisma.automationRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId: 'ws-1',
          enabled: true
        }
      })
    );
    expect(result).toHaveLength(1);
  });

  it('lists rules including disabled when requested', async () => {
    const { prisma, service } = makeDeps();
    prisma.automationRule.findMany.mockResolvedValue([]);

    await service.listRules({
      workspaceId: 'ws-1',
      userId: 'user-1',
      includeDisabled: true
    });

    expect(prisma.automationRule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId: 'ws-1'
        }
      })
    );
  });

  it('creates a validated automation rule', async () => {
    const { prisma, eventPublisher, service } = makeDeps();

    prisma.automationRule.create.mockResolvedValue({
      id: 'rule-1',
      workspaceId: 'ws-1',
      name: 'Dev done to QA ready',
      description: 'Cross-view synchronization',
      triggerType: 'item.moved',
      trigger: { type: 'item.moved' },
      conditions: { sourceViewKeys: ['dev'], toColumnKeys: ['done'] },
      actions: [
        {
          type: 'set_view_column',
          targetViewKey: 'qa',
          targetColumnKey: 'ready-for-test'
        }
      ],
      enabled: true,
      priority: 10,
      version: 1,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02')
    });

    const created = await service.createRule({
      workspaceId: 'ws-1',
      userId: 'user-1',
      name: 'Dev done to QA ready',
      description: 'Cross-view synchronization',
      trigger: { type: 'item.moved' },
      conditions: { sourceViewKeys: ['dev'], toColumnKeys: ['done'] },
      actions: [
        {
          type: 'set_view_column',
          targetViewKey: 'qa',
          targetColumnKey: 'ready-for-test'
        }
      ],
      enabled: true,
      priority: 10
    });

    expect(created.triggerType).toBe('item.moved');
    expect(prisma.automationRule.create).toHaveBeenCalled();
    expect(eventPublisher.publishInTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ name: DomainEventNames.AutomationRuleCreated })
      ,
      expect.anything()
    );
  });

  it('creates rule with default enabled/priority and undefined conditions', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationRule.create.mockResolvedValue({
      id: 'rule-2',
      workspaceId: 'ws-1',
      name: 'Defaulted',
      description: null,
      triggerType: 'item.updated',
      trigger: { type: 'item.updated' },
      conditions: null,
      actions: [{ type: 'remove_from_view', targetViewKey: 'legacy' }],
      enabled: true,
      priority: 100,
      version: 1,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02')
    });

    await service.createRule({
      workspaceId: 'ws-1',
      userId: 'user-1',
      name: 'Defaulted',
      trigger: { type: 'item.updated' },
      actions: [{ type: 'remove_from_view', targetViewKey: 'legacy' }]
    });

    expect(prisma.automationRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conditions: undefined,
          enabled: true,
          priority: 100
        })
      })
    );
  });

  it('updates a rule and increments version when spec changes', async () => {
    const { prisma, eventPublisher, service } = makeDeps();

    prisma.automationRule.findFirst.mockResolvedValue({
      id: 'rule-1',
      workspaceId: 'ws-1',
      name: 'Legacy rule',
      description: null,
      triggerType: 'item.updated',
      trigger: { type: 'item.updated' },
      conditions: null,
      actions: [{ type: 'remove_from_view', targetViewKey: 'legacy' }],
      enabled: true,
      priority: 100,
      version: 2,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02')
    });

    prisma.automationRule.update.mockResolvedValue({
      id: 'rule-1',
      workspaceId: 'ws-1',
      name: 'Rule updated',
      description: null,
      triggerType: 'item.moved',
      trigger: { type: 'item.moved' },
      conditions: { sourceViewKeys: ['dev'] },
      actions: [
        {
          type: 'set_view_column',
          targetViewKey: 'qa',
          targetColumnKey: 'ready-for-test'
        }
      ],
      enabled: true,
      priority: 30,
      version: 3,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-03')
    });

    const updated = await service.updateRule({
      workspaceId: 'ws-1',
      ruleId: 'rule-1',
      userId: 'user-1',
      payload: {
        name: 'Rule updated',
        trigger: { type: 'item.moved' },
        conditions: { sourceViewKeys: ['dev'] },
        actions: [
          {
            type: 'set_view_column',
            targetViewKey: 'qa',
            targetColumnKey: 'ready-for-test'
          }
        ],
        priority: 30
      }
    });

    expect(updated.version).toBe(3);
    expect(eventPublisher.publishInTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ name: DomainEventNames.AutomationRuleUpdated })
      ,
      expect.anything()
    );
  });

  it('updates spec using current actions and clears conditions to JsonNull when omitted', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationRule.findFirst.mockResolvedValue({
      id: 'rule-1',
      workspaceId: 'ws-1',
      name: 'Legacy rule',
      description: null,
      triggerType: 'item.updated',
      trigger: { type: 'item.updated' },
      conditions: null,
      actions: [{ type: 'remove_from_view', targetViewKey: 'legacy' }],
      enabled: true,
      priority: 100,
      version: 2,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02')
    });

    prisma.automationRule.update.mockResolvedValue({
      id: 'rule-1',
      workspaceId: 'ws-1',
      name: 'Legacy rule',
      description: null,
      triggerType: 'item.moved',
      trigger: { type: 'item.moved' },
      conditions: null,
      actions: [{ type: 'remove_from_view', targetViewKey: 'legacy' }],
      enabled: true,
      priority: 100,
      version: 3,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-03')
    });

    await service.updateRule({
      workspaceId: 'ws-1',
      ruleId: 'rule-1',
      userId: 'user-1',
      payload: {
        trigger: { type: 'item.moved' }
      }
    });

    expect(prisma.automationRule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          triggerType: 'item.moved',
          conditions: Prisma.JsonNull
        })
      })
    );
  });

  it('updates spec with actions only and reuses current trigger', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationRule.findFirst.mockResolvedValue({
      id: 'rule-1',
      workspaceId: 'ws-1',
      name: 'Legacy rule',
      description: null,
      triggerType: 'item.updated',
      trigger: { type: 'item.updated' },
      conditions: { sourceViewKeys: ['dev'] },
      actions: [{ type: 'remove_from_view', targetViewKey: 'legacy' }],
      enabled: true,
      priority: 100,
      version: 2,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02')
    });

    prisma.automationRule.update.mockResolvedValue({
      id: 'rule-1',
      workspaceId: 'ws-1',
      name: 'Legacy rule',
      description: null,
      triggerType: 'item.updated',
      trigger: { type: 'item.updated' },
      conditions: { sourceViewKeys: ['dev'] },
      actions: [{ type: 'remove_from_view', targetViewKey: 'qa' }],
      enabled: true,
      priority: 100,
      version: 3,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-03')
    });

    await service.updateRule({
      workspaceId: 'ws-1',
      ruleId: 'rule-1',
      userId: 'user-1',
      payload: {
        actions: [{ type: 'remove_from_view', targetViewKey: 'qa' }]
      }
    });

    expect(prisma.automationRule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          triggerType: 'item.updated'
        })
      })
    );
  });

  it('throws 404 when updating a missing rule', async () => {
    const { prisma, service } = makeDeps();
    prisma.automationRule.findFirst.mockResolvedValue(null);

    await expect(
      service.updateRule({
        workspaceId: 'ws-1',
        ruleId: 'missing',
        userId: 'user-1',
        payload: { enabled: false }
      })
    ).rejects.toMatchObject({
      statusCode: 404
    });
  });

  it('updates a rule without spec changes and keeps current version', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationRule.findFirst.mockResolvedValue({
      id: 'rule-1',
      workspaceId: 'ws-1',
      name: 'Rule',
      description: null,
      triggerType: 'item.updated',
      trigger: { type: 'item.updated' },
      conditions: null,
      actions: [{ type: 'remove_from_view', targetViewKey: 'legacy' }],
      enabled: true,
      priority: 100,
      version: 4,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02')
    });

    prisma.automationRule.update.mockResolvedValue({
      id: 'rule-1',
      workspaceId: 'ws-1',
      name: 'Renamed',
      description: null,
      triggerType: 'item.updated',
      trigger: { type: 'item.updated' },
      conditions: null,
      actions: [{ type: 'remove_from_view', targetViewKey: 'legacy' }],
      enabled: true,
      priority: 100,
      version: 4,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-02')
    });

    const updated = await service.updateRule({
      workspaceId: 'ws-1',
      ruleId: 'rule-1',
      userId: 'user-1',
      payload: { name: 'Renamed' }
    });

    expect(updated.version).toBe(4);
  });

  it('queues manual rule run and validates workspace access', async () => {
    const { prisma, jobQueue, service, workspaceConfigService } = makeDeps();

    prisma.automationRule.findUnique.mockResolvedValue({
      id: 'rule-1',
      workspaceId: 'ws-1'
    });

    await service.runRule({
      ruleId: 'rule-1',
      userId: 'user-1',
      context: { itemId: 'item-1' }
    });

    expect(workspaceConfigService.ensureReadableWorkspace).toHaveBeenCalledWith('ws-1', 'user-1');
    expect(jobQueue.enqueue).toHaveBeenCalledWith('automation.run-rule', {
      ruleId: 'rule-1',
      context: { itemId: 'item-1' },
      requestedBy: 'user-1'
    });
  });

  it('returns 404 when running a missing rule', async () => {
    const { prisma, service } = makeDeps();
    prisma.automationRule.findUnique.mockResolvedValue(null);

    await expect(
      service.runRule({
        ruleId: 'missing',
        userId: 'user-1',
        context: {}
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('returns 404 when workspace mismatch is provided on run', async () => {
    const { prisma, service } = makeDeps();
    prisma.automationRule.findUnique.mockResolvedValue({
      id: 'rule-1',
      workspaceId: 'ws-1'
    });

    await expect(
      service.runRule({
        workspaceId: 'ws-2',
        ruleId: 'rule-1',
        userId: 'user-1',
        context: {}
      })
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('lists execution history with bounded limit', async () => {
    const { prisma, service } = makeDeps();

    prisma.automationExecution.findMany.mockResolvedValue([
      {
        id: 'exec-1',
        workspaceId: 'ws-1',
        ruleId: 'rule-1',
        eventName: 'item.moved',
        eventId: 'evt-1',
        status: 'succeeded',
        attempts: 1,
        context: { itemId: 'item-1' },
        error: null,
        startedAt: new Date('2026-01-01T10:00:00Z'),
        finishedAt: new Date('2026-01-01T10:00:01Z'),
        createdAt: new Date('2026-01-01T10:00:00Z'),
        updatedAt: new Date('2026-01-01T10:00:01Z'),
        rule: {
          id: 'rule-1',
          name: 'Sync',
          triggerType: 'item.moved',
          enabled: true
        }
      }
    ]);

    const executions = await service.listExecutions({
      workspaceId: 'ws-1',
      userId: 'user-1',
      limit: 999
    });

    expect(prisma.automationExecution.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 })
    );
    expect(executions).toHaveLength(1);
  });

  it('uses default execution limit when omitted', async () => {
    const { prisma, service } = makeDeps();
    prisma.automationExecution.findMany.mockResolvedValue([]);

    await service.listExecutions({
      workspaceId: 'ws-1',
      userId: 'user-1'
    });

    expect(prisma.automationExecution.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 })
    );
  });
});
