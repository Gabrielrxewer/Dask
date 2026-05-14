import { apiClient } from "@/shared/api/http-client";
import type {
  BillingPlan,
  BillingPortalToken,
  BillingStatus,
  ConnectAccountStatus,
  ConnectCatalogBillingType,
  ConnectCatalogItem,
  ConnectCatalogItemKind,
  ConnectCatalogRecurringInterval,
  ConnectPaymentOrder,
  CreateConnectCheckoutSessionInput,
  SubscriptionCheckoutAcceptance,
  SubscriptionPlan
} from "../model/types";

const billingRequestConfig = {
  authMode: "required" as const,
  retryOnUnauthorized: true,
  globalLoading: false
};

interface BillingPageResponse<T> {
  items: T[];
  nextCursor?: string | null;
}

function asQueryString(input: Record<string, string | number | boolean | undefined | null>): string {
  const query = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "all") {
      return;
    }
    query.set(key, String(value));
  });
  const encoded = query.toString();
  return encoded.length > 0 ? `?${encoded}` : "";
}

export const billingService = {
  listPlans(): Promise<{ items: BillingPlan[] }> {
    return apiClient.get<{ items: BillingPlan[] }>("/billing/plans", {
      authMode: "optional",
      retryOnUnauthorized: false,
      globalLoading: false
    });
  },

  getStatus(): Promise<BillingStatus> {
    return apiClient.get<BillingStatus>("/billing/status", billingRequestConfig);
  },

  createCheckoutSession(planCode: SubscriptionPlan, acceptance: SubscriptionCheckoutAcceptance): Promise<{ url: string }> {
    return apiClient.post<{ url: string }>(
      "/billing/checkout-session",
      { planCode, ...acceptance },
      billingRequestConfig
    );
  },

  createPortalSession(): Promise<{ url: string }> {
    return apiClient.post<{ url: string }>(
      "/billing/portal-session",
      {},
      billingRequestConfig
    );
  },

  createConnectOnboardingLink(
    workspaceId: string,
    input: { refreshUrl?: string; returnUrl?: string } = {}
  ): Promise<{ url: string; accountId: string }> {
    return apiClient.post<{ url: string; accountId: string }>(
      `/billing/connect/workspaces/${workspaceId}/onboarding-link`,
      input,
      billingRequestConfig
    );
  },

  getConnectAccountStatus(workspaceId: string): Promise<ConnectAccountStatus> {
    return apiClient.get<ConnectAccountStatus>(
      `/billing/connect/workspaces/${workspaceId}/account`,
      billingRequestConfig
    );
  },

  requestConnectPaymentCapability(
    workspaceId: string,
    capability: "boleto_payments"
  ): Promise<ConnectAccountStatus> {
    return apiClient.post<ConnectAccountStatus>(
      `/billing/connect/workspaces/${workspaceId}/payment-capability`,
      { paymentMethod: "boleto" },
      billingRequestConfig
    );
  },

  listConnectCatalogItems(
    workspaceId: string,
    input: boolean | {
      includeInactive?: boolean;
      search?: string;
      kind?: ConnectCatalogItemKind;
      billingType?: ConnectCatalogBillingType;
      status?: "active" | "inactive" | "all";
      pageSize?: number;
      cursor?: string | null;
    } = true
  ): Promise<BillingPageResponse<ConnectCatalogItem>> {
    const filters = typeof input === "boolean" ? { includeInactive: input } : input;
    return apiClient.get<BillingPageResponse<ConnectCatalogItem>>(
      `/billing/connect/workspaces/${workspaceId}/catalog-items${asQueryString({
        includeInactive: filters.includeInactive ?? true,
        search: filters.search,
        kind: filters.kind,
        billingType: filters.billingType,
        status: filters.status,
        pageSize: filters.pageSize,
        cursor: filters.cursor ?? undefined
      })}`,
      billingRequestConfig
    );
  },

  createConnectCatalogItem(
    workspaceId: string,
    input: {
      kind: ConnectCatalogItemKind;
      billingType?: ConnectCatalogBillingType;
      recurringInterval?: ConnectCatalogRecurringInterval;
      recurringIntervalCount?: number;
      name: string;
      description?: string;
      amount: number;
      currency?: string;
      metadata?: Record<string, string>;
    }
  ): Promise<ConnectCatalogItem> {
    return apiClient.post<ConnectCatalogItem>(
      `/billing/connect/workspaces/${workspaceId}/catalog-items`,
      input,
      billingRequestConfig
    );
  },

  updateConnectCatalogItem(
    workspaceId: string,
    itemId: string,
    input: {
      kind: ConnectCatalogItemKind;
      billingType?: ConnectCatalogBillingType;
      recurringInterval?: ConnectCatalogRecurringInterval;
      recurringIntervalCount?: number;
      name: string;
      description?: string;
      amount: number;
      currency?: string;
      metadata?: Record<string, string>;
    }
  ): Promise<ConnectCatalogItem> {
    return apiClient.patch<ConnectCatalogItem>(
      `/billing/connect/workspaces/${workspaceId}/catalog-items/${itemId}`,
      input,
      billingRequestConfig
    );
  },

  deleteConnectCatalogItem(workspaceId: string, itemId: string): Promise<ConnectCatalogItem> {
    return apiClient.delete<ConnectCatalogItem>(
      `/billing/connect/workspaces/${workspaceId}/catalog-items/${itemId}`,
      billingRequestConfig
    );
  },

  createConnectCheckoutSession(
    workspaceId: string,
    input: CreateConnectCheckoutSessionInput
  ): Promise<{ url: string; sessionId: string; orderId: string }> {
    return apiClient.post<{ url: string; sessionId: string; orderId: string }>(
      `/billing/connect/workspaces/${workspaceId}/checkout-session`,
      input,
      billingRequestConfig
    );
  },

  listConnectPaymentOrders(
    workspaceId: string,
    input: number | {
      status?: string;
      customerId?: string;
      email?: string;
      search?: string;
      pageSize?: number;
      cursor?: string | null;
    } = 50
  ): Promise<BillingPageResponse<ConnectPaymentOrder>> {
    const filters = typeof input === "number" ? { pageSize: input } : input;
    return apiClient.get<BillingPageResponse<ConnectPaymentOrder>>(
      `/billing/connect/workspaces/${workspaceId}/payment-orders${asQueryString({
        status: filters.status,
        customerId: filters.customerId,
        email: filters.email,
        search: filters.search,
        pageSize: filters.pageSize,
        cursor: filters.cursor ?? undefined
      })}`,
      billingRequestConfig
    );
  },

  syncConnectPaymentOrderStatus(workspaceId: string, sessionId: string): Promise<ConnectPaymentOrder> {
    return apiClient.post<ConnectPaymentOrder>(
      `/billing/connect/workspaces/${workspaceId}/payment-orders/sync?sessionId=${encodeURIComponent(sessionId)}`,
      {},
      billingRequestConfig
    );
  },

  resendConnectPaymentOrderEmail(workspaceId: string, orderId: string): Promise<{ ok: true }> {
    return apiClient.post<{ ok: true }>(
      `/billing/connect/workspaces/${workspaceId}/payment-orders/${orderId}/resend-email`,
      {},
      billingRequestConfig
    );
  },

  cancelConnectPaymentOrder(workspaceId: string, orderId: string): Promise<{ ok: true }> {
    return apiClient.post<{ ok: true }>(
      `/billing/connect/workspaces/${workspaceId}/payment-orders/${orderId}/cancel`,
      {},
      billingRequestConfig
    );
  },

  createPaymentOrderPortalToken(
    workspaceId: string,
    orderId: string,
    input: {
      expiresInSeconds?: number;
      scopes?: BillingPortalToken["scopes"];
    } = {}
  ): Promise<BillingPortalToken> {
    return apiClient.post<BillingPortalToken>(
      `/billing/connect/workspaces/${workspaceId}/payment-orders/${orderId}/portal-token`,
      input,
      billingRequestConfig
    );
  },

  revokePaymentOrderPortalToken(workspaceId: string, orderId: string): Promise<{ ok: true }> {
    return apiClient.post<{ ok: true }>(
      `/billing/connect/workspaces/${workspaceId}/payment-orders/${orderId}/portal-token/revoke`,
      {},
      billingRequestConfig
    );
  }
};
