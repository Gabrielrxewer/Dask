import { Router, type Request } from 'express';
import { asyncHandler } from '@/core/http/async-handler';
import type { LeadsService } from '@/modules/leads/application/leads-service';
import { leadWebhookBodyDto, leadWebhookParamsDto } from '@/modules/leads/http/dto';

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

export const buildLeadsIntegrationRoutes = (deps: { leadsService: LeadsService }): Router => {
  const router = Router();

  router.post(
    '/integrations/leads/webhook/:source',
    asyncHandler(async (req, res) => {
      const { source } = leadWebhookParamsDto.parse(req.params);
      const payload = leadWebhookBodyDto.parse(req.body ?? {});
      const workspaceIdFromQuery =
        typeof req.query.workspaceId === 'string' && req.query.workspaceId.trim().length > 0
          ? req.query.workspaceId.trim()
          : undefined;

      const result = await deps.leadsService.handleInboundWebhook({
        source: deps.leadsService.resolveIntegrationSource(source),
        headers: normalizeHeaders(req.headers),
        payload,
        workspaceId: workspaceIdFromQuery
      });

      res.status(200).json({ received: true, ...result });
    })
  );

  return router;
};
