import { z } from 'zod';

export const workspaceParamsDto = z.object({
  workspaceId: z.string().uuid()
});

export const fiscalDocumentParamsDto = z.object({
  workspaceId: z.string().uuid(),
  documentId: z.string().uuid()
});

export const fiscalCompanyParamsDto = z.object({
  workspaceId: z.string().uuid(),
  companyId: z.string().uuid()
});

export const fiscalDraftParamsDto = z.object({
  workspaceId: z.string().uuid(),
  draftId: z.string().uuid()
});

export const fiscalDocumentsQueryDto = z.object({
  workspaceBusinessId: z.string().optional(),
  documentType: z.enum(['NFE', 'NFSE']).optional(),
  direction: z.enum(['OUTBOUND', 'INBOUND']).optional(),
  status: z.string().optional(),
  origin: z.string().optional(),
  customerId: z.string().optional(),
  search: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional()
});

const fiscalItemDto = z.object({
  itemType: z.enum(['PRODUCT', 'SERVICE']),
  sourceType: z.string().optional().nullable(),
  catalogProfileId: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  name: z.string().min(1),
  descriptionCommercial: z.string().optional().nullable(),
  descriptionFiscal: z.string().optional().nullable(),
  quantity: z.string().min(1),
  unit: z.string().optional().nullable(),
  unitPrice: z.string().min(1),
  discountAmount: z.string().optional().nullable(),
  totalAmount: z.string().min(1),
  taxConfigSnapshot: z.record(z.unknown()).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable()
});

const fiscalPartyDto = z.object({
  role: z.enum(['EMITTER', 'RECIPIENT', 'TAKER', 'SUPPLIER']),
  name: z.string().min(1),
  legalName: z.string().optional().nullable(),
  cnpjCpf: z.string().min(11),
  stateRegistration: z.string().optional().nullable(),
  municipalRegistration: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.record(z.unknown()).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable()
});

export const createFiscalDocumentDto = z.object({
  workspaceBusinessId: z.string().optional().nullable(),
  companyConfigId: z.string().uuid().optional().nullable(),
  internalReference: z.string().min(3),
  direction: z.enum(['OUTBOUND', 'INBOUND']),
  documentType: z.enum(['NFE', 'NFSE']),
  origin: z.enum([
    'MANUAL_PRODUCT',
    'MANUAL_SERVICE',
    'CATALOG_PRODUCT',
    'CATALOG_SERVICE',
    'STRIPE_PAYMENT',
    'STRIPE_SUBSCRIPTION',
    'EXTERNAL_RECEIVED_NFE',
    'EXTERNAL_RECEIVED_NFSE'
  ]),
  sourceSystem: z.enum(['INTERNAL', 'STRIPE', 'FOCUS', 'MDE', 'NFSER']).optional(),
  customerId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  saleId: z.string().optional().nullable(),
  stripeSessionId: z.string().optional().nullable(),
  stripePaymentIntentId: z.string().optional().nullable(),
  stripeChargeId: z.string().optional().nullable(),
  stripeAccountId: z.string().optional().nullable(),
  focusReference: z.string().optional().nullable(),
  amountSubtotal: z.string().optional().nullable(),
  amountDiscount: z.string().optional().nullable(),
  amountTotal: z.string().optional().nullable(),
  currency: z.string().optional(),
  requestPayloadSnapshot: z.record(z.unknown()).optional().nullable(),
  responsePayloadSnapshot: z.record(z.unknown()).optional().nullable(),
  providerPayloadRaw: z.record(z.unknown()).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
  items: z.array(fiscalItemDto).optional(),
  parties: z.array(fiscalPartyDto).optional()
});

export const cancelFiscalDocumentDto = z.object({
  justification: z.string().min(5).max(500).optional()
});

export const receivedQueryDto = z.object({
  workspaceBusinessId: z.string().optional(),
  type: z.enum(['NFE_MDE', 'NFSE_NFSER']).optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional()
});

export const syncReceivedDto = z.object({
  companyConfigId: z.string().uuid(),
  type: z.enum(['NFE_MDE', 'NFSE_NFSER']),
  trigger: z.enum(['MANUAL', 'SCHEDULED', 'WEBHOOK', 'RETRY']).default('MANUAL')
});

export const fiscalDraftsQueryDto = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional()
});

export const createFiscalCompanyConfigDto = z.object({
  workspaceBusinessId: z.string().optional().nullable(),
  displayName: z.string().min(2),
  legalName: z.string().min(2),
  cnpj: z.string().min(14),
  stateRegistration: z.string().optional().nullable(),
  municipalRegistration: z.string().optional().nullable(),
  taxRegime: z.string().optional().nullable(),
  focusToken: z.string().min(10),
  focusEnvironment: z.string().default('homologacao'),
  focusCompanyReference: z.string().optional().nullable(),
  focusWebhookSecret: z.string().optional().nullable(),
  emitAutomatically: z.boolean().optional(),
  stripePolicy: z.string().optional(),
  defaultSerie: z.string().optional().nullable(),
  defaultNatureOperation: z.string().optional().nullable(),
  fallbackRules: z.record(z.unknown()).optional().nullable(),
  syncConfig: z.record(z.unknown()).optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable()
});

export const updateFiscalCompanyConfigDto = createFiscalCompanyConfigDto.partial();

export const upsertFiscalCatalogProfileDto = z.object({
  id: z.string().uuid().optional(),
  workspaceBusinessId: z.string().optional().nullable(),
  itemType: z.enum(['PRODUCT', 'SERVICE']),
  name: z.string().min(1),
  descriptionCommercial: z.string().optional().nullable(),
  descriptionFiscal: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  defaultValue: z.number().optional().nullable(),
  ncm: z.string().optional().nullable(),
  serviceCode: z.string().optional().nullable(),
  cnae: z.string().optional().nullable(),
  lcItem: z.string().optional().nullable(),
  cfopDefault: z.string().optional().nullable(),
  operationNature: z.string().optional().nullable(),
  taxConfig: z.record(z.unknown()).optional().nullable(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional().nullable()
});

export const upsertFiscalOperationTemplateDto = z.object({
  id: z.string().uuid().optional(),
  workspaceBusinessId: z.string().optional().nullable(),
  name: z.string().min(1),
  documentType: z.enum(['NFE', 'NFSE']),
  itemType: z.enum(['PRODUCT', 'SERVICE']).optional().nullable(),
  serie: z.string().optional().nullable(),
  natureOperation: z.string().optional().nullable(),
  cfop: z.string().optional().nullable(),
  taxDefaults: z.record(z.unknown()).optional().nullable(),
  notes: z.string().optional().nullable(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional()
});
