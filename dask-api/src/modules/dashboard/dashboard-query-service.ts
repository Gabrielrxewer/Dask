import type { PrismaClient } from '@prisma/client';
import {
  requireClientCustomerScope,
  resolveCustomerAccessScope
} from '@/modules/workspace-platform/application/customer-access-scope';
import type { WorkspaceConfigService } from '@/modules/workspace-platform/application/workspace-config-service';
import type {
  DashboardItemVisibility,
  DashboardResponse,
  DashboardScope,
  DashboardWidget
} from '@/modules/dashboard/dashboard.types';
import type { DashboardFiltersService } from '@/modules/dashboard/dashboard-filters-service';
import type { DashboardMetricsService } from '@/modules/dashboard/dashboard-metrics-service';
import type { DashboardWidgetsService } from '@/modules/dashboard/dashboard-widgets-service';

export class DashboardQueryService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly workspaceConfigService: WorkspaceConfigService,
    private readonly filtersService: DashboardFiltersService,
    private readonly metricsService: DashboardMetricsService,
    private readonly widgetsService: DashboardWidgetsService
  ) {}

  public async getOverview(input: {
    workspaceId: string;
    userId: string;
    query: unknown;
    includeAutomation: boolean;
  }): Promise<DashboardResponse> {
    return this.buildDashboardResponse({
      ...input,
      scope: 'overview',
      includeCrm: true,
      includeAutomation: input.includeAutomation
    });
  }

  public async getCrm(input: {
    workspaceId: string;
    userId: string;
    query: unknown;
  }): Promise<DashboardResponse> {
    return this.buildDashboardResponse({
      ...input,
      scope: 'crm',
      includeCrm: true,
      includeAutomation: false
    });
  }

  public async getAutomation(input: {
    workspaceId: string;
    userId: string;
    query: unknown;
  }): Promise<DashboardResponse> {
    return this.buildDashboardResponse({
      ...input,
      scope: 'automation',
      includeCrm: false,
      includeAutomation: true
    });
  }

  public async getWidgets(input: {
    workspaceId: string;
    userId: string;
    query: unknown;
    includeAutomation: boolean;
  }): Promise<DashboardResponse> {
    return this.getOverview(input);
  }

  private async buildDashboardResponse(input: {
    workspaceId: string;
    userId: string;
    query: unknown;
    scope: DashboardScope;
    includeCrm: boolean;
    includeAutomation: boolean;
  }): Promise<DashboardResponse> {
    const filters = this.filtersService.parse(input.query);
    const [access, customerScope] = await Promise.all([
      this.workspaceConfigService.ensureReadableWorkspace(input.workspaceId, input.userId),
      resolveCustomerAccessScope(this.prisma, {
        workspaceId: input.workspaceId,
        userId: input.userId
      })
    ]);
    const reference = await this.metricsService.getReferenceData(input.workspaceId);
    const itemVisibility: DashboardItemVisibility = {
      ...(access.ownCardsOnly && !customerScope.isClient ? { ownCardsOnlyUserId: input.userId } : {}),
      ...(customerScope.isClient ? { clientCustomerIds: requireClientCustomerScope(customerScope) } : {})
    };
    const context = {
      workspaceId: input.workspaceId,
      filters,
      itemVisibility
    };
    const widgets: DashboardWidget[] = [];

    if (input.includeCrm) {
      const crmMetrics = await this.metricsService.buildCrmMetrics(context, reference);
      widgets.push(...this.widgetsService.buildCrmWidgets(crmMetrics, filters));
    }

    if (input.includeAutomation) {
      const automationMetrics = await this.metricsService.buildAutomationMetrics(context, reference);
      widgets.push(...this.widgetsService.buildAutomationWidgets({
        ...automationMetrics,
        failedRunsTable: this.metricsService.buildAutomationFailuresTable(automationMetrics.failedRunsByWorkflow)
      }, filters));
    }

    return {
      workspaceId: input.workspaceId,
      generatedAt: new Date().toISOString(),
      scope: input.scope,
      filters: this.filtersService.serialize(filters),
      widgets
    };
  }
}
