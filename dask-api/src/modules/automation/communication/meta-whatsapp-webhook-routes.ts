import { createHmac, timingSafeEqual } from 'crypto';
import { Router } from 'express';
import type { PrismaClient } from '@prisma/client';
import { env } from '@/core/config/env';
import { AppError } from '@/core/errors/app-error';
import { asyncHandler } from '@/core/http/async-handler';
import { CommunicationProviderEventService } from '@/modules/automation/communication/communication-provider-event-service';
import { normalizeMetaWhatsAppWebhookEvents } from '@/modules/automation/communication/meta-whatsapp-webhook-normalizer';

function readRawBody(req: { rawBody?: Buffer; body: unknown }): Buffer {
  return req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
}

function verifyMetaSignature(input: {
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

export function buildMetaWhatsAppWebhookRoutes(input: {
  prisma: PrismaClient;
  providerEventService?: CommunicationProviderEventService;
  enabled?: boolean;
  verifyToken?: string;
  appSecret?: string;
  maxPayloadBytes?: number;
  environment?: 'development' | 'test' | 'production';
}): Router {
  const router = Router();
  const providerEventService = input.providerEventService ?? new CommunicationProviderEventService(input.prisma);

  router.get(
    '/public/webhooks/whatsapp/meta',
    asyncHandler(async (req, res) => {
      const enabled = input.enabled ?? env.META_WHATSAPP_WEBHOOK_ENABLED;
      if (!enabled) {
        throw new AppError('Webhook not found.', 404);
      }

      const mode = typeof req.query['hub.mode'] === 'string' ? req.query['hub.mode'] : undefined;
      const token = typeof req.query['hub.verify_token'] === 'string' ? req.query['hub.verify_token'] : undefined;
      const challenge = typeof req.query['hub.challenge'] === 'string' ? req.query['hub.challenge'] : undefined;
      const verifyToken = input.verifyToken ?? env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN;
      const environment = input.environment ?? env.NODE_ENV;
      if (!verifyToken && environment === 'production') {
        throw new AppError('Meta WhatsApp webhook verify token is required.', 503, {
          code: 'META_WHATSAPP_WEBHOOK_VERIFY_TOKEN_MISSING',
          missingEnv: ['META_WHATSAPP_WEBHOOK_VERIFY_TOKEN']
        });
      }

      if (mode === 'subscribe' && verifyToken && token === verifyToken && challenge) {
        res.status(200).type('text/plain').send(challenge);
        return;
      }

      res.status(403).json({ received: false });
    })
  );

  router.post(
    '/public/webhooks/whatsapp/meta',
    asyncHandler(async (req, res) => {
      const enabled = input.enabled ?? env.META_WHATSAPP_WEBHOOK_ENABLED;
      if (!enabled) {
        throw new AppError('Webhook not found.', 404);
      }

      const rawBody = readRawBody(req as typeof req & { rawBody?: Buffer });
      if (rawBody.byteLength > (input.maxPayloadBytes ?? 2 * 1024 * 1024)) {
        throw new AppError('Webhook payload too large.', 413);
      }

      const appSecret = input.appSecret ?? env.META_WHATSAPP_WEBHOOK_APP_SECRET;
      const environment = input.environment ?? env.NODE_ENV;
      if (!appSecret && environment === 'production') {
        throw new AppError('Meta WhatsApp webhook app secret is required.', 503, {
          code: 'META_WHATSAPP_WEBHOOK_APP_SECRET_MISSING',
          missingEnv: ['META_WHATSAPP_WEBHOOK_APP_SECRET']
        });
      }

      if (appSecret) {
        const valid = verifyMetaSignature({
          rawBody,
          signature: req.header('x-hub-signature-256') ?? undefined,
          secret: appSecret
        });
        if (!valid) {
          throw new AppError('Invalid webhook signature.', 401);
        }
      }

      const normalizedEvents = normalizeMetaWhatsAppWebhookEvents(req.body);
      const results = [];
      for (const event of normalizedEvents) {
        results.push(await providerEventService.receiveEvent({ event }));
      }

      res.status(202).json({
        received: true,
        status: results.some((result) => result.status === 'failed') ? 'failed' : 'accepted',
        events: results.length
      });
    })
  );

  return router;
}
