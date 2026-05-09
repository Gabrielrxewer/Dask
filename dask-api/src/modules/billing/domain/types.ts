// These will be enriched by `prisma generate` but we define the union types here
// so the module compiles before migration runs.
export type SubscriptionPlan = 'PERSONAL' | 'BUSINESS';
export type SubscriptionStatus =
  | 'INCOMPLETE'
  | 'INCOMPLETE_EXPIRED'
  | 'TRIALING'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'CANCELED'
  | 'UNPAID'
  | 'PAUSED';

export const SUBSCRIPTION_PLANS = ['PERSONAL', 'BUSINESS'] as const satisfies SubscriptionPlan[];

export const PLAN_PRICE_IDS: Record<SubscriptionPlan, string> = {
  PERSONAL: process.env.STRIPE_PRICE_ID_PERSONAL_MONTHLY ?? '',
  BUSINESS: process.env.STRIPE_PRICE_ID_BUSINESS_MONTHLY ?? ''
};

/** Stripe statuses that grant full platform access */
export const ACTIVE_STATUSES: SubscriptionStatus[] = ['ACTIVE', 'TRIALING'];

export function isSubscriptionActive(status: SubscriptionStatus | null | undefined): boolean {
  if (!status) return false;
  return ACTIVE_STATUSES.includes(status);
}

export interface BillingStatus {
  hasActiveSubscription: boolean;
  plan: SubscriptionPlan | null;
  status: SubscriptionStatus | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canAccessPlatform: boolean;
  canCreateWorkspace: boolean;
  message: string | null;
}
