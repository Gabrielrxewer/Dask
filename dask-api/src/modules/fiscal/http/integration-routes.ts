import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@/core/http/async-handler';
import type { FiscalService } from '@/modules/fiscal/application/fiscal-service';

const focusWebhookPayloadDto = z.record(z.unknown());

function normalizeHeaders(headers: Request['headers']): Record<string, string | undefined> {
  return Object.entries(headers).reduce<Record<string, string | undefined>>((acc, [key, value]) => {
    if (typeof value === 'string') {
      acc[key.toLowerCase()] = value;
      return acc;
    }

    if (Array.isArray(value)) {
      acc[key.toLowerCase()] = value.join(',');
      return acc;
    }

    acc[key.toLowerCase()] = undefined;
    return acc;
  }, {});
}

export const buildFiscalIntegrationRoutes = (deps: { fiscalService: FiscalService }): Router => {
  const router = Router();

  router.post(
    '/integrations/focus/webhook',
    asyncHandler(async (req: Request, res: Response) => {
      const payload = focusWebhookPayloadDto.parse(req.body ?? {});
      const result = await deps.fiscalService.handleFocusWebhook({
        payload,
        headers: normalizeHeaders(req.headers)
      });

      res.status(200).json({ received: true, ...result });
    })
  );

  router.post(
    '/integrations/stripe/webhook/fiscal',
    asyncHandler(async (req: Request, res: Response) => {
      const signature = req.headers['stripe-signature'];
      if (!signature || typeof signature !== 'string') {
        res.status(400).json({ error: 'Missing stripe-signature header' });
        return;
      }

      if (!Buffer.isBuffer(req.body)) {
        res.status(400).json({ error: 'Raw body is required for Stripe webhook signature validation' });
        return;
      }

      const result = await deps.fiscalService.handleStripeFiscalWebhook(req.body, signature);
      res.status(200).json({ received: true, ...result });
    })
  );

  return router;
};
