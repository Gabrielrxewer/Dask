import type {
  DashboardFilter,
  DashboardRefreshPolicy,
  DashboardSeriesItem,
  DashboardTableColumn,
  DashboardTableRow,
  DashboardWidget
} from '@/modules/dashboard/dashboard.types';
import { DashboardFiltersService } from '@/modules/dashboard/dashboard-filters-service';

type CrmWidgetInput = {
  activeWorkItems: number;
  cardsByColumn: DashboardSeriesItem[];
  cardsByState: DashboardSeriesItem[];
  cardsByAssignee: DashboardSeriesItem[];
  overdueWorkItems: number;
  unassignedWorkItems: number;
  createdWorkItemsInPeriod: number;
};

type AutomationWidgetInput = {
  runsByStatus: DashboardSeriesItem[];
  failedRunsByWorkflow: DashboardSeriesItem[];
  failedRunsTable: { columns: DashboardTableColumn[]; rows: DashboardTableRow[] };
  pendingApprovals: number;
};

const manualRefresh: DashboardRefreshPolicy = {
  strategy: 'manual'
};

const realtimeRefresh: DashboardRefreshPolicy = {
  strategy: 'realtime',
  ttlSeconds: 30
};

export class DashboardWidgetsService {
  public constructor(private readonly filtersService = new DashboardFiltersService()) {}

  public buildCrmWidgets(input: CrmWidgetInput, filters: Parameters<DashboardFiltersService['toWidgetFilters']>[0]): DashboardWidget[] {
    const currentFilters = this.filtersService.toWidgetFilters(filters, ['assigneeId', 'itemTypeId', 'stateId', 'columnId']);
    const periodFilters = this.filtersService.toWidgetFilters(filters, ['from', 'to', 'assigneeId', 'itemTypeId', 'stateId', 'columnId']);

    return [
      this.kpiWidget({
        id: 'active-work-items',
        title: 'Cards ativos',
        description: 'Cards em estados nao terminais no workspace.',
        metricKey: 'crm.activeWorkItems',
        value: input.activeWorkItems,
        filters: currentFilters
      }),
      this.seriesWidget({
        id: 'cards-by-column',
        type: 'bar',
        title: 'Cards por etapa',
        description: 'Distribuicao atual de cards ativos por coluna do Kanban.',
        metricKey: 'crm.cardsByColumn',
        items: input.cardsByColumn,
        filters: currentFilters
      }),
      this.seriesWidget({
        id: 'commercial-funnel',
        type: 'funnel',
        title: 'Funil operacional',
        description: 'Volume de cards ativos por etapa do fluxo comercial/operacional.',
        metricKey: 'crm.commercialFunnel',
        items: input.cardsByColumn,
        filters: currentFilters
      }),
      this.seriesWidget({
        id: 'cards-by-state',
        type: 'pie',
        title: 'Cards por estado',
        description: 'Distribuicao atual por estado de workflow.',
        metricKey: 'crm.cardsByState',
        items: input.cardsByState,
        filters: this.filtersService.toWidgetFilters(filters, ['assigneeId', 'itemTypeId', 'stateId'])
      }),
      this.seriesWidget({
        id: 'cards-by-assignee',
        type: 'bar',
        title: 'Cards por responsavel',
        description: 'Carga atual de cards ativos por membro.',
        metricKey: 'crm.cardsByAssignee',
        items: input.cardsByAssignee,
        filters: this.filtersService.toWidgetFilters(filters, ['assigneeId', 'itemTypeId', 'stateId', 'columnId'])
      }),
      this.kpiWidget({
        id: 'overdue-work-items',
        title: 'Cards vencidos',
        description: 'Cards ativos com prazo anterior a data atual.',
        metricKey: 'crm.overdueWorkItems',
        value: input.overdueWorkItems,
        filters: currentFilters
      }),
      this.kpiWidget({
        id: 'unassigned-work-items',
        title: 'Sem responsavel',
        description: 'Cards ativos sem responsavel definido.',
        metricKey: 'crm.unassignedWorkItems',
        value: input.unassignedWorkItems,
        filters: currentFilters
      }),
      this.kpiWidget({
        id: 'created-work-items-in-period',
        title: 'Criados no periodo',
        description: 'Cards criados dentro do periodo filtrado.',
        metricKey: 'crm.createdWorkItemsInPeriod',
        value: input.createdWorkItemsInPeriod,
        filters: periodFilters
      }),
      this.unavailableWidget({
        id: 'completed-work-items-in-period',
        type: 'kpi',
        title: 'Concluidos no periodo',
        metricKey: 'crm.completedWorkItemsInPeriod',
        reason: 'O schema atual nao possui completedAt nem read model indexado de transicao terminal por workspace.'
      }),
      this.unavailableWidget({
        id: 'average-aging-by-stage',
        type: 'table',
        title: 'Aging medio por etapa',
        metricKey: 'crm.averageAgingByStage',
        reason: 'O schema atual nao registra data confiavel de entrada em cada coluna/estado.'
      })
    ];
  }

  public buildAutomationWidgets(input: AutomationWidgetInput, filters: Parameters<DashboardFiltersService['toWidgetFilters']>[0]): DashboardWidget[] {
    const automationFilters = this.filtersService.toWidgetFilters(filters, ['from', 'to', 'workflowId', 'status']);
    const failureFilters = this.filtersService.toWidgetFilters(filters, ['from', 'to', 'workflowId']);

    return [
      this.seriesWidget({
        id: 'automation-runs-by-status',
        type: 'bar',
        title: 'Execucoes por status',
        description: 'Runs de automacao agrupados por status no periodo.',
        metricKey: 'automation.runsByStatus',
        items: input.runsByStatus,
        filters: automationFilters
      }),
      {
        id: 'automation-failures-by-workflow',
        type: 'table',
        title: 'Falhas por workflow',
        description: 'Workflows com runs em falha no periodo filtrado.',
        metricKey: 'automation.failuresByWorkflow',
        data: input.failedRunsTable,
        filters: failureFilters,
        refreshPolicy: realtimeRefresh
      },
      this.kpiWidget({
        id: 'pending-human-approvals',
        title: 'Aprovacoes pendentes',
        description: 'Solicitacoes de aprovacao humana ainda pendentes.',
        metricKey: 'automation.pendingHumanApprovals',
        value: input.pendingApprovals,
        filters: this.filtersService.toWidgetFilters(filters, ['from', 'to', 'workflowId', 'status'])
      })
    ];
  }

  private kpiWidget(input: {
    id: string;
    title: string;
    description: string;
    metricKey: string;
    value: number;
    filters: DashboardFilter[];
  }): DashboardWidget {
    return {
      id: input.id,
      type: 'kpi',
      title: input.title,
      description: input.description,
      metricKey: input.metricKey,
      data: {
        value: input.value
      },
      filters: input.filters,
      refreshPolicy: realtimeRefresh
    };
  }

  private seriesWidget(input: {
    id: string;
    type: 'bar' | 'pie' | 'funnel' | 'line';
    title: string;
    description: string;
    metricKey: string;
    items: DashboardSeriesItem[];
    filters: DashboardFilter[];
  }): DashboardWidget {
    return {
      id: input.id,
      type: input.type,
      title: input.title,
      description: input.description,
      metricKey: input.metricKey,
      data: {
        items: input.items
      },
      filters: input.filters,
      refreshPolicy: realtimeRefresh
    };
  }

  private unavailableWidget(input: {
    id: string;
    type: DashboardWidget['type'];
    title: string;
    metricKey: string;
    reason: string;
  }): DashboardWidget {
    return {
      id: input.id,
      type: input.type,
      title: input.title,
      metricKey: input.metricKey,
      data: {
        unavailable: true,
        reason: input.reason
      },
      refreshPolicy: manualRefresh,
      status: 'unavailable',
      unavailableReason: input.reason
    };
  }
}
