import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '@/core/http/async-handler';
import { authMiddleware } from '@/core/http/auth-middleware';
import { AppError } from '@/core/errors/app-error';
import type { BillingService } from '../application/billing-service';
import {
  connectCatalogItemParamsDto,
  connectWorkspaceParamsDto,
  connectPaymentOrderParamsDto,
  createConnectCatalogItemDto,
  createBillingPortalTokenDto,
  createCheckoutSessionDto,
  createConnectCheckoutSessionDto,
  createConnectOnboardingLinkDto,
  listConnectCatalogItemsQueryDto,
  listConnectPaymentOrdersQueryDto,
  requestConnectPaymentCapabilityDto,
  syncConnectPaymentOrderQueryDto,
  updateConnectCatalogItemDto
} from './dto';

interface BillingRouteDeps {
  billingService: BillingService;
}

function resolvePageSize(input: { pageSize?: number; limit?: number }, fallback = 50): number {
  return Math.max(1, Math.min(input.pageSize ?? input.limit ?? fallback, 200));
}

function toCursorPage<T extends { id: string }>(items: T[], pageSize: number): { items: T[]; nextCursor: string | null } {
  const pageItems = items.slice(0, pageSize);
  return {
    items: pageItems,
    nextCursor: items.length > pageSize ? pageItems[pageItems.length - 1]?.id ?? null : null
  };
}

export function buildBillingRoutes({ billingService }: BillingRouteDeps): Router {
  const router = Router();

  router.get(
    '/billing/plans',
    asyncHandler(async (_req: Request, res: Response) => {
      const items = await billingService.listBillingPlans();
      res.status(200).json({ items });
    })
  );

  router.post(
    '/billing/checkout-session',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const parsed = createCheckoutSessionDto.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError('Invalid request body', 400);
      }

      const userId = req.auth!.userId;
      const { url } = await billingService.createCheckoutSession(userId, parsed.data.planCode);
      res.status(200).json({ url });
    })
  );

  router.get(
    '/billing/status',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const status = await billingService.getBillingStatus(req.auth!.userId);
      res.status(200).json(status);
    })
  );

  router.get(
    '/billing/me',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const status = await billingService.getBillingStatus(req.auth!.userId);
      res.status(200).json(status);
    })
  );

  router.post(
    '/billing/portal-session',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const { url } = await billingService.createBillingPortalSession(req.auth!.userId);
      res.status(200).json({ url });
    })
  );

  router.post(
    '/billing/connect/workspaces/:workspaceId/onboarding-link',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const params = connectWorkspaceParamsDto.safeParse(req.params);
      const body = createConnectOnboardingLinkDto.safeParse(req.body ?? {});
      if (!params.success || !body.success) {
        throw new AppError('Invalid request payload', 400);
      }

      const response = await billingService.createConnectOnboardingLink(
        params.data.workspaceId,
        req.auth!.userId,
        body.data
      );
      res.status(200).json(response);
    })
  );

  router.get(
    '/billing/connect/workspaces/:workspaceId/account',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const params = connectWorkspaceParamsDto.safeParse(req.params);
      if (!params.success) {
        throw new AppError('Invalid workspaceId', 400);
      }

      const status = await billingService.getConnectAccountStatus(params.data.workspaceId, req.auth!.userId);
      res.status(200).json(status);
    })
  );

  router.post(
    '/billing/connect/workspaces/:workspaceId/catalog-items',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const params = connectWorkspaceParamsDto.safeParse(req.params);
      const body = createConnectCatalogItemDto.safeParse(req.body ?? {});
      if (!params.success || !body.success) {
        throw new AppError('Invalid request payload', 400);
      }

      const item = await billingService.createConnectCatalogItem(
        params.data.workspaceId,
        req.auth!.userId,
        body.data
      );
      res.status(201).json(item);
    })
  );

  router.get(
    '/billing/connect/workspaces/:workspaceId/catalog-items',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const params = connectWorkspaceParamsDto.safeParse(req.params);
      const query = listConnectCatalogItemsQueryDto.safeParse(req.query ?? {});
      if (!params.success || !query.success) {
        throw new AppError('Invalid request payload', 400);
      }

      const pageSize = resolvePageSize(query.data, 100);
      const items = await billingService.listConnectCatalogItems(
        params.data.workspaceId,
        req.auth!.userId,
        {
          includeInactive: query.data.includeInactive,
          cursor: query.data.cursor,
          pageSize: pageSize + 1,
          kind: query.data.kind,
          billingType: query.data.billingType,
          status: query.data.status,
          search: query.data.search
        }
      );
      res.status(200).json(toCursorPage(items, pageSize));
    })
  );

  router.delete(
    '/billing/connect/workspaces/:workspaceId/catalog-items/:itemId',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const params = connectCatalogItemParamsDto.safeParse(req.params);
      if (!params.success) {
        throw new AppError('Invalid request payload', 400);
      }

      const item = await billingService.deactivateConnectCatalogItem(
        params.data.workspaceId,
        req.auth!.userId,
        params.data.itemId
      );
      res.status(200).json(item);
    })
  );

  router.patch(
    '/billing/connect/workspaces/:workspaceId/catalog-items/:itemId',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const params = connectCatalogItemParamsDto.safeParse(req.params);
      const body = updateConnectCatalogItemDto.safeParse(req.body ?? {});
      if (!params.success || !body.success) {
        throw new AppError('Invalid request payload', 400);
      }

      const item = await billingService.updateConnectCatalogItem(
        params.data.workspaceId,
        req.auth!.userId,
        params.data.itemId,
        body.data
      );
      res.status(200).json(item);
    })
  );

  router.post(
    '/billing/connect/workspaces/:workspaceId/checkout-session',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const params = connectWorkspaceParamsDto.safeParse(req.params);
      const body = createConnectCheckoutSessionDto.safeParse(req.body ?? {});
      if (!params.success || !body.success) {
        throw new AppError('Invalid request payload', 400);
      }

      const response = await billingService.createConnectCheckoutSession(
        params.data.workspaceId,
        req.auth!.userId,
        body.data
      );
      res.status(200).json(response);
    })
  );

  router.get(
    '/billing/connect/workspaces/:workspaceId/payment-orders',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const params = connectWorkspaceParamsDto.safeParse(req.params);
      const query = listConnectPaymentOrdersQueryDto.safeParse(req.query);
      if (!params.success || !query.success) {
        throw new AppError('Invalid request payload', 400);
      }

      const pageSize = resolvePageSize(query.data, 50);
      const orders = await billingService.listConnectPaymentOrders(
        params.data.workspaceId,
        req.auth!.userId,
        {
          cursor: query.data.cursor,
          pageSize: pageSize + 1,
          status: query.data.status,
          customerId: query.data.customerId,
          email: query.data.email,
          search: query.data.search
        }
      );
      res.status(200).json(toCursorPage(orders, pageSize));
    })
  );

  router.post(
    '/billing/connect/workspaces/:workspaceId/payment-capability',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const params = connectWorkspaceParamsDto.safeParse(req.params);
      const body = requestConnectPaymentCapabilityDto.safeParse(req.body ?? {});
      if (!params.success || !body.success) {
        throw new AppError('Invalid request payload', 400);
      }

      const status = await billingService.requestConnectLocalPaymentMethod(
        params.data.workspaceId,
        req.auth!.userId,
        body.data.paymentMethod
      );
      res.status(200).json(status);
    })
  );

  router.post(
    '/billing/connect/workspaces/:workspaceId/payment-orders/sync',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const params = connectWorkspaceParamsDto.safeParse(req.params);
      const query = syncConnectPaymentOrderQueryDto.safeParse(req.query);
      if (!params.success || !query.success) {
        throw new AppError('Invalid request payload', 400);
      }

      const order = await billingService.syncConnectPaymentOrderStatusBySessionId(
        params.data.workspaceId,
        req.auth!.userId,
        query.data.sessionId
      );
      res.status(200).json(order);
    })
  );

  router.post(
    '/billing/connect/workspaces/:workspaceId/payment-orders/:orderId/resend-email',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const params = connectPaymentOrderParamsDto.safeParse(req.params);
      if (!params.success) {
        throw new AppError('Invalid request params', 400);
      }

      await billingService.resendConnectPaymentOrderEmail(
        params.data.workspaceId,
        req.auth!.userId,
        params.data.orderId
      );
      res.status(200).json({ ok: true });
    })
  );

  router.post(
    '/billing/connect/workspaces/:workspaceId/payment-orders/:orderId/cancel',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const params = connectPaymentOrderParamsDto.safeParse(req.params);
      if (!params.success) {
        throw new AppError('Invalid request params', 400);
      }

      await billingService.cancelConnectPaymentOrder(
        params.data.workspaceId,
        req.auth!.userId,
        params.data.orderId
      );
      res.status(200).json({ ok: true });
    })
  );

  router.post(
    '/billing/connect/workspaces/:workspaceId/payment-orders/:orderId/portal-token',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const params = connectPaymentOrderParamsDto.safeParse(req.params);
      const body = createBillingPortalTokenDto.safeParse(req.body ?? {});
      if (!params.success || !body.success) {
        throw new AppError('Invalid request payload', 400);
      }

      const token = await billingService.createConnectPaymentOrderPortalToken(
        params.data.workspaceId,
        req.auth!.userId,
        params.data.orderId,
        body.data
      );
      res.status(201).json(token);
    })
  );

  router.post(
    '/billing/connect/workspaces/:workspaceId/payment-orders/:orderId/portal-token/revoke',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const params = connectPaymentOrderParamsDto.safeParse(req.params);
      if (!params.success) {
        throw new AppError('Invalid request params', 400);
      }

      await billingService.revokeConnectPaymentOrderPortalToken(
        params.data.workspaceId,
        req.auth!.userId,
        params.data.orderId
      );
      res.status(200).json({ ok: true });
    })
  );

  return router;
}
