import { Router, type Request } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@/core/http/async-handler';
import type { CommercialIntakeService } from '@/modules/commercial-intake/application/commercial-intake-service';

const webhookParamsDto = z.object({
  source: z.string().trim().min(1).max(40)
});

const webhookBodyDto = z.record(z.unknown());

function normalizeHeaders(headers: Request['headers']): Record<string, string | undefined> {
  return Object.entries(headers).reduce<Record<string, string | undefined>>((acc, [key, value]) => {
    if (typeof value === 'string') {
      acc[key.toLowerCase()] = value;
    } else if (Array.isArray(value)) {
      acc[key.toLowerCase()] = value.join(',');
    } else {
      acc[key.toLowerCase()] = undefined;
    }
    return acc;
  }, {});
}

export const buildCommercialIntakeRoutes = (deps: { commercialIntakeService: CommercialIntakeService }): Router => {
  const router = Router();

  router.post(
    '/integrations/leads/webhook/:source',
    asyncHandler(async (req, res) => {
      const { source } = webhookParamsDto.parse(req.params);
      const payload = webhookBodyDto.parse(req.body ?? {});
      const workspaceIdFromQuery =
        typeof req.query.workspaceId === 'string' && req.query.workspaceId.trim().length > 0
          ? req.query.workspaceId.trim()
          : undefined;

      const result = await deps.commercialIntakeService.handleInboundWebhook({
        source: deps.commercialIntakeService.resolveSource(source),
        headers: normalizeHeaders(req.headers),
        payload,
        workspaceId: workspaceIdFromQuery
      });

      res.status(200).json({ received: true, ...result });
    })
  );

  return router;
};
