import {
  Prisma,
  type FiscalCatalogProfile,
  type FiscalCompanyConfig,
  type FiscalDirection,
  type FiscalDocument,
  type FiscalDocumentItem,
  type FiscalDocumentOrigin,
  type FiscalEmissionDraft,
  type FiscalIntegrationLog,
  type FiscalOperationTemplate,
  type FiscalParty,
  type FiscalReceivedDocument,
  type FiscalSyncRun,
  type FiscalWebhookEvent,
  type FiscalSyncStatus,
  type PrismaClient
} from '@prisma/client';
import type {
  CreateFiscalDocumentInput,
  UpdateFiscalDocumentStatusInput
} from '@/modules/fiscal/domain/types';
import type {
  FiscalDocumentsQuery,
  FiscalReceivedQuery,
  FiscalRepository
} from '@/modules/fiscal/repositories/fiscal-repository';

function toJson(value: unknown): Prisma.InputJsonValue {
  return (value ?? Prisma.JsonNull) as Prisma.InputJsonValue;
}

function toNullableJson(value: unknown): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
  if (value === undefined || value === null) {
    return Prisma.JsonNull;
  }
  return value as Prisma.InputJsonValue;
}

function resolveLimit(input?: number, fallback = 100, max = 500): number {
  if (typeof input !== 'number' || Number.isNaN(input)) {
    return fallback;
  }

  return Math.max(1, Math.min(max, Math.round(input)));
}

function resolveCursorPagination(
  input?: number | { pageSize?: number; limit?: number; cursor?: string },
  fallback = 100,
  max = 500
): { take: number; cursor?: { id: string }; skip?: number } {
  const pageSize = typeof input === 'number'
    ? input
    : input?.pageSize ?? input?.limit;
  const cursor = typeof input === 'number' ? undefined : input?.cursor;

  return {
    take: resolveLimit(pageSize, fallback, max),
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
  };
}

export class PrismaFiscalRepository implements FiscalRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async listCompanyConfigs(
    workspaceId: string,
    options?: { cursor?: string; pageSize?: number; limit?: number; search?: string }
  ): Promise<FiscalCompanyConfig[]> {
    const search = options?.search?.trim();
    return this.prisma.fiscalCompanyConfig.findMany({
      where: {
        workspaceId,
        OR: search
          ? [
              { displayName: { contains: search, mode: 'insensitive' } },
              { legalName: { contains: search, mode: 'insensitive' } },
              { cnpj: { contains: search.replace(/\D/g, ''), mode: 'insensitive' } }
            ]
          : undefined
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(options ? resolveCursorPagination(options, 100, 201) : {})
    });
  }

  public async findCompanyConfigById(
    workspaceId: string,
    companyConfigId: string
  ): Promise<FiscalCompanyConfig | null> {
    return this.prisma.fiscalCompanyConfig.findFirst({
      where: {
        id: companyConfigId,
        workspaceId
      }
    });
  }

  public async createCompanyConfig(
    input: Omit<FiscalCompanyConfig, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<FiscalCompanyConfig> {
    return this.prisma.fiscalCompanyConfig.create({
      data: {
        workspaceId: input.workspaceId,
        workspaceBusinessId: input.workspaceBusinessId,
        provider: input.provider,
        displayName: input.displayName,
        legalName: input.legalName,
        cnpj: input.cnpj,
        stateRegistration: input.stateRegistration,
        municipalRegistration: input.municipalRegistration,
        taxRegime: input.taxRegime,
        focusToken: input.focusToken,
        focusEnvironment: input.focusEnvironment,
        focusCompanyReference: input.focusCompanyReference,
        focusWebhookSecret: input.focusWebhookSecret,
        emitAutomatically: input.emitAutomatically,
        stripePolicy: input.stripePolicy,
        defaultSerie: input.defaultSerie,
        defaultNatureOperation: input.defaultNatureOperation,
        fallbackRules: toNullableJson(input.fallbackRules),
        syncConfig: toNullableJson(input.syncConfig),
        metadata: toNullableJson(input.metadata),
        createdByUserId: input.createdByUserId
      }
    });
  }

  public async updateCompanyConfig(
    workspaceId: string,
    companyConfigId: string,
    patch: Partial<Omit<FiscalCompanyConfig, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>>
  ): Promise<FiscalCompanyConfig | null> {
    const existing = await this.findCompanyConfigById(workspaceId, companyConfigId);
    if (!existing) {
      return null;
    }

    return this.prisma.fiscalCompanyConfig.update({
      where: {
        id: companyConfigId
      },
      data: {
        workspaceBusinessId: patch.workspaceBusinessId,
        provider: patch.provider,
        displayName: patch.displayName,
        legalName: patch.legalName,
        cnpj: patch.cnpj,
        stateRegistration: patch.stateRegistration,
        municipalRegistration: patch.municipalRegistration,
        taxRegime: patch.taxRegime,
        focusToken: patch.focusToken,
        focusEnvironment: patch.focusEnvironment,
        focusCompanyReference: patch.focusCompanyReference,
        focusWebhookSecret: patch.focusWebhookSecret,
        emitAutomatically: patch.emitAutomatically,
        stripePolicy: patch.stripePolicy,
        defaultSerie: patch.defaultSerie,
        defaultNatureOperation: patch.defaultNatureOperation,
        fallbackRules:
          patch.fallbackRules !== undefined ? toNullableJson(patch.fallbackRules) : undefined,
        syncConfig: patch.syncConfig !== undefined ? toNullableJson(patch.syncConfig) : undefined,
        metadata: patch.metadata !== undefined ? toNullableJson(patch.metadata) : undefined,
        createdByUserId: patch.createdByUserId
      }
    });
  }

  public async listDocuments(
    query: FiscalDocumentsQuery
  ): Promise<Array<FiscalDocument & { items: FiscalDocumentItem[]; parties: FiscalParty[] }>> {
    return this.prisma.fiscalDocument.findMany({
      where: {
        workspaceId: query.workspaceId,
        workspaceBusinessId: query.workspaceBusinessId,
        documentType: query.documentType,
        direction: query.direction as FiscalDirection | undefined,
        status: query.status,
        origin: query.origin as FiscalDocumentOrigin | undefined,
        customerId: query.customerIds
          ? { in: query.customerId ? query.customerIds.filter((id) => id === query.customerId) : query.customerIds }
          : query.customerId,
        createdAt:
          query.from || query.to
            ? {
                gte: query.from,
                lte: query.to
              }
            : undefined,
        OR: query.search
          ? [
              {
                internalReference: {
                  contains: query.search,
                  mode: 'insensitive'
                }
              },
              {
                focusReference: {
                  contains: query.search,
                  mode: 'insensitive'
                }
              },
              {
                saleId: {
                  contains: query.search,
                  mode: 'insensitive'
                }
              }
            ]
          : undefined
      },
      include: {
        items: true,
        parties: true
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: resolveLimit(query.limit, 120, 201)
    });
  }

  public async getDocumentById(
    workspaceId: string,
    documentId: string,
    customerIds?: string[]
  ): Promise<(FiscalDocument & { items: FiscalDocumentItem[]; parties: FiscalParty[] }) | null> {
    return this.prisma.fiscalDocument.findFirst({
      where: {
        id: documentId,
        workspaceId,
        ...(customerIds ? { customerId: { in: customerIds } } : {})
      },
      include: {
        items: true,
        parties: true
      }
    });
  }

  public async findDocumentByReference(
    workspaceId: string,
    internalReference: string
  ): Promise<(FiscalDocument & { items: FiscalDocumentItem[]; parties: FiscalParty[] }) | null> {
    return this.prisma.fiscalDocument.findFirst({
      where: {
        workspaceId,
        internalReference
      },
      include: {
        items: true,
        parties: true
      }
    });
  }

  public async createDocument(
    input: CreateFiscalDocumentInput
  ): Promise<FiscalDocument & { items: FiscalDocumentItem[]; parties: FiscalParty[] }> {
    return this.prisma.fiscalDocument.create({
      data: {
        workspaceId: input.workspaceId,
        workspaceBusinessId: input.workspaceBusinessId,
        companyConfigId: input.companyConfigId,
        internalReference: input.internalReference,
        provider: 'FOCUS',
        direction: input.direction,
        documentType: input.documentType,
        origin: input.origin,
        sourceSystem: input.sourceSystem ?? 'INTERNAL',
        customerId: input.customerId,
        supplierId: input.supplierId,
        saleId: input.saleId,
        stripeSessionId: input.stripeSessionId,
        stripePaymentIntentId: input.stripePaymentIntentId,
        stripeChargeId: input.stripeChargeId,
        stripeAccountId: input.stripeAccountId,
        focusReference: input.focusReference,
        amountSubtotal:
          input.amountSubtotal !== undefined && input.amountSubtotal !== null
            ? new Prisma.Decimal(input.amountSubtotal)
            : undefined,
        amountDiscount:
          input.amountDiscount !== undefined && input.amountDiscount !== null
            ? new Prisma.Decimal(input.amountDiscount)
            : undefined,
        amountTotal:
          input.amountTotal !== undefined && input.amountTotal !== null
            ? new Prisma.Decimal(input.amountTotal)
            : undefined,
        currency: input.currency ?? 'BRL',
        requestPayloadSnapshot: toNullableJson(input.requestPayloadSnapshot),
        responsePayloadSnapshot: toNullableJson(input.responsePayloadSnapshot),
        providerPayloadRaw: toNullableJson(input.providerPayloadRaw),
        metadata: toNullableJson(input.metadata),
        createdByUserId: input.createdByUserId,
        items:
          input.items && input.items.length > 0
            ? {
                create: input.items.map((item) => ({
                  itemType: item.itemType,
                  sourceType: item.sourceType,
                  catalogProfileId: item.catalogProfileId,
                  sku: item.sku,
                  name: item.name,
                  descriptionCommercial: item.descriptionCommercial,
                  descriptionFiscal: item.descriptionFiscal,
                  quantity: new Prisma.Decimal(item.quantity),
                  unit: item.unit,
                  unitPrice: new Prisma.Decimal(item.unitPrice),
                  discountAmount:
                    item.discountAmount !== undefined && item.discountAmount !== null
                      ? new Prisma.Decimal(item.discountAmount)
                      : undefined,
                  totalAmount: new Prisma.Decimal(item.totalAmount),
                  taxConfigSnapshot: toNullableJson(item.taxConfigSnapshot),
                  metadata: toNullableJson(item.metadata)
                }))
              }
            : undefined,
        parties:
          input.parties && input.parties.length > 0
            ? {
                create: input.parties.map((party) => ({
                  role: party.role,
                  name: party.name,
                  legalName: party.legalName,
                  cnpjCpf: party.cnpjCpf,
                  stateRegistration: party.stateRegistration,
                  municipalRegistration: party.municipalRegistration,
                  email: party.email,
                  phone: party.phone,
                  address: toNullableJson(party.address),
                  metadata: toNullableJson(party.metadata)
                }))
              }
            : undefined
      },
      include: {
        items: true,
        parties: true
      }
    });
  }

  public async updateDocumentStatus(input: UpdateFiscalDocumentStatusInput): Promise<FiscalDocument | null> {
    const existing = await this.prisma.fiscalDocument.findFirst({
      where: {
        id: input.id,
        workspaceId: input.workspaceId
      }
    });

    if (!existing) {
      return null;
    }

    return this.prisma.fiscalDocument.update({
      where: {
        id: input.id
      },
      data: {
        status: input.status,
        issueStatus: input.issueStatus,
        focusStatus: input.focusStatus,
        operationStatus: input.operationStatus,
        focusDocumentId: input.focusDocumentId,
        xmlUrl: input.xmlUrl,
        pdfUrl: input.pdfUrl,
        responsePayloadSnapshot:
          input.responsePayloadSnapshot !== undefined
            ? toNullableJson(input.responsePayloadSnapshot)
            : undefined,
        providerPayloadRaw:
          input.providerPayloadRaw !== undefined ? toNullableJson(input.providerPayloadRaw) : undefined,
        lastError: input.lastError,
        lastSyncAt: new Date(),
        authorizedAt:
          input.status === 'AUTHORIZED' && existing.authorizedAt === null ? new Date() : undefined,
        issuedAt: input.status === 'AUTHORIZED' && existing.issuedAt === null ? new Date() : undefined,
        cancelledAt:
          input.status === 'CANCELLED' && existing.cancelledAt === null ? new Date() : undefined
      }
    });
  }

  public async updateDocumentPayloadSnapshots(
    workspaceId: string,
    documentId: string,
    patch: {
      requestPayloadSnapshot?: Record<string, unknown> | null;
      responsePayloadSnapshot?: Record<string, unknown> | null;
      providerPayloadRaw?: Record<string, unknown> | null;
      lastError?: string | null;
    }
  ): Promise<FiscalDocument | null> {
    const existing = await this.prisma.fiscalDocument.findFirst({
      where: {
        id: documentId,
        workspaceId
      }
    });

    if (!existing) {
      return null;
    }

    return this.prisma.fiscalDocument.update({
      where: {
        id: documentId
      },
      data: {
        requestPayloadSnapshot:
          patch.requestPayloadSnapshot !== undefined
            ? toNullableJson(patch.requestPayloadSnapshot)
            : undefined,
        responsePayloadSnapshot:
          patch.responsePayloadSnapshot !== undefined
            ? toNullableJson(patch.responsePayloadSnapshot)
            : undefined,
        providerPayloadRaw:
          patch.providerPayloadRaw !== undefined ? toNullableJson(patch.providerPayloadRaw) : undefined,
        lastError: patch.lastError,
        lastSyncAt: new Date()
      }
    });
  }

  public async createEmissionDraft(
    input: Omit<FiscalEmissionDraft, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<FiscalEmissionDraft> {
    return this.prisma.fiscalEmissionDraft.create({
      data: {
        workspaceId: input.workspaceId,
        workspaceBusinessId: input.workspaceBusinessId,
        companyConfigId: input.companyConfigId,
        status: input.status,
        documentType: input.documentType,
        origin: input.origin,
        saleId: input.saleId,
        stripeSessionId: input.stripeSessionId,
        stripePaymentIntentId: input.stripePaymentIntentId,
        emitAfterPayment: input.emitAfterPayment,
        autoIssueEligible: input.autoIssueEligible,
        payload: toJson(input.payload),
        suggestion: toNullableJson(input.suggestion),
        createdByUserId: input.createdByUserId,
        issuedDocumentId: input.issuedDocumentId
      }
    });
  }

  public async listEmissionDrafts(
    workspaceId: string,
    options?: number | { cursor?: string; pageSize?: number; limit?: number }
  ): Promise<FiscalEmissionDraft[]> {
    return this.prisma.fiscalEmissionDraft.findMany({
      where: {
        workspaceId
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...resolveCursorPagination(options, 50, 201)
    });
  }

  public async findEmissionDraftById(
    workspaceId: string,
    draftId: string
  ): Promise<FiscalEmissionDraft | null> {
    return this.prisma.fiscalEmissionDraft.findFirst({
      where: {
        id: draftId,
        workspaceId
      }
    });
  }

  public async findEmissionDraftByStripeSession(
    workspaceId: string,
    stripeSessionId: string
  ): Promise<FiscalEmissionDraft | null> {
    return this.prisma.fiscalEmissionDraft.findFirst({
      where: {
        workspaceId,
        stripeSessionId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  public async updateEmissionDraft(
    workspaceId: string,
    draftId: string,
    patch: Partial<Omit<FiscalEmissionDraft, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>>
  ): Promise<FiscalEmissionDraft | null> {
    const existing = await this.findEmissionDraftById(workspaceId, draftId);
    if (!existing) {
      return null;
    }

    return this.prisma.fiscalEmissionDraft.update({
      where: {
        id: draftId
      },
      data: {
        workspaceBusinessId: patch.workspaceBusinessId,
        companyConfigId: patch.companyConfigId,
        status: patch.status,
        documentType: patch.documentType,
        origin: patch.origin,
        saleId: patch.saleId,
        stripeSessionId: patch.stripeSessionId,
        stripePaymentIntentId: patch.stripePaymentIntentId,
        emitAfterPayment: patch.emitAfterPayment,
        autoIssueEligible: patch.autoIssueEligible,
        payload: patch.payload !== undefined ? toJson(patch.payload) : undefined,
        suggestion: patch.suggestion !== undefined ? toNullableJson(patch.suggestion) : undefined,
        createdByUserId: patch.createdByUserId,
        issuedDocumentId: patch.issuedDocumentId
      }
    });
  }

  public async upsertReceivedDocument(
    input: Omit<FiscalReceivedDocument, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<FiscalReceivedDocument> {
    return this.prisma.fiscalReceivedDocument.upsert({
      where: {
        workspaceId_type_externalKey: {
          workspaceId: input.workspaceId,
          type: input.type,
          externalKey: input.externalKey
        }
      },
      create: {
        workspaceId: input.workspaceId,
        workspaceBusinessId: input.workspaceBusinessId,
        companyConfigId: input.companyConfigId,
        type: input.type,
        status: input.status,
        manifestationStatus: input.manifestationStatus,
        externalKey: input.externalKey,
        providerReference: input.providerReference,
        focusReference: input.focusReference,
        issuerName: input.issuerName,
        issuerDocument: input.issuerDocument,
        recipientDocument: input.recipientDocument,
        amountTotal: input.amountTotal,
        issuedAt: input.issuedAt,
        receivedAt: input.receivedAt,
        xmlUrl: input.xmlUrl,
        pdfUrl: input.pdfUrl,
        payload: toNullableJson(input.payload),
        supplierId: input.supplierId,
        costCenterId: input.costCenterId,
        categoryId: input.categoryId,
        financialEntryId: input.financialEntryId,
        purchaseId: input.purchaseId,
        mappedDocumentId: input.mappedDocumentId,
        lastSyncAt: input.lastSyncAt,
        lastError: input.lastError,
        metadata: toNullableJson(input.metadata)
      },
      update: {
        workspaceBusinessId: input.workspaceBusinessId,
        companyConfigId: input.companyConfigId,
        status: input.status,
        manifestationStatus: input.manifestationStatus,
        providerReference: input.providerReference,
        focusReference: input.focusReference,
        issuerName: input.issuerName,
        issuerDocument: input.issuerDocument,
        recipientDocument: input.recipientDocument,
        amountTotal: input.amountTotal,
        issuedAt: input.issuedAt,
        receivedAt: input.receivedAt,
        xmlUrl: input.xmlUrl,
        pdfUrl: input.pdfUrl,
        payload: toNullableJson(input.payload),
        supplierId: input.supplierId,
        costCenterId: input.costCenterId,
        categoryId: input.categoryId,
        financialEntryId: input.financialEntryId,
        purchaseId: input.purchaseId,
        mappedDocumentId: input.mappedDocumentId,
        lastSyncAt: input.lastSyncAt,
        lastError: input.lastError,
        metadata: toNullableJson(input.metadata)
      }
    });
  }

  public async listReceivedDocuments(query: FiscalReceivedQuery): Promise<FiscalReceivedDocument[]> {
    return this.prisma.fiscalReceivedDocument.findMany({
      where: {
        workspaceId: query.workspaceId,
        workspaceBusinessId: query.workspaceBusinessId,
        type: query.type,
        status: query.status,
        createdAt:
          query.from || query.to
            ? {
                gte: query.from,
                lte: query.to
              }
            : undefined,
        OR: query.search
          ? [
              {
                externalKey: {
                  contains: query.search,
                  mode: 'insensitive'
                }
              },
              {
                issuerName: {
                  contains: query.search,
                  mode: 'insensitive'
                }
              },
              {
                issuerDocument: {
                  contains: query.search,
                  mode: 'insensitive'
                }
              }
            ]
          : undefined
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      take: resolveLimit(query.limit, 120, 201)
    });
  }

  public async createSyncRun(
    input: Omit<FiscalSyncRun, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<FiscalSyncRun> {
    return this.prisma.fiscalSyncRun.create({
      data: {
        workspaceId: input.workspaceId,
        workspaceBusinessId: input.workspaceBusinessId,
        companyConfigId: input.companyConfigId,
        syncType: input.syncType,
        trigger: input.trigger,
        status: input.status,
        startedAt: input.startedAt,
        finishedAt: input.finishedAt,
        processedCount: input.processedCount,
        createdCount: input.createdCount,
        updatedCount: input.updatedCount,
        failedCount: input.failedCount,
        requestSnapshot: toNullableJson(input.requestSnapshot),
        responseSnapshot: toNullableJson(input.responseSnapshot),
        lastError: input.lastError
      }
    });
  }

  public async finishSyncRun(
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
  ): Promise<FiscalSyncRun> {
    return this.prisma.fiscalSyncRun.update({
      where: {
        id
      },
      data: {
        status: patch.status,
        processedCount: patch.processedCount,
        createdCount: patch.createdCount,
        updatedCount: patch.updatedCount,
        failedCount: patch.failedCount,
        responseSnapshot:
          patch.responseSnapshot !== undefined ? toNullableJson(patch.responseSnapshot) : undefined,
        lastError: patch.lastError,
        finishedAt: new Date()
      }
    });
  }

  public async listLatestSyncRuns(
    workspaceId: string,
    options?: number | { cursor?: string; pageSize?: number; limit?: number }
  ): Promise<FiscalSyncRun[]> {
    return this.prisma.fiscalSyncRun.findMany({
      where: {
        workspaceId
      },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      ...resolveCursorPagination(options, 20, 201)
    });
  }

  public async createWebhookEvent(
    input: Omit<FiscalWebhookEvent, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<FiscalWebhookEvent> {
    return this.prisma.fiscalWebhookEvent.create({
      data: {
        workspaceId: input.workspaceId,
        source: input.source,
        providerEventId: input.providerEventId,
        eventType: input.eventType,
        idempotencyKey: input.idempotencyKey,
        status: input.status,
        headers: toNullableJson(input.headers),
        payload: toJson(input.payload),
        signature: input.signature,
        attempts: input.attempts,
        processedAt: input.processedAt,
        lastError: input.lastError
      }
    });
  }

  public async findWebhookEventByIdempotencyKey(
    idempotencyKey: string
  ): Promise<FiscalWebhookEvent | null> {
    return this.prisma.fiscalWebhookEvent.findUnique({
      where: {
        idempotencyKey
      }
    });
  }

  public async updateWebhookEvent(
    id: string,
    patch: Partial<
      Pick<FiscalWebhookEvent, 'status' | 'attempts' | 'processedAt' | 'lastError' | 'workspaceId'>
    >
  ): Promise<FiscalWebhookEvent> {
    return this.prisma.fiscalWebhookEvent.update({
      where: {
        id
      },
      data: {
        workspaceId: patch.workspaceId,
        status: patch.status,
        attempts: patch.attempts,
        processedAt: patch.processedAt,
        lastError: patch.lastError
      }
    });
  }

  public async appendIntegrationLog(
    input: Omit<FiscalIntegrationLog, 'id' | 'createdAt'>
  ): Promise<FiscalIntegrationLog> {
    return this.prisma.fiscalIntegrationLog.create({
      data: {
        workspaceId: input.workspaceId,
        companyConfigId: input.companyConfigId,
        documentId: input.documentId,
        system: input.system,
        direction: input.direction,
        operation: input.operation,
        status: input.status,
        correlationId: input.correlationId,
        httpStatus: input.httpStatus,
        requestPayload: toNullableJson(input.requestPayload),
        responsePayload: toNullableJson(input.responsePayload),
        errorMessage: input.errorMessage
      }
    });
  }

  public async listIntegrationLogs(
    workspaceId: string,
    options?: { documentId?: string; limit?: number }
  ): Promise<FiscalIntegrationLog[]> {
    return this.prisma.fiscalIntegrationLog.findMany({
      where: {
        workspaceId,
        documentId: options?.documentId
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: resolveLimit(options?.limit, 100)
    });
  }

  public async getDashboardMetrics(workspaceId: string): Promise<{
    issuedToday: number;
    pending: number;
    rejected: number;
    received: number;
    pendingReview: number;
    latestSyncAt: Date | null;
  }> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const [issuedToday, pending, rejected, received, pendingReview, latestSyncRun] =
      await this.prisma.$transaction([
        this.prisma.fiscalDocument.count({
          where: {
            workspaceId,
            direction: 'OUTBOUND',
            status: 'AUTHORIZED',
            createdAt: {
              gte: startOfToday,
              lte: endOfToday
            }
          }
        }),
        this.prisma.fiscalDocument.count({
          where: {
            workspaceId,
            direction: 'OUTBOUND',
            status: {
              in: ['PROCESSING', 'ISSUING', 'READY_TO_ISSUE']
            }
          }
        }),
        this.prisma.fiscalDocument.count({
          where: {
            workspaceId,
            direction: 'OUTBOUND',
            status: {
              in: ['REJECTED', 'FAILED']
            }
          }
        }),
        this.prisma.fiscalReceivedDocument.count({
          where: {
            workspaceId
          }
        }),
        this.prisma.fiscalDocument.count({
          where: {
            workspaceId,
            status: 'PENDING_REVIEW'
          }
        }),
        this.prisma.fiscalSyncRun.findFirst({
          where: {
            workspaceId
          },
          orderBy: {
            startedAt: 'desc'
          }
        })
      ]);

    return {
      issuedToday,
      pending,
      rejected,
      received,
      pendingReview,
      latestSyncAt: latestSyncRun?.startedAt ?? null
    };
  }

  public async listCatalogProfiles(workspaceId: string): Promise<FiscalCatalogProfile[]> {
    return this.prisma.fiscalCatalogProfile.findMany({
      where: {
        workspaceId
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });
  }

  public async upsertCatalogProfile(
    workspaceId: string,
    input: Partial<Omit<FiscalCatalogProfile, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>> &
      Pick<FiscalCatalogProfile, 'name' | 'itemType'> & { id?: string }
  ): Promise<FiscalCatalogProfile> {
    if (!input.id) {
      return this.prisma.fiscalCatalogProfile.create({
        data: {
          workspaceId,
          workspaceBusinessId: input.workspaceBusinessId,
          itemType: input.itemType,
          name: input.name,
          descriptionCommercial: input.descriptionCommercial,
          descriptionFiscal: input.descriptionFiscal,
          sku: input.sku,
          unit: input.unit,
          defaultValue: input.defaultValue,
          ncm: input.ncm,
          serviceCode: input.serviceCode,
          cnae: input.cnae,
          lcItem: input.lcItem,
          cfopDefault: input.cfopDefault,
          operationNature: input.operationNature,
          taxConfig: toNullableJson(input.taxConfig),
          isActive: input.isActive ?? true,
          metadata: toNullableJson(input.metadata),
          createdByUserId: input.createdByUserId
        }
      });
    }

    return this.prisma.fiscalCatalogProfile.update({
      where: {
        id: input.id
      },
      data: {
        workspaceBusinessId: input.workspaceBusinessId,
        itemType: input.itemType,
        name: input.name,
        descriptionCommercial: input.descriptionCommercial,
        descriptionFiscal: input.descriptionFiscal,
        sku: input.sku,
        unit: input.unit,
        defaultValue: input.defaultValue,
        ncm: input.ncm,
        serviceCode: input.serviceCode,
        cnae: input.cnae,
        lcItem: input.lcItem,
        cfopDefault: input.cfopDefault,
        operationNature: input.operationNature,
        taxConfig: input.taxConfig !== undefined ? toNullableJson(input.taxConfig) : undefined,
        isActive: input.isActive,
        metadata: input.metadata !== undefined ? toNullableJson(input.metadata) : undefined,
        createdByUserId: input.createdByUserId
      }
    });
  }

  public async listOperationTemplates(workspaceId: string): Promise<FiscalOperationTemplate[]> {
    return this.prisma.fiscalOperationTemplate.findMany({
      where: {
        workspaceId
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });
  }

  public async upsertOperationTemplate(
    workspaceId: string,
    input: Partial<Omit<FiscalOperationTemplate, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>> &
      Pick<FiscalOperationTemplate, 'name' | 'documentType'> & { id?: string }
  ): Promise<FiscalOperationTemplate> {
    if (!input.id) {
      return this.prisma.fiscalOperationTemplate.create({
        data: {
          workspaceId,
          workspaceBusinessId: input.workspaceBusinessId,
          name: input.name,
          documentType: input.documentType,
          itemType: input.itemType,
          serie: input.serie,
          natureOperation: input.natureOperation,
          cfop: input.cfop,
          taxDefaults: toNullableJson(input.taxDefaults),
          notes: input.notes,
          isDefault: input.isDefault ?? false,
          isActive: input.isActive ?? true,
          createdByUserId: input.createdByUserId
        }
      });
    }

    return this.prisma.fiscalOperationTemplate.update({
      where: {
        id: input.id
      },
      data: {
        workspaceBusinessId: input.workspaceBusinessId,
        name: input.name,
        documentType: input.documentType,
        itemType: input.itemType,
        serie: input.serie,
        natureOperation: input.natureOperation,
        cfop: input.cfop,
        taxDefaults: input.taxDefaults !== undefined ? toNullableJson(input.taxDefaults) : undefined,
        notes: input.notes,
        isDefault: input.isDefault,
        isActive: input.isActive,
        createdByUserId: input.createdByUserId
      }
    });
  }
}
