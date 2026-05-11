export type FiscalDocumentType = "NFE" | "NFSE";
export type FiscalDirection = "OUTBOUND" | "INBOUND";
export type FiscalDocumentOrigin =
  | "MANUAL_PRODUCT"
  | "MANUAL_SERVICE"
  | "CATALOG_PRODUCT"
  | "CATALOG_SERVICE"
  | "STRIPE_PAYMENT"
  | "STRIPE_SUBSCRIPTION"
  | "EXTERNAL_RECEIVED_NFE"
  | "EXTERNAL_RECEIVED_NFSE";

export type FiscalDocumentStatus =
  | "DRAFT"
  | "READY_TO_ISSUE"
  | "ISSUING"
  | "AUTHORIZED"
  | "PROCESSING"
  | "PENDING_REVIEW"
  | "REJECTED"
  | "CANCELLED"
  | "FAILED"
  | "RECEIVED"
  | "MANIFEST_PENDING"
  | "MANIFESTED"
  | "SYNCED";

export type FiscalIssueStatus =
  | "NOT_STARTED"
  | "PROCESSING"
  | "AUTHORIZED"
  | "REJECTED"
  | "CANCELLED"
  | "FAILED";

export type FiscalReceivedType = "NFE_MDE" | "NFSE_NFSER";
export type FiscalReceivedStatus = "RECEIVED" | "MANIFEST_PENDING" | "MANIFESTED" | "SYNCED" | "FAILED";
export type FiscalDraftStatus = "DRAFT" | "READY" | "ISSUED" | "CANCELLED";

export interface FiscalDashboardResponse {
  counters: {
    issuedToday: number;
    pending: number;
    rejected: number;
    received: number;
    pendingReview: number;
  };
  latestSyncAt: string | null;
  recentSyncRuns: Array<{
    id: string;
    syncType: string;
    status: string;
    startedAt: string;
    finishedAt: string | null;
  }>;
}

export interface FiscalSyncRun {
  id: string;
  workspaceId: string;
  companyConfigId: string | null;
  syncType: string;
  trigger: string;
  status: string;
  processedCount: number;
  createdCount: number;
  updatedCount: number;
  failedCount: number;
  lastError: string | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalDocumentItem {
  id: string;
  itemType: "PRODUCT" | "SERVICE";
  sourceType: string | null;
  catalogProfileId: string | null;
  sku: string | null;
  name: string;
  descriptionCommercial: string | null;
  descriptionFiscal: string | null;
  quantity: string;
  unit: string | null;
  unitPrice: string;
  discountAmount: string | null;
  totalAmount: string;
  taxConfigSnapshot: unknown;
  metadata: unknown;
}

export interface FiscalParty {
  id: string;
  role: "EMITTER" | "RECIPIENT" | "TAKER" | "SUPPLIER";
  name: string;
  legalName: string | null;
  cnpjCpf: string;
  stateRegistration: string | null;
  municipalRegistration: string | null;
  email: string | null;
  phone: string | null;
  address: unknown;
  metadata: unknown;
}

export interface FiscalDocument {
  id: string;
  workspaceId: string;
  workspaceBusinessId: string | null;
  companyConfigId: string | null;
  internalReference: string;
  provider: string;
  direction: FiscalDirection;
  documentType: FiscalDocumentType;
  origin: FiscalDocumentOrigin;
  sourceSystem: string;
  status: FiscalDocumentStatus;
  issueStatus: FiscalIssueStatus;
  focusStatus: string | null;
  operationStatus: string | null;
  customerId: string | null;
  supplierId: string | null;
  saleId: string | null;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  stripeAccountId: string | null;
  focusReference: string | null;
  focusDocumentId: string | null;
  number: string | null;
  series: string | null;
  amountSubtotal: string | null;
  amountDiscount: string | null;
  amountTotal: string | null;
  currency: string;
  issuedAt: string | null;
  authorizedAt: string | null;
  cancelledAt: string | null;
  xmlUrl: string | null;
  pdfUrl: string | null;
  xmlStorageRef: string | null;
  pdfStorageRef: string | null;
  requestPayloadSnapshot: unknown;
  responsePayloadSnapshot: unknown;
  providerPayloadRaw: unknown;
  metadata: unknown;
  lastSyncAt: string | null;
  lastError: string | null;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  items?: FiscalDocumentItem[];
  parties?: FiscalParty[];
}

export interface FiscalIntegrationLog {
  id: string;
  operation: string;
  status: string;
  createdAt: string;
  errorMessage: string | null;
}

export interface FiscalDocumentDetails {
  document: FiscalDocument;
  integrationLogs: FiscalIntegrationLog[];
}

export interface FiscalReceivedDocument {
  id: string;
  workspaceId: string;
  workspaceBusinessId: string | null;
  companyConfigId: string | null;
  type: FiscalReceivedType;
  status: FiscalReceivedStatus;
  manifestationStatus: string | null;
  externalKey: string;
  providerReference: string | null;
  focusReference: string | null;
  issuerName: string | null;
  issuerDocument: string | null;
  recipientDocument: string | null;
  amountTotal: string | null;
  issuedAt: string | null;
  receivedAt: string | null;
  xmlUrl: string | null;
  pdfUrl: string | null;
  payload: unknown;
  supplierId: string | null;
  costCenterId: string | null;
  categoryId: string | null;
  financialEntryId: string | null;
  purchaseId: string | null;
  mappedDocumentId: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalCompanyConfig {
  id: string;
  workspaceId: string;
  workspaceBusinessId: string | null;
  provider: string;
  displayName: string;
  legalName: string;
  cnpj: string;
  stateRegistration: string | null;
  municipalRegistration: string | null;
  taxRegime: string | null;
  focusToken: string;
  focusEnvironment: string;
  focusCompanyReference: string | null;
  focusWebhookSecret: string | null;
  emitAutomatically: boolean;
  stripePolicy: string;
  defaultSerie: string | null;
  defaultNatureOperation: string | null;
  fallbackRules: unknown;
  syncConfig: unknown;
  metadata: unknown;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalCatalogProfile {
  id: string;
  workspaceId: string;
  workspaceBusinessId: string | null;
  itemType: "PRODUCT" | "SERVICE";
  name: string;
  descriptionCommercial: string | null;
  descriptionFiscal: string | null;
  sku: string | null;
  unit: string | null;
  defaultValue: string | null;
  ncm: string | null;
  serviceCode: string | null;
  cnae: string | null;
  lcItem: string | null;
  cfopDefault: string | null;
  operationNature: string | null;
  taxConfig: unknown;
  isActive: boolean;
  metadata: unknown;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalOperationTemplate {
  id: string;
  workspaceId: string;
  workspaceBusinessId: string | null;
  name: string;
  documentType: FiscalDocumentType;
  itemType: "PRODUCT" | "SERVICE" | null;
  serie: string | null;
  natureOperation: string | null;
  cfop: string | null;
  taxDefaults: unknown;
  notes: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FiscalEmissionDraft {
  id: string;
  workspaceId: string;
  workspaceBusinessId: string | null;
  companyConfigId: string | null;
  status: FiscalDraftStatus;
  documentType: FiscalDocumentType;
  origin: FiscalDocumentOrigin;
  saleId: string | null;
  stripeSessionId: string | null;
  stripePaymentIntentId: string | null;
  emitAfterPayment: boolean;
  autoIssueEligible: boolean;
  payload: unknown;
  suggestion: unknown;
  createdByUserId: string | null;
  issuedDocumentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateFiscalDocumentInput {
  workspaceBusinessId?: string | null;
  companyConfigId?: string | null;
  internalReference: string;
  direction: FiscalDirection;
  documentType: FiscalDocumentType;
  origin: FiscalDocumentOrigin;
  sourceSystem?: "INTERNAL" | "STRIPE" | "FOCUS" | "MDE" | "NFSER";
  customerId?: string | null;
  supplierId?: string | null;
  saleId?: string | null;
  stripeSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
  stripeAccountId?: string | null;
  focusReference?: string | null;
  amountSubtotal?: string | null;
  amountDiscount?: string | null;
  amountTotal?: string | null;
  currency?: string;
  requestPayloadSnapshot?: Record<string, unknown> | null;
  responsePayloadSnapshot?: Record<string, unknown> | null;
  providerPayloadRaw?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  items?: Array<{
    itemType: "PRODUCT" | "SERVICE";
    sourceType?: string | null;
    catalogProfileId?: string | null;
    sku?: string | null;
    name: string;
    descriptionCommercial?: string | null;
    descriptionFiscal?: string | null;
    quantity: string;
    unit?: string | null;
    unitPrice: string;
    discountAmount?: string | null;
    totalAmount: string;
    taxConfigSnapshot?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
  }>;
  parties?: Array<{
    role: "EMITTER" | "RECIPIENT" | "TAKER" | "SUPPLIER";
    name: string;
    legalName?: string | null;
    cnpjCpf: string;
    stateRegistration?: string | null;
    municipalRegistration?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
  }>;
}
