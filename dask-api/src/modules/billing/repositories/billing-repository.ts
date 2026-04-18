import type { SubscriptionPlan, SubscriptionStatus } from '../domain/types';

/** Minimal user shape used by billing — avoids coupling to the generated Prisma User type */
export interface BillingUser {
  id: string;
  email: string;
  name: string;
  stripeCustomerId: string | null;
  subscriptionPlan: string | null;
  subscriptionStatus: string | null;
  subscriptionId: string | null;
  currentPeriodEnd: Date | null;
  hasActiveSubscription: boolean;
}

// Minimal subscription shape until `prisma generate` produces the full type
export interface Subscription {
  id: string;
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripeCheckoutSessionId: string | null;
  planCode: SubscriptionPlan;
  status: SubscriptionStatus;
  currency: string;
  amount: number;
  interval: string;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  lastWebhookEvent: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSubscriptionInput {
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripeCheckoutSessionId?: string;
  planCode: SubscriptionPlan;
  status: SubscriptionStatus;
  amount: number;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  lastWebhookEvent?: string;
}

export interface UpdateSubscriptionInput {
  status?: SubscriptionStatus;
  planCode?: SubscriptionPlan;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  lastWebhookEvent?: string;
}

export interface BillingRepository {
  findUserById(userId: string): Promise<BillingUser | null>;
  findUserByStripeCustomerId(customerId: string): Promise<BillingUser | null>;
  findSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | null>;
  findActiveSubscriptionByUserId(userId: string): Promise<Subscription | null>;
  findLatestSubscriptionByUserId(userId: string): Promise<Subscription | null>;

  upsertStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void>;

  createSubscription(input: CreateSubscriptionInput): Promise<Subscription>;
  updateSubscription(stripeSubscriptionId: string, input: UpdateSubscriptionInput): Promise<Subscription>;

  /** Sync User billing fields from subscription state */
  syncUserBillingFields(userId: string, subscription: Subscription): Promise<void>;

  /** Revoke user access (subscription deleted / payment failed) */
  revokeUserAccess(userId: string): Promise<void>;
}
