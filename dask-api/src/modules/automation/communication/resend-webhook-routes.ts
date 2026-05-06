import { createHmac, timingSafeEqual } from 'crypto';
import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { env } from '@/core/config/env';
import { asyncHandler } from '@/core/http/async-handler';
import { AppError } from '@/core/errors/app-error';
import { CommunicationProviderEventService } from '@/modules/automation/communication/communication-provider-event-service';
import { normalizeResendWebhookEvent } from '@/modules/automation/communication/resend-webhook-event-normalizer';

function readRawBody(req: { rawBody?: Buffer; body: unknown }): Buffer {
  return req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
}

function verifySignature(input: {
  rawBody: Buffer;
  signature: string | undefined;
  secret: string;
}): boolean {
  if (!input.signature) {
    return false;
  }

  const expected = createHmac('sha256', input.secret).update(input.rawBody).digest('hex');
  const normalized = input.signature.replace(/^sha256=/, '').trim();
  const expectedBuffer = Buffer.from(expected, 'hex');
  const receivedBuffer = Buffer.from(normalized, 'hex');
  return expectedBuffer.length === receivedBuffer.length && timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function buildResendWebhookRoutes(input: {
  prisma: PrismaClient;
  providerEventService?: CommunicationProviderEventService;
  enabled?: boolean;
  secret?: string;
}): Router {
  const router = Router();
  const providerEventService = input.providerEventService ?? new CommunicationProviderEventService(input.prisma);

  router.post(
    '/webhooks/resend',
    asyncHandler(async (req, res) => {
      const enabled = input.enabled ?? env.RESEND_WEBHOOK_ENABLED;
      if (!enabled) {
        throw new AppError('Webhook not found.', 404);
      }

      const secret = input.secret ?? env.RESEND_WEBHOOK_SECRET;
      if (secret) {
        const signature = req.header('x-dask-signature') ?? req.header('x-resend-signature');
        const valid = verifySignature({
          rawBody: readRawBody(req as typeof req & { rawBody?: Buffer }),
          signature,
          secret
        });
        if (!valid) {
          throw new AppError('Invalid webhook signature.', 401);
        }
      }

      const normalized = normalizeResendWebhookEvent(req.body);
      const result = await providerEventService.receiveEvent({ event: normalized });

      res.status(202).json({
        received: true,
        status: result.status
      });
    })
  );

  return router;
}
