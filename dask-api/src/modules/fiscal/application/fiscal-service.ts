import crypto from 'crypto';
import type Stripe from 'stripe';
import { Prisma } from '@prisma/client';
import type {
  FiscalCatalogProfile,
  FiscalCompanyConfig,
  FiscalDocument,
  FiscalDocumentItem,
  FiscalOperationTemplate,
  FiscalParty
} from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import type { JobQueue } from '@/core/jobs/job-queue';
import { logger } from '@/core/logging/logger';
import { redactErrorMessage } from '@/core/security/redaction';
import {
  mapFocusStatusToInternal,
  sanitizeDocumentReference,
  type CreateFiscalDocumentInput,
  type FiscalFocusEnvironment,
  type FiscalDocumentOrigin,
  type FiscalDocumentType,
  type FiscalReceivedType,
  type FiscalStripePolicy
} from '@/modules/fiscal/domain/types';
import type { FiscalProvider } from '@/modules/fiscal/providers/fiscal-provider';
import type { FiscalRepository } from '@/modules/fiscal/repositories/fiscal-repository';
import { redactFiscalCredentials } from '@/modules/fiscal/domain/redaction';

const DEFAULT_FISCAL_STRIPE_POLICY: FiscalStripePolicy = 'manual_review';

export interface FiscalDocumentDetails {
  document: FiscalDocument & { items: FiscalDocumentItem[]; parties: FiscalParty[] };
  integrationLogs: Array<{ id: string; operation: string; status: string; createdAt: Date; errorMessage: string | null }>;
}

type StripeWebhookEvent = {
  id: string;
  type: string;
  account?: string;
  data: { object: unknown };
};

type StripeCheckoutSession = {
  id: string;
  mode: string | null;
  payment_intent?: string | { id: string } | null;
  customer_details?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    tax_ids?: Array<{ value?: string }>;
  } | null;
  amount_total?: number | null;
  currency?: string | null;
  metadata?: Record<string, string> | null;
};

type StripeCheckoutLineItem = {
  id?: string;
  description?: string | null;
  quantity?: number | null;
  amount_total?: number | null;
  amount_subtotal?: number | null;
  currency?: string | null;
  price?: {
    id?: string | null;
    unit_amount?: number | null;
    recurring?: {
      interval?: string | null;
    } | null;
  } | null;
};

interface FiscalServiceDeps {
  repo: FiscalRepository;
  provider: FiscalProvider;
  jobQueue: JobQueue;
  stripe?: InstanceType<typeof Stripe> | null;
  stripeWebhookSecret?: string;
  focusWebhookSecret?: string;
  environment?: 'development' | 'test' | 'production';
}

const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const asString = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const centsToDec = (v: number | null | undefined): string | null => (typeof v === 'number' && Number.isFinite(v) ? (v / 100).toFixed(2) : null);
const hintToType = (hint: string | null | undefined): FiscalDocumentType => (typeof hint === 'string' && hint.toLowerCase() === 'nfse' ? 'NFSE' : 'NFE');
const boolFlag = (v: string | undefined): boolean => ['1', 'true', 'yes'].includes((v ?? '').trim().toLowerCase());
const asNullableString = (v: string | null | undefined): string | null => v ?? null;
const stripBearerPrefix = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  return normalized.toLowerCase().startsWith('bearer ')
    ? normalized.slice('bearer '.length).trim()
    : normalized;
};
const sanitizeMoney = (value: string | null | undefined, fallback = '0.00'): string => {
  const normalized = asString(value);
  if (!normalized) {
    return fallback;
  }

  const candidate = Number(normalized.replace(',', '.'));
  if (!Number.isFinite(candidate)) {
    return fallback;
  }

  return candidate.toFixed(2);
};
const asJsonValue = (v: unknown): Prisma.JsonValue => {
  if (v === undefined || v === null) {
    return null;
  }

  try {
    return JSON.parse(JSON.stringify(v)) as Prisma.JsonValue;
  } catch {
    return null;
  }
};
const originFromStripe = (meta?: Record<string, string> | null): FiscalDocumentOrigin =>
  (meta?.sale_origin?.trim().toLowerCase() === 'stripe_subscription' ? 'STRIPE_SUBSCRIPTION' : 'STRIPE_PAYMENT');

export class FiscalService {
  private readonly repo: FiscalRepository;
  private readonly provider: FiscalProvider;
  private readonly jobQueue: JobQueue;
  private readonly stripe: InstanceType<typeof Stripe> | null;
  private readonly stripeWebhookSecret: string;
  private readonly focusWebhookSecret: string | null;
  private readonly environment: 'development' | 'test' | 'production';

  public constructor(deps: FiscalServiceDeps) {
    this.repo = deps.repo;
    this.provider = deps.provider;
    this.jobQueue = deps.jobQueue;
    this.stripe = deps.stripe ?? null;
    this.stripeWebhookSecret = deps.stripeWebhookSecret ?? '';
    this.focusWebhookSecret = deps.focusWebhookSecret ?? null;
    this.environment = deps.environment ?? 'development';
  }

  public async getDashboard(workspaceId: string, customerIds?: string[]) {
    if (customerIds) {
      const documents = await this.repo.listDocuments({ workspaceId, customerIds, limit: 500 });
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);

      return {
        counters: {
          issuedToday: documents.filter((document) => document.createdAt >= startOfToday && document.createdAt <= endOfToday).length,
          pending: documents.filter((document) => document.status === 'DRAFT' || document.status === 'PENDING_REVIEW').length,
          rejected: documents.filter((document) => document.status === 'REJECTED').length,
          received: 0,
          pendingReview: 0
        },
        latestSyncAt: null,
        recentSyncRuns: []
      };
    }

    const [metrics, recentSyncRuns] = await Promise.all([
      this.repo.getDashboardMetrics(workspaceId),
      this.repo.listLatestSyncRuns(workspaceId, 10)
    ]);

    return {
      counters: {
        issuedToday: metrics.issuedToday,
        pending: metrics.pending,
        rejected: metrics.rejected,
        received: metrics.received,
        pendingReview: metrics.pendingReview
      },
      latestSyncAt: metrics.latestSyncAt,
      recentSyncRuns: recentSyncRuns.map((run) => ({
        id: run.id,
        syncType: run.syncType,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt
      }))
    };
  }

  public async listDocuments(input: {
    workspaceId: string;
    workspaceBusinessId?: string;
    documentType?: FiscalDocumentType;
    direction?: 'OUTBOUND' | 'INBOUND';
    status?: string;
    origin?: string;
    customerId?: string;
    customerIds?: string[];
    from?: Date;
    to?: Date;
    search?: string;
    limit?: number;
    cursor?: string;
  }) {
    return this.repo.listDocuments({
      workspaceId: input.workspaceId,
      workspaceBusinessId: input.workspaceBusinessId,
      documentType: input.documentType,
      direction: input.direction,
      status: input.status as unknown as Parameters<FiscalRepository['listDocuments']>[0]['status'],
      origin: input.origin,
      customerId: input.customerId,
      customerIds: input.customerIds,
      from: input.from,
      to: input.to,
      search: input.search,
      limit: input.limit,
      cursor: input.cursor
    });
  }

  public async listSyncRuns(
    workspaceId: string,
    options: { cursor?: string; pageSize?: number; limit?: number } = {}
  ) {
    return this.repo.listLatestSyncRuns(workspaceId, options);
  }

  public async getDocumentDetails(
    workspaceId: string,
    documentId: string,
    customerIds?: string[]
  ): Promise<FiscalDocumentDetails> {
    const document = await this.repo.getDocumentById(workspaceId, documentId, customerIds);
    if (!document) {
      throw new AppError('Fiscal document not found', 404);
    }

    const logs = await this.repo.listIntegrationLogs(workspaceId, { documentId, limit: 100 });

    return {
      document,
      integrationLogs: logs.map((log) => ({
        id: log.id,
        operation: log.operation,
        status: log.status,
        createdAt: log.createdAt,
        errorMessage: log.errorMessage
      }))
    };
  }

  public async createDocument(input: CreateFiscalDocumentInput) {
    const normalizedReference = sanitizeDocumentReference(input.internalReference);
    const existing = await this.repo.findDocumentByReference(input.workspaceId, normalizedReference);
    if (existing) {
      return existing;
    }

    return this.repo.createDocument({
      ...input,
      internalReference: normalizedReference,
      requestPayloadSnapshot: redactFiscalCredentials(input.requestPayloadSnapshot),
      responsePayloadSnapshot: redactFiscalCredentials(input.responsePayloadSnapshot),
      providerPayloadRaw: redactFiscalCredentials(input.providerPayloadRaw),
      metadata: redactFiscalCredentials(input.metadata)
    });
  }

  public async issueDocument(input: { workspaceId: string; documentId: string; requestedByUserId: string }) {
    const document = await this.repo.getDocumentById(input.workspaceId, input.documentId);
    if (!document) {
      throw new AppError('Fiscal document not found', 404);
    }

    const companyConfig = await this.resolveCompanyForDocument(input.workspaceId, document);
    const reference = sanitizeDocumentReference(document.focusReference ?? document.internalReference);
    const requestPayload = asRecord(document.requestPayloadSnapshot);

    await this.repo.updateDocumentStatus({
      workspaceId: input.workspaceId,
      id: document.id,
      status: 'ISSUING',
      issueStatus: 'PROCESSING',
      operationStatus: 'issuing'
    });

    try {
      const response =
        document.documentType === 'NFE'
          ? await this.provider.issueNfe({ reference, payload: requestPayload, company: this.mapCompany(companyConfig) })
          : await this.provider.issueNfse({ reference, payload: requestPayload, company: this.mapCompany(companyConfig) });

      const mapped = mapFocusStatusToInternal(response.providerStatus);
      const updated = await this.repo.updateDocumentStatus({
        workspaceId: input.workspaceId,
        id: document.id,
        status: mapped.status,
        issueStatus: mapped.issueStatus,
        focusStatus: response.providerStatus ?? undefined,
        operationStatus: mapped.status.toLowerCase(),
        focusDocumentId: response.providerDocumentId ?? undefined,
        xmlUrl: response.xmlUrl ?? undefined,
        pdfUrl: response.pdfUrl ?? undefined,
        responsePayloadSnapshot: response.raw,
        providerPayloadRaw: response.raw,
        lastError: null
      });

      await this.repo.appendIntegrationLog({
        workspaceId: input.workspaceId,
        companyConfigId: companyConfig.id,
        documentId: document.id,
        system: 'FOCUS',
        direction: 'OUTBOUND',
        operation: document.documentType === 'NFE' ? 'issue_nfe' : 'issue_nfse',
        status: 'SUCCESS',
        correlationId: reference,
        httpStatus: null,
        requestPayload: asJsonValue(redactFiscalCredentials(requestPayload)),
        responsePayload: asJsonValue(response.raw),
        errorMessage: null
      });

      if (!updated) {
        throw new AppError('Fiscal document update failed after issuing', 500);
      }

      if (mapped.status === 'PROCESSING' || mapped.status === 'ISSUING') {
        await this.jobQueue.enqueue('fiscal.reconcile-pending', { workspaceId: input.workspaceId, documentId: document.id }, { jobId: `fiscal-reconcile-${document.id}` });
      }

      return updated;
    } catch (error) {
      const message = redactErrorMessage(error, 2000) || 'Unknown fiscal issue error';
      await this.repo.updateDocumentStatus({
        workspaceId: input.workspaceId,
        id: document.id,
        status: 'FAILED',
        issueStatus: 'FAILED',
        operationStatus: 'failed',
        lastError: message
      });

      await this.repo.appendIntegrationLog({
        workspaceId: input.workspaceId,
        companyConfigId: companyConfig.id,
        documentId: document.id,
        system: 'FOCUS',
        direction: 'OUTBOUND',
        operation: document.documentType === 'NFE' ? 'issue_nfe' : 'issue_nfse',
        status: 'ERROR',
        correlationId: reference,
        httpStatus: null,
        requestPayload: asJsonValue(requestPayload),
        responsePayload: null,
        errorMessage: message
      });

      throw error;
    }
  }

  public async cancelDocument(input: { workspaceId: string; documentId: string; justification?: string }) {
    const document = await this.repo.getDocumentById(input.workspaceId, input.documentId);
    if (!document) {
      throw new AppError('Fiscal document not found', 404);
    }

    const companyConfig = await this.resolveCompanyForDocument(input.workspaceId, document);
    const reference = sanitizeDocumentReference(document.focusReference ?? document.internalReference);

    const response = await this.provider.cancelDocument({
      company: this.mapCompany(companyConfig),
      reference,
      documentType: document.documentType,
      justification: input.justification
    });

    const updated = await this.repo.updateDocumentStatus({
      workspaceId: input.workspaceId,
      id: document.id,
      status: 'CANCELLED',
      issueStatus: 'CANCELLED',
      focusStatus: response.providerStatus ?? undefined,
      operationStatus: 'cancelled',
      responsePayloadSnapshot: response.raw,
      providerPayloadRaw: response.raw,
      lastError: null
    });

    if (!updated) {
      throw new AppError('Fiscal document update failed after cancellation', 500);
    }

    await this.repo.appendIntegrationLog({
      workspaceId: input.workspaceId,
      companyConfigId: companyConfig.id,
      documentId: document.id,
      system: 'FOCUS',
      direction: 'OUTBOUND',
      operation: 'cancel_document',
      status: 'SUCCESS',
      correlationId: reference,
      httpStatus: null,
      requestPayload: asJsonValue({ justification: input.justification ?? null }),
      responsePayload: asJsonValue(response.raw),
      errorMessage: null
    });

    return updated;
  }

  public async retryDocumentIssue(input: { workspaceId: string; documentId: string; requestedByUserId: string }) {
    await this.repo.updateDocumentStatus({
      workspaceId: input.workspaceId,
      id: input.documentId,
      status: 'READY_TO_ISSUE',
      issueStatus: 'NOT_STARTED',
      operationStatus: 'ready_to_issue',
      lastError: null
    });

    return this.issueDocument(input);
  }

  public async listReceivedDocuments(input: {
    workspaceId: string;
    workspaceBusinessId?: string;
    type?: FiscalReceivedType;
    status?: string;
    from?: Date;
    to?: Date;
    search?: string;
    limit?: number;
    cursor?: string;
    customerIds?: string[];
  }) {
    if (input.customerIds) {
      return [];
    }

    return this.repo.listReceivedDocuments({
      workspaceId: input.workspaceId,
      workspaceBusinessId: input.workspaceBusinessId,
      type: input.type,
      status: input.status as unknown as Parameters<FiscalRepository['listReceivedDocuments']>[0]['status'],
      from: input.from,
      to: input.to,
      search: input.search,
      limit: input.limit,
      cursor: input.cursor
    });
  }

  public async listEmissionDrafts(
    workspaceId: string,
    options?: number | { cursor?: string; pageSize?: number; limit?: number },
    customerIds?: string[]
  ) {
    if (customerIds) {
      return [];
    }

    return this.repo.listEmissionDrafts(workspaceId, options ?? { pageSize: 100 });
  }

  public async emitDraft(input: { workspaceId: string; draftId: string; requestedByUserId: string }) {
    const draft = await this.repo.findEmissionDraftById(input.workspaceId, input.draftId);
    if (!draft) {
      throw new AppError('Fiscal draft not found', 404);
    }

    if (draft.issuedDocumentId) {
      const issued = await this.repo.getDocumentById(input.workspaceId, draft.issuedDocumentId);
      if (issued) {
        return issued;
      }
    }

    const payload = asRecord(draft.payload);
    const metadata = asRecord(payload.metadata);
    const customer = asRecord(payload.customer);
    const lineItems =
      Array.isArray(payload.lineItems) && payload.lineItems.length > 0
        ? payload.lineItems.map((entry) => asRecord(entry))
        : [];

    const company =
      (draft.companyConfigId
        ? await this.repo.findCompanyConfigById(input.workspaceId, draft.companyConfigId)
        : null) ??
      (await this.resolveCompanyFromMetadata(input.workspaceId, draft.workspaceBusinessId ?? undefined));
    if (!company) {
      throw new AppError('Fiscal company config not found for draft emission', 422);
    }

    const internalReference = sanitizeDocumentReference(
      asString(metadata.internal_sale_id) ??
        asString(metadata.order_id) ??
        asString(draft.saleId) ??
        `fiscal-draft-${draft.id}`
    );
    const amountTotal = sanitizeMoney(asString(payload.amountTotal), '0.00');

    const createdDocument = await this.createDocument({
      workspaceId: input.workspaceId,
      workspaceBusinessId: company.workspaceBusinessId,
      companyConfigId: company.id,
      internalReference,
      direction: 'OUTBOUND',
      documentType: draft.documentType,
      origin: draft.origin,
      sourceSystem: 'STRIPE',
      customerId: asString(metadata.customer_id),
      saleId: asString(metadata.internal_sale_id) ?? asString(metadata.order_id) ?? draft.saleId,
      stripeSessionId: draft.stripeSessionId,
      stripePaymentIntentId: draft.stripePaymentIntentId,
      stripeChargeId: null,
      stripeAccountId: asString(payload.stripeAccountId),
      focusReference: internalReference,
      amountSubtotal: amountTotal,
      amountDiscount: '0.00',
      amountTotal,
      currency: (asString(payload.currency) ?? 'BRL').toUpperCase(),
      requestPayloadSnapshot: asRecord(payload),
      responsePayloadSnapshot: null,
      providerPayloadRaw: null,
      metadata: {
        source: 'stripe_fiscal_draft',
        draftId: draft.id,
        stripeSessionId: draft.stripeSessionId
      },
      createdByUserId: input.requestedByUserId,
      items: this.buildDocumentItemsFromSerializedLines({
        documentType: draft.documentType,
        metadata,
        lineItems,
        fallbackAmountTotal: amountTotal
      }),
      parties: this.buildDocumentPartiesFromStripeCustomer({
        documentType: draft.documentType,
        customerName: asString(customer.name) ?? 'Cliente Stripe',
        customerTaxId: asString(customer.document),
        customerEmail: asString(customer.email),
        customerPhone: asString(customer.phone),
        customerStateRegistration: asString(customer.stateRegistration),
        customerMunicipalRegistration: asString(customer.municipalRegistration),
        customerAddress: asRecord(customer.address)
      })
    });

    await this.repo.updateEmissionDraft(input.workspaceId, draft.id, {
      status: 'ISSUED',
      issuedDocumentId: createdDocument.id
    });

    return this.issueDocument({
      workspaceId: input.workspaceId,
      documentId: createdDocument.id,
      requestedByUserId: input.requestedByUserId
    });
  }

  public async syncReceived(input: {
    workspaceId: string;
    companyConfigId: string;
    type: FiscalReceivedType;
    trigger: 'MANUAL' | 'SCHEDULED' | 'WEBHOOK' | 'RETRY';
    requestedByUserId: string;
  }) {
    const company = await this.repo.findCompanyConfigById(input.workspaceId, input.companyConfigId);
    if (!company) {
      throw new AppError('Fiscal company config not found', 404);
    }

    const syncRun = await this.repo.createSyncRun({
      workspaceId: input.workspaceId,
      workspaceBusinessId: company.workspaceBusinessId,
      companyConfigId: company.id,
      syncType: input.type === 'NFE_MDE' ? 'RECEIVED_NFE' : 'RECEIVED_NFSE',
      trigger: input.trigger,
      status: 'RUNNING',
      startedAt: new Date(),
      finishedAt: null,
      processedCount: 0,
      createdCount: 0,
      updatedCount: 0,
      failedCount: 0,
      requestSnapshot: { requestedByUserId: input.requestedByUserId, type: input.type },
      responseSnapshot: null,
      lastError: null
    });

    let processed = 0;
    let failed = 0;
    let touched = 0;

    try {
      const response =
        input.type === 'NFE_MDE'
          ? await this.provider.syncReceivedNfe({ company: this.mapCompany(company), full: true })
          : await this.provider.syncReceivedNfse({ company: this.mapCompany(company), full: true });

      for (const item of response.items) {
        processed += 1;

        try {
          await this.repo.upsertReceivedDocument({
            workspaceId: input.workspaceId,
            workspaceBusinessId: company.workspaceBusinessId,
            companyConfigId: company.id,
            type: response.type,
            status: item.manifestationStatus ? 'MANIFESTED' : 'RECEIVED',
            manifestationStatus: asNullableString(item.manifestationStatus),
            externalKey: item.externalKey,
            providerReference: asNullableString(item.providerReference),
            focusReference: asNullableString(item.focusReference),
            issuerName: asNullableString(item.issuerName),
            issuerDocument: asNullableString(item.issuerDocument),
            recipientDocument: asNullableString(item.recipientDocument),
            amountTotal: item.amountTotal !== null && item.amountTotal !== undefined ? new Prisma.Decimal(item.amountTotal) : null,
            issuedAt: item.issuedAt ? new Date(item.issuedAt) : null,
            receivedAt: item.receivedAt ? new Date(item.receivedAt) : null,
            xmlUrl: asNullableString(item.xmlUrl),
            pdfUrl: asNullableString(item.pdfUrl),
            payload: asJsonValue(item.raw),
            supplierId: null,
            costCenterId: null,
            categoryId: null,
            financialEntryId: null,
            purchaseId: null,
            mappedDocumentId: null,
            lastSyncAt: new Date(),
            lastError: null,
            metadata: null
          });
          touched += 1;
        } catch (error) {
          failed += 1;
          logger.warn({ event: 'fiscal.received.sync.item_failed', workspaceId: input.workspaceId, externalKey: item.externalKey, err: error });
        }
      }

      await this.repo.finishSyncRun(syncRun.id, {
        status: failed > 0 ? 'PARTIAL' : 'SUCCESS',
        processedCount: processed,
        createdCount: touched,
        updatedCount: 0,
        failedCount: failed,
        responseSnapshot: { type: response.type, totalCount: response.totalCount, maxVersion: response.maxVersion, processed, touched, failed },
        lastError: failed > 0 ? `${failed} item(s) failed to persist` : null
      });

      return { syncRunId: syncRun.id, processed, createdOrUpdated: touched, failed };
    } catch (error) {
      const message = redactErrorMessage(error, 2000) || 'Unknown sync error';
      await this.repo.finishSyncRun(syncRun.id, {
        status: 'FAILED',
        processedCount: processed,
        createdCount: touched,
        updatedCount: 0,
        failedCount: Math.max(1, failed),
        responseSnapshot: { processed, touched, failed },
        lastError: message
      });

      throw error;
    }
  }

  public async listCompanyConfigs(
    workspaceId: string,
    options?: { cursor?: string; pageSize?: number; limit?: number; search?: string }
  ) {
    return this.repo.listCompanyConfigs(workspaceId, options);
  }

  public async createCompanyConfig(input: {
    workspaceId: string;
    workspaceBusinessId?: string | null;
    displayName: string;
    legalName: string;
    cnpj: string;
    stateRegistration?: string | null;
    municipalRegistration?: string | null;
    taxRegime?: string | null;
    focusToken: string;
    focusEnvironment: FiscalFocusEnvironment;
    focusCompanyReference?: string | null;
    focusWebhookSecret?: string | null;
    emitAutomatically?: boolean;
    stripePolicy?: FiscalStripePolicy;
    defaultSerie?: string | null;
    defaultNatureOperation?: string | null;
    fallbackRules?: Record<string, unknown> | null;
    syncConfig?: Record<string, unknown> | null;
    metadata?: Record<string, unknown> | null;
    createdByUserId?: string | null;
  }) {
    return this.repo.createCompanyConfig({
      workspaceId: input.workspaceId,
      workspaceBusinessId: input.workspaceBusinessId ?? null,
      provider: 'FOCUS',
      displayName: input.displayName,
      legalName: input.legalName,
      cnpj: input.cnpj,
      stateRegistration: input.stateRegistration ?? null,
      municipalRegistration: input.municipalRegistration ?? null,
      taxRegime: input.taxRegime ?? null,
      focusToken: input.focusToken,
      focusEnvironment: input.focusEnvironment,
      focusCompanyReference: input.focusCompanyReference ?? null,
      focusWebhookSecret: input.focusWebhookSecret ?? null,
      emitAutomatically: input.emitAutomatically ?? false,
      stripePolicy: input.stripePolicy ?? DEFAULT_FISCAL_STRIPE_POLICY,
      defaultSerie: input.defaultSerie ?? null,
      defaultNatureOperation: input.defaultNatureOperation ?? null,
      fallbackRules: asJsonValue(input.fallbackRules),
      syncConfig: asJsonValue(input.syncConfig),
      metadata: asJsonValue(redactFiscalCredentials(input.metadata)),
      createdByUserId: input.createdByUserId ?? null
    });
  }

  public async updateCompanyConfig(input: { workspaceId: string; companyConfigId: string; patch: Record<string, unknown> }) {
    const patch =
      input.patch.metadata !== undefined
        ? {
            ...input.patch,
            metadata: redactFiscalCredentials(input.patch.metadata)
          }
        : input.patch;
    const updated = await this.repo.updateCompanyConfig(
      input.workspaceId,
      input.companyConfigId,
      patch as Partial<Omit<FiscalCompanyConfig, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>>
    );
    if (!updated) {
      throw new AppError('Fiscal company config not found', 404);
    }
    return updated;
  }

  public async validateCompanyConfig(input: { workspaceId: string; companyConfigId: string }) {
    const company = await this.repo.findCompanyConfigById(input.workspaceId, input.companyConfigId);
    if (!company) {
      throw new AppError('Fiscal company config not found', 404);
    }

    return this.provider.validateCompanyConfig({ company: this.mapCompany(company) });
  }

  public async listCatalogProfiles(workspaceId: string): Promise<FiscalCatalogProfile[]> {
    return this.repo.listCatalogProfiles(workspaceId);
  }

  public async upsertCatalogProfile(
    workspaceId: string,
    input: Partial<Omit<FiscalCatalogProfile, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>> & Pick<FiscalCatalogProfile, 'name' | 'itemType'> & { id?: string }
  ) {
    return this.repo.upsertCatalogProfile(workspaceId, input);
  }

  public async listOperationTemplates(workspaceId: string): Promise<FiscalOperationTemplate[]> {
    return this.repo.listOperationTemplates(workspaceId);
  }

  public async upsertOperationTemplate(
    workspaceId: string,
    input: Partial<Omit<FiscalOperationTemplate, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>> & Pick<FiscalOperationTemplate, 'name' | 'documentType'> & { id?: string }
  ) {
    return this.repo.upsertOperationTemplate(workspaceId, input);
  }

  public async handleFocusWebhook(input: { payload: Record<string, unknown>; headers: Record<string, string | undefined> }) {
    this.assertFocusWebhookAuthorization(input.headers);

    const parsed = this.provider.handleWebhook(input.payload);
    const idempotencyKey = parsed.sourceEventId?.trim()
      ? `focus:${parsed.sourceEventId.trim()}`
      : `focus:${this.createPayloadHash(input.payload)}`;

    const existing = await this.repo.findWebhookEventByIdempotencyKey(idempotencyKey);
    if (existing) {
      return { eventId: existing.id, duplicate: true };
    }

    const event = await this.repo.createWebhookEvent({
      workspaceId: parsed.workspaceId ?? null,
      source: 'FOCUS',
      providerEventId: parsed.sourceEventId ?? null,
      eventType: parsed.eventType,
      idempotencyKey,
      status: 'RECEIVED',
      headers: asJsonValue(redactFiscalCredentials(input.headers)),
      payload: asJsonValue(redactFiscalCredentials(input.payload)),
      signature: input.headers['x-focus-signature'] ? '[REDACTED]' : null,
      attempts: 1,
      processedAt: null,
      lastError: null
    });

    try {
      if (parsed.workspaceId && parsed.documentReference) {
        const document = await this.repo.findDocumentByReference(parsed.workspaceId, sanitizeDocumentReference(parsed.documentReference));
        if (document) {
          const mapped = mapFocusStatusToInternal(parsed.raw.status ?? parsed.eventType);
          await this.repo.updateDocumentStatus({
            workspaceId: parsed.workspaceId,
            id: document.id,
            status: mapped.status,
            issueStatus: mapped.issueStatus,
            focusStatus: asString(parsed.raw.status) ?? parsed.eventType,
            operationStatus: parsed.eventType,
            responsePayloadSnapshot: parsed.raw,
            providerPayloadRaw: parsed.raw,
            lastError: null
          });
        }
      }

      await this.repo.updateWebhookEvent(event.id, {
        status: 'PROCESSED',
        processedAt: new Date(),
        lastError: null,
        workspaceId: parsed.workspaceId ?? event.workspaceId,
        attempts: event.attempts + 1
      });

      return { eventId: event.id, duplicate: false };
    } catch (error) {
      const message = redactErrorMessage(error, 2000) || 'Unknown focus webhook error';
      await this.repo.updateWebhookEvent(event.id, { status: 'FAILED', lastError: message, attempts: event.attempts + 1 });
      throw error;
    }
  }

  public async handleStripeFiscalWebhook(rawBody: Buffer, signature: string) {
    if (!this.stripe) {
      throw new AppError('Stripe client is not configured for fiscal integration', 503);
    }
    if (!this.stripeWebhookSecret) {
      throw new AppError('Stripe webhook secret is missing for fiscal integration', 503);
    }

    let event: StripeWebhookEvent;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.stripeWebhookSecret) as StripeWebhookEvent;
    } catch (error) {
      throw new AppError('Invalid Stripe webhook signature', 400, { details: { error: redactErrorMessage(error) || 'Unknown signature error' } });
    }

    const idempotencyKey = `stripe:${event.id}`;
    const existing = await this.repo.findWebhookEventByIdempotencyKey(idempotencyKey);
    if (existing) {
      return { eventId: existing.id, duplicate: true };
    }

    const eventRow = await this.repo.createWebhookEvent({
      workspaceId: null,
      source: 'STRIPE',
      providerEventId: event.id,
      eventType: event.type,
      idempotencyKey,
      status: 'RECEIVED',
      headers: asJsonValue(redactFiscalCredentials({ 'stripe-signature': signature })),
      payload: asJsonValue(redactFiscalCredentials(asRecord(event as unknown as Record<string, unknown>))),
      signature: '[REDACTED]',
      attempts: 1,
      processedAt: null,
      lastError: null
    });

    try {
      if (event.type === 'checkout.session.completed') {
        await this.processStripeCheckoutCompleted(event.data.object as StripeCheckoutSession, event.account);
      }

      await this.repo.updateWebhookEvent(eventRow.id, {
        status: 'PROCESSED',
        processedAt: new Date(),
        attempts: eventRow.attempts + 1,
        lastError: null
      });

      return { eventId: eventRow.id, duplicate: false };
    } catch (error) {
      const message = redactErrorMessage(error, 2000) || 'Unknown Stripe webhook error';
      await this.repo.updateWebhookEvent(eventRow.id, { status: 'FAILED', attempts: eventRow.attempts + 1, lastError: message });
      throw error;
    }
  }

  public async processPendingDocumentStatus(input: { workspaceId: string; documentId: string }) {
    const document = await this.repo.getDocumentById(input.workspaceId, input.documentId);
    if (!document) {
      return null;
    }

    const company = await this.resolveCompanyForDocument(input.workspaceId, document);
    const status = await this.provider.getDocumentStatus({
      company: this.mapCompany(company),
      reference: sanitizeDocumentReference(document.focusReference ?? document.internalReference),
      documentType: document.documentType
    });

    const mapped = mapFocusStatusToInternal(status.providerStatus);

    return this.repo.updateDocumentStatus({
      workspaceId: input.workspaceId,
      id: document.id,
      status: mapped.status,
      issueStatus: mapped.issueStatus,
      focusStatus: status.providerStatus ?? undefined,
      operationStatus: mapped.status.toLowerCase(),
      focusDocumentId: status.providerDocumentId ?? undefined,
      xmlUrl: status.xmlUrl ?? undefined,
      pdfUrl: status.pdfUrl ?? undefined,
      responsePayloadSnapshot: status.raw,
      providerPayloadRaw: status.raw,
      lastError: null
    });
  }

  private async processStripeCheckoutCompleted(session: StripeCheckoutSession, stripeAccountId?: string): Promise<void> {
    const metadata = session.metadata ?? {};
    const workspaceId = metadata.workspace_id;
    if (!workspaceId) {
      logger.info({ event: 'fiscal.stripe.webhook.ignored_missing_workspace', sessionId: session.id });
      return;
    }

    const existingDraft = await this.repo.findEmissionDraftByStripeSession(workspaceId, session.id);
    if (existingDraft) {
      return;
    }

    const company = await this.resolveCompanyFromMetadata(workspaceId, metadata.workspace_business_id);
    if (!company) {
      logger.warn({ event: 'fiscal.stripe.webhook.missing_company', workspaceId, sessionId: session.id });
      return;
    }

    const documentType = hintToType(metadata.document_hint);
    const origin = originFromStripe(metadata);
    const amountTotal = centsToDec(session.amount_total);
    const customerTaxId = session.customer_details?.tax_ids?.[0]?.value ?? asString(metadata.customer_document);
    const customerName = asString(session.customer_details?.name) ?? asString(metadata.customer_name) ?? 'Cliente Stripe';
    const customerEmail = asString(session.customer_details?.email) ?? asString(metadata.customer_email);
    const customerPhone = asString(session.customer_details?.phone) ?? asString(metadata.customer_phone);
    const customerStateRegistration = asString(metadata.customer_state_registration);
    const customerMunicipalRegistration = asString(metadata.customer_municipal_registration);
    const internalReference = sanitizeDocumentReference(metadata.internal_sale_id ?? metadata.order_id ?? `stripe-${session.id}`);
    const lineItems = await this.fetchStripeCheckoutLineItems(session.id, stripeAccountId);

    const payloadSnapshot: Record<string, unknown> = redactFiscalCredentials({
      source: 'stripe_checkout',
      sessionId: session.id,
      mode: session.mode,
      metadata,
      amountTotal,
      currency: asString(session.currency) ?? 'BRL',
      customer: {
        id: asString(metadata.customer_id),
        name: customerName,
        document: customerTaxId,
        email: customerEmail,
        phone: customerPhone,
        stateRegistration: customerStateRegistration,
        municipalRegistration: customerMunicipalRegistration
      },
      stripeAccountId: stripeAccountId ?? null,
      lineItems
    });

    const draft = await this.repo.createEmissionDraft({
      workspaceId,
      workspaceBusinessId: company.workspaceBusinessId,
      companyConfigId: company.id,
      status: 'READY',
      documentType,
      origin,
      saleId: metadata.internal_sale_id ?? metadata.order_id ?? null,
      stripeSessionId: session.id,
      stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null,
      emitAfterPayment: boolFlag(metadata.emit_after_payment),
      autoIssueEligible: company.emitAutomatically,
      payload: asJsonValue(payloadSnapshot),
      suggestion: asJsonValue({
        suggestedDocumentType: documentType,
        suggestedOrigin: origin,
        hasCustomerDocument: Boolean(customerTaxId),
        lineItemsCount: lineItems.length,
        source: 'stripe_webhook_checkout_completed'
      }),
      createdByUserId: null,
      issuedDocumentId: null
    });

    if (!(boolFlag(metadata.emit_after_payment) && company.emitAutomatically)) {
      return;
    }

    const createdDocument = await this.createDocument({
      workspaceId,
      workspaceBusinessId: company.workspaceBusinessId,
      companyConfigId: company.id,
      internalReference,
      direction: 'OUTBOUND',
      documentType,
      origin,
      sourceSystem: 'STRIPE',
      customerId: metadata.customer_id ?? null,
      saleId: metadata.internal_sale_id ?? metadata.order_id ?? null,
      stripeSessionId: session.id,
      stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null,
      stripeChargeId: null,
      stripeAccountId: stripeAccountId ?? null,
      focusReference: internalReference,
      amountSubtotal: amountTotal,
      amountDiscount: '0.00',
      amountTotal,
      currency: (session.currency ?? 'BRL').toUpperCase(),
      requestPayloadSnapshot: payloadSnapshot,
      responsePayloadSnapshot: null,
      providerPayloadRaw: null,
      metadata: { stripeSessionId: session.id, source: 'stripe_checkout_completed', draftId: draft.id },
      createdByUserId: null,
      items: this.buildDocumentItemsFromStripeLines({
        documentType,
        metadata,
        lineItems,
        fallbackAmountTotal: amountTotal ?? '0.00'
      }),
      parties: this.buildDocumentPartiesFromStripeCustomer({
        documentType,
        customerName,
        customerTaxId,
        customerEmail,
        customerPhone,
        customerStateRegistration,
        customerMunicipalRegistration
      })
    });

    await this.issueDocument({ workspaceId, documentId: createdDocument.id, requestedByUserId: 'system:stripe-webhook' });
  }

  private async fetchStripeCheckoutLineItems(
    sessionId: string,
    stripeAccountId?: string
  ): Promise<StripeCheckoutLineItem[]> {
    if (!this.stripe) {
      return [];
    }

    try {
      const response = await this.stripe.checkout.sessions.listLineItems(
        sessionId,
        { limit: 100 },
        stripeAccountId ? { stripeAccount: stripeAccountId } : undefined
      );
      return (response.data ?? []) as unknown as StripeCheckoutLineItem[];
    } catch (error) {
      logger.warn({ event: 'fiscal.stripe.line_items.failed', sessionId, stripeAccountId, err: error });
      return [];
    }
  }

  private buildDocumentItemsFromSerializedLines(input: {
    documentType: FiscalDocumentType;
    metadata: Record<string, unknown>;
    lineItems: Array<Record<string, unknown>>;
    fallbackAmountTotal: string;
  }): CreateFiscalDocumentInput['items'] {
    if (input.lineItems.length === 0) {
      return this.buildDocumentItemsFromStripeLines({
        documentType: input.documentType,
        metadata: Object.entries(input.metadata).reduce<Record<string, string>>((acc, [key, value]) => {
          if (typeof value === 'string') {
            acc[key] = value;
          }
          return acc;
        }, {}),
        lineItems: [],
        fallbackAmountTotal: input.fallbackAmountTotal
      });
    }

    const toStripeLine = (entry: Record<string, unknown>): StripeCheckoutLineItem => ({
      id: asString(entry.id) ?? undefined,
      description: asString(entry.description),
      quantity: typeof entry.quantity === 'number' ? entry.quantity : null,
      amount_total: typeof entry.amount_total === 'number' ? entry.amount_total : null,
      amount_subtotal: typeof entry.amount_subtotal === 'number' ? entry.amount_subtotal : null,
      currency: asString(entry.currency),
      price: asRecord(entry.price) as StripeCheckoutLineItem['price']
    });

    return this.buildDocumentItemsFromStripeLines({
      documentType: input.documentType,
      metadata: Object.entries(input.metadata).reduce<Record<string, string>>((acc, [key, value]) => {
        if (typeof value === 'string') {
          acc[key] = value;
        }
        return acc;
      }, {}),
      lineItems: input.lineItems.map(toStripeLine),
      fallbackAmountTotal: input.fallbackAmountTotal
    });
  }

  private buildDocumentItemsFromStripeLines(input: {
    documentType: FiscalDocumentType;
    metadata: Record<string, string>;
    lineItems: StripeCheckoutLineItem[];
    fallbackAmountTotal: string;
  }): CreateFiscalDocumentInput['items'] {
    const fallbackName = input.metadata.catalog_item_ids ?? input.metadata.order_id ?? 'Item Stripe';
    const itemType: 'PRODUCT' | 'SERVICE' = input.documentType === 'NFSE' ? 'SERVICE' : 'PRODUCT';

    if (input.lineItems.length === 0) {
      return [
        {
          itemType,
          sourceType: 'stripe_checkout',
          catalogProfileId: null,
          sku: null,
          name: fallbackName,
          descriptionCommercial: input.metadata.order_id ?? 'Pagamento via Stripe Checkout',
          descriptionFiscal: input.metadata.order_id ?? 'Pagamento via Stripe Checkout',
          quantity: '1.0000',
          unit: 'UN',
          unitPrice: sanitizeMoney(input.fallbackAmountTotal),
          discountAmount: '0.00',
          totalAmount: sanitizeMoney(input.fallbackAmountTotal),
          taxConfigSnapshot: null,
          metadata: {
            source: 'stripe',
            lineItemMode: 'fallback'
          }
        }
      ];
    }

    const items = input.lineItems.map((lineItem, index) => {
      const quantity = typeof lineItem.quantity === 'number' && lineItem.quantity > 0 ? lineItem.quantity : 1;
      const unitAmountCents =
        (typeof lineItem.price?.unit_amount === 'number' ? lineItem.price.unit_amount : null) ??
        (typeof lineItem.amount_total === 'number' ? Math.round(lineItem.amount_total / quantity) : null);
      const totalAmountCents =
        typeof lineItem.amount_total === 'number'
          ? lineItem.amount_total
          : unitAmountCents !== null
            ? unitAmountCents * quantity
            : null;
      const itemName = asString(lineItem.description) ?? `${fallbackName} ${index + 1}`;

      return {
        itemType,
        sourceType: 'stripe_checkout_line_item',
        catalogProfileId: null,
        sku: asString(lineItem.price?.id),
        name: itemName,
        descriptionCommercial: itemName,
        descriptionFiscal: itemName,
        quantity: quantity.toFixed(4),
        unit: 'UN',
        unitPrice: centsToDec(unitAmountCents) ?? '0.00',
        discountAmount: '0.00',
        totalAmount: centsToDec(totalAmountCents) ?? '0.00',
        taxConfigSnapshot: null,
        metadata: {
          source: 'stripe',
          stripeLineItemId: asString(lineItem.id),
          stripePriceId: asString(lineItem.price?.id),
          recurringInterval: asString(lineItem.price?.recurring?.interval),
          amountSubtotal: centsToDec(lineItem.amount_subtotal)
        }
      };
    });

    return items.length > 0
      ? items
      : [
          {
            itemType,
            sourceType: 'stripe_checkout',
            catalogProfileId: null,
            sku: null,
            name: fallbackName,
            descriptionCommercial: fallbackName,
            descriptionFiscal: fallbackName,
            quantity: '1.0000',
            unit: 'UN',
            unitPrice: sanitizeMoney(input.fallbackAmountTotal),
            discountAmount: '0.00',
            totalAmount: sanitizeMoney(input.fallbackAmountTotal),
            taxConfigSnapshot: null,
            metadata: {
              source: 'stripe',
              lineItemMode: 'fallback'
            }
          }
        ];
  }

  private buildDocumentPartiesFromStripeCustomer(input: {
    documentType: FiscalDocumentType;
    customerName: string;
    customerTaxId: string | null;
    customerEmail: string | null;
    customerPhone: string | null;
    customerStateRegistration?: string | null;
    customerMunicipalRegistration?: string | null;
    customerAddress?: Record<string, unknown> | null;
  }): CreateFiscalDocumentInput['parties'] {
    if (!input.customerTaxId) {
      return [];
    }

    return [
      {
        role: input.documentType === 'NFSE' ? 'TAKER' : 'RECIPIENT',
        name: input.customerName,
        legalName: input.customerName,
        cnpjCpf: input.customerTaxId,
        stateRegistration: input.customerStateRegistration ?? null,
        municipalRegistration: input.customerMunicipalRegistration ?? null,
        email: input.customerEmail,
        phone: input.customerPhone,
        address: input.customerAddress ?? null,
        metadata: {
          source: 'stripe_customer_details'
        }
      }
    ];
  }

  private async resolveCompanyForDocument(workspaceId: string, document: FiscalDocument): Promise<FiscalCompanyConfig> {
    if (document.companyConfigId) {
      const direct = await this.repo.findCompanyConfigById(workspaceId, document.companyConfigId);
      if (direct) return direct;
    }

    const all = await this.repo.listCompanyConfigs(workspaceId);
    if (all.length === 0) throw new AppError('No fiscal company config found for workspace', 422);
    return all[0];
  }

  private async resolveCompanyFromMetadata(workspaceId: string, workspaceBusinessId: string | undefined): Promise<FiscalCompanyConfig | null> {
    const companies = await this.repo.listCompanyConfigs(workspaceId);
    if (companies.length === 0) return null;
    if (!workspaceBusinessId) return companies[0];
    return companies.find((company) => company.workspaceBusinessId === workspaceBusinessId) ?? companies[0];
  }

  private mapCompany(input: FiscalCompanyConfig) {
    return {
      id: input.id,
      cnpj: input.cnpj,
      token: input.focusToken,
      environment: input.focusEnvironment,
      companyReference: input.focusCompanyReference,
      webhookSecret: input.focusWebhookSecret
    };
  }

  private assertFocusWebhookAuthorization(headers: Record<string, string | undefined>): void {
    if (!this.focusWebhookSecret || !this.focusWebhookSecret.trim()) {
      if (this.environment === 'production') {
        throw new AppError('Focus webhook secret is required', 503, {
          missingEnv: ['FOCUS_WEBHOOK_SECRET']
        });
      }
      return;
    }
    const provided =
      stripBearerPrefix(headers.authorization) ??
      stripBearerPrefix(headers['authorization_header']) ??
      stripBearerPrefix(headers['x-focus-webhook-secret']) ??
      stripBearerPrefix(headers['x-webhook-secret']);
    const expected = stripBearerPrefix(this.focusWebhookSecret);

    if (!provided || !expected || provided !== expected) {
      throw new AppError('Focus webhook is not authorized', 401);
    }
  }

  private createPayloadHash(payload: Record<string, unknown>): string {
    const normalized = JSON.stringify(payload, Object.keys(payload).sort());
    return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
  }
}
