import { apiClient } from "@/shared/api/http-client";
import type { CommercialDocumentStatus, DocumentKind, WorkspaceDocumentMetadata } from "@/modules/workspace";

export type PublicCommercialDocumentDecision = "approve" | "accept" | "sign" | "reject";

export interface PublicCommercialDocument {
  title: string;
  content: string;
  kind: Exclude<DocumentKind, "wiki">;
  status: CommercialDocumentStatus;
  metadata: WorkspaceDocumentMetadata;
  masked: boolean;
  access: "public_token" | "authenticated_recipient";
  requiresLogin: boolean;
  allowAcceptReject: boolean;
  canDecide: boolean;
  workspace: {
    name: string;
  };
  recipientEmail: string;
  recipientEmails?: string[];
  recipientUserExists: boolean;
}

export const publicCommercialDocumentService = {
  getByToken(token: string): Promise<PublicCommercialDocument> {
    return apiClient.get<PublicCommercialDocument>(`/documents/public/${encodeURIComponent(token)}`, {
      authMode: "optional",
      retryOnUnauthorized: false,
      globalLoading: false
    });
  },

  decide(token: string, decision: PublicCommercialDocumentDecision): Promise<void> {
    return apiClient.post<void>(
      `/documents/public/${encodeURIComponent(token)}/decision`,
      { decision },
      {
        authMode: "required",
        retryOnUnauthorized: true,
        globalLoading: false
      }
    );
  }
};
