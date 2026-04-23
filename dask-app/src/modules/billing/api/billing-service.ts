import { apiClient } from "@/shared/api/http-client";
import type {
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

export const billingService = {
  getStatus(): Promise<BillingStatus> {
    return apiClient.get<BillingStatus>("/billing/status", {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  createCheckoutSession(planCode: SubscriptionPlan): Promise<{ url: string }> {
    return apiClient.post<{ url: string }>(
      "/billing/checkout-session",
      { planCode },
      { authMode: "required", retryOnUnauthorized: true }
    );
  },

  createPortalSession(): Promise<{ url: string }> {
    return apiClient.post<{ url: string }>(
      "/billing/portal-session",
      {},
      { authMode: "required", retryOnUnauthorized: true }
    );
  },

  createConnectOnboardingLink(
    workspaceId: string,
    input: { refreshUrl?: string; returnUrl?: string } = {}
  ): Promise<{ url: string; accountId: string }> {
    return apiClient.post<{ url: string; accountId: string }>(
      `/billing/connect/workspaces/${workspaceId}/onboarding-link`,
      input,
      { authMode: "required", retryOnUnauthorized: true }
    );
  },

  getConnectAccountStatus(workspaceId: string): Promise<ConnectAccountStatus> {
    return apiClient.get<ConnectAccountStatus>(
      `/billing/connect/workspaces/${workspaceId}/account`,
      { authMode: "required", retryOnUnauthorized: true }
    );
  },

  listConnectCatalogItems(workspaceId: string, includeInactive = true): Promise<{ items: ConnectCatalogItem[] }> {
    return apiClient.get<{ items: ConnectCatalogItem[] }>(
      `/billing/connect/workspaces/${workspaceId}/catalog-items?includeInactive=${String(includeInactive)}`,
      { authMode: "required", retryOnUnauthorized: true }
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
      { authMode: "required", retryOnUnauthorized: true }
    );
  },

  createConnectCheckoutSession(
    workspaceId: string,
    input: CreateConnectCheckoutSessionInput
  ): Promise<{ url: string; sessionId: string; orderId: string }> {
    return apiClient.post<{ url: string; sessionId: string; orderId: string }>(
      `/billing/connect/workspaces/${workspaceId}/checkout-session`,
      input,
      { authMode: "required", retryOnUnauthorized: true }
    );
  },

  listConnectPaymentOrders(workspaceId: string, limit = 50): Promise<{ items: ConnectPaymentOrder[] }> {
    return apiClient.get<{ items: ConnectPaymentOrder[] }>(
      `/billing/connect/workspaces/${workspaceId}/payment-orders?limit=${limit}`,
      { authMode: "required", retryOnUnauthorized: true }
    );
  },

  syncConnectPaymentOrderStatus(workspaceId: string, sessionId: string): Promise<ConnectPaymentOrder> {
    return apiClient.post<ConnectPaymentOrder>(
      `/billing/connect/workspaces/${workspaceId}/payment-orders/sync?sessionId=${encodeURIComponent(sessionId)}`,
      {},
      { authMode: "required", retryOnUnauthorized: true }
    );
  },

  resendConnectPaymentOrderEmail(workspaceId: string, orderId: string): Promise<{ ok: true }> {
    return apiClient.post<{ ok: true }>(
      `/billing/connect/workspaces/${workspaceId}/payment-orders/${orderId}/resend-email`,
      {},
      { authMode: "required", retryOnUnauthorized: true }
    );
  },

  cancelConnectPaymentOrder(workspaceId: string, orderId: string): Promise<{ ok: true }> {
    return apiClient.post<{ ok: true }>(
      `/billing/connect/workspaces/${workspaceId}/payment-orders/${orderId}/cancel`,
      {},
      { authMode: "required", retryOnUnauthorized: true }
    );
  }
};
