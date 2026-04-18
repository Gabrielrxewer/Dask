import { apiClient } from "@/shared/api/http-client";
import type {
  CreateFiscalDocumentInput,
  FiscalCatalogProfile,
  FiscalCompanyConfig,
  FiscalDashboardResponse,
  FiscalDocument,
  FiscalDocumentDetails,
  FiscalDocumentType,
  FiscalDirection,
  FiscalEmissionDraft,
  FiscalOperationTemplate,
  FiscalReceivedDocument,
  FiscalReceivedType
} from "../model/types";

function asQueryString(input: Record<string, string | number | undefined | null>): string {
  const query = new URLSearchParams();
  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    query.set(key, String(value));
  });
  const encoded = query.toString();
  return encoded.length > 0 ? `?${encoded}` : "";
}

export const fiscalService = {
  getDashboard(workspaceId: string): Promise<FiscalDashboardResponse> {
    return apiClient.get<FiscalDashboardResponse>(`/fiscal/workspaces/${workspaceId}/dashboard`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  listDocuments(
    workspaceId: string,
    input: {
      workspaceBusinessId?: string;
      documentType?: FiscalDocumentType;
      direction?: FiscalDirection;
      status?: string;
      origin?: string;
      customerId?: string;
      search?: string;
      from?: string;
      to?: string;
      limit?: number;
    } = {}
  ): Promise<{ items: FiscalDocument[] }> {
    return apiClient.get<{ items: FiscalDocument[] }>(
      `/fiscal/workspaces/${workspaceId}/documents${asQueryString(input)}`,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  createDocument(workspaceId: string, input: CreateFiscalDocumentInput): Promise<FiscalDocument> {
    return apiClient.post<FiscalDocument>(`/fiscal/workspaces/${workspaceId}/documents`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  getDocumentDetails(workspaceId: string, documentId: string): Promise<FiscalDocumentDetails> {
    return apiClient.get<FiscalDocumentDetails>(`/fiscal/workspaces/${workspaceId}/documents/${documentId}`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  issueDocument(workspaceId: string, documentId: string): Promise<FiscalDocument> {
    return apiClient.post<FiscalDocument>(`/fiscal/workspaces/${workspaceId}/documents/${documentId}/issue`, {}, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  cancelDocument(workspaceId: string, documentId: string, justification?: string): Promise<FiscalDocument> {
    return apiClient.post<FiscalDocument>(
      `/fiscal/workspaces/${workspaceId}/documents/${documentId}/cancel`,
      { justification },
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  retryDocument(workspaceId: string, documentId: string): Promise<FiscalDocument> {
    return apiClient.post<FiscalDocument>(`/fiscal/workspaces/${workspaceId}/documents/${documentId}/retry`, {}, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  listReceived(
    workspaceId: string,
    input: {
      workspaceBusinessId?: string;
      type?: FiscalReceivedType;
      status?: string;
      search?: string;
      from?: string;
      to?: string;
      limit?: number;
    } = {}
  ): Promise<{ items: FiscalReceivedDocument[] }> {
    return apiClient.get<{ items: FiscalReceivedDocument[] }>(
      `/fiscal/workspaces/${workspaceId}/received${asQueryString(input)}`,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  syncReceived(
    workspaceId: string,
    input: { companyConfigId: string; type: FiscalReceivedType; trigger?: "MANUAL" | "SCHEDULED" | "WEBHOOK" | "RETRY" }
  ): Promise<{ syncRunId: string; processed: number; createdOrUpdated: number; failed: number }> {
    return apiClient.post(`/fiscal/workspaces/${workspaceId}/received/sync`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  listCompanies(workspaceId: string): Promise<{ items: FiscalCompanyConfig[] }> {
    return apiClient.get<{ items: FiscalCompanyConfig[] }>(`/fiscal/workspaces/${workspaceId}/companies`, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  createCompany(workspaceId: string, input: Partial<FiscalCompanyConfig> & { displayName: string; legalName: string; cnpj: string; focusToken: string }): Promise<FiscalCompanyConfig> {
    return apiClient.post<FiscalCompanyConfig>(`/fiscal/workspaces/${workspaceId}/companies`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  updateCompany(workspaceId: string, companyId: string, patch: Partial<FiscalCompanyConfig>): Promise<FiscalCompanyConfig> {
    return apiClient.put<FiscalCompanyConfig>(`/fiscal/workspaces/${workspaceId}/companies/${companyId}`, patch, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  validateCompany(workspaceId: string, companyId: string): Promise<{ ok: boolean; details: Record<string, unknown> }> {
    return apiClient.post<{ ok: boolean; details: Record<string, unknown> }>(
      `/fiscal/workspaces/${workspaceId}/companies/${companyId}/validate`,
      {},
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  listCatalogProfiles(workspaceId: string): Promise<{ items: FiscalCatalogProfile[] }> {
    return apiClient.get<{ items: FiscalCatalogProfile[] }>(
      `/fiscal/workspaces/${workspaceId}/catalog/profiles`,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  upsertCatalogProfile(workspaceId: string, input: Partial<FiscalCatalogProfile> & { name: string; itemType: "PRODUCT" | "SERVICE" }): Promise<FiscalCatalogProfile> {
    return apiClient.post<FiscalCatalogProfile>(`/fiscal/workspaces/${workspaceId}/catalog/profiles`, input, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  },

  listOperationTemplates(workspaceId: string): Promise<{ items: FiscalOperationTemplate[] }> {
    return apiClient.get<{ items: FiscalOperationTemplate[] }>(
      `/fiscal/workspaces/${workspaceId}/operation-templates`,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  upsertOperationTemplate(
    workspaceId: string,
    input: Partial<FiscalOperationTemplate> & { name: string; documentType: FiscalDocumentType }
  ): Promise<FiscalOperationTemplate> {
    return apiClient.post<FiscalOperationTemplate>(
      `/fiscal/workspaces/${workspaceId}/operation-templates`,
      input,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  listDrafts(workspaceId: string, limit = 100): Promise<{ items: FiscalEmissionDraft[] }> {
    return apiClient.get<{ items: FiscalEmissionDraft[] }>(
      `/fiscal/workspaces/${workspaceId}/drafts${asQueryString({ limit })}`,
      {
        authMode: "required",
        retryOnUnauthorized: true
      }
    );
  },

  emitDraft(workspaceId: string, draftId: string): Promise<FiscalDocument> {
    return apiClient.post<FiscalDocument>(`/fiscal/workspaces/${workspaceId}/drafts/${draftId}/emit`, {}, {
      authMode: "required",
      retryOnUnauthorized: true
    });
  }
};

