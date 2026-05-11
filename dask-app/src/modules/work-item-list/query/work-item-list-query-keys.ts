import type { WorkItemListParams } from "@/modules/work-item-list/model/types";

function cleanRecord<TValue>(
  record: Record<string, TValue | undefined | null | ""> | undefined
): Record<string, TValue> {
  return Object.fromEntries(
    Object.entries(record ?? {}).filter(([, value]) => value !== undefined && value !== null && value !== "")
  ) as Record<string, TValue>;
}

export function normalizeWorkItemListParams(params?: Partial<WorkItemListParams>) {
  return {
    ...cleanRecord<string | number | boolean>({
      page: params?.page,
      pageSize: params?.pageSize,
      perspectiveId: params?.perspectiveId,
      workItemTypeId: params?.workItemTypeId,
      typeSlug: params?.typeSlug,
      workflowStateId: params?.workflowStateId,
      stateSlug: params?.stateSlug,
      assigneeId: params?.assigneeId,
      assignedToMe: params?.assignedToMe,
      search: params?.search?.trim(),
      dueDateFrom: params?.dueDateFrom,
      dueDateTo: params?.dueDateTo,
      plannedStartFrom: params?.plannedStartFrom,
      plannedStartTo: params?.plannedStartTo,
      createdAtFrom: params?.createdAtFrom,
      createdAtTo: params?.createdAtTo,
      updatedAtFrom: params?.updatedAtFrom,
      updatedAtTo: params?.updatedAtTo,
      source: params?.source,
      customerId: params?.customerId,
      converted: params?.converted,
      sortBy: params?.sortBy,
      sortDirection: params?.sortDirection,
      sort: params?.sort
    }),
    workflowStateIds: params?.workflowStateIds?.filter(Boolean) ?? [],
    customFieldFilters: params?.customFieldFilters ?? []
  };
}

export const workItemListQueryKeys = {
  all: ["work-item-list"] as const,
  workspace: (workspaceId: string) => [...workItemListQueryKeys.all, workspaceId] as const,
  lists: (workspaceId: string) => [...workItemListQueryKeys.workspace(workspaceId), "list"] as const,
  list: (workspaceId: string, params?: Partial<WorkItemListParams>) =>
    [...workItemListQueryKeys.lists(workspaceId), normalizeWorkItemListParams(params)] as const,
  config: (workspaceId: string, workItemTypeId: string) =>
    [...workItemListQueryKeys.workspace(workspaceId), "config", workItemTypeId] as const,
  columns: (workspaceId: string, workItemTypeId: string) =>
    [...workItemListQueryKeys.workspace(workspaceId), "columns", workItemTypeId] as const,
  facets: (workspaceId: string, params?: Partial<WorkItemListParams>) =>
    [...workItemListQueryKeys.workspace(workspaceId), "facets", normalizeWorkItemListParams(params)] as const
};
