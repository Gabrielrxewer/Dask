import type { Prisma } from '@prisma/client';

export type DashboardWidgetType = 'kpi' | 'bar' | 'line' | 'table' | 'funnel' | 'pie';
export type DashboardRefreshStrategy = 'realtime' | 'cached' | 'manual';
export type DashboardWidgetStatus = 'ready' | 'unavailable';
export type DashboardScope = 'overview' | 'crm' | 'automation';

export type DashboardFilter = {
  key: 'from' | 'to' | 'assigneeId' | 'itemTypeId' | 'stateId' | 'columnId' | 'workflowId' | 'status';
  label: string;
  value: string;
};

export type DashboardFilters = {
  from?: Date;
  to?: Date;
  assigneeId?: string;
  itemTypeId?: string;
  stateId?: string;
  columnId?: string;
  workflowId?: string;
  status?: string;
};

export type SerializedDashboardFilters = {
  from?: string;
  to?: string;
  assigneeId?: string;
  itemTypeId?: string;
  stateId?: string;
  columnId?: string;
  workflowId?: string;
  status?: string;
};

export type DashboardRefreshPolicy = {
  strategy: DashboardRefreshStrategy;
  ttlSeconds?: number;
};

export type DashboardWidget = {
  id: string;
  type: DashboardWidgetType;
  title: string;
  description?: string;
  metricKey: string;
  data: unknown;
  filters?: DashboardFilter[];
  refreshPolicy?: DashboardRefreshPolicy;
  status?: DashboardWidgetStatus;
  unavailableReason?: string;
};

export type DashboardResponse = {
  workspaceId: string;
  generatedAt: string;
  scope: DashboardScope;
  filters: SerializedDashboardFilters;
  widgets: DashboardWidget[];
};

export type DashboardSeriesItem = {
  id?: string | null;
  label: string;
  value: number;
  color?: string | null;
};

export type DashboardTableColumn = {
  key: string;
  label: string;
};

export type DashboardTableRow = Record<string, string | number | null>;

export type DashboardReferenceData = {
  columns: Array<{ id: string; name: string; slug: string; color?: string | null }>;
  states: Array<{ id: string; name: string; slug: string; color: string; isTerminal: boolean }>;
  itemTypes: Array<{ id: string; name: string; slug: string; color: string }>;
  members: Array<{ id: string; name: string; email?: string | null }>;
  workflows: Array<{ id: string; name: string; status: string }>;
};

export type DashboardItemVisibility = {
  ownCardsOnlyUserId?: string;
  clientCustomerIds?: string[];
};

export type DashboardMetricContext = {
  workspaceId: string;
  filters: DashboardFilters;
  itemVisibility: DashboardItemVisibility;
};

export type ItemGroupKey = 'boardColumnId' | 'stateId' | 'assigneeId';

export type ItemGroupCount = {
  key: string | null;
  count: number;
};

export type AutomationGroupCount = {
  key: string | null;
  count: number;
};

export type DashboardRepository = {
  getReferenceData(workspaceId: string): Promise<DashboardReferenceData>;
  countItems(where: Prisma.ItemWhereInput): Promise<number>;
  groupItemsByColumn(where: Prisma.ItemWhereInput): Promise<ItemGroupCount[]>;
  groupItemsByState(where: Prisma.ItemWhereInput): Promise<ItemGroupCount[]>;
  groupItemsByAssignee(where: Prisma.ItemWhereInput): Promise<ItemGroupCount[]>;
  countAutomationRuns(where: Prisma.AutomationRunWhereInput): Promise<number>;
  groupAutomationRunsByStatus(where: Prisma.AutomationRunWhereInput): Promise<AutomationGroupCount[]>;
  groupFailedAutomationRunsByWorkflow(where: Prisma.AutomationRunWhereInput): Promise<AutomationGroupCount[]>;
  countPendingAutomationApprovals(where: Prisma.AutomationApprovalRequestWhereInput): Promise<number>;
};
