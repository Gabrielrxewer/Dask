import { apiClient } from "@/shared/api/http-client";

export interface PortalOnboardResponse {
  workspaceSlug: string;
  workspaceName: string;
  documentId?: string;
  documentKind?: "proposal" | "contract";
  orderId?: string;
  paymentUrl?: string | null;
  customerId?: string;
  anchorItemId?: string | null;
}

export const portalService = {
  onboardDocumentToken(docToken: string): Promise<PortalOnboardResponse> {
    return apiClient.post<PortalOnboardResponse>(
      "/portal/onboard",
      { docToken },
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  onboardBillingToken(billingToken: string): Promise<PortalOnboardResponse> {
    return apiClient.post<PortalOnboardResponse>(
      "/portal/onboard",
      { billingToken },
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  }
};
