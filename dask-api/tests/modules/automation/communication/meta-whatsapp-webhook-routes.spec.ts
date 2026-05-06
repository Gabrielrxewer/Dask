import crypto from 'crypto';
import express from 'express';
import { AddressInfo } from 'net';
import { describe, expect, it, vi } from 'vitest';
import { buildMetaWhatsAppWebhookRoutes } from '@/modules/automation/communication/meta-whatsapp-webhook-routes';

function makeApp(input?: {
  enabled?: boolean;
  verifyToken?: string;
  appSecret?: string;
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
  app.use('/api/v1', buildMetaWhatsAppWebhookRoutes({
    prisma: {} as any,
    enabled: input?.enabled ?? true,
    verifyToken: input?.verifyToken ?? 'verify-token',
    appSecret: input?.appSecret,
    providerEventService: { receiveEvent } as any
  }));
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.statusCode ?? 500).json({ message: err.message });
  });
  return { app, receiveEvent };
}

async function request(app: express.Express, input: {
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}) {
  const server = app.listen(0);
  const address = server.address() as AddressInfo;
  try {
    const rawBody = input.body === undefined
      ? undefined
      : typeof input.body === 'string' ? input.body : JSON.stringify(input.body);
    const response = await fetch(`http://127.0.0.1:${address.port}${input.path}`, {
      method: input.method,
      headers: rawBody ? {
        'content-type': 'application/json',
        ...(input.headers ?? {})
      } : input.headers,
      body: rawBody
    });
    const text = await response.text();
    return {
      status: response.status,
      body: text ? tryParseJson(text) : null,
      text
    };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

function tryParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const inboundPayload = {
  entry: [{
    changes: [{
      value: {
        metadata: { display_phone_number: '554933333333', phone_number_id: 'phone-number-1' },
        messages: [{
          id: 'wamid.reply.1',
          from: '5549999999999',
          timestamp: '1777982400',
          type: 'text',
          text: { body: 'Tenho interesse' }
        }]
      }
    }]
  }]
};

describe('Meta WhatsApp webhook routes', () => {
  it('verifies webhook challenge with a valid token', async () => {
    const { app } = makeApp({ verifyToken: 'valid-token' });

    const response = await request(app, {
      method: 'GET',
      path: '/api/v1/public/webhooks/whatsapp/meta?hub.mode=subscribe&hub.verify_token=valid-token&hub.challenge=abc123'
    });

    expect(response.status).toBe(200);
    expect(response.text).toBe('abc123');
  });

  it('rejects invalid verify token and disabled webhook safely', async () => {
    const invalid = await request(makeApp({ verifyToken: 'valid-token' }).app, {
      method: 'GET',
      path: '/api/v1/public/webhooks/whatsapp/meta?hub.mode=subscribe&hub.verify_token=bad&hub.challenge=abc123'
    });
    expect(invalid.status).toBe(403);

    const disabled = await request(makeApp({ enabled: false }).app, {
      method: 'GET',
      path: '/api/v1/public/webhooks/whatsapp/meta?hub.mode=subscribe&hub.verify_token=valid-token&hub.challenge=abc123'
    });
    expect(disabled.status).toBe(404);
  });

  it('accepts valid POST payloads without user auth', async () => {
    const { app, receiveEvent } = makeApp();

    const response = await request(app, {
      method: 'POST',
      path: '/api/v1/public/webhooks/whatsapp/meta',
      body: inboundPayload
    });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ received: true, status: 'accepted', events: 1 });
    expect(receiveEvent).toHaveBeenCalledWith({
      event: expect.objectContaining({
        eventType: 'whatsapp.replied',
        from: '5549999999999'
      })
    });
  });

  it('validates Meta signatures when app secret is configured', async () => {
    const rawBody = JSON.stringify(inboundPayload);
    const signature = `sha256=${crypto.createHmac('sha256', 'secret').update(Buffer.from(rawBody)).digest('hex')}`;
    const { app, receiveEvent } = makeApp({ appSecret: 'secret' });

    const accepted = await request(app, {
      method: 'POST',
      path: '/api/v1/public/webhooks/whatsapp/meta',
      body: rawBody,
      headers: { 'x-hub-signature-256': signature }
    });
    expect(accepted.status).toBe(202);

    const rejected = await request(app, {
      method: 'POST',
      path: '/api/v1/public/webhooks/whatsapp/meta',
      body: inboundPayload,
      headers: { 'x-hub-signature-256': 'sha256=bad' }
    });
    expect(rejected.status).toBe(401);
    expect(receiveEvent).toHaveBeenCalledTimes(1);
  });

  it('returns idempotent duplicate status without leaking details', async () => {
    const { app } = makeApp({
      receiveEvent: vi.fn(async () => ({
        status: 'duplicate',
        event: { id: 'provider-event-1' }
      }))
    });

    const response = await request(app, {
      method: 'POST',
      path: '/api/v1/public/webhooks/whatsapp/meta',
      body: inboundPayload
    });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({ received: true, status: 'accepted', events: 1 });
  });
});
