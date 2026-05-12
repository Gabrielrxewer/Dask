import type { ConnectCatalogBillingType, ConnectCatalogItemKind } from "@/modules/billing/model/types";

export interface BillingCatalogFilters {
  includeInactive?: boolean;
  search?: string;
  kind?: ConnectCatalogItemKind;
  billingType?: ConnectCatalogBillingType;
  status?: "active" | "inactive" | "all";
  pageSize?: number;
  cursor?: string | null;
}

export interface BillingPaymentOrderFilters {
  status?: string;
  customerId?: string;
  email?: string;
  search?: string;
  catalogItemId?: string;
  createdFrom?: string | null;
  createdTo?: string | null;
  paidFrom?: string | null;
  paidTo?: string | null;
  paymentMethod?: string;
  amountMin?: number | null;
  amountMax?: number | null;
  pageSize?: number;
  cursor?: string | null;
}

function cleanRecord<TValue>(
  record: Record<string, TValue | undefined | null | "" | "all"> | undefined
): Record<string, TValue> {
  return Object.fromEntries(
    Object.entries(record ?? {}).filter(([, value]) =>
      value !== undefined && value !== null && value !== "" && value !== "all"
    )
  ) as Record<string, TValue>;
}

export function normalizeBillingCatalogFilters(filters?: BillingCatalogFilters) {
  return cleanRecord<string | number | boolean>({
    includeInactive: filters?.includeInactive,
    search: filters?.search?.trim(),
    kind: filters?.kind,
    billingType: filters?.billingType,
    status: filters?.status,
    pageSize: filters?.pageSize,
    cursor: filters?.cursor ?? undefined
  });
}

export function normalizeBillingPaymentOrderFilters(filters?: BillingPaymentOrderFilters) {
  return cleanRecord<string | number>({
    status: filters?.status,
    customerId: filters?.customerId,
    email: filters?.email?.trim(),
    search: filters?.search?.trim(),
    catalogItemId: filters?.catalogItemId,
    createdFrom: filters?.createdFrom ?? undefined,
    createdTo: filters?.createdTo ?? undefined,
    paidFrom: filters?.paidFrom ?? undefined,
    paidTo: filters?.paidTo ?? undefined,
    paymentMethod: filters?.paymentMethod,
    amountMin: filters?.amountMin ?? undefined,
    amountMax: filters?.amountMax ?? undefined,
    pageSize: filters?.pageSize,
    cursor: filters?.cursor ?? undefined
  });
}

export const billingQueryKeys = {
  all: ["billing"] as const,
  plans: () => [...billingQueryKeys.all, "plans"] as const,
  subscription: () => [...billingQueryKeys.all, "subscription"] as const,
  workspace: (workspaceId: string) => [...billingQueryKeys.all, "workspace", workspaceId] as const,
  platformSubscription: (workspaceId: string) =>
    [...billingQueryKeys.workspace(workspaceId), "platform-subscription"] as const,
  connectAccount: (workspaceId: string) =>
    [...billingQueryKeys.workspace(workspaceId), "connect-account"] as const,
  catalog: (workspaceId: string, filters?: BillingCatalogFilters) =>
    [...billingQueryKeys.workspace(workspaceId), "catalog", normalizeBillingCatalogFilters(filters)] as const,
  catalogItem: (workspaceId: string, itemId: string) =>
    [...billingQueryKeys.workspace(workspaceId), "catalog", itemId] as const,
  paymentOrders: (workspaceId: string, filters?: BillingPaymentOrderFilters) =>
    [...billingQueryKeys.workspace(workspaceId), "payment-orders", normalizeBillingPaymentOrderFilters(filters)] as const,
  paymentOrder: (workspaceId: string, orderId: string) =>
    [...billingQueryKeys.workspace(workspaceId), "payment-orders", orderId] as const,
  history: (workspaceId: string, filters?: BillingPaymentOrderFilters) =>
    [...billingQueryKeys.workspace(workspaceId), "history", normalizeBillingPaymentOrderFilters(filters)] as const,
  portalToken: (workspaceId: string, orderId: string) =>
    [...billingQueryKeys.workspace(workspaceId), "portal-token", orderId] as const
};
