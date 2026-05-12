import crypto from 'crypto';
import express from 'express';
import { AddressInfo } from 'net';
import { describe, expect, it, vi } from 'vitest';
import { buildResendWebhookRoutes } from '@/modules/automation/communication/resend-webhook-routes';

function makeApp(input?: {
  enabled?: boolean;
  secret?: string;
  environment?: 'development' | 'test' | 'production';
  receiveEvent?: ReturnType<typeof vi.fn>;
}) {
  const app = express();
  app.use(express.json({
    verify: (req, _res, buf) => {
      (req as typeof req & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
    }
  }));
  const receiveEvent = input?.receiveEvent ?? vi.fn(async () => ({
    status: 'processed',
    event: { id: 'provider-event-1' }
  }));
  app.use('/api/v1', buildResendWebhookRoutes({
    prisma: {} as any,
    enabled: input?.enabled ?? true,
    secret: input?.secret,
    environment: input?.environment,
    providerEventService: { receiveEvent } as any
  }));
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.statusCode ?? 500).json({ message: err.message, details: err.details });
  });

  return { app, receiveEvent };
}

async function postJson(app: express.Express, input: {
  path: string;
  body: unknown;
  headers?: Record<string, string>;
}) {
  const server = app.listen(0);
  const address = server.address() as AddressInfo;
  try {
    const rawBody = typeof input.body === 'string' ? input.body : JSON.stringify(input.body);
    const response = await fetch(`http://127.0.0.1:${address.port}${input.path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(input.headers ?? {})
      },
      body: rawBody
    });
    const json = await response.json();
    return { status: response.status, body: json };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

describe('Resend webhook routes', () => {
  it('accepts valid payloads without user auth', async () => {
    const { app, receiveEvent } = makeApp();

    const response = await postJson(app, {
      path: '/api/v1/webhooks/resend',
      body: {
        id: 'evt-1',
        type: 'email.delivered',
        data: { email: { id: 'resend_123', to: 'person@example.com' } }
      }
    });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ received: true, status: 'processed' });
    expect(receiveEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: expect.objectContaining({ eventType: 'email.delivered' })
      })
    );
  });

  it('rejects invalid signature when secret is configured', async () => {
    const { app, receiveEvent } = makeApp({ secret: 'secret' });

    const response = await postJson(app, {
      path: '/api/v1/webhooks/resend',
      headers: { 'x-dask-signature': 'bad' },
      body: { id: 'evt-1', type: 'email.delivered', data: {} }
    });

    expect(response.status).toBe(401);
    expect(receiveEvent).not.toHaveBeenCalled();
  });

  it('requires a webhook secret when enabled in production', async () => {
    const { app, receiveEvent } = makeApp({ environment: 'production' });

    const response = await postJson(app, {
      path: '/api/v1/webhooks/resend',
      body: { id: 'evt-1', type: 'email.delivered', data: {} }
    });

    expect(response.status).toBe(503);
    expect(response.body.details).toMatchObject({
      code: 'RESEND_WEBHOOK_SECRET_MISSING',
      missingEnv: ['RESEND_WEBHOOK_SECRET']
    });
    expect(receiveEvent).not.toHaveBeenCalled();
  });

  it('accepts valid signature and duplicate responses are idempotent', async () => {
    const body = JSON.stringify({ id: 'evt-1', type: 'email.delivered', data: {} });
    const signature = crypto.createHmac('sha256', 'secret').update(Buffer.from(body)).digest('hex');
    const { app } = makeApp({
      secret: 'secret',
      receiveEvent: vi.fn(async () => ({
        status: 'duplicate',
        event: { id: 'provider-event-1' }
      }))
    });

    const response = await postJson(app, {
      path: '/api/v1/webhooks/resend',
      headers: { 'x-dask-signature': signature },
      body
    });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ received: true, status: 'duplicate' });
  });

  it('returns not found when disabled', async () => {
    const { app } = makeApp({ enabled: false });

    const response = await postJson(app, {
      path: '/api/v1/webhooks/resend',
      body: { id: 'evt-1' }
    });

    expect(response.status).toBe(404);
  });
});
