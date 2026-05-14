import { describe, expect, it } from 'vitest';
import {
  assertProductionCriticalConfig,
  validateProductionCriticalConfig,
  type ProductionCriticalConfigInput
} from '@/core/config/production-config';

const completeProductionConfig: ProductionCriticalConfigInput = {
  nodeEnv: 'production',
  rawEnv: {
    STRIPE_ENVIRONMENT: 'live',
    STRIPE_CONNECT_APPLICATION_FEE_BPS: '500',
    STRIPE_CONNECT_REQUIRED_CAPABILITIES: 'charges_enabled,transfers,card_payments',
    FOCUS_API_ENVIRONMENT: 'producao',
    FOCUS_API_BASE_URL: 'https://api.focusnfe.com.br/v2'
  },
  stripeEnvironment: 'live',
  stripeSecretKey: 'sk_live_1234567890abcdef',
  stripePublicKey: 'pk_live_1234567890abcdef',
  stripeWebhookSecret: 'whsec_1234567890abcdef',
  stripeFiscalWebhookSecret: 'whsec_fiscal_1234567890abcdef',
  billingPortalTokenSecret: 'prod-billing-portal-token-secret-32-chars',
  stripePriceIdPersonalMonthly: 'price_personal_live',
  stripePriceIdBusinessMonthly: 'price_business_live',
  stripeConnectApplicationFeeBps: 500,
  stripeConnectRequiredCapabilities: ['charges_enabled', 'transfers', 'card_payments'],
  focusApiEnvironment: 'producao',
  focusApiBaseUrl: 'https://api.focusnfe.com.br/v2',
  focusWebhookSecret: 'prod-focus-webhook-secret-32-chars-ok'
};

describe('production critical config validation', () => {
  it('does not block development or test without provider env', () => {
    expect(validateProductionCriticalConfig({
      nodeEnv: 'development',
      rawEnv: {}
    })).toEqual([]);
    expect(validateProductionCriticalConfig({
      nodeEnv: 'test',
      rawEnv: {}
    })).toEqual([]);
  });

  it('fails production when required Billing/Fiscal env is absent', () => {
    const violations = validateProductionCriticalConfig({
      nodeEnv: 'production',
      rawEnv: {}
    });

    expect(violations.map((violation) => violation.env)).toEqual(expect.arrayContaining([
      'STRIPE_ENVIRONMENT',
      'STRIPE_SECRET_KEY',
      'STRIPE_PUBLIC_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_WEBHOOK_SECRET_FISCAL',
      'BILLING_PORTAL_TOKEN_SECRET',
      'STRIPE_CONNECT_APPLICATION_FEE_BPS',
      'STRIPE_CONNECT_REQUIRED_CAPABILITIES',
      'FOCUS_API_ENVIRONMENT',
      'FOCUS_API_BASE_URL',
      'FOCUS_WEBHOOK_SECRET'
    ]));
  });

  it('fails production with partial Stripe/Focus env', () => {
    const violations = validateProductionCriticalConfig({
      ...completeProductionConfig,
      rawEnv: {
        STRIPE_ENVIRONMENT: 'live',
        STRIPE_CONNECT_APPLICATION_FEE_BPS: '500',
        FOCUS_API_ENVIRONMENT: 'producao',
        FOCUS_API_BASE_URL: 'https://api.focusnfe.com.br/v2'
      },
      stripePublicKey: undefined,
      stripeConnectRequiredCapabilities: []
    });

    expect(violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ env: 'STRIPE_PUBLIC_KEY', reason: 'missing' }),
      expect.objectContaining({ env: 'STRIPE_CONNECT_REQUIRED_CAPABILITIES', reason: 'missing' })
    ]));
  });

  it('fails production with weak/default secrets without leaking their values', () => {
    const weakSecret = 'change-me-minimum-16-chars-billing-portal-secret';
    const violations = validateProductionCriticalConfig({
      ...completeProductionConfig,
      billingPortalTokenSecret: weakSecret,
      focusWebhookSecret: 'change-me-focus-webhook-secret'
    });

    expect(violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ env: 'BILLING_PORTAL_TOKEN_SECRET', reason: 'weak' }),
      expect.objectContaining({ env: 'FOCUS_WEBHOOK_SECRET', reason: 'weak' })
    ]));

    expect(() =>
      assertProductionCriticalConfig({
        ...completeProductionConfig,
        billingPortalTokenSecret: weakSecret
      })
    ).toThrow(/BILLING_PORTAL_TOKEN_SECRET: weak/);
    expect(() =>
      assertProductionCriticalConfig({
        ...completeProductionConfig,
        billingPortalTokenSecret: weakSecret
      })
    ).not.toThrow(weakSecret);
  });

  it('fails production when sandbox Stripe or Focus config is mixed into production', () => {
    const violations = validateProductionCriticalConfig({
      ...completeProductionConfig,
      rawEnv: {
        ...completeProductionConfig.rawEnv,
        STRIPE_ENVIRONMENT: 'test',
        FOCUS_API_ENVIRONMENT: 'homologacao',
        FOCUS_API_BASE_URL: 'https://homologacao.focusnfe.com.br/v2'
      },
      stripeEnvironment: 'test',
      stripeSecretKey: 'sk_test_1234567890abcdef',
      stripePublicKey: 'pk_test_1234567890abcdef',
      focusApiEnvironment: 'homologacao',
      focusApiBaseUrl: 'https://homologacao.focusnfe.com.br/v2'
    });

    expect(violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ env: 'STRIPE_ENVIRONMENT', reason: 'sandbox_production_mismatch' }),
      expect.objectContaining({ env: 'STRIPE_SECRET_KEY', reason: 'sandbox_production_mismatch' }),
      expect.objectContaining({ env: 'STRIPE_PUBLIC_KEY', reason: 'sandbox_production_mismatch' }),
      expect.objectContaining({ env: 'FOCUS_API_ENVIRONMENT', reason: 'sandbox_production_mismatch' }),
      expect.objectContaining({ env: 'FOCUS_API_BASE_URL', reason: 'sandbox_production_mismatch' })
    ]));
  });

  it('accepts complete production Billing, Stripe Connect and Focus config', () => {
    expect(validateProductionCriticalConfig(completeProductionConfig)).toEqual([]);
    expect(() => assertProductionCriticalConfig(completeProductionConfig)).not.toThrow();
  });
});
