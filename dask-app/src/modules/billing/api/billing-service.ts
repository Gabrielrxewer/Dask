import { apiClient } from "@/shared/api/http-client";
import type {
  BillingPlan,
  BillingStatus,
  ConnectAccountStatus,
  ConnectCatalogBillingType,
  ConnectCatalogItem,
  ConnectCatalogItemKind,
  ConnectCatalogRecurringInterval,
  ConnectPaymentOrder,
  CreateConnectCheckoutSessionInput,
  SubscriptionPlan
} from "../model/types";

const billingRequestConfig = {
  authMode: "required" as const,
  retryOnUnauthorized: true,
  globalLoading: false
};

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

  createCheckoutSession(planCode: SubscriptionPlan): Promise<{ url: string }> {
    return apiClient.post<{ url: string }>(
      "/billing/checkout-session",
      { planCode },
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

  listConnectCatalogItems(workspaceId: string, includeInactive = true): Promise<{ items: ConnectCatalogItem[] }> {
    return apiClient.get<{ items: ConnectCatalogItem[] }>(
      `/billing/connect/workspaces/${workspaceId}/catalog-items?includeInactive=${String(includeInactive)}`,
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

  listConnectPaymentOrders(workspaceId: string, limit = 50): Promise<{ items: ConnectPaymentOrder[] }> {
    return apiClient.get<{ items: ConnectPaymentOrder[] }>(
      `/billing/connect/workspaces/${workspaceId}/payment-orders?limit=${limit}`,
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
  }
};
