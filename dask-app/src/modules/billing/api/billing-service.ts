import { apiClient } from "@/shared/api/http-client";
import type { BillingStatus, SubscriptionPlan } from "../model/types";

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
  }
};
