import { describe, expect, it } from 'vitest';
import {
  REDACTED,
  maskEmail,
  maskPhone,
  redactError,
  redactLogData,
  redactSensitiveText,
  redactSensitiveValue
} from '@/core/security/redaction';
import { AppError } from '@/core/errors/app-error';

describe('central redaction', () => {
  it('redacts common secret keys while preserving diagnostic fields', () => {
    const payload = redactSensitiveValue({
      requestId: 'req-123',
      status: 'failed',
      authorization: 'Bearer secret-token-value',
      apiKey: 'sk-proj-abcdefghijklmnopqrstuvwxyz1234567890',
      stripeSecretKey: 'sk_live_1234567890abcdef',
      stripeWebhookSecret: 'whsec_1234567890abcdef',
      focusToken: 'focus-token-secret',
      webhookSecret: 'webhook-secret',
      nested: {
        url: 'https://app.test/callback?clientAccessToken=client-token-secret&ok=1',
        message: 'provider returned token=provider-secret'
      }
    });

    expect(payload).toMatchObject({
      requestId: 'req-123',
      status: 'failed',
      authorization: REDACTED,
      apiKey: REDACTED,
      stripeSecretKey: REDACTED,
      stripeWebhookSecret: REDACTED,
      focusToken: REDACTED,
      webhookSecret: REDACTED,
      nested: {
        url: `https://app.test/callback?clientAccessToken=${REDACTED}&ok=1`,
        message: `provider returned token=${REDACTED}`
      }
    });
  });

  it('redacts sensitive text patterns used by AI prompts and provider errors', () => {
    const text = redactSensitiveText(
      [
        'email admin@example.com',
        'phone +55 11 99999-9999',
        'bearer Bearer abcdefghijklmnop',
        'stripe sk_test_1234567890abcdef',
        'webhook whsec_1234567890abcdef',
        'card 4242 4242 4242 4242'
      ].join(' | ')
    );

    expect(text).not.toContain('admin@example.com');
    expect(text).not.toContain('+55 11 99999-9999');
    expect(text).not.toContain('abcdefghijklmnop');
    expect(text).not.toContain('sk_test_1234567890abcdef');
    expect(text).not.toContain('whsec_1234567890abcdef');
    expect(text).not.toContain('4242 4242 4242 4242');
    expect(text).toContain(REDACTED);
  });

  it('masks personal data in log payloads without hiding business context', () => {
    const safe = redactLogData({
      event: 'billing.checkout.failed',
      reason: 'Payment method rejected',
      email: 'customer@example.com',
      phone: '+5511999999999',
      metadata: {
        orderId: 'order-1',
        portalToken: 'portal-token-secret'
      }
    });

    expect(safe).toMatchObject({
      event: 'billing.checkout.failed',
      reason: 'Payment method rejected',
      email: 'c***@example.com',
      phone: '+55******9999',
      metadata: {
        orderId: 'order-1',
        portalToken: REDACTED
      }
    });
  });

  it('redacts AppError messages and details for client-safe responses', () => {
    const error = new AppError('Business rule failed token=raw-secret', 409, {
      reason: 'business_rule',
      webhookSecret: 'webhook-secret',
      contactEmail: 'owner@example.com'
    });

    const safe = redactError(error);

    expect(safe).toMatchObject({
      name: 'Error',
      message: `Business rule failed token=${REDACTED}`,
      statusCode: 409,
      details: {
        reason: 'business_rule',
        webhookSecret: REDACTED,
        contactEmail: 'o***@example.com'
      }
    });
    expect(JSON.stringify(safe)).not.toContain('raw-secret');
    expect(JSON.stringify(safe)).not.toContain('webhook-secret');
    expect(JSON.stringify(safe)).not.toContain('owner@example.com');
  });

  it('exposes shared email and phone masks for domain-specific views', () => {
    expect(maskEmail('jane@acme.test')).toBe('j***@acme.test');
    expect(maskPhone('+5511999999999')).toBe('+55******9999');
  });
});
