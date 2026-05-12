import { useCallback } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { commercialService } from "@/modules/commercial/api";
import type {
  CommercialWorkItemFilters,
  CommercialWorkItemsPage,
  CustomerListFilters,
  CommercialCustomersPage
} from "@/modules/commercial/model/types";
import { commercialQueryKeys } from "@/modules/commercial/query/commercial-query-keys";

function isWorkspaceReady(workspaceId: string | null | undefined): workspaceId is string {
  return Boolean(workspaceId?.trim());
}

function requireWorkspace(workspaceId: string | null | undefined): string {
  if (!isWorkspaceReady(workspaceId)) {
    throw new Error("Nenhum workspace selecionado.");
  }
  return workspaceId;
}

function isTypeReady(typeSlug: string | null | undefined): typeSlug is string {
  return Boolean(typeSlug?.trim());
}

function requireType(typeSlug: string | null | undefined): string {
  if (!isTypeReady(typeSlug)) {
    throw new Error("Tipo comercial nao configurado.");
  }
  return typeSlug;
}

export function flattenWorkItemPages(data: { pages: CommercialWorkItemsPage[] } | undefined) {
  return data?.pages.flatMap((page) => page.items) ?? [];
}

export function flattenCustomerPages(data: { pages: CommercialCustomersPage[] } | undefined) {
  return data?.pages.flatMap((page) => page.items) ?? [];
}

export function useCommercialWorkItemsQuery(
  workspaceId: string | null | undefined,
  workItemType: string | null | undefined,
  filters?: CommercialWorkItemFilters
) {
  return useInfiniteQuery<CommercialWorkItemsPage>({
    queryKey: commercialQueryKeys.commercial(workspaceId ?? "__missing_workspace__", { ...filters, workItemType }),
    queryFn: ({ pageParam }) =>
      commercialService.listCommercialWorkItems(requireWorkspace(workspaceId), {
        typeSlug: requireType(workItemType),
        filters,
        cursor: typeof pageParam === "string" ? pageParam : null
      }),
    enabled: isWorkspaceReady(workspaceId) && isTypeReady(workItemType),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
  });
}

export function useSignalsQuery(
  workspaceId: string | null | undefined,
  workItemType: string | null | undefined,
  filters?: CommercialWorkItemFilters
) {
  return useInfiniteQuery<CommercialWorkItemsPage>({
    queryKey: commercialQueryKeys.signals(workspaceId ?? "__missing_workspace__", { ...filters, workItemType }),
    queryFn: ({ pageParam }) =>
      commercialService.listCommercialWorkItems(requireWorkspace(workspaceId), {
        typeSlug: requireType(workItemType),
        filters,
        cursor: typeof pageParam === "string" ? pageParam : null
      }),
    enabled: isWorkspaceReady(workspaceId) && isTypeReady(workItemType),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
  });
}

export function useCommercialWorkItemDetailsQuery(
  workspaceId: string | null | undefined,
  workItemId: string | null | undefined
) {
  return useQuery({
    queryKey: commercialQueryKeys.workItem(workspaceId ?? "__missing_workspace__", workItemId ?? "__missing_item__"),
    queryFn: () => commercialService.getCommercialWorkItem(requireWorkspace(workspaceId), workItemId ?? ""),
    enabled: isWorkspaceReady(workspaceId) && Boolean(workItemId?.trim())
  });
}

export function useCustomersQuery(
  workspaceId: string | null | undefined,
  filters?: CustomerListFilters
) {
  return useInfiniteQuery<CommercialCustomersPage>({
    queryKey: commercialQueryKeys.customers(workspaceId ?? "__missing_workspace__", filters),
    queryFn: ({ pageParam }) =>
      commercialService.listCustomers(requireWorkspace(workspaceId), filters, typeof pageParam === "string" ? pageParam : null),
    enabled: isWorkspaceReady(workspaceId),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
  });
}

export function useCustomerLookupAction(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useCallback(
    (filters?: CustomerListFilters) => {
      const lookupFilters = {
        ...filters,
        limit: filters?.limit ?? 20
      };

      return queryClient.fetchQuery({
        queryKey: commercialQueryKeys.customerLookup(workspaceId ?? "__missing_workspace__", lookupFilters),
        queryFn: async () => {
          const page = await commercialService.listCustomers(requireWorkspace(workspaceId), lookupFilters, null);
          return page.items;
        },
        staleTime: 30_000
      });
    },
    [queryClient, workspaceId]
  );
}

export function useCommercialOverviewQuery(
  workspaceId: string | null | undefined,
  workItemType: string | null | undefined,
  filters?: CommercialWorkItemFilters
) {
  return useQuery({
    queryKey: commercialQueryKeys.overview(workspaceId ?? "__missing_workspace__", { ...filters, limit: 1 }),
    queryFn: () =>
      commercialService.listCommercialWorkItems(requireWorkspace(workspaceId), {
        typeSlug: requireType(workItemType),
        filters: { ...filters, limit: 1 },
        cursor: null
      }),
    enabled: isWorkspaceReady(workspaceId) && isTypeReady(workItemType)
  });
}

export function useCommercialTransformationsQuery(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: commercialQueryKeys.transformations(workspaceId ?? "__missing_workspace__"),
    queryFn: () => commercialService.listTransformations(requireWorkspace(workspaceId)),
    enabled: isWorkspaceReady(workspaceId)
  });
}
