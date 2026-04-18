import type { FiscalDocumentType, FiscalReceivedType } from '@/modules/fiscal/domain/types';

export interface FiscalProviderCompanyConfig {
  id: string;
  cnpj: string;
  token: string;
  environment: string;
  companyReference?: string | null;
  webhookSecret?: string | null;
}

export interface FiscalIssueRequest {
  reference: string;
  payload: Record<string, unknown>;
  company: FiscalProviderCompanyConfig;
}

export interface FiscalIssueResponse {
  reference: string;
  providerStatus?: string | null;
  providerDocumentId?: string | null;
  xmlUrl?: string | null;
  pdfUrl?: string | null;
  raw: Record<string, unknown>;
}

export interface FiscalDocumentStatusResponse {
  reference: string;
  providerStatus?: string | null;
  providerDocumentId?: string | null;
  xmlUrl?: string | null;
  pdfUrl?: string | null;
  raw: Record<string, unknown>;
}

export interface FiscalCancelResponse {
  reference: string;
  providerStatus?: string | null;
  raw: Record<string, unknown>;
}

export interface FiscalReceivedSyncRequest {
  company: FiscalProviderCompanyConfig;
  version?: number;
  full?: boolean;
}

export interface FiscalReceivedDocumentPayload {
  externalKey: string;
  providerReference?: string | null;
  focusReference?: string | null;
  manifestationStatus?: string | null;
  issuerName?: string | null;
  issuerDocument?: string | null;
  recipientDocument?: string | null;
  amountTotal?: number | null;
  issuedAt?: string | null;
  receivedAt?: string | null;
  xmlUrl?: string | null;
  pdfUrl?: string | null;
  raw: Record<string, unknown>;
}

export interface FiscalReceivedSyncResponse {
  type: FiscalReceivedType;
  items: FiscalReceivedDocumentPayload[];
  maxVersion?: number;
  totalCount?: number;
  rawHeaders?: Record<string, string | null>;
}

export interface FiscalWebhookParseResult {
  sourceEventId?: string | null;
  eventType: string;
  workspaceId?: string | null;
  companyReference?: string | null;
  documentReference?: string | null;
  documentType?: FiscalDocumentType | null;
  raw: Record<string, unknown>;
}

export interface FiscalProvider {
  issueNfe(input: FiscalIssueRequest): Promise<FiscalIssueResponse>;
  issueNfse(input: FiscalIssueRequest): Promise<FiscalIssueResponse>;
  getDocumentStatus(input: {
    company: FiscalProviderCompanyConfig;
    reference: string;
    documentType: FiscalDocumentType;
  }): Promise<FiscalDocumentStatusResponse>;
  cancelDocument(input: {
    company: FiscalProviderCompanyConfig;
    reference: string;
    documentType: FiscalDocumentType;
    justification?: string;
  }): Promise<FiscalCancelResponse>;
  downloadXml(input: {
    company: FiscalProviderCompanyConfig;
    reference: string;
    documentType: FiscalDocumentType;
  }): Promise<{ url: string | null; raw: Record<string, unknown> }>;
  downloadPdf(input: {
    company: FiscalProviderCompanyConfig;
    reference: string;
    documentType: FiscalDocumentType;
  }): Promise<{ url: string | null; raw: Record<string, unknown> }>;
  syncReceivedNfe(input: FiscalReceivedSyncRequest): Promise<FiscalReceivedSyncResponse>;
  syncReceivedNfse(input: FiscalReceivedSyncRequest): Promise<FiscalReceivedSyncResponse>;
  handleWebhook(payload: Record<string, unknown>): FiscalWebhookParseResult;
  registerCompany(input: {
    company: FiscalProviderCompanyConfig;
    payload: Record<string, unknown>;
  }): Promise<Record<string, unknown>>;
  validateCompanyConfig(input: {
    company: FiscalProviderCompanyConfig;
  }): Promise<{ ok: boolean; details: Record<string, unknown> }>;
}
