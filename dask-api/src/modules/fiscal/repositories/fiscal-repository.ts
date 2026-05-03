import type {
  FiscalCatalogProfile,
  FiscalCompanyConfig,
  FiscalDocument,
  FiscalDocumentItem,
  FiscalDirection,
  FiscalEmissionDraft,
  FiscalIntegrationLog,
  FiscalIssueStatus,
  FiscalOperationTemplate,
  FiscalParty,
  FiscalReceivedDocument,
  FiscalReceivedStatus,
  FiscalReceivedType,
  FiscalSyncRun,
  FiscalSyncStatus,
  FiscalWebhookEvent
} from '@prisma/client';
import type {
  CreateFiscalDocumentInput,
  FiscalDocumentStatus,
  FiscalDocumentType,
  UpdateFiscalDocumentStatusInput
} from '@/modules/fiscal/domain/types';

export interface FiscalDocumentsQuery {
  workspaceId: string;
  workspaceBusinessId?: string;
  documentType?: FiscalDocumentType;
  direction?: FiscalDirection;
  status?: FiscalDocumentStatus;
  origin?: string;
  customerId?: string;
  customerIds?: string[];
  from?: Date;
  to?: Date;
  search?: string;
  limit?: number;
}

export interface FiscalReceivedQuery {
  workspaceId: string;
  workspaceBusinessId?: string;
  type?: FiscalReceivedType;
  status?: FiscalReceivedStatus;
  from?: Date;
  to?: Date;
  search?: string;
  limit?: number;
}

export interface FiscalRepository {
  listCompanyConfigs(workspaceId: string): Promise<FiscalCompanyConfig[]>;
  findCompanyConfigById(workspaceId: string, companyConfigId: string): Promise<FiscalCompanyConfig | null>;
  createCompanyConfig(input: Omit<FiscalCompanyConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<FiscalCompanyConfig>;
  updateCompanyConfig(
    workspaceId: string,
    companyConfigId: string,
    patch: Partial<Omit<FiscalCompanyConfig, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>>
  ): Promise<FiscalCompanyConfig | null>;

  listDocuments(
    query: FiscalDocumentsQuery
  ): Promise<Array<FiscalDocument & { items: FiscalDocumentItem[]; parties: FiscalParty[] }>>;
  getDocumentById(
    workspaceId: string,
    documentId: string,
    customerIds?: string[]
  ): Promise<(FiscalDocument & { items: FiscalDocumentItem[]; parties: FiscalParty[] }) | null>;
  findDocumentByReference(
    workspaceId: string,
    internalReference: string
  ): Promise<(FiscalDocument & { items: FiscalDocumentItem[]; parties: FiscalParty[] }) | null>;
  createDocument(
    input: CreateFiscalDocumentInput
  ): Promise<FiscalDocument & { items: FiscalDocumentItem[]; parties: FiscalParty[] }>;
  updateDocumentStatus(input: UpdateFiscalDocumentStatusInput): Promise<FiscalDocument | null>;
  updateDocumentPayloadSnapshots(
    workspaceId: string,
    documentId: string,
    patch: {
      requestPayloadSnapshot?: Record<string, unknown> | null;
      responsePayloadSnapshot?: Record<string, unknown> | null;
      providerPayloadRaw?: Record<string, unknown> | null;
      lastError?: string | null;
    }
  ): Promise<FiscalDocument | null>;

  createEmissionDraft(input: Omit<FiscalEmissionDraft, 'id' | 'createdAt' | 'updatedAt'>): Promise<FiscalEmissionDraft>;
  listEmissionDrafts(workspaceId: string, limit?: number): Promise<FiscalEmissionDraft[]>;
  findEmissionDraftById(workspaceId: string, draftId: string): Promise<FiscalEmissionDraft | null>;
  findEmissionDraftByStripeSession(
    workspaceId: string,
    stripeSessionId: string
  ): Promise<FiscalEmissionDraft | null>;
  updateEmissionDraft(
    workspaceId: string,
    draftId: string,
    patch: Partial<Omit<FiscalEmissionDraft, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>>
  ): Promise<FiscalEmissionDraft | null>;

  upsertReceivedDocument(input: Omit<FiscalReceivedDocument, 'id' | 'createdAt' | 'updatedAt'>): Promise<FiscalReceivedDocument>;
  listReceivedDocuments(query: FiscalReceivedQuery): Promise<FiscalReceivedDocument[]>;

  createSyncRun(input: Omit<FiscalSyncRun, 'id' | 'createdAt' | 'updatedAt'>): Promise<FiscalSyncRun>;
  finishSyncRun(
    id: string,
    patch: {
      status: FiscalSyncStatus;
      processedCount: number;
      createdCount: number;
      updatedCount: number;
      failedCount: number;
      responseSnapshot?: Record<string, unknown> | null;
      lastError?: string | null;
    }
  ): Promise<FiscalSyncRun>;
  listLatestSyncRuns(workspaceId: string, limit?: number): Promise<FiscalSyncRun[]>;

  createWebhookEvent(input: Omit<FiscalWebhookEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<FiscalWebhookEvent>;
  findWebhookEventByIdempotencyKey(idempotencyKey: string): Promise<FiscalWebhookEvent | null>;
  updateWebhookEvent(
    id: string,
    patch: Partial<Pick<FiscalWebhookEvent, 'status' | 'attempts' | 'processedAt' | 'lastError' | 'workspaceId'>>
  ): Promise<FiscalWebhookEvent>;

  appendIntegrationLog(input: Omit<FiscalIntegrationLog, 'id' | 'createdAt'>): Promise<FiscalIntegrationLog>;
  listIntegrationLogs(
    workspaceId: string,
    options?: { documentId?: string; limit?: number }
  ): Promise<FiscalIntegrationLog[]>;

  getDashboardMetrics(workspaceId: string): Promise<{
    issuedToday: number;
    pending: number;
    rejected: number;
    received: number;
    pendingReview: number;
    latestSyncAt: Date | null;
  }>;

  listCatalogProfiles(workspaceId: string): Promise<FiscalCatalogProfile[]>;
  upsertCatalogProfile(
    workspaceId: string,
    input: Partial<Omit<FiscalCatalogProfile, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>> &
      Pick<FiscalCatalogProfile, 'name' | 'itemType'> & { id?: string }
  ): Promise<FiscalCatalogProfile>;

  listOperationTemplates(workspaceId: string): Promise<FiscalOperationTemplate[]>;
  upsertOperationTemplate(
    workspaceId: string,
    input: Partial<Omit<FiscalOperationTemplate, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>> &
      Pick<FiscalOperationTemplate, 'name' | 'documentType'> & { id?: string }
  ): Promise<FiscalOperationTemplate>;
}

export type UpdateDocumentStatusInput = {
  workspaceId: string;
  id: string;
  status: FiscalDocumentStatus;
  issueStatus: FiscalIssueStatus;
  focusStatus?: string | null;
  operationStatus?: string | null;
  focusDocumentId?: string | null;
  xmlUrl?: string | null;
  pdfUrl?: string | null;
  responsePayloadSnapshot?: Record<string, unknown> | null;
  providerPayloadRaw?: Record<string, unknown> | null;
  lastError?: string | null;
};
