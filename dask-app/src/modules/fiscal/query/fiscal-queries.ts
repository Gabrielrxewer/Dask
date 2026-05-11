import { useQuery } from "@tanstack/react-query";
import { fiscalService } from "@/modules/fiscal/api/fiscal-service";
import {
  fiscalQueryKeys,
  type FiscalDashboardFilters,
  type FiscalListFilters,
  type FiscalReceivedFilters
} from "@/modules/fiscal/query/fiscal-query-keys";
import type { Customer } from "@/modules/workspace";

function isWorkspaceReady(workspaceId: string | null | undefined): workspaceId is string {
  return Boolean(workspaceId?.trim());
}

function requireWorkspace(workspaceId: string | null | undefined): string {
  if (!isWorkspaceReady(workspaceId)) {
    throw new Error("Nenhum workspace selecionado.");
  }
  return workspaceId;
}

export function useFiscalDashboardQuery(
  workspaceId: string | null | undefined,
  filters?: FiscalDashboardFilters
) {
  const resolvedWorkspaceId = workspaceId ?? "__missing_workspace__";

  return useQuery({
    queryKey: fiscalQueryKeys.dashboard(resolvedWorkspaceId, filters),
    queryFn: () => fiscalService.getDashboard(requireWorkspace(workspaceId)),
    enabled: isWorkspaceReady(workspaceId)
  });
}

export function useFiscalCustomersQuery(
  workspaceId: string | null | undefined,
  listCustomers: () => Promise<Customer[]>,
  enabled = true
) {
  const resolvedWorkspaceId = workspaceId ?? "__missing_workspace__";

  return useQuery({
    queryKey: fiscalQueryKeys.customers(resolvedWorkspaceId),
    queryFn: listCustomers,
    enabled: isWorkspaceReady(workspaceId) && enabled,
    staleTime: 30_000
  });
}

export function useFiscalCompaniesQuery(
  workspaceId: string | null | undefined,
  filters?: FiscalListFilters
) {
  const resolvedWorkspaceId = workspaceId ?? "__missing_workspace__";

  return useQuery({
    queryKey: fiscalQueryKeys.companies(resolvedWorkspaceId, filters),
    queryFn: () =>
      fiscalService.listCompanies(requireWorkspace(workspaceId), {
        search: filters?.search,
        pageSize: filters?.pageSize,
        cursor: filters?.cursor
      }),
    enabled: isWorkspaceReady(workspaceId)
  });
}

export function useFiscalDocumentsQuery(
  workspaceId: string | null | undefined,
  filters?: FiscalListFilters
) {
  const resolvedWorkspaceId = workspaceId ?? "__missing_workspace__";

  return useQuery({
    queryKey: fiscalQueryKeys.documents(resolvedWorkspaceId, filters),
    queryFn: () =>
      fiscalService.listDocuments(requireWorkspace(workspaceId), {
        workspaceBusinessId: filters?.workspaceBusinessId,
        documentType: filters?.documentType,
        direction: filters?.direction,
        status: filters?.status,
        origin: filters?.source,
        customerId: filters?.customerId,
        search: filters?.search,
        from: filters?.issueFrom ?? undefined,
        to: filters?.issueTo ?? undefined,
        pageSize: filters?.pageSize,
        cursor: filters?.cursor
      }),
    enabled: isWorkspaceReady(workspaceId)
  });
}

export function useFiscalCustomerDocumentsQuery(
  workspaceId: string | null | undefined,
  customerIds: string[],
  filters?: Omit<FiscalListFilters, "customerId">
) {
  const resolvedWorkspaceId = workspaceId ?? "__missing_workspace__";
  const normalizedCustomerIds = [...new Set(customerIds.filter(Boolean))].sort();

  return useQuery({
    queryKey: [
      ...fiscalQueryKeys.documents(resolvedWorkspaceId, filters),
      "customers",
      normalizedCustomerIds
    ] as const,
    queryFn: async () => {
      const results = await Promise.all(
        normalizedCustomerIds.map((customerId) =>
          fiscalService.listDocuments(requireWorkspace(workspaceId), {
            workspaceBusinessId: filters?.workspaceBusinessId,
            documentType: filters?.documentType,
            direction: filters?.direction,
            status: filters?.status,
            origin: filters?.source,
            customerId,
            search: filters?.search,
            from: filters?.issueFrom ?? undefined,
            to: filters?.issueTo ?? undefined,
            pageSize: filters?.pageSize,
            cursor: filters?.cursor
          })
        )
      );
      return results
        .flatMap((result) => result.items)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    },
    enabled: isWorkspaceReady(workspaceId) && normalizedCustomerIds.length > 0
  });
}

export function useFiscalDocumentQuery(
  workspaceId: string | null | undefined,
  documentId: string | null | undefined
) {
  const resolvedWorkspaceId = workspaceId ?? "__missing_workspace__";
  const resolvedDocumentId = documentId ?? "__missing_document__";

  return useQuery({
    queryKey: fiscalQueryKeys.document(resolvedWorkspaceId, resolvedDocumentId),
    queryFn: () => fiscalService.getDocumentDetails(requireWorkspace(workspaceId), resolvedDocumentId),
    enabled: isWorkspaceReady(workspaceId) && Boolean(documentId)
  });
}

export function useFiscalReceivedDocumentsQuery(
  workspaceId: string | null | undefined,
  filters?: FiscalReceivedFilters
) {
  const resolvedWorkspaceId = workspaceId ?? "__missing_workspace__";

  return useQuery({
    queryKey: fiscalQueryKeys.receivedDocuments(resolvedWorkspaceId, filters),
    queryFn: () =>
      fiscalService.listReceived(requireWorkspace(workspaceId), {
        workspaceBusinessId: filters?.workspaceBusinessId,
        type: filters?.type,
        status: filters?.status,
        search: filters?.search,
        from: filters?.from ?? undefined,
        to: filters?.to ?? undefined,
        pageSize: filters?.pageSize,
        cursor: filters?.cursor
      }),
    enabled: isWorkspaceReady(workspaceId)
  });
}

export function useFiscalDraftsQuery(
  workspaceId: string | null | undefined,
  filters?: FiscalListFilters
) {
  const resolvedWorkspaceId = workspaceId ?? "__missing_workspace__";

  return useQuery({
    queryKey: fiscalQueryKeys.drafts(resolvedWorkspaceId, filters),
    queryFn: () =>
      fiscalService.listDrafts(requireWorkspace(workspaceId), {
        pageSize: filters?.pageSize,
        cursor: filters?.cursor
      }),
    enabled: isWorkspaceReady(workspaceId)
  });
}

export function useFiscalSyncRunsQuery(
  workspaceId: string | null | undefined,
  filters?: FiscalListFilters
) {
  const resolvedWorkspaceId = workspaceId ?? "__missing_workspace__";

  return useQuery({
    queryKey: fiscalQueryKeys.syncRuns(resolvedWorkspaceId, filters),
    queryFn: () =>
      fiscalService.listSyncRuns(requireWorkspace(workspaceId), {
        pageSize: filters?.pageSize,
        cursor: filters?.cursor
      }),
    enabled: isWorkspaceReady(workspaceId)
  });
}

export function useFiscalProfilesQuery(workspaceId: string | null | undefined) {
  const resolvedWorkspaceId = workspaceId ?? "__missing_workspace__";

  return useQuery({
    queryKey: fiscalQueryKeys.profiles(resolvedWorkspaceId),
    queryFn: () => fiscalService.listCatalogProfiles(requireWorkspace(workspaceId)),
    enabled: isWorkspaceReady(workspaceId)
  });
}

export function useFiscalOperationTemplatesQuery(workspaceId: string | null | undefined) {
  const resolvedWorkspaceId = workspaceId ?? "__missing_workspace__";

  return useQuery({
    queryKey: fiscalQueryKeys.operationTemplates(resolvedWorkspaceId),
    queryFn: () => fiscalService.listOperationTemplates(requireWorkspace(workspaceId)),
    enabled: isWorkspaceReady(workspaceId)
  });
}
