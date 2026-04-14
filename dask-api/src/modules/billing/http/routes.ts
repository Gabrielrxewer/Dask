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

  // POST /billing/checkout-session — create Stripe Checkout session
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

  // POST /billing/webhook — Stripe webhook (raw body required)
  router.post(
    '/billing/webhook',
    asyncHandler(async (req: Request, res: Response) => {
      const signature = req.headers['stripe-signature'];
      if (!signature || typeof signature !== 'string') {
        throw new AppError('Missing stripe-signature header', 400);
      }

      // req.body is a Buffer because we mount this route before express.json()
      await billingService.handleWebhook(req.body as Buffer, signature);
      res.status(200).json({ received: true });
    })
  );

  // GET /billing/status — current subscription status for authenticated user
  router.get(
    '/billing/status',
    authMiddleware,
    asyncHandler(async (req: Request, res: Response) => {
      const status = await billingService.getBillingStatus(req.auth!.userId);
      res.status(200).json(status);
    })
  );

  // GET /billing/me — alias for /billing/status
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
