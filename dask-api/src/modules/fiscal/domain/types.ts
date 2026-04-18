export const fiscalDocumentOrigins = [
  'MANUAL_PRODUCT',
  'MANUAL_SERVICE',
  'CATALOG_PRODUCT',
  'CATALOG_SERVICE',
  'STRIPE_PAYMENT',
  'STRIPE_SUBSCRIPTION',
  'EXTERNAL_RECEIVED_NFE',
  'EXTERNAL_RECEIVED_NFSE'
] as const;

export type FiscalDocumentOrigin = (typeof fiscalDocumentOrigins)[number];

export type FiscalDocumentStatus =
  | 'DRAFT'
  | 'READY_TO_ISSUE'
  | 'ISSUING'
  | 'AUTHORIZED'
  | 'PROCESSING'
  | 'PENDING_REVIEW'
  | 'REJECTED'
  | 'CANCELLED'
  | 'FAILED'
  | 'RECEIVED'
  | 'MANIFEST_PENDING'
  | 'MANIFESTED'
  | 'SYNCED';

export type FiscalIssueStatus =
  | 'NOT_STARTED'
  | 'PROCESSING'
  | 'AUTHORIZED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'FAILED';

export type FiscalDocumentType = 'NFE' | 'NFSE';

export type FiscalDirection = 'OUTBOUND' | 'INBOUND';

export type FiscalSourceSystem = 'INTERNAL' | 'STRIPE' | 'FOCUS' | 'MDE' | 'NFSER';

export type FiscalReceivedType = 'NFE_MDE' | 'NFSE_NFSER';

export interface FiscalPartySnapshot {
  role: 'EMITTER' | 'RECIPIENT' | 'TAKER' | 'SUPPLIER';
  name: string;
  legalName?: string | null;
  cnpjCpf: string;
  stateRegistration?: string | null;
  municipalRegistration?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface FiscalItemSnapshot {
  itemType: 'PRODUCT' | 'SERVICE';
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
}

export interface CreateFiscalDocumentInput {
  workspaceId: string;
  workspaceBusinessId?: string | null;
  companyConfigId?: string | null;
  internalReference: string;
  direction: FiscalDirection;
  documentType: FiscalDocumentType;
  origin: FiscalDocumentOrigin;
  sourceSystem?: FiscalSourceSystem;
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
  createdByUserId?: string | null;
  items?: FiscalItemSnapshot[];
  parties?: FiscalPartySnapshot[];
}

export interface UpdateFiscalDocumentStatusInput {
  id: string;
  workspaceId: string;
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
}

function includesAny(value: string, candidates: string[]): boolean {
  return candidates.some((candidate) => value.includes(candidate));
}

export function mapFocusStatusToInternal(status: unknown): {
  status: FiscalDocumentStatus;
  issueStatus: FiscalIssueStatus;
} {
  if (typeof status !== 'string' || status.trim().length === 0) {
    return {
      status: 'PROCESSING',
      issueStatus: 'PROCESSING'
    };
  }

  const normalized = status.trim().toLowerCase();

  if (includesAny(normalized, ['autorizad', 'aprovad', 'emitid'])) {
    return {
      status: 'AUTHORIZED',
      issueStatus: 'AUTHORIZED'
    };
  }

  if (includesAny(normalized, ['cancelad'])) {
    return {
      status: 'CANCELLED',
      issueStatus: 'CANCELLED'
    };
  }

  if (includesAny(normalized, ['rejeitad', 'erro', 'invalid', 'falh'])) {
    return {
      status: 'REJECTED',
      issueStatus: 'REJECTED'
    };
  }

  if (includesAny(normalized, ['process', 'fila', 'pendente'])) {
    return {
      status: 'PROCESSING',
      issueStatus: 'PROCESSING'
    };
  }

  return {
    status: 'PROCESSING',
    issueStatus: 'PROCESSING'
  };
}

export function sanitizeDocumentReference(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
