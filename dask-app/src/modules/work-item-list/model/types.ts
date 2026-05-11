import type { BoardConfig, TaskFieldDefinition } from "@/entities/task";
import type { ListWorkItemsInput, WorkItemsPage, WorkspacePreferences } from "@/modules/workspace";

export const WORK_ITEM_LIST_CONFIG_SCHEMA_VERSION = 1;
export const WORK_ITEM_LIST_CONFIG_SETTINGS_KEY = "workItemListConfigsByType";

export type WorkItemListDensity = "comfortable" | "compact";
export type WorkItemListColumnPinned = "left" | "right" | false;
export type WorkItemListColumnAlign = "left" | "center" | "right";
export type WorkItemListColumnType =
  | "title"
  | "type"
  | "status"
  | "assignee"
  | "dueDate"
  | "progress"
  | "customer"
  | "field"
  | "actions";

export interface WorkItemListColumnConfig {
  id: string;
  fieldKey: string;
  fieldId?: string;
  label: string;
  type: WorkItemListColumnType | TaskFieldDefinition["type"];
  visible: boolean;
  pinned?: WorkItemListColumnPinned;
  width?: number;
  minWidth?: number;
  sortable?: boolean;
  filterable?: boolean;
  editableInline?: boolean;
  required?: boolean;
  order: number;
  cellRenderer?: string;
  align?: WorkItemListColumnAlign;
  format?: string;
  permissions?: Record<string, unknown>;
}

export interface WorkItemListMobileCardLayout {
  titleField: string;
  subtitleFields: string[];
  badgeFields: string[];
  primaryMetaFields: string[];
  secondaryMetaFields: string[];
  actions: string[];
}

export interface WorkItemListConfig {
  id: string;
  workspaceId: string;
  workItemTypeId: string;
  schemaVersion: typeof WORK_ITEM_LIST_CONFIG_SCHEMA_VERSION;
  name: string;
  columns: WorkItemListColumnConfig[];
  defaultSort: Pick<WorkItemListParams, "sortBy" | "sortDirection">;
  defaultFilters: Partial<WorkItemListParams>;
  density: WorkItemListDensity;
  rowActions: string[];
  bulkActions: string[];
  mobileCardLayout: WorkItemListMobileCardLayout;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string | null;
}

export type WorkItemListParams = ListWorkItemsInput & {
  page: number;
  pageSize: number;
};

export interface WorkItemListConfigBuildInput {
  workspaceId: string;
  workItemTypeId: string;
  boardConfig: BoardConfig;
  settings?: WorkspacePreferences["settings"];
}

export type WorkItemListConfigsByType = Record<string, WorkItemListConfig>;
export type WorkItemListPage = WorkItemsPage;
