import type { Prisma } from '@prisma/client';
import type {
  AutomationGroupCount,
  DashboardItemVisibility,
  DashboardMetricContext,
  DashboardReferenceData,
  DashboardRepository,
  DashboardSeriesItem,
  DashboardTableColumn,
  DashboardTableRow,
  ItemGroupCount
} from '@/modules/dashboard/dashboard.types';

type CrmMetrics = {
  activeWorkItems: number;
  cardsByColumn: DashboardSeriesItem[];
  cardsByState: DashboardSeriesItem[];
  cardsByAssignee: DashboardSeriesItem[];
  overdueWorkItems: number;
  unassignedWorkItems: number;
  createdWorkItemsInPeriod: number;
};

type AutomationMetrics = {
  runsByStatus: DashboardSeriesItem[];
  failedRunsByWorkflow: DashboardSeriesItem[];
  pendingApprovals: number;
};

function dateRangeWhere(from?: Date, to?: Date): Prisma.DateTimeFilter | undefined {
  const range: Prisma.DateTimeFilter = {};

  if (from) {
    range.gte = from;
  }

  if (to) {
    range.lte = to;
  }

  return Object.keys(range).length > 0 ? range : undefined;
}

function combineWhere<TWhere extends object>(...parts: TWhere[]): TWhere {
  const entries = parts.filter((part) => Object.keys(part).length > 0);
  return entries.length > 0 ? ({ AND: entries } as TWhere) : ({} as TWhere);
}

function sortByValueDesc(items: DashboardSeriesItem[]): DashboardSeriesItem[] {
  return [...items].sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));
}

export class DashboardMetricsService {
  public constructor(private readonly repository: DashboardRepository) {}

  public getReferenceData(workspaceId: string): Promise<DashboardReferenceData> {
    return this.repository.getReferenceData(workspaceId);
  }

  public async buildCrmMetrics(
    context: DashboardMetricContext,
    reference: DashboardReferenceData,
    now = new Date()
  ): Promise<CrmMetrics> {
    const activeWhere = this.buildItemWhere(context, reference, { activeOnly: true });
    const currentWhere = this.buildItemWhere(context, reference);
    const createdWhere = this.buildItemWhere(context, reference, { applyPeriodToCreatedAt: true });

    const [
      activeWorkItems,
      cardsByColumn,
      cardsByState,
      cardsByAssignee,
      overdueWorkItems,
      unassignedWorkItems,
      createdWorkItemsInPeriod
    ] = await Promise.all([
      this.repository.countItems(activeWhere),
      this.repository.groupItemsByColumn(activeWhere),
      this.repository.groupItemsByState(currentWhere),
      this.repository.groupItemsByAssignee(activeWhere),
      this.repository.countItems(combineWhere(activeWhere, { dueDate: { lt: now } })),
      this.repository.countItems(combineWhere(activeWhere, { assigneeId: null })),
      this.repository.countItems(createdWhere)
    ]);

    return {
      activeWorkItems,
      cardsByColumn: this.mapReferenceGroups(cardsByColumn, reference.columns, 'Sem etapa'),
      cardsByState: this.mapReferenceGroups(cardsByState, reference.states, 'Sem estado'),
      cardsByAssignee: sortByValueDesc(this.mapReferenceGroups(cardsByAssignee, reference.members, 'Sem responsavel')),
      overdueWorkItems,
      unassignedWorkItems,
      createdWorkItemsInPeriod
    };
  }

  public async buildAutomationMetrics(
    context: DashboardMetricContext,
    reference: DashboardReferenceData
  ): Promise<AutomationMetrics> {
    const runsWhere = this.buildAutomationRunWhere(context);
    const failedWhere = this.buildFailedAutomationRunWhere(context);
    const pendingApprovalWhere = this.buildPendingApprovalWhere(context);

    const [runsByStatus, failedRunsByWorkflow, pendingApprovals] = await Promise.all([
      this.repository.groupAutomationRunsByStatus(runsWhere),
      failedWhere ? this.repository.groupFailedAutomationRunsByWorkflow(failedWhere) : Promise.resolve([]),
      pendingApprovalWhere ? this.repository.countPendingAutomationApprovals(pendingApprovalWhere) : Promise.resolve(0)
    ]);

    return {
      runsByStatus: sortByValueDesc(this.mapAutomationStatusGroups(runsByStatus)),
      failedRunsByWorkflow: sortByValueDesc(
        this.mapReferenceGroups(failedRunsByWorkflow, reference.workflows, 'Workflow removido')
      ),
      pendingApprovals
    };
  }

  public buildAutomationFailuresTable(items: DashboardSeriesItem[]): { columns: DashboardTableColumn[]; rows: DashboardTableRow[] } {
    return {
      columns: [
        { key: 'workflow', label: 'Workflow' },
        { key: 'failures', label: 'Falhas' }
      ],
      rows: items.map((item) => ({
        workflow: item.label,
        failures: item.value
      }))
    };
  }

  private buildItemWhere(
    context: DashboardMetricContext,
    reference: DashboardReferenceData,
    options: { activeOnly?: boolean; applyPeriodToCreatedAt?: boolean } = {}
  ): Prisma.ItemWhereInput {
    const parts: Prisma.ItemWhereInput[] = [
      { workspaceId: context.workspaceId },
      this.buildItemVisibilityWhere(context.itemVisibility)
    ];

    if (context.filters.assigneeId) {
      parts.push({ assigneeId: context.filters.assigneeId });
    }

    if (context.filters.itemTypeId) {
      parts.push({ typeId: context.filters.itemTypeId });
    }

    if (context.filters.stateId) {
      parts.push({ stateId: context.filters.stateId });
    }

    if (context.filters.columnId) {
      parts.push({
        OR: [
          { boardColumnId: context.filters.columnId },
          { columnId: context.filters.columnId }
        ]
      });
    }

    if (options.activeOnly) {
      const terminalStateIds = reference.states.filter((state) => state.isTerminal).map((state) => state.id);
      if (terminalStateIds.length > 0) {
        parts.push({
          OR: [
            { stateId: null },
            { stateId: { notIn: terminalStateIds } }
          ]
        });
      }
    }

    if (options.applyPeriodToCreatedAt) {
      const createdAt = dateRangeWhere(context.filters.from, context.filters.to);
      if (createdAt) {
        parts.push({ createdAt });
      }
    }

    return combineWhere(...parts);
  }

  private buildItemVisibilityWhere(visibility: DashboardItemVisibility): Prisma.ItemWhereInput {
    const parts: Prisma.ItemWhereInput[] = [];

    if (visibility.ownCardsOnlyUserId) {
      parts.push({
        OR: [
          { assigneeId: visibility.ownCardsOnlyUserId },
          { createdBy: visibility.ownCardsOnlyUserId }
        ]
      });
    }

    if (visibility.clientCustomerIds && visibility.clientCustomerIds.length > 0) {
      parts.push({
        OR: visibility.clientCustomerIds.flatMap((customerId) => [
          {
            fields: {
              path: ['customerId'],
              equals: customerId
            }
          },
          {
            metadata: {
              path: ['customerId'],
              equals: customerId
            }
          },
          {
            customFieldValues: {
              some: {
                field: {
                  slug: 'customerId'
                },
                value: {
                  equals: customerId as Prisma.InputJsonValue
                }
              }
            }
          }
        ])
      });
    }

    return combineWhere(...parts);
  }

  private buildAutomationRunWhere(context: DashboardMetricContext): Prisma.AutomationRunWhereInput {
    const createdAt = dateRangeWhere(context.filters.from, context.filters.to);

    return {
      workspaceId: context.workspaceId,
      ...(context.filters.workflowId ? { workflowId: context.filters.workflowId } : {}),
      ...(context.filters.status ? { status: context.filters.status } : {}),
      ...(createdAt ? { createdAt } : {})
    };
  }

  private buildFailedAutomationRunWhere(context: DashboardMetricContext): Prisma.AutomationRunWhereInput | null {
    if (context.filters.status && context.filters.status !== 'failed') {
      return null;
    }

    const createdAt = dateRangeWhere(context.filters.from, context.filters.to);
    return {
      workspaceId: context.workspaceId,
      status: 'failed',
      ...(context.filters.workflowId ? { workflowId: context.filters.workflowId } : {}),
      ...(createdAt ? { createdAt } : {})
    };
  }

  private buildPendingApprovalWhere(context: DashboardMetricContext): Prisma.AutomationApprovalRequestWhereInput | null {
    if (context.filters.status && context.filters.status !== 'pending') {
      return null;
    }

    const requestedAt = dateRangeWhere(context.filters.from, context.filters.to);
    return {
      workspaceId: context.workspaceId,
      status: 'pending',
      ...(context.filters.workflowId ? { run: { workflowId: context.filters.workflowId } } : {}),
      ...(requestedAt ? { requestedAt } : {})
    };
  }

  private mapReferenceGroups(
    groups: Array<ItemGroupCount | AutomationGroupCount>,
    references: Array<{ id: string; name: string; color?: string | null }>,
    nullLabel: string
  ): DashboardSeriesItem[] {
    const counts = new Map(groups.map((group) => [group.key, group.count]));
    const referenceIds = new Set(references.map((reference) => reference.id));
    const known = references.map((reference) => ({
      id: reference.id,
      label: reference.name,
      value: counts.get(reference.id) ?? 0,
      color: reference.color ?? null
    }));
    const unknown = groups
      .filter((group) => group.key !== null && !referenceIds.has(group.key))
      .map((group) => ({
        id: group.key,
        label: 'Nao encontrado',
        value: group.count,
        color: null
      }));
    const nullCount = counts.get(null);

    return [
      ...known,
      ...unknown,
      ...(nullCount ? [{ id: null, label: nullLabel, value: nullCount, color: null }] : [])
    ];
  }

  private mapAutomationStatusGroups(groups: AutomationGroupCount[]): DashboardSeriesItem[] {
    return groups.map((group) => ({
      id: group.key,
      label: group.key ?? 'Sem status',
      value: group.count,
      color: null
    }));
  }
}
