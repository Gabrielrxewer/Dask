import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@/core/http/async-handler';
import type { IntegrationService } from '@/modules/integration/application/integration-service';

const webhookDto = z.object({
  source: z.string().min(1),
  event: z.string().min(1),
  payload: z.record(z.unknown())
});

export const buildIntegrationRoutes = (deps: { integrationService: IntegrationService }): Router => {
  const router = Router();

  router.post(
    '/integration/webhooks',
    asyncHandler(async (req, res) => {
      const input = webhookDto.parse(req.body);
      await deps.integrationService.receiveWebhook(input);
      res.status(202).json({ status: 'accepted' });
    })
  );

  return router;
};
