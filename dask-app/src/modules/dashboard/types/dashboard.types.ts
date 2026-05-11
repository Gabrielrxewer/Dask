export type DashboardWidgetType = "kpi" | "bar" | "line" | "table" | "funnel" | "pie";
export type DashboardWidgetStatus = "ready" | "unavailable";
export type DashboardScope = "overview" | "crm" | "automation";

export type DashboardFilterKey =
  | "from"
  | "to"
  | "assigneeId"
  | "itemTypeId"
  | "stateId"
  | "columnId"
  | "workflowId"
  | "status";

export interface DashboardFilter {
  key: DashboardFilterKey;
  label: string;
  value: string;
}

export interface DashboardFilters {
  from?: string;
  to?: string;
  assigneeId?: string;
  itemTypeId?: string;
  stateId?: string;
  columnId?: string;
  workflowId?: string;
  status?: string;
}

export interface DashboardWidget {
  id: string;
  type: DashboardWidgetType;
  title: string;
  description?: string;
  metricKey: string;
  data: unknown;
  filters?: DashboardFilter[];
  refreshPolicy?: {
    strategy: "realtime" | "cached" | "manual";
    ttlSeconds?: number;
  };
  status?: DashboardWidgetStatus;
  unavailableReason?: string;
}

export interface DashboardResponse {
  workspaceId: string;
  generatedAt: string;
  scope: DashboardScope;
  filters: DashboardFilters;
  widgets: DashboardWidget[];
}

export interface DashboardSeriesItem {
  id?: string | null;
  label: string;
  value: number;
  color?: string | null;
}

export interface DashboardSeriesData {
  items: DashboardSeriesItem[];
}

export interface DashboardKpiData {
  value: number;
  unit?: string;
}

export interface DashboardTableColumn {
  key: string;
  label: string;
}

export type DashboardTableRow = Record<string, string | number | null>;

export interface DashboardTableData {
  columns: DashboardTableColumn[];
  rows: DashboardTableRow[];
}

export interface DashboardUnavailableData {
  unavailable: true;
  reason: string;
}

export interface DashboardFilterOptions {
  members: Array<{ id: string; label: string }>;
  itemTypes: Array<{ id: string; label: string }>;
  states: Array<{ id: string; label: string }>;
  columns: Array<{ id: string; label: string }>;
  workflows: Array<{ id: string; label: string }>;
  automationStatuses: Array<{ id: string; label: string }>;
}
