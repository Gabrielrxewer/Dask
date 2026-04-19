import { Router } from 'express';
import { asyncHandler } from '@/core/http/async-handler';
import { env } from '@/core/config/env';
import type { MarketingService } from '@/modules/marketing/application/marketing-service';
import { providerWebhookBodyDto, providerWebhookParamsDto } from '@/modules/marketing/http/dto';

function normalizeHeader(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  if (Array.isArray(value)) {
    const normalized = value.join(',').trim();
    return normalized.length > 0 ? normalized : null;
  }

  return null;
}

export const buildMarketingIntegrationRoutes = (deps: { marketingService: MarketingService }): Router => {
  const router = Router();

  router.post(
    '/integrations/marketing/email-events/:provider',
    asyncHandler(async (req, res) => {
      const webhookSecret = env.MARKETING_WEBHOOK_SECRET?.trim();
      if (webhookSecret) {
        const provided =
          normalizeHeader(req.headers['x-marketing-webhook-secret']) ??
          normalizeHeader(req.headers['x-webhook-secret']) ??
          normalizeHeader(req.headers.authorization)?.replace(/^bearer\s+/i, '');

        if (!provided || provided !== webhookSecret) {
          res.status(401).json({ message: 'Unauthorized marketing webhook.' });
          return;
        }
      }

      const { provider } = providerWebhookParamsDto.parse(req.params);
      const payload = providerWebhookBodyDto.parse(req.body ?? {});

      await deps.marketingService.registerProviderEvent({
        workspaceId: payload.workspaceId,
        provider,
        providerMessageId: payload.providerMessageId,
        eventType: payload.eventType,
        occurredAt: payload.occurredAt,
        payload: payload.payload
      });

      res.status(200).json({ received: true });
    })
  );

  return router;
};
