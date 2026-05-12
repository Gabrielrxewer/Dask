import { describe, expect, it } from 'vitest';
import {
  assertFocusSmokeEnvironmentIsSafe,
  assertStripeSmokeKeyIsSafe,
  formatSmokeError,
  readProviderSmokeConfig,
  requireCompleteProviderSmokeEnv
} from './real-smoke-env';

describe('real provider smoke env helpers', () => {
  it('skips provider smokes when no real smoke flag is set', () => {
    const config = readProviderSmokeConfig('stripePlatform', {});

    expect(config).toEqual({
      provider: 'stripePlatform',
      requested: false,
      missingEnv: []
    });
  });

  it('fails loudly when a requested provider smoke has partial env', () => {
    expect(() =>
      requireCompleteProviderSmokeEnv('stripePlatform', {
        DASK_REAL_SMOKE_STRIPE_PLATFORM: 'true',
        STRIPE_SECRET_KEY: 'sk_test_123'
      })
    ).toThrow(/STRIPE_WEBHOOK_SECRET/);
  });

  it('keeps backward compatibility with the legacy Stripe smoke flag', () => {
    const config = readProviderSmokeConfig('stripePlatform', {
      DASK_STRIPE_REAL_SMOKE: 'true',
      STRIPE_SECRET_KEY: 'sk_test_123'
    });

    expect(config.requested).toBe(true);
    expect(config.missingEnv).toContain('STRIPE_PRICE_ID_PERSONAL_MONTHLY');
  });

  it('uses release real smoke flag to require provider env', () => {
    const config = readProviderSmokeConfig('aiProvider', {
      DASK_RELEASE_REAL_SMOKE: 'true',
      OPENAI_API_KEY: 'sk-test-openai-key'
    });

    expect(config.requested).toBe(true);
    expect(config.missingEnv).toContain('AI_CHAT_MODEL');
  });

  it('refuses live Stripe keys unless explicitly allowed', () => {
    expect(() => assertStripeSmokeKeyIsSafe('sk_live_secret')).toThrow(/refuses live/);
    expect(() =>
      assertStripeSmokeKeyIsSafe('sk_live_secret', { DASK_REAL_SMOKE_ALLOW_LIVE_STRIPE: 'true' })
    ).not.toThrow();
  });

  it('refuses Focus production unless explicitly allowed', () => {
    expect(() => assertFocusSmokeEnvironmentIsSafe('producao')).toThrow(/refuses non-homologacao/);
    expect(() =>
      assertFocusSmokeEnvironmentIsSafe('producao', { DASK_REAL_SMOKE_ALLOW_FOCUS_PRODUCTION: 'true' })
    ).not.toThrow();
  });

  it('redacts secrets in provider smoke error messages', () => {
    const error = new Error('provider failed with token=raw-secret admin@example.com sk_live_1234567890 pk_test_1234567890 sk-test-****************lder userPrompt=secret-prompt');

    const message = formatSmokeError(error);

    expect(message).not.toContain('raw-secret');
    expect(message).not.toContain('admin@example.com');
    expect(message).not.toContain('sk_live_1234567890');
    expect(message).not.toContain('pk_test_1234567890');
    expect(message).not.toContain('sk-test-****************lder');
    expect(message).not.toContain('secret-prompt');
  });
});
