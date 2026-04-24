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

export interface WorkspaceMembership {
  workspaceId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
}

export interface WorkspaceBillingConnectInfo {
  id: string;
  name: string;
  connectAccountId: string | null;
}

export type ConnectCatalogItemKind = 'PRODUCT' | 'SERVICE';
export type ConnectCatalogBillingType = 'ONE_TIME' | 'ASSINATURA' | 'SUBSCRIPTION';
export type ConnectCatalogRecurringInterval = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

export interface ConnectCatalogItem {
  id: string;
  workspaceId: string;
  createdByUserId: string;
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
  metadata: Record<string, string> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConnectCatalogItemInput {
  workspaceId: string;
  createdByUserId: string;
  kind: ConnectCatalogItemKind;
  billingType: ConnectCatalogBillingType;
  recurringInterval?: ConnectCatalogRecurringInterval;
  recurringIntervalCount?: number;
  name: string;
  description?: string;
  amount: number;
  currency: string;
  stripeConnectAccountId: string;
  stripeProductId: string;
  stripePriceId: string;
  metadata?: Record<string, string>;
}

export interface UpdateConnectCatalogItemInput {
  isActive?: boolean;
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
  workspaceId: string;
  createdByUserId: string;
  stripeConnectAccountId: string;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  amount: number;
  currency: string;
  description: string;
  customerEmail: string | null;
  applicationFeeAmount: number;
  status: ConnectPaymentOrderStatus;
  statusReason: string | null;
  metadata: Record<string, string> | null;
  checkoutUrl: string | null;
  lastWebhookEvent: string | null;
  paidAt: Date | null;
  failedAt: Date | null;
  canceledAt: Date | null;
  refundedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConnectPaymentOrderInput {
  workspaceId: string;
  createdByUserId: string;
  stripeConnectAccountId: string;
  amount: number;
  currency: string;
  description: string;
  customerEmail?: string;
  applicationFeeAmount: number;
  metadata?: Record<string, string>;
}

export interface UpdateConnectPaymentOrderInput {
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  status?: ConnectPaymentOrderStatus;
  statusReason?: string;
  checkoutUrl?: string;
  lastWebhookEvent?: string;
  paidAt?: Date | null;
  failedAt?: Date | null;
  canceledAt?: Date | null;
  refundedAt?: Date | null;
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
  hasGuestWorkspaceMembership(userId: string): Promise<boolean>;
  findWorkspaceMembership(workspaceId: string, userId: string): Promise<WorkspaceMembership | null>;
  findWorkspaceBillingConnectInfo(workspaceId: string): Promise<WorkspaceBillingConnectInfo | null>;
  findConnectCatalogItemById(itemId: string): Promise<ConnectCatalogItem | null>;
  listConnectCatalogItemsByWorkspace(workspaceId: string, includeInactive?: boolean): Promise<ConnectCatalogItem[]>;
  findConnectPaymentOrderById(orderId: string): Promise<ConnectPaymentOrder | null>;
  findConnectPaymentOrderByCheckoutSessionId(sessionId: string): Promise<ConnectPaymentOrder | null>;
  findConnectPaymentOrderByPaymentIntentId(paymentIntentId: string): Promise<ConnectPaymentOrder | null>;
  listConnectPaymentOrdersByWorkspace(workspaceId: string, limit: number): Promise<ConnectPaymentOrder[]>;

  upsertStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void>;
  upsertWorkspaceConnectAccountId(workspaceId: string, stripeConnectAccountId: string): Promise<void>;

  createSubscription(input: CreateSubscriptionInput): Promise<Subscription>;
  updateSubscription(stripeSubscriptionId: string, input: UpdateSubscriptionInput): Promise<Subscription>;
  createConnectCatalogItem(input: CreateConnectCatalogItemInput): Promise<ConnectCatalogItem>;
  updateConnectCatalogItem(itemId: string, input: UpdateConnectCatalogItemInput): Promise<ConnectCatalogItem>;
  createConnectPaymentOrder(input: CreateConnectPaymentOrderInput): Promise<ConnectPaymentOrder>;
  updateConnectPaymentOrder(orderId: string, input: UpdateConnectPaymentOrderInput): Promise<ConnectPaymentOrder>;

  /** Sync User billing fields from subscription state */
  syncUserBillingFields(userId: string, subscription: Subscription): Promise<void>;

  /** Revoke user access (subscription deleted / payment failed) */
  revokeUserAccess(userId: string): Promise<void>;
}
