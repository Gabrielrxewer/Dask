import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '@/core/http/async-handler';
import { authMiddleware } from '@/core/http/auth-middleware';
import { AppError } from '@/core/errors/app-error';
import type { BillingService } from '../application/billing-service';
import { createCheckoutSessionDto } from './dto';

interface BillingRouteDeps {
  billingService: BillingService;
}

export function buildBillingRoutes({ billingService }: BillingRouteDeps): Router {
  const router = Router();

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

  return router;
}
