import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  AutomationGroupCount,
  DashboardReferenceData,
  DashboardRepository,
  ItemGroupCount
} from '@/modules/dashboard/dashboard.types';

export class PrismaDashboardRepository implements DashboardRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async getReferenceData(workspaceId: string): Promise<DashboardReferenceData> {
    const [columns, states, itemTypes, members, workflows] = await Promise.all([
      this.prisma.boardColumn.findMany({
        where: { workspaceId, isActive: true },
        select: { id: true, name: true, slug: true },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
      }),
      this.prisma.workflowState.findMany({
        where: { workspaceId, isActive: true },
        select: { id: true, name: true, slug: true, color: true, isTerminal: true },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
      }),
      this.prisma.workItemType.findMany({
        where: { workspaceId, isActive: true },
        select: { id: true, name: true, slug: true, color: true },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }]
      }),
      this.prisma.workspaceMembership.findMany({
        where: { workspaceId },
        select: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      }),
      this.prisma.automationWorkflow.findMany({
        where: { workspaceId },
        select: { id: true, name: true, status: true },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }]
      })
    ]);

    return {
      columns: columns.map((column) => ({
        ...column,
        color: null
      })),
      states,
      itemTypes,
      members: members.map((membership) => membership.user),
      workflows
    };
  }

  public countItems(where: Prisma.ItemWhereInput): Promise<number> {
    return this.prisma.item.count({ where });
  }

  public async groupItemsByColumn(where: Prisma.ItemWhereInput): Promise<ItemGroupCount[]> {
    const rows = await this.prisma.item.groupBy({
      by: ['boardColumnId'],
      where,
      _count: { _all: true }
    });

    return rows.map((row) => ({
      key: row.boardColumnId,
      count: row._count._all
    }));
  }

  public async groupItemsByState(where: Prisma.ItemWhereInput): Promise<ItemGroupCount[]> {
    const rows = await this.prisma.item.groupBy({
      by: ['stateId'],
      where,
      _count: { _all: true }
    });

    return rows.map((row) => ({
      key: row.stateId,
      count: row._count._all
    }));
  }

  public async groupItemsByAssignee(where: Prisma.ItemWhereInput): Promise<ItemGroupCount[]> {
    const rows = await this.prisma.item.groupBy({
      by: ['assigneeId'],
      where,
      _count: { _all: true }
    });

    return rows.map((row) => ({
      key: row.assigneeId,
      count: row._count._all
    }));
  }

  public countAutomationRuns(where: Prisma.AutomationRunWhereInput): Promise<number> {
    return this.prisma.automationRun.count({ where });
  }

  public async groupAutomationRunsByStatus(where: Prisma.AutomationRunWhereInput): Promise<AutomationGroupCount[]> {
    const rows = await this.prisma.automationRun.groupBy({
      by: ['status'],
      where,
      _count: { _all: true }
    });

    return rows.map((row) => ({
      key: row.status,
      count: row._count._all
    }));
  }

  public async groupFailedAutomationRunsByWorkflow(
    where: Prisma.AutomationRunWhereInput
  ): Promise<AutomationGroupCount[]> {
    const rows = await this.prisma.automationRun.groupBy({
      by: ['workflowId'],
      where,
      _count: { _all: true }
    });

    return rows.map((row) => ({
      key: row.workflowId,
      count: row._count._all
    }));
  }

  public countPendingAutomationApprovals(where: Prisma.AutomationApprovalRequestWhereInput): Promise<number> {
    return this.prisma.automationApprovalRequest.count({ where });
  }
}
