import { Router } from 'express';
import { Prisma, type PrismaClient } from '@prisma/client';
import { asyncHandler } from '@/core/http/async-handler';
import { AppError } from '@/core/errors/app-error';
import {
  requireWorkspaceModule,
  requireWorkspacePermission,
  workspaceScopeMiddleware
} from '@/modules/identity/http/workspace-scope-middleware';
import type { AuthorizationService } from '@/modules/identity/domain/authorization';
import type { FiscalService } from '@/modules/fiscal/application/fiscal-service';
import {
  cancelFiscalDocumentDto,
  createFiscalCompanyConfigDto,
  createFiscalDocumentDto,
  fiscalCompanyParamsDto,
  fiscalDraftParamsDto,
  fiscalDraftsQueryDto,
  fiscalDocumentParamsDto,
  fiscalDocumentsQueryDto,
  receivedQueryDto,
  syncReceivedDto,
  updateFiscalCompanyConfigDto,
  upsertFiscalCatalogProfileDto,
  upsertFiscalOperationTemplateDto,
  workspaceParamsDto
} from '@/modules/fiscal/http/dto';

const asJsonValue = (value: unknown): Prisma.JsonValue => {
  if (value === undefined || value === null) {
    return null;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.JsonValue;
  } catch {
    return null;
  }
};

const maskFocusToken = (token: string | null | undefined): string | null => {
  if (!token) {
    return null;
  }

  return `${token.slice(0, 4)}***`;
};

const sanitizeCompanyConfig = <T extends { focusToken: string | null }>(item: T): T => ({
  ...item,
  focusToken: maskFocusToken(item.focusToken)
});

export const buildFiscalRoutes = (deps: {
  prisma: PrismaClient;
  authorizationService: AuthorizationService;
  fiscalService: FiscalService;
}): Router => {
  const router = Router();

  const resolveWorkspaceScope = workspaceScopeMiddleware(deps.prisma);
  const requireFiscalRead = requireWorkspacePermission(deps.authorizationService, 'fiscal.read');
  const requireFiscalIssue = requireWorkspacePermission(deps.authorizationService, 'fiscal.issue');
  const requireFiscalConfig = requireWorkspacePermission(deps.authorizationService, 'fiscal.config');
  const resolveClientCustomerIds = async (
    req: { workspace?: { role?: string }; auth?: { userId?: string } },
    workspaceId: string
  ): Promise<string[] | undefined> => {
    if (req.workspace?.role !== 'CLIENT') {
      return undefined;
    }

    const links = await deps.prisma.workspaceCustomerUser.findMany({
      where: {
        workspaceId,
        userId: req.auth?.userId
      },
      select: { customerId: true }
    });

    if (links.length === 0) {
      throw new AppError('Customer access is not linked to this workspace', 403);
    }

    return links.map((link) => link.customerId);
  };

  router.use(
    '/fiscal/workspaces/:workspaceId',
    resolveWorkspaceScope,
    requireWorkspaceModule('fiscal'),
    requireFiscalRead
  );

  router.get(
    '/fiscal/workspaces/:workspaceId/dashboard',
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceParamsDto.parse(req.params);
      const customerIds = await resolveClientCustomerIds(req, workspaceId);
      const dashboard = await deps.fiscalService.getDashboard(workspaceId, customerIds);
      res.status(200).json(dashboard);
    })
  );

  router.get(
    '/fiscal/workspaces/:workspaceId/drafts',
    requireFiscalRead,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceParamsDto.parse(req.params);
      const query = fiscalDraftsQueryDto.parse(req.query ?? {});
      const customerIds = await resolveClientCustomerIds(req, workspaceId);
      const items = await deps.fiscalService.listEmissionDrafts(workspaceId, query.limit, customerIds);
      res.status(200).json({ items });
    })
  );

  router.post(
    '/fiscal/workspaces/:workspaceId/drafts/:draftId/emit',
    requireFiscalIssue,
    asyncHandler(async (req, res) => {
      const { workspaceId, draftId } = fiscalDraftParamsDto.parse(req.params);
      const document = await deps.fiscalService.emitDraft({
        workspaceId,
        draftId,
        requestedByUserId: req.auth!.userId
      });
      res.status(200).json(document);
    })
  );

  router.get(
    '/fiscal/workspaces/:workspaceId/documents',
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceParamsDto.parse(req.params);
      const query = fiscalDocumentsQueryDto.parse(req.query ?? {});
      const customerIds = await resolveClientCustomerIds(req, workspaceId);
      const documents = await deps.fiscalService.listDocuments({
        workspaceId,
        workspaceBusinessId: query.workspaceBusinessId,
        documentType: query.documentType,
        direction: query.direction,
        status: query.status,
        origin: query.origin,
        customerId: query.customerId,
        customerIds,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
        search: query.search,
        limit: query.limit
      });

      res.status(200).json({ items: documents });
    })
  );

  router.post(
    '/fiscal/workspaces/:workspaceId/documents',
    requireFiscalIssue,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceParamsDto.parse(req.params);
      const payload = createFiscalDocumentDto.parse(req.body ?? {});
      const created = await deps.fiscalService.createDocument({
        workspaceId,
        workspaceBusinessId: payload.workspaceBusinessId,
        companyConfigId: payload.companyConfigId,
        internalReference: payload.internalReference,
        direction: payload.direction,
        documentType: payload.documentType,
        origin: payload.origin,
        sourceSystem: payload.sourceSystem,
        customerId: payload.customerId,
        supplierId: payload.supplierId,
        saleId: payload.saleId,
        stripeSessionId: payload.stripeSessionId,
        stripePaymentIntentId: payload.stripePaymentIntentId,
        stripeChargeId: payload.stripeChargeId,
        stripeAccountId: payload.stripeAccountId,
        focusReference: payload.focusReference,
        amountSubtotal: payload.amountSubtotal,
        amountDiscount: payload.amountDiscount,
        amountTotal: payload.amountTotal,
        currency: payload.currency,
        requestPayloadSnapshot: payload.requestPayloadSnapshot,
        responsePayloadSnapshot: payload.responsePayloadSnapshot,
        providerPayloadRaw: payload.providerPayloadRaw,
        metadata: payload.metadata,
        createdByUserId: req.auth?.userId ?? null,
        items: payload.items,
        parties: payload.parties
      });

      res.status(201).json(created);
    })
  );

  router.get(
    '/fiscal/workspaces/:workspaceId/documents/:documentId',
    asyncHandler(async (req, res) => {
      const { workspaceId, documentId } = fiscalDocumentParamsDto.parse(req.params);
      const customerIds = await resolveClientCustomerIds(req, workspaceId);
      const details = await deps.fiscalService.getDocumentDetails(workspaceId, documentId, customerIds);
      res.status(200).json(details);
    })
  );

  router.post(
    '/fiscal/workspaces/:workspaceId/documents/:documentId/issue',
    requireFiscalIssue,
    asyncHandler(async (req, res) => {
      const { workspaceId, documentId } = fiscalDocumentParamsDto.parse(req.params);
      const issued = await deps.fiscalService.issueDocument({
        workspaceId,
        documentId,
        requestedByUserId: req.auth!.userId
      });

      res.status(200).json(issued);
    })
  );

  router.post(
    '/fiscal/workspaces/:workspaceId/documents/:documentId/cancel',
    requireFiscalIssue,
    asyncHandler(async (req, res) => {
      const { workspaceId, documentId } = fiscalDocumentParamsDto.parse(req.params);
      const body = cancelFiscalDocumentDto.parse(req.body ?? {});
      const cancelled = await deps.fiscalService.cancelDocument({
        workspaceId,
        documentId,
        justification: body.justification
      });

      res.status(200).json(cancelled);
    })
  );

  router.post(
    '/fiscal/workspaces/:workspaceId/documents/:documentId/retry',
    requireFiscalIssue,
    asyncHandler(async (req, res) => {
      const { workspaceId, documentId } = fiscalDocumentParamsDto.parse(req.params);
      const retried = await deps.fiscalService.retryDocumentIssue({
        workspaceId,
        documentId,
        requestedByUserId: req.auth!.userId
      });

      res.status(200).json(retried);
    })
  );

  router.get(
    '/fiscal/workspaces/:workspaceId/received',
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceParamsDto.parse(req.params);
      const query = receivedQueryDto.parse(req.query ?? {});
      const customerIds = await resolveClientCustomerIds(req, workspaceId);
      const items = await deps.fiscalService.listReceivedDocuments({
        workspaceId,
        workspaceBusinessId: query.workspaceBusinessId,
        type: query.type,
        status: query.status,
        search: query.search,
        from: query.from ? new Date(query.from) : undefined,
        to: query.to ? new Date(query.to) : undefined,
        limit: query.limit,
        customerIds
      });

      res.status(200).json({ items });
    })
  );

  router.post(
    '/fiscal/workspaces/:workspaceId/received/sync',
    requireFiscalIssue,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceParamsDto.parse(req.params);
      const body = syncReceivedDto.parse(req.body ?? {});
      const result = await deps.fiscalService.syncReceived({
        workspaceId,
        companyConfigId: body.companyConfigId,
        type: body.type,
        trigger: body.trigger,
        requestedByUserId: req.auth!.userId
      });

      res.status(202).json(result);
    })
  );

  router.get(
    '/fiscal/workspaces/:workspaceId/companies',
    requireFiscalConfig,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceParamsDto.parse(req.params);
      const items = await deps.fiscalService.listCompanyConfigs(workspaceId);
      const sanitized = items.map((item) => sanitizeCompanyConfig(item));

      res.status(200).json({ items: sanitized });
    })
  );

  router.post(
    '/fiscal/workspaces/:workspaceId/companies',
    requireFiscalConfig,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceParamsDto.parse(req.params);
      const payload = createFiscalCompanyConfigDto.parse(req.body ?? {});
      const created = await deps.fiscalService.createCompanyConfig({
        workspaceId,
        ...payload,
        createdByUserId: req.auth!.userId
      });

      res.status(201).json(sanitizeCompanyConfig(created));
    })
  );

  router.put(
    '/fiscal/workspaces/:workspaceId/companies/:companyId',
    requireFiscalConfig,
    asyncHandler(async (req, res) => {
      const { workspaceId, companyId } = fiscalCompanyParamsDto.parse(req.params);
      const patch = updateFiscalCompanyConfigDto.parse(req.body ?? {});
      const updated = await deps.fiscalService.updateCompanyConfig({
        workspaceId,
        companyConfigId: companyId,
        patch
      });

      res.status(200).json(sanitizeCompanyConfig(updated));
    })
  );

  router.post(
    '/fiscal/workspaces/:workspaceId/companies/:companyId/validate',
    requireFiscalConfig,
    asyncHandler(async (req, res) => {
      const { workspaceId, companyId } = fiscalCompanyParamsDto.parse(req.params);
      const result = await deps.fiscalService.validateCompanyConfig({
        workspaceId,
        companyConfigId: companyId
      });

      res.status(200).json(result);
    })
  );

  router.get(
    '/fiscal/workspaces/:workspaceId/catalog/profiles',
    requireFiscalConfig,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceParamsDto.parse(req.params);
      const items = await deps.fiscalService.listCatalogProfiles(workspaceId);
      res.status(200).json({ items });
    })
  );

  router.post(
    '/fiscal/workspaces/:workspaceId/catalog/profiles',
    requireFiscalConfig,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceParamsDto.parse(req.params);
      const payload = upsertFiscalCatalogProfileDto.parse(req.body ?? {});
      const saved = await deps.fiscalService.upsertCatalogProfile(workspaceId, {
        ...payload,
        defaultValue:
          payload.defaultValue !== undefined && payload.defaultValue !== null
            ? new Prisma.Decimal(payload.defaultValue)
            : null,
        taxConfig: asJsonValue(payload.taxConfig),
        metadata: asJsonValue(payload.metadata),
        createdByUserId: req.auth!.userId
      });
      res.status(200).json(saved);
    })
  );

  router.get(
    '/fiscal/workspaces/:workspaceId/operation-templates',
    requireFiscalConfig,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceParamsDto.parse(req.params);
      const items = await deps.fiscalService.listOperationTemplates(workspaceId);
      res.status(200).json({ items });
    })
  );

  router.post(
    '/fiscal/workspaces/:workspaceId/operation-templates',
    requireFiscalConfig,
    asyncHandler(async (req, res) => {
      const { workspaceId } = workspaceParamsDto.parse(req.params);
      const payload = upsertFiscalOperationTemplateDto.parse(req.body ?? {});
      const saved = await deps.fiscalService.upsertOperationTemplate(workspaceId, {
        ...payload,
        taxDefaults: asJsonValue(payload.taxDefaults),
        createdByUserId: req.auth!.userId
      });

      res.status(200).json(saved);
    })
  );

  return router;
};

