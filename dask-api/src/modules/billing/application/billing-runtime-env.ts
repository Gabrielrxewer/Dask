import { AppError } from '@/core/errors/app-error';
import type { SubscriptionPlan } from '../domain/types';

export type BillingRuntimeEnvironment = 'development' | 'test' | 'production';

export interface StripeBillingRuntimeEnv {
  nodeEnv: BillingRuntimeEnvironment;
  stripeSecretKey?: string | null;
  stripePublicKey?: string | null;
  stripeWebhookSecret?: string | null;
  billingPortalTokenSecret?: string | null;
  priceIds?: Partial<Record<SubscriptionPlan, string | null | undefined>>;
}

export const STRIPE_BILLING_PRODUCTION_ENV_VARS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_PUBLIC_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'BILLING_PORTAL_TOKEN_SECRET',
  'STRIPE_PRICE_ID_PERSONAL_MONTHLY',
  'STRIPE_PRICE_ID_BUSINESS_MONTHLY'
] as const;

function hasValue(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function listMissingStripeBillingProductionEnv(input: StripeBillingRuntimeEnv): string[] {
  if (input.nodeEnv !== 'production') {
    return [];
  }

  const missing: string[] = [];
  if (!hasValue(input.stripeSecretKey)) missing.push('STRIPE_SECRET_KEY');
  if (!hasValue(input.stripePublicKey)) missing.push('STRIPE_PUBLIC_KEY');
  if (!hasValue(input.stripeWebhookSecret)) missing.push('STRIPE_WEBHOOK_SECRET');
  if (!hasValue(input.billingPortalTokenSecret)) missing.push('BILLING_PORTAL_TOKEN_SECRET');
  if (!hasValue(input.priceIds?.PERSONAL)) missing.push('STRIPE_PRICE_ID_PERSONAL_MONTHLY');
  if (!hasValue(input.priceIds?.BUSINESS)) missing.push('STRIPE_PRICE_ID_BUSINESS_MONTHLY');
  return missing;
}

export function assertStripeBillingProductionEnv(input: StripeBillingRuntimeEnv): void {
  const missingEnv = listMissingStripeBillingProductionEnv(input);
  if (missingEnv.length === 0) {
    return;
  }

  throw new AppError('Stripe billing environment is not configured for production', 503, {
    code: 'STRIPE_BILLING_ENV_MISSING',
    missingEnv
  });
}
