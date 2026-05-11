export interface WorkspaceWorkItemsFilters {
  perspectiveId?: string;
  workflowStateId?: string;
  search?: string;
  assigneeId?: string;
  dateFrom?: string;
  dateTo?: string;
  customFields?: Record<string, string | number | boolean | null | undefined>;
}

export interface WorkspaceAuditLogFilters {
  entityType?: string;
  entityId?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  cursor?: string;
  limit?: number;
}

export interface NormalizedWorkspaceWorkItemsFilters {
  perspectiveId?: string;
  workflowStateId?: string;
  search?: string;
  assigneeId?: string;
  dateFrom?: string;
  dateTo?: string;
  customFields: Record<string, string | number | boolean | null>;
}

function cleanRecord<TValue>(record: Record<string, TValue | undefined> | undefined): Record<string, TValue> {
  return Object.fromEntries(
    Object.entries(record ?? {}).filter(([, value]) => value !== undefined && value !== "")
  ) as Record<string, TValue>;
}

export function normalizeWorkspaceWorkItemsFilters(filters?: WorkspaceWorkItemsFilters): NormalizedWorkspaceWorkItemsFilters {
  return {
    ...cleanRecord<string>({
      perspectiveId: filters?.perspectiveId,
      workflowStateId: filters?.workflowStateId,
      search: filters?.search?.trim(),
      assigneeId: filters?.assigneeId,
      dateFrom: filters?.dateFrom,
      dateTo: filters?.dateTo
    }),
    customFields: cleanRecord<string | number | boolean | null>(filters?.customFields)
  };
}

export function normalizeWorkspaceAuditLogFilters(filters?: WorkspaceAuditLogFilters) {
  return cleanRecord({
    entityType: filters?.entityType,
    entityId: filters?.entityId,
    action: filters?.action,
    dateFrom: filters?.dateFrom,
    dateTo: filters?.dateTo,
    cursor: filters?.cursor,
    limit: filters?.limit
  });
}

export const workspaceQueryKeys = {
  all: ["workspace-platform"] as const,
  workspaceList: () => [...workspaceQueryKeys.all, "directory"] as const,
  workspaceTemplates: () => [...workspaceQueryKeys.all, "template-catalog"] as const,
  workspace: (workspaceId: string) => [...workspaceQueryKeys.all, workspaceId] as const,
  workspaceSnapshot: (workspaceId: string) => [...workspaceQueryKeys.workspace(workspaceId), "snapshot"] as const,
  workspaceBoards: (workspaceId: string) => [...workspaceQueryKeys.workspace(workspaceId), "boards"] as const,
  workspaceWorkItems: (workspaceId: string, filters?: WorkspaceWorkItemsFilters) =>
    [...workspaceQueryKeys.workspace(workspaceId), "work-items", normalizeWorkspaceWorkItemsFilters(filters)] as const,
  workspaceWorkflowStates: (workspaceId: string) => [...workspaceQueryKeys.workspace(workspaceId), "workflow-states"] as const,
  workspaceFieldSchemas: (workspaceId: string) => [...workspaceQueryKeys.workspace(workspaceId), "field-schemas"] as const,
  workspaceAuditLog: (workspaceId: string, filters?: WorkspaceAuditLogFilters) =>
    [...workspaceQueryKeys.workspace(workspaceId), "audit-log", normalizeWorkspaceAuditLogFilters(filters)] as const
};
