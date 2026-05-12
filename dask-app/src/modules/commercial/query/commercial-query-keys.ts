import type { CommercialWorkItemFilters, CustomerListFilters } from "@/modules/commercial/model/types";

function cleanRecord<TValue>(
  record: Record<string, TValue | undefined | null | ""> | undefined
): Record<string, TValue> {
  return Object.fromEntries(
    Object.entries(record ?? {}).filter(([, value]) => value !== undefined && value !== null && value !== "")
  ) as Record<string, TValue>;
}

export function normalizeCommercialWorkItemFilters(filters?: CommercialWorkItemFilters) {
  return cleanRecord<string | number | boolean>({
    search: filters?.search?.trim(),
    workflowStateId: filters?.workflowStateId,
    source: filters?.source?.trim(),
    responsibleId: filters?.responsibleId,
    customerId: filters?.customerId,
    converted: filters?.converted,
    createdAtFrom: filters?.createdAtFrom,
    createdAtTo: filters?.createdAtTo,
    updatedAtFrom: filters?.updatedAtFrom,
    updatedAtTo: filters?.updatedAtTo,
    sort: filters?.sort,
    limit: filters?.limit
  });
}

export function normalizeCustomerFilters(filters?: CustomerListFilters) {
  return cleanRecord<string | number>({
    search: filters?.search?.trim(),
    status: filters?.status,
    limit: filters?.limit
  });
}

export const commercialQueryKeys = {
  all: ["commercial"] as const,
  workspace: (workspaceId: string) => [...commercialQueryKeys.all, workspaceId] as const,
  overview: (workspaceId: string, filters?: CommercialWorkItemFilters) =>
    [...commercialQueryKeys.workspace(workspaceId), "overview", normalizeCommercialWorkItemFilters(filters)] as const,
  commercial: (workspaceId: string, filters?: CommercialWorkItemFilters & { workItemType?: string | null }) =>
    [...commercialQueryKeys.workspace(workspaceId), "items", filters?.workItemType ?? "workItem", normalizeCommercialWorkItemFilters(filters)] as const,
  workItem: (workspaceId: string, workItemId: string) =>
    [...commercialQueryKeys.workspace(workspaceId), "items", workItemId] as const,
  signals: (workspaceId: string, filters?: CommercialWorkItemFilters & { workItemType?: string | null }) =>
    [...commercialQueryKeys.workspace(workspaceId), "signals", filters?.workItemType ?? "signal", normalizeCommercialWorkItemFilters(filters)] as const,
  customers: (workspaceId: string, filters?: CustomerListFilters) =>
    [...commercialQueryKeys.workspace(workspaceId), "customers", normalizeCustomerFilters(filters)] as const,
  customerLookup: (workspaceId: string, filters?: CustomerListFilters) =>
    [...commercialQueryKeys.workspace(workspaceId), "customer-lookup", normalizeCustomerFilters(filters)] as const,
  customer: (workspaceId: string, customerId: string) =>
    [...commercialQueryKeys.workspace(workspaceId), "customers", customerId] as const,
  flow: (workspaceId: string, filters?: CommercialWorkItemFilters) =>
    [...commercialQueryKeys.workspace(workspaceId), "flow", normalizeCommercialWorkItemFilters(filters)] as const,
  transformations: (workspaceId: string) =>
    [...commercialQueryKeys.workspace(workspaceId), "transformations"] as const,
  duplicates: (workspaceId: string, payload: Record<string, unknown>) =>
    [...commercialQueryKeys.workspace(workspaceId), "duplicates", payload] as const
};
