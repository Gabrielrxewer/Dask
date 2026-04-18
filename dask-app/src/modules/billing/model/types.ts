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

export interface BillingStatus {
  hasActiveSubscription: boolean;
  plan: SubscriptionPlan | null;
  status: SubscriptionStatus | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canAccessPlatform: boolean;
  canCreateWorkspace: boolean;
  message: string | null;
}

export interface ConnectAccountStatus {
  workspaceId: string;
  stripeAccountId: string;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  onboardingComplete: boolean;
  requirementsDue: string[];
}

export interface CreateConnectCheckoutSessionInput {
  amount?: number;
  currency?: string;
  description?: string;
  catalogItemId?: string;
  customerEmail?: string;
  customerName?: string;
  applicationFeeAmount?: number;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
}

export type ConnectCatalogItemKind = "PRODUCT" | "SERVICE";
export type ConnectCatalogBillingType = "ONE_TIME" | "SUBSCRIPTION";
export type ConnectCatalogRecurringInterval = "DAY" | "WEEK" | "MONTH" | "YEAR";

export interface ConnectCatalogItem {
  id: string;
  kind: ConnectCatalogItemKind;
  billingType: ConnectCatalogBillingType;
  recurringInterval: ConnectCatalogRecurringInterval | null;
  recurringIntervalCount: number | null;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  stripeConnectAccountId: string | null;
  stripeProductId: string | null;
  stripePriceId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ConnectPaymentOrderStatus =
  | 'DRAFT'
  | 'CHECKOUT_OPEN'
  | 'CHECKOUT_COMPLETED'
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELED'
  | 'REFUNDED';

export interface ConnectPaymentOrder {
  id: string;
  status: ConnectPaymentOrderStatus;
  amount: number;
  currency: string;
  description: string;
  customerEmail: string | null;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  checkoutUrl: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
  failedAt: string | null;
  canceledAt: string | null;
  refundedAt: string | null;
}

export type BillingLoadState = 'idle' | 'loading' | 'loaded' | 'error';

export interface BillingState {
  loadState: BillingLoadState;
  status: BillingStatus | null;
  error: string | null;
}

export const PLAN_DISPLAY: Record<SubscriptionPlan, { name: string; price: string; description: string }> = {
  PERSONAL: {
    name: 'Pessoal',
    price: 'R$ 19,90',
    description: 'Para uso individual, organizar tarefas, projetos e fluxos pessoais.'
  },
  BUSINESS: {
    name: 'Business',
    price: 'R$ 99,00',
    description: 'Para equipes e operacoes corporativas com recursos avancados.'
  }
};
