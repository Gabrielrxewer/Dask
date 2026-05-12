import { describe, expect, it, vi } from 'vitest';
import { DashboardMetricsService } from '@/modules/dashboard/dashboard-metrics-service';
import type { DashboardReferenceData, DashboardRepository } from '@/modules/dashboard/dashboard.types';

const reference: DashboardReferenceData = {
  columns: [
    { id: 'col-new', name: 'Entrada comercial', slug: 'commercial-intake' },
    { id: 'col-won', name: 'Ganho', slug: 'ganho' }
  ],
  states: [
    { id: 'state-new', name: 'Novo', slug: 'novo', color: '#2563eb', isTerminal: false },
    { id: 'state-won', name: 'Ganho', slug: 'ganho', color: '#16a34a', isTerminal: true }
  ],
  itemTypes: [
    { id: 'type-workItem', name: 'WorkItem', slug: 'workItem', color: '#2563eb' }
  ],
  members: [
    { id: 'user-1', name: 'Ana' },
    { id: 'user-2', name: 'Bruno' }
  ],
  workflows: [
    { id: 'workflow-1', name: 'Follow-up', status: 'active' }
  ]
};

function makeRepository(): DashboardRepository {
  return {
    getReferenceData: vi.fn(async () => reference),
    countItems: vi.fn(),
    groupItemsByColumn: vi.fn(),
    groupItemsByState: vi.fn(),
    groupItemsByAssignee: vi.fn(),
    countAutomationRuns: vi.fn(),
    groupAutomationRunsByStatus: vi.fn(),
    groupFailedAutomationRunsByWorkflow: vi.fn(),
    countPendingAutomationApprovals: vi.fn()
  };
}

describe('DashboardMetricsService', () => {
  it('builds CRM metrics from real grouped repository data', async () => {
    const repo = makeRepository();
    vi.mocked(repo.countItems)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(5);
    vi.mocked(repo.groupItemsByColumn).mockResolvedValue([
      { key: 'col-new', count: 6 },
      { key: 'col-won', count: 2 }
    ]);
    vi.mocked(repo.groupItemsByState).mockResolvedValue([
      { key: 'state-new', count: 6 },
      { key: 'state-won', count: 2 }
    ]);
    vi.mocked(repo.groupItemsByAssignee).mockResolvedValue([
      { key: 'user-1', count: 5 },
      { key: null, count: 3 }
    ]);

    const service = new DashboardMetricsService(repo);
    const metrics = await service.buildCrmMetrics({
      workspaceId: 'workspace-1',
      filters: { assigneeId: 'user-1', itemTypeId: 'type-workItem', columnId: 'col-new' },
      itemVisibility: { ownCardsOnlyUserId: 'user-1' }
    }, reference, new Date('2026-05-09T12:00:00.000Z'));

    expect(metrics.activeWorkItems).toBe(8);
    expect(metrics.overdueWorkItems).toBe(2);
    expect(metrics.unassignedWorkItems).toBe(3);
    expect(metrics.createdWorkItemsInPeriod).toBe(5);
    expect(metrics.cardsByColumn).toContainEqual(expect.objectContaining({ id: 'col-new', label: 'Entrada comercial', value: 6 }));
    expect(metrics.cardsByState).toContainEqual(expect.objectContaining({ id: 'state-won', label: 'Ganho', value: 2 }));
    expect(metrics.cardsByAssignee).toContainEqual(expect.objectContaining({ id: null, label: 'Sem responsavel', value: 3 }));
  });

  it('applies period filters only to created-in-period CRM metric', async () => {
    const repo = makeRepository();
    vi.mocked(repo.countItems).mockResolvedValue(0);
    vi.mocked(repo.groupItemsByColumn).mockResolvedValue([]);
    vi.mocked(repo.groupItemsByState).mockResolvedValue([]);
    vi.mocked(repo.groupItemsByAssignee).mockResolvedValue([]);

    const service = new DashboardMetricsService(repo);
    await service.buildCrmMetrics({
      workspaceId: 'workspace-1',
      filters: {
        from: new Date('2026-05-01T00:00:00.000Z'),
        to: new Date('2026-05-09T23:59:59.999Z')
      },
      itemVisibility: {}
    }, reference);

    const createdWhere = vi.mocked(repo.countItems).mock.calls[3]?.[0];
    expect(createdWhere).toEqual(expect.objectContaining({
      AND: expect.arrayContaining([
        { workspaceId: 'workspace-1' },
        { createdAt: { gte: new Date('2026-05-01T00:00:00.000Z'), lte: new Date('2026-05-09T23:59:59.999Z') } }
      ])
    }));
  });

  it('keeps every CRM query scoped by workspace', async () => {
    const repo = makeRepository();
    vi.mocked(repo.countItems).mockResolvedValue(0);
    vi.mocked(repo.groupItemsByColumn).mockResolvedValue([]);
    vi.mocked(repo.groupItemsByState).mockResolvedValue([]);
    vi.mocked(repo.groupItemsByAssignee).mockResolvedValue([]);

    const service = new DashboardMetricsService(repo);
    await service.buildCrmMetrics({
      workspaceId: 'workspace-secure',
      filters: {},
      itemVisibility: {}
    }, reference);

    const calls = [
      ...vi.mocked(repo.countItems).mock.calls,
      ...vi.mocked(repo.groupItemsByColumn).mock.calls,
      ...vi.mocked(repo.groupItemsByState).mock.calls,
      ...vi.mocked(repo.groupItemsByAssignee).mock.calls
    ];

    expect(calls.length).toBeGreaterThan(0);
    expect(calls.every(([where]) => JSON.stringify(where).includes('workspace-secure'))).toBe(true);
  });

  it('groups automation runs by status and failed workflow with filters', async () => {
    const repo = makeRepository();
    vi.mocked(repo.groupAutomationRunsByStatus).mockResolvedValue([
      { key: 'completed', count: 7 },
      { key: 'failed', count: 2 }
    ]);
    vi.mocked(repo.groupFailedAutomationRunsByWorkflow).mockResolvedValue([
      { key: 'workflow-1', count: 2 }
    ]);
    vi.mocked(repo.countPendingAutomationApprovals).mockResolvedValue(4);

    const service = new DashboardMetricsService(repo);
    const metrics = await service.buildAutomationMetrics({
      workspaceId: 'workspace-1',
      filters: {
        workflowId: 'workflow-1',
        status: 'failed',
        from: new Date('2026-05-01T00:00:00.000Z')
      },
      itemVisibility: {}
    }, reference);

    expect(metrics.runsByStatus).toContainEqual(expect.objectContaining({ id: 'completed', value: 7 }));
    expect(metrics.failedRunsByWorkflow).toEqual([
      expect.objectContaining({ id: 'workflow-1', label: 'Follow-up', value: 2 })
    ]);
    expect(metrics.pendingApprovals).toBe(0);
    expect(repo.groupAutomationRunsByStatus).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'workspace-1',
      workflowId: 'workflow-1',
      status: 'failed'
    }));
  });

  it('returns empty metrics when there is no data', async () => {
    const repo = makeRepository();
    vi.mocked(repo.countItems).mockResolvedValue(0);
    vi.mocked(repo.groupItemsByColumn).mockResolvedValue([]);
    vi.mocked(repo.groupItemsByState).mockResolvedValue([]);
    vi.mocked(repo.groupItemsByAssignee).mockResolvedValue([]);

    const service = new DashboardMetricsService(repo);
    const metrics = await service.buildCrmMetrics({
      workspaceId: 'workspace-empty',
      filters: {},
      itemVisibility: {}
    }, reference);

    expect(metrics.activeWorkItems).toBe(0);
    expect(metrics.cardsByColumn.every((item) => item.value === 0)).toBe(true);
    expect(metrics.cardsByState.every((item) => item.value === 0)).toBe(true);
  });
});
