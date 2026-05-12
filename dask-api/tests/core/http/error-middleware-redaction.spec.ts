import express from 'express';
import type { AddressInfo } from 'net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '@/core/errors/app-error';
import { errorMiddleware } from '@/core/http/error-middleware';
import { setTelemetryRecorder } from '@/core/telemetry/telemetry-recorder';

async function requestJson(app: express.Express, path: string) {
  const server = app.listen(0);
  const address = server.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
    return {
      status: response.status,
      payload: await response.json()
    };
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
}

describe('errorMiddleware redaction', () => {
  afterEach(() => {
    setTelemetryRecorder(null);
    vi.restoreAllMocks();
  });

  it('returns business errors with sensitive details redacted', async () => {
    const telemetry = vi.fn().mockResolvedValue(undefined);
    setTelemetryRecorder(telemetry);

    const app = express();
    app.get('/boom', () => {
      throw new AppError('Checkout rejected token=client-secret-token', 409, {
        reason: 'card_declined',
        stripeSecretKey: 'sk_live_1234567890abcdef',
        customerEmail: 'customer@example.com'
      });
    });
    app.use(errorMiddleware);

    const { status, payload } = await requestJson(app, '/boom');
    await new Promise((resolve) => setImmediate(resolve));

    expect(status).toBe(409);
    expect(payload).toMatchObject({
      message: 'Checkout rejected token=[REDACTED]',
      details: {
        reason: 'card_declined',
        stripeSecretKey: '[REDACTED]',
        customerEmail: 'c***@example.com'
      }
    });
    expect(JSON.stringify(payload)).not.toContain('client-secret-token');
    expect(JSON.stringify(payload)).not.toContain('sk_live_1234567890abcdef');
    expect(JSON.stringify(payload)).not.toContain('customer@example.com');
    expect(JSON.stringify(telemetry.mock.calls)).not.toContain('client-secret-token');
    expect(JSON.stringify(telemetry.mock.calls)).not.toContain('sk_live_1234567890abcdef');
  });
});
