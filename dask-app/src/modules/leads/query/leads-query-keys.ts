import type { CommercialWorkItemFilters, CustomerListFilters } from "@/modules/leads/model/types";

function cleanRecord<TValue>(
  record: Record<string, TValue | undefined | null | ""> | undefined
): Record<string, TValue> {
  return Object.fromEntries(
    Object.entries(record ?? {}).filter(([, value]) => value !== undefined && value !== null && value !== "")
  ) as Record<string, TValue>;
}

export function normalizeLeadFilters(filters?: CommercialWorkItemFilters) {
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

export const leadsQueryKeys = {
  all: ["leads"] as const,
  workspace: (workspaceId: string) => [...leadsQueryKeys.all, workspaceId] as const,
  overview: (workspaceId: string, filters?: CommercialWorkItemFilters) =>
    [...leadsQueryKeys.workspace(workspaceId), "overview", normalizeLeadFilters(filters)] as const,
  leads: (workspaceId: string, filters?: CommercialWorkItemFilters & { workItemType?: string | null }) =>
    [...leadsQueryKeys.workspace(workspaceId), "items", filters?.workItemType ?? "lead", normalizeLeadFilters(filters)] as const,
  lead: (workspaceId: string, workItemId: string) =>
    [...leadsQueryKeys.workspace(workspaceId), "items", workItemId] as const,
  signals: (workspaceId: string, filters?: CommercialWorkItemFilters & { workItemType?: string | null }) =>
    [...leadsQueryKeys.workspace(workspaceId), "signals", filters?.workItemType ?? "signal", normalizeLeadFilters(filters)] as const,
  customers: (workspaceId: string, filters?: CustomerListFilters) =>
    [...leadsQueryKeys.workspace(workspaceId), "customers", normalizeCustomerFilters(filters)] as const,
  customerLookup: (workspaceId: string, filters?: CustomerListFilters) =>
    [...leadsQueryKeys.workspace(workspaceId), "customer-lookup", normalizeCustomerFilters(filters)] as const,
  customer: (workspaceId: string, customerId: string) =>
    [...leadsQueryKeys.workspace(workspaceId), "customers", customerId] as const,
  flow: (workspaceId: string, filters?: CommercialWorkItemFilters) =>
    [...leadsQueryKeys.workspace(workspaceId), "flow", normalizeLeadFilters(filters)] as const,
  transformations: (workspaceId: string) =>
    [...leadsQueryKeys.workspace(workspaceId), "transformations"] as const,
  duplicates: (workspaceId: string, payload: Record<string, unknown>) =>
    [...leadsQueryKeys.workspace(workspaceId), "duplicates", payload] as const
};
