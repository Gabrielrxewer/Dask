import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { asyncHandler } from '@/core/http/async-handler';
import { CommunicationUnsubscribeService } from '@/modules/automation/communication/communication-unsubscribe-service';

const unsubscribeQueryDto = z.object({
  token: z.string().min(16)
});

export function buildCommunicationPublicRoutes(input: {
  prisma: PrismaClient;
  unsubscribeService?: CommunicationUnsubscribeService;
}): Router {
  const router = Router();
  const unsubscribeService = input.unsubscribeService ?? new CommunicationUnsubscribeService(input.prisma);

  router.get(
    '/public/unsubscribe',
    asyncHandler(async (req, res) => {
      const query = unsubscribeQueryDto.parse(req.query);
      await unsubscribeService.consumeToken({ token: query.token });

      res
        .status(200)
        .type('html')
        .send('<!doctype html><html><body><h1>Unsubscribe registered</h1><p>You will no longer receive these emails.</p></body></html>');
    })
  );

  return router;
}
