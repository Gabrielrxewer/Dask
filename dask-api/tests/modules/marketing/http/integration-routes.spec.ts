import express from 'express';
import { AddressInfo } from 'net';
import { describe, expect, it, vi } from 'vitest';
import { buildMarketingIntegrationRoutes } from '@/modules/marketing/http/integration-routes';

function makeApp(input?: {
  webhookSecret?: string;
  environment?: 'development' | 'test' | 'production';
  registerProviderEvent?: ReturnType<typeof vi.fn>;
}) {
  const app = express();
  app.use(express.json());
  const registerProviderEvent = input?.registerProviderEvent ?? vi.fn(async () => undefined);
  app.use('/api/v1', buildMarketingIntegrationRoutes({
    marketingService: { registerProviderEvent } as any,
    webhookSecret: input?.webhookSecret,
    environment: input?.environment
  }));
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.statusCode ?? 500).json({ message: err.message, details: err.details });
  });

  return { app, registerProviderEvent };
}

async function postJson(app: express.Express, input: {
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
}) {
  const server = app.listen(0);
  const address = server.address() as AddressInfo;
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/integrations/marketing/email-events/resend`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(input.headers ?? {})
      },
      body: JSON.stringify(input.body ?? {
        workspaceId: '11111111-1111-4111-8111-111111111111',
        providerMessageId: 'provider-message-1',
        eventType: 'EMAIL_DELIVERED',
        payload: { providerEventId: 'evt-1' }
      })
    });
    const body = await response.json();
    return { status: response.status, body };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

describe('marketing integration routes', () => {
  it('requires a webhook secret when enabled in production', async () => {
    const { app, registerProviderEvent } = makeApp({ environment: 'production' });

    const response = await postJson(app, {});

    expect(response.status).toBe(503);
    expect(response.body.details).toMatchObject({
      code: 'MARKETING_WEBHOOK_SECRET_MISSING',
      missingEnv: ['MARKETING_WEBHOOK_SECRET']
    });
    expect(registerProviderEvent).not.toHaveBeenCalled();
  });

  it('rejects invalid marketing webhook secrets', async () => {
    const { app, registerProviderEvent } = makeApp({ webhookSecret: 'expected-secret' });

    const response = await postJson(app, {
      headers: { 'x-marketing-webhook-secret': 'wrong-secret' }
    });

    expect(response.status).toBe(401);
    expect(registerProviderEvent).not.toHaveBeenCalled();
  });

  it('accepts valid marketing webhook payloads with a configured secret', async () => {
    const { app, registerProviderEvent } = makeApp({ webhookSecret: 'expected-secret' });

    const response = await postJson(app, {
      headers: { 'x-marketing-webhook-secret': 'expected-secret' }
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true });
    expect(registerProviderEvent).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: '11111111-1111-4111-8111-111111111111',
      provider: 'resend',
      providerMessageId: 'provider-message-1',
      eventType: 'EMAIL_DELIVERED'
    }));
  });
});
