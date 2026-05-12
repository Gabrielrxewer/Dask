import { useQuery } from "@tanstack/react-query";
import { billingService } from "@/modules/billing/api/billing-service";
import {
  billingQueryKeys,
  type BillingCatalogFilters,
  type BillingPaymentOrderFilters
} from "@/modules/billing/query/billing-query-keys";

interface BillingQueryOptions {
  enabled?: boolean;
  refetchInterval?: number | false;
}

function isWorkspaceReady(workspaceId: string | null | undefined): workspaceId is string {
  return Boolean(workspaceId?.trim());
}

function requireWorkspace(workspaceId: string | null | undefined): string {
  if (!isWorkspaceReady(workspaceId)) {
    throw new Error("Nenhum workspace selecionado.");
  }
  return workspaceId;
}

export function usePlatformSubscriptionQuery(workspaceId: string | null | undefined) {
  const resolvedWorkspaceId = workspaceId ?? "__missing_workspace__";

  return useQuery({
    queryKey: billingQueryKeys.platformSubscription(resolvedWorkspaceId),
    queryFn: () => billingService.getStatus(),
    enabled: isWorkspaceReady(workspaceId)
  });
}

export const useBillingPlatformSubscriptionQuery = usePlatformSubscriptionQuery;

export function useBillingStatusQuery(options: BillingQueryOptions = {}) {
  return useQuery({
    queryKey: billingQueryKeys.subscription(),
    queryFn: () => billingService.getStatus(),
    enabled: options.enabled ?? true,
    refetchInterval: options.refetchInterval
  });
}

export function useBillingPlansQuery(options: BillingQueryOptions = {}) {
  return useQuery({
    queryKey: billingQueryKeys.plans(),
    queryFn: () => billingService.listPlans(),
    enabled: options.enabled ?? true
  });
}

export function useConnectAccountQuery(workspaceId: string | null | undefined) {
  const resolvedWorkspaceId = workspaceId ?? "__missing_workspace__";

  return useQuery({
    queryKey: billingQueryKeys.connectAccount(resolvedWorkspaceId),
    queryFn: () => billingService.getConnectAccountStatus(requireWorkspace(workspaceId)),
    enabled: isWorkspaceReady(workspaceId)
  });
}

export const useBillingConnectAccountQuery = useConnectAccountQuery;

export function useBillingCatalogQuery(
  workspaceId: string | null | undefined,
  filters?: BillingCatalogFilters,
  options: BillingQueryOptions = {}
) {
  const resolvedWorkspaceId = workspaceId ?? "__missing_workspace__";

  return useQuery({
    queryKey: billingQueryKeys.catalog(resolvedWorkspaceId, filters),
    queryFn: () =>
      billingService.listConnectCatalogItems(
        requireWorkspace(workspaceId),
        {
          includeInactive: filters?.includeInactive ?? filters?.status !== "active",
          status: filters?.status,
          search: filters?.search,
          kind: filters?.kind,
          billingType: filters?.billingType,
          pageSize: filters?.pageSize,
          cursor: filters?.cursor
        }
      ),
    enabled: (options.enabled ?? true) && isWorkspaceReady(workspaceId)
  });
}

export function useBillingPaymentOrdersQuery(
  workspaceId: string | null | undefined,
  filters?: BillingPaymentOrderFilters
) {
  const resolvedWorkspaceId = workspaceId ?? "__missing_workspace__";

  return useQuery({
    queryKey: billingQueryKeys.paymentOrders(resolvedWorkspaceId, filters),
    queryFn: () =>
      billingService.listConnectPaymentOrders(
        requireWorkspace(workspaceId),
        {
          status: filters?.status,
          customerId: filters?.customerId,
          email: filters?.email,
          search: filters?.search,
          pageSize: filters?.pageSize ?? 50,
          cursor: filters?.cursor
        }
      ),
    enabled: isWorkspaceReady(workspaceId),
    refetchInterval: 10_000
  });
}

export const useBillingHistoryQuery = useBillingPaymentOrdersQuery;
