import crypto from 'crypto';
import type Stripe from 'stripe';
import { DomainEventNames } from '@/core/events/event-names';
import { logger } from '@/core/logging/logger';
import { AppError } from '@/core/errors/app-error';
import type { EmailService } from '@/infra/email/email-service';
import type { BillingRepository } from '../repositories/billing-repository';
import type {
  BillingCustomerSnapshot,
  ConnectCatalogBillingType,
  ConnectCatalogItem,
  ConnectCatalogItemKind,
  ConnectCatalogRecurringInterval,
  ConnectPaymentOrder,
  ConnectPaymentOrderStatus,
  UpdateConnectPaymentOrderInput
} from '../repositories/billing-repository';
import {
  PLAN_PRICE_IDS,
  SUBSCRIPTION_PLANS,
  isSubscriptionActive,
  type BillingStatus
} from '../domain/types';
import {
  DEFAULT_BILLING_PORTAL_SCOPES,
  createBillingPortalToken,
  type BillingPortalTokenScope
} from '../domain/portal-token';
import { redactBillingMetadata, redactBillingSecretValue } from '../domain/redaction';
import type { BillingRuntimeEnvironment } from './billing-runtime-env';
import type { SubscriptionPlan, SubscriptionStatus } from '../domain/types';

// Stripe v22 exports as `export = StripeConstructor` — use InstanceType to get the instance type
type StripeInstance = InstanceType<typeof Stripe>;
type StripeRetrieveSubscription = (subscriptionId: string) => Promise<StripeSubscriptionObject>;
type StripeCheckoutPaymentMethodType = 'card' | 'boleto';
type StripePaymentMethodConfigurationUpdateParams = Record<string, {
  display_preference: { preference: 'on' | 'off' };
}>;

const BRL_PAYMENT_METHODS: StripeCheckoutPaymentMethodType[] = ['card', 'boleto'];
const CARD_ONLY_PAYMENT_METHODS: StripeCheckoutPaymentMethodType[] = ['card'];
const DEFAULT_CONNECT_REQUIRED_CAPABILITIES = ['charges_enabled', 'transfers', 'card_payments'] as const;

function asRecordOrNull(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function getBillingCustomerDisplayName(customer: BillingCustomerSnapshot | null): string | null {
  if (!customer) return null;
  return customer.tradeName ?? customer.legalName ?? customer.name;
}

function normalizedMetadataValue(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isSubscriptionPlan(value: unknown): value is SubscriptionPlan {
  return typeof value === 'string' && SUBSCRIPTION_PLANS.includes(value as SubscriptionPlan);
}

function parseBillingPlanFeatures(metadata: Record<string, string> | null | undefined): string[] {
  if (!metadata) {
    return [];
  }

  const rawFeatureList = normalizedMetadataValue(metadata.features);
  const parsedList = rawFeatureList
    ? (() => {
        try {
          const parsed = JSON.parse(rawFeatureList) as unknown;
          if (Array.isArray(parsed)) {
            return parsed
              .filter((item): item is string => typeof item === 'string')
              .map((item) => item.trim())
              .filter(Boolean);
          }
        } catch {
          // Metadata is operator-provided; non-JSON values are parsed as delimited text below.
        }
        return rawFeatureList
          .split(/\r?\n|[|;]/)
          .map((item) => item.trim())
          .filter(Boolean);
      })()
    : [];

  const indexedFeatures = Object.entries(metadata)
    .filter(([key]) => /^feature_\d+$/i.test(key))
    .sort(([a], [b]) => Number(a.replace(/\D/g, '')) - Number(b.replace(/\D/g, '')))
    .map(([, value]) => value.trim())
    .filter(Boolean);

  return Array.from(new Set([...parsedList, ...indexedFeatures]));
}

// Minimal local interfaces for Stripe event payloads (avoids namespace type conflicts)
interface StripeCheckoutSession {
  id: string;
  status?: string | null;
  mode: string | null;
  subscription: string | { id: string } | null;
  payment_intent?: string | { id: string } | null;
  payment_status?: string | null;
  amount_total?: number | null;
  metadata: Record<string, string> | null;
}

interface StripeSubscriptionObject {
  id: string;
  customer: string | { id: string };
  status: string;
  /** Top-level in older API versions; may be undefined in newer ones */
  current_period_start?: number;
  current_period_end?: number;
  cancel_at_period_end: boolean;
  metadata: Record<string, string>;
  /** Newer Stripe API versions put period dates here */
  items?: {
    data: Array<{
      current_period_start?: number;
      current_period_end?: number;
      price?: {
        unit_amount?: number | null;
        currency?: string | null;
      };
    }>;
  };
}

/** Safely extracts period dates — handles both old (top-level) and new (items[0]) Stripe API shapes */
function extractPeriodDates(sub: StripeSubscriptionObject): { start: Date; end: Date } {
  const rawStart = sub.current_period_start ?? sub.items?.data?.[0]?.current_period_start;
  const rawEnd   = sub.current_period_end   ?? sub.items?.data?.[0]?.current_period_end;
  const now = Date.now();
  return {
    start: rawStart ? new Date(rawStart * 1000) : new Date(now),
    end:   rawEnd   ? new Date(rawEnd   * 1000) : new Date(now + 30 * 24 * 60 * 60 * 1000)
  };
}

interface StripeInvoiceObject {
  subscription: string | { id: string } | null;
}

interface StripeWebhookEvent {
  type: string;
  id: string;
  account?: string;
  data: { object: unknown };
}

interface StripePaymentIntentObject {
  id: string;
  status: string;
  metadata?: Record<string, string>;
}

interface StripeChargeObject {
  id: string;
  payment_intent?: string | { id: string } | null;
  metadata?: Record<string, string>;
}

interface StripePaymentMethodConfigurationObject {
  id: string;
  is_default: boolean;
  pix?: {
    available: boolean;
    display_preference?: { preference?: string | null; value?: string | null };
  };
  boleto?: {
    available: boolean;
    display_preference?: { preference?: string | null; value?: string | null };
  };
}

interface StripeConnectAccountCapabilitySnapshot {
  id: string;
  charges_enabled?: boolean;
  capabilities?: Record<string, string | null>;
}

interface BillingServiceDeps {
  repo: BillingRepository;
  stripe: StripeInstance;
  appPublicUrl: string;
  webhookSecret: string;
  portalTokenSecret?: string;
  environment?: BillingRuntimeEnvironment;
  stripeSecretConfigured?: boolean;
  webhookSecretConfigured?: boolean;
  portalTokenSecretConfigured?: boolean;
  emailService?: EmailService;
  eventPublisher?: {
    publish(event: {
      id: string;
      name: string;
      aggregateType: string;
      aggregateId: string;
      occurredAt: Date;
      payload: Record<string, unknown>;
    }): Promise<void>;
  };
  priceIds?: Partial<Record<SubscriptionPlan, string>>;
  connectApplicationFeeBps?: number;
  connectRequiredCapabilities?: string[];
}

export interface ConnectAccountStatus {
  workspaceId: string;
  stripeAccountId: string;
  controllerType: string | null;
  dashboardType: string | null;
  requirementCollection: string | null;
  disabledReason: string | null;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  cardPaymentsStatus: string | null;
  pixPaymentsStatus: string | null;
  boletoPaymentsStatus: string | null;
  capabilities: Record<string, string | null>;
  onboardingComplete: boolean;
  requirementsDue: string[];
  requirementsPastDue: string[];
  requirementsEventuallyDue: string[];
  requirementsPendingVerification: string[];
}

export interface BillingPlanCatalogItem {
  code: SubscriptionPlan;
  name: string;
  description: string | null;
  amount: number;
  currency: string;
  interval: string | null;
  intervalCount: number | null;
  features: string[];
  isActive: boolean;
}

export type ConnectLocalPaymentMethod = 'pix' | 'boleto';

export interface CreateConnectCheckoutSessionInput {
  amount?: number;
  currency?: string;
  description?: string;
  catalogItemId?: string;
  customerId?: string;
  customerEmail?: string;
  customerName?: string;
  sendEmail?: boolean;
  applicationFeeAmount?: number;
  successUrl?: string;
  cancelUrl?: string;
  sourceWorkItemId?: string;
  hasProposalOrContract?: boolean;
  justification?: string;
  metadata?: Record<string, string>;
}

export interface CreateConnectCatalogItemInput {
  kind: ConnectCatalogItemKind;
  billingType: ConnectCatalogBillingType;
  recurringInterval?: ConnectCatalogRecurringInterval;
  recurringIntervalCount?: number;
  name: string;
  description?: string;
  amount: number;
  currency?: string;
  metadata?: Record<string, string>;
}

export interface CreateBillingPortalTokenInput {
  expiresInSeconds?: number;
  scopes?: BillingPortalTokenScope[];
}

export interface ListConnectPaymentOrdersInput {
  cursor?: string;
  pageSize?: number;
  limit?: number;
  status?: ConnectPaymentOrderStatus;
  customerId?: string;
  email?: string;
  search?: string;
}

export interface ListConnectCatalogItemsInput {
  includeInactive?: boolean;
  cursor?: string;
  pageSize?: number;
  limit?: number;
  kind?: ConnectCatalogItemKind;
  billingType?: ConnectCatalogBillingType;
  status?: 'active' | 'inactive' | 'all';
  search?: string;
}

export type UpdateConnectCatalogItemInput = CreateConnectCatalogItemInput;

export interface ConnectCatalogItemListItem {
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
  metadata: Record<string, string> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConnectPaymentOrderListItem {
  id: string;
  status: ConnectPaymentOrderStatus;
  customerStatus: CustomerFacingPaymentStatus;
  amount: number;
  currency: string;
  description: string;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerDocument: string | null;
  customerPhone: string | null;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  checkoutUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  paidAt: Date | null;
  failedAt: Date | null;
  canceledAt: Date | null;
  refundedAt: Date | null;
  customerPortalUrl: string | null;
}

export type CustomerFacingPaymentStatus =
  | 'pending'
  | 'paid'
  | 'overdue'
  | 'canceled'
  | 'failed'
  | 'refunded'
  | 'subscription_active'
  | 'subscription_canceled';

/** Maps Stripe subscription status strings to our enum */
function mapStripeStatus(stripeStatus: string): SubscriptionStatus {
  const map: Record<string, SubscriptionStatus> = {
    incomplete: 'INCOMPLETE',
    incomplete_expired: 'INCOMPLETE_EXPIRED',
    trialing: 'TRIALING',
    active: 'ACTIVE',
    past_due: 'PAST_DUE',
    canceled: 'CANCELED',
    unpaid: 'UNPAID',
    paused: 'PAUSED'
  };
  return map[stripeStatus] ?? 'INCOMPLETE';
}

export class BillingService {
  private readonly repo: BillingRepository;
  private readonly stripe: StripeInstance;
  private readonly appPublicUrl: string;
  private readonly webhookSecret: string;
  private readonly emailService?: EmailService;
  private readonly eventPublisher?: BillingServiceDeps['eventPublisher'];
  private readonly priceIds: Partial<Record<SubscriptionPlan, string>>;
  private readonly connectApplicationFeeBps: number;
  private readonly portalTokenSecret: string;
  private readonly environment: BillingRuntimeEnvironment;
  private readonly stripeSecretConfigured: boolean;
  private readonly webhookSecretConfigured: boolean;
  private readonly portalTokenSecretConfigured: boolean;
  private readonly connectRequiredCapabilities: string[];

  constructor(deps: BillingServiceDeps) {
    this.repo = deps.repo;
    this.stripe = deps.stripe;
    this.appPublicUrl = deps.appPublicUrl;
    this.webhookSecret = deps.webhookSecret.trim();
    this.portalTokenSecret = deps.portalTokenSecret?.trim() ?? '';
    this.environment = deps.environment ?? 'test';
    this.stripeSecretConfigured = deps.stripeSecretConfigured ?? true;
    this.webhookSecretConfigured = deps.webhookSecretConfigured ?? this.webhookSecret.length > 0;
    this.portalTokenSecretConfigured = deps.portalTokenSecretConfigured ?? Boolean(deps.portalTokenSecret?.trim());
    this.emailService = deps.emailService;
    this.eventPublisher = deps.eventPublisher;
    this.priceIds = deps.priceIds ?? PLAN_PRICE_IDS;
    this.connectApplicationFeeBps = deps.connectApplicationFeeBps ?? 500;
    this.connectRequiredCapabilities = deps.connectRequiredCapabilities?.length
      ? Array.from(new Set(deps.connectRequiredCapabilities))
      : [...DEFAULT_CONNECT_REQUIRED_CAPABILITIES];
  }

  private assertStripeRuntimeConfigured(scope: 'platform' | 'connect' | 'webhook'): void {
    if (this.environment !== 'production' || this.stripeSecretConfigured) {
      return;
    }

    throw new AppError('Stripe billing is not configured for production', 503, {
      code: 'STRIPE_BILLING_ENV_MISSING',
      scope,
      missingEnv: ['STRIPE_SECRET_KEY']
    });
  }

  private assertStripeWebhookConfigured(): void {
    if (this.webhookSecretConfigured && this.webhookSecret.length > 0) {
      return;
    }

    throw new AppError('Stripe webhook secret is not configured', 503, {
      code: 'STRIPE_WEBHOOK_SECRET_MISSING',
      missingEnv: ['STRIPE_WEBHOOK_SECRET']
    });
  }

  private assertBillingPortalTokenSecretConfigured(): void {
    if (this.portalTokenSecret.trim().length >= 16 && (this.environment !== 'production' || this.portalTokenSecretConfigured)) {
      return;
    }

    throw new AppError('Billing portal token secret is not configured', 503, {
      code: 'BILLING_PORTAL_TOKEN_SECRET_MISSING',
      missingEnv: ['BILLING_PORTAL_TOKEN_SECRET']
    });
  }

  // ---------------------------------------------------------------------------
  // Plan catalog
  // ---------------------------------------------------------------------------

  async listBillingPlans(): Promise<BillingPlanCatalogItem[]> {
    this.assertStripeRuntimeConfigured('platform');
    return Promise.all(SUBSCRIPTION_PLANS.map((planCode) => this.buildBillingPlanCatalogItem(planCode)));
  }

  private getConfiguredPlanPriceId(planCode: SubscriptionPlan): string {
    const priceId = this.priceIds[planCode]?.trim();
    if (!priceId) {
      throw new AppError(
        `Stripe price ID for plan ${planCode} is not configured. Set STRIPE_PRICE_ID_${planCode}_MONTHLY in .env.`,
        503
      );
    }
    return priceId;
  }

  private async retrievePlanPrice(planCode: SubscriptionPlan) {
    return this.stripe.prices.retrieve(this.getConfiguredPlanPriceId(planCode), {
      expand: ['product']
    });
  }

  private async buildBillingPlanCatalogItem(planCode: SubscriptionPlan): Promise<BillingPlanCatalogItem> {
    const price = await this.retrievePlanPrice(planCode);
    if (price.unit_amount == null) {
      throw new AppError(`Stripe price ${price.id} for plan ${planCode} has no unit_amount.`, 503);
    }

    const product =
      typeof price.product === 'string'
        ? await this.stripe.products.retrieve(price.product)
        : price.product;

    if ('deleted' in product && product.deleted) {
      throw new AppError(`Stripe product for plan ${planCode} is deleted.`, 503);
    }

    const features = parseBillingPlanFeatures({
      ...(product.metadata ?? {}),
      ...(price.metadata ?? {})
    });

    return {
      code: planCode,
      name: product.name,
      description: product.description ?? null,
      amount: price.unit_amount,
      currency: price.currency,
      interval: price.recurring?.interval ?? null,
      intervalCount: price.recurring?.interval_count ?? null,
      features,
      isActive: price.active && product.active
    };
  }

  private async resolveSubscriptionAmount(
    subscription: StripeSubscriptionObject,
    planCode: SubscriptionPlan,
    checkoutAmount?: number | null
  ): Promise<number> {
    if (typeof checkoutAmount === 'number') {
      return checkoutAmount;
    }

    const itemAmount = subscription.items?.data?.[0]?.price?.unit_amount;
    if (typeof itemAmount === 'number') {
      return itemAmount;
    }

    const configuredPrice = await this.retrievePlanPrice(planCode);
    if (configuredPrice.unit_amount == null) {
      throw new AppError(`Stripe price ${configuredPrice.id} for plan ${planCode} has no unit_amount.`, 503);
    }
    return configuredPrice.unit_amount;
  }

  // ---------------------------------------------------------------------------
  // Checkout
  // ---------------------------------------------------------------------------

  async createCheckoutSession(
    userId: string,
    planCode: SubscriptionPlan
  ): Promise<{ url: string }> {
    this.assertStripeRuntimeConfigured('platform');
    const priceId = this.getConfiguredPlanPriceId(planCode);

    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Reuse existing Stripe customer or create a new one
    let customerId = user.stripeCustomerId ?? undefined;
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId }
      });
      customerId = customer.id;
      await this.repo.upsertStripeCustomerId(userId, customerId);
    }

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      payment_method_types: CARD_ONLY_PAYMENT_METHODS,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${this.appPublicUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.appPublicUrl}/billing/cancel`,
      metadata: {
        userId,
        planCode
      },
      subscription_data: {
        metadata: { userId, planCode }
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      locale: 'pt-BR'
    });

    if (!session.url) {
      throw new AppError('Failed to create Stripe Checkout session', 500);
    }

    logger.info({ event: 'billing.checkout.created', userId, planCode, sessionId: session.id });
    return { url: session.url };
  }

  // ---------------------------------------------------------------------------
  // Billing status
  // ---------------------------------------------------------------------------

  async getBillingStatus(userId: string): Promise<BillingStatus> {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }
    const hasGuestWorkspaceMembership = await this.repo.hasGuestWorkspaceMembership(userId);
    const latestSubscription = await this.repo.findLatestSubscriptionByUserId(userId);

    if (process.env.NODE_ENV !== 'production') {
      const developmentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      return {
        hasActiveSubscription: true,
        plan: (user.subscriptionPlan as SubscriptionPlan | null) ?? 'BUSINESS',
        status: (user.subscriptionStatus as SubscriptionStatus | null) ?? 'ACTIVE',
        currentPeriodEnd: user.currentPeriodEnd ?? developmentPeriodEnd,
        cancelAtPeriodEnd: latestSubscription?.cancelAtPeriodEnd ?? false,
        canAccessPlatform: true,
        canCreateWorkspace: true,
        message: null
      };
    }

    const active = isSubscriptionActive(user.subscriptionStatus as SubscriptionStatus | null);
    const canAccessPlatform = active || hasGuestWorkspaceMembership;

    return {
      hasActiveSubscription: user.hasActiveSubscription,
      plan: (user.subscriptionPlan as SubscriptionPlan | null) ?? null,
      status: (user.subscriptionStatus as SubscriptionStatus | null) ?? null,
      currentPeriodEnd: user.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: latestSubscription?.cancelAtPeriodEnd ?? false,
      canAccessPlatform,
      canCreateWorkspace: active,
      message: canAccessPlatform ? null : this.buildBlockedMessage(user.subscriptionStatus as SubscriptionStatus | null)
    };
  }

  async createBillingPortalSession(userId: string): Promise<{ url: string }> {
    this.assertStripeRuntimeConfigured('platform');
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (!user.stripeCustomerId) {
      throw new AppError('No billing customer found for this account', 409);
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${this.appPublicUrl}/choose-plan`
    });

    if (!session.url) {
      throw new AppError('Failed to create Stripe billing portal session', 500);
    }

    logger.info({ event: 'billing.portal.created', userId, customerId: user.stripeCustomerId });
    return { url: session.url };
  }

  // ---------------------------------------------------------------------------
  // Stripe Connect (our clients charging their own customers)
  // ---------------------------------------------------------------------------

  async createConnectOnboardingLink(
    workspaceId: string,
    userId: string,
    input: { refreshUrl?: string; returnUrl?: string } = {}
  ): Promise<{ url: string; accountId: string }> {
    this.assertStripeRuntimeConfigured('connect');
    const workspace = await this.assertWorkspaceBillingOwner(workspaceId, userId);
    let accountId = workspace.connectAccountId;

    if (!accountId) {
      // Current production path keeps legacy Express account creation for existing
      // Dask workspaces. New Connect configurations should move through an adapter
      // to controller properties / Accounts v2 before changing account creation.
      const account = await this.stripe.accounts.create({
        type: 'express',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        },
        metadata: {
          workspaceId,
          createdByUserId: userId
        },
        business_profile: {
          name: workspace.name,
          product_description: `Pagamentos recebidos por ${workspace.name} via Dask`
        }
      });
      accountId = account.id;
      await this.repo.upsertWorkspaceConnectAccountId(workspaceId, accountId);
    }
    const accountLink = await this.stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      refresh_url: input.refreshUrl ?? `${this.appPublicUrl}/settings?billing=connect-refresh`,
      return_url: input.returnUrl ?? `${this.appPublicUrl}/settings?billing=connect-return`
    });

    logger.info({ event: 'billing.connect.onboarding_link.created', workspaceId, userId, accountId });
    return {
      url: accountLink.url,
      accountId
    };
  }

  async getConnectAccountStatus(workspaceId: string, userId: string): Promise<ConnectAccountStatus> {
    this.assertStripeRuntimeConfigured('connect');
    const workspace = await this.assertWorkspaceBillingManager(workspaceId, userId);
    if (!workspace.connectAccountId) {
      throw new AppError('Workspace has no Stripe Connect account yet', 404);
    }

    const account = await this.stripe.accounts.retrieve(workspace.connectAccountId);
    const rawAccount = account as typeof account & {
      capabilities?: Record<string, string | null>;
      controller?: {
        type?: string | null;
        requirement_collection?: string | null;
        stripe_dashboard?: { type?: string | null } | null;
      } | null;
      requirements?: {
        currently_due?: string[] | null;
        past_due?: string[] | null;
        eventually_due?: string[] | null;
        pending_verification?: string[] | null;
        disabled_reason?: string | null;
      } | null;
    };
    const requirementsDue = rawAccount.requirements?.currently_due ?? [];
    const requirementsPastDue = rawAccount.requirements?.past_due ?? [];
    const requirementsEventuallyDue = rawAccount.requirements?.eventually_due ?? [];
    const requirementsPendingVerification = rawAccount.requirements?.pending_verification ?? [];
    const paymentMethodConfiguration = await this.getDefaultPaymentMethodConfiguration(workspace.connectAccountId, workspaceId);
    return {
      workspaceId,
      stripeAccountId: account.id,
      controllerType: rawAccount.controller?.type ?? null,
      dashboardType: rawAccount.controller?.stripe_dashboard?.type ?? null,
      requirementCollection: rawAccount.controller?.requirement_collection ?? null,
      disabledReason: rawAccount.requirements?.disabled_reason ?? null,
      detailsSubmitted: Boolean(account.details_submitted),
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
      cardPaymentsStatus: rawAccount.capabilities?.card_payments ?? null,
      pixPaymentsStatus: this.resolvePaymentMethodConfigurationStatus(paymentMethodConfiguration?.pix, rawAccount.capabilities?.pix_payments),
      boletoPaymentsStatus: this.resolvePaymentMethodConfigurationStatus(paymentMethodConfiguration?.boleto, rawAccount.capabilities?.boleto_payments),
      capabilities: rawAccount.capabilities ?? {},
      onboardingComplete:
        Boolean(account.details_submitted) &&
        Boolean(account.charges_enabled) &&
        requirementsDue.length === 0 &&
        requirementsPastDue.length === 0,
      requirementsDue,
      requirementsPastDue,
      requirementsEventuallyDue,
      requirementsPendingVerification
    };
  }

  async requestConnectLocalPaymentMethod(
    workspaceId: string,
    userId: string,
    paymentMethod: ConnectLocalPaymentMethod
  ): Promise<ConnectAccountStatus> {
    this.assertStripeRuntimeConfigured('connect');
    const workspace = await this.assertWorkspaceBillingOwner(workspaceId, userId);
    if (!workspace.connectAccountId) {
      throw new AppError('Workspace has no Stripe Connect account configured', 409);
    }

    const configuration = await this.getDefaultPaymentMethodConfiguration(workspace.connectAccountId, workspaceId);
    if (!configuration) {
      throw new AppError('Connected account has no payment method configuration available', 409);
    }

    try {
      await this.stripe.paymentMethodConfigurations.update(
        configuration.id,
        this.buildPaymentMethodConfigurationPreference(paymentMethod, 'on'),
        { stripeAccount: workspace.connectAccountId }
      );
    } catch (err) {
      const reason = redactBillingSecretValue(err);
      logger.warn({
        event: 'billing.connect.payment_method_preference_failed',
        workspaceId,
        userId,
        accountId: workspace.connectAccountId,
        paymentMethod,
        configurationId: configuration.id,
        error: reason
      });
      throw new AppError('Failed to update connected account payment method preference', 409, { reason });
    }
    logger.info({
      event: 'billing.connect.payment_method_preference_updated',
      workspaceId,
      userId,
      accountId: workspace.connectAccountId,
      paymentMethod,
      configurationId: configuration.id
    });

    const status = await this.getConnectAccountStatus(workspaceId, userId);
    return {
      ...status,
      pixPaymentsStatus: paymentMethod === 'pix'
        ? this.resolveRequestedPaymentMethodStatus(status.pixPaymentsStatus)
        : status.pixPaymentsStatus,
      boletoPaymentsStatus: paymentMethod === 'boleto'
        ? this.resolveRequestedPaymentMethodStatus(status.boletoPaymentsStatus)
        : status.boletoPaymentsStatus
    };
  }

  async createConnectCheckoutSession(
    workspaceId: string,
    userId: string,
    input: CreateConnectCheckoutSessionInput
  ): Promise<{ url: string; sessionId: string; orderId: string }> {
    this.assertStripeRuntimeConfigured('connect');
    const workspace = await this.assertWorkspaceBillingManager(workspaceId, userId);
    const accountId = workspace.connectAccountId;
    if (!accountId) {
      throw new AppError('Workspace has no Stripe Connect account configured', 409);
    }
    const catalogItem = input.catalogItemId
      ? await this.repo.findConnectCatalogItemById(input.catalogItemId)
      : null;
    if (input.catalogItemId && (!catalogItem || catalogItem.workspaceId !== workspaceId || !catalogItem.isActive)) {
      throw new AppError('Catalog item not found for this workspace', 404);
    }
    if (catalogItem?.stripeConnectAccountId && catalogItem.stripeConnectAccountId !== accountId) {
      throw new AppError('Catalog item belongs to a different connected account', 409);
    }
    if (catalogItem && !catalogItem.stripePriceId) {
      throw new AppError('Catalog item has no Stripe price mapping', 409);
    }

    const amount = catalogItem?.amount ?? input.amount;
    const description = catalogItem?.name ?? input.description;
    const currency = (catalogItem?.currency ?? input.currency ?? 'brl').toLowerCase();
    if (!amount || amount <= 0) {
      throw new AppError('amount must be a positive integer', 422);
    }
    if (!description || description.trim().length < 3) {
      throw new AppError('description is required for this charge', 422);
    }

    const sourceWorkItemId =
      normalizedMetadataValue(input.sourceWorkItemId) ||
      normalizedMetadataValue(input.metadata?.sourceWorkItemId);
    const justification = normalizedMetadataValue(input.justification ?? input.metadata?.justification);
    const safeInputMetadata = redactBillingMetadata(input.metadata ?? {}) as Record<string, string>;
    const hasFormalCommercialDocument = sourceWorkItemId
      ? input.hasProposalOrContract === true ||
        await this.repo.hasWorkItemProposalOrContract(workspaceId, sourceWorkItemId)
      : false;

    if (sourceWorkItemId && !hasFormalCommercialDocument && justification.length < 12) {
      throw new AppError(
        'Formal justification is required to create billing for a commercial WorkItem without proposal or contract',
        422,
        {
          code: 'LEAD_BILLING_JUSTIFICATION_REQUIRED',
          sourceWorkItemId,
          minimumLength: 12
        }
      );
    }

    if (!input.customerId) {
      throw new AppError(
        'Customer fiscal data is required before creating checkout',
        422,
        {
          code: 'FISCAL_CUSTOMER_REQUIRED',
          missingFields: ['customerId', 'customerDocument']
        }
      );
    }

    const requestedCustomerEmail = normalizeCustomerEmail(input.customerEmail);
    const customer = await this.repo.findCustomerById(workspaceId, input.customerId);
    if (!customer) {
      throw new AppError('Customer not found for this workspace', 404);
    }
    const customerName = getBillingCustomerDisplayName(customer) ?? input.customerName?.trim() ?? null;
    const customerEmail = requestedCustomerEmail ?? normalizeCustomerEmail(customer?.email) ?? undefined;
    const customerDocument = customer?.document ?? null;
    const customerPhone = customer?.phone ?? null;
    const customerAddress = asRecordOrNull(customer?.address);
    this.assertCheckoutCustomerFiscalData({
      customer,
      customerEmail,
      customerDocument
    });
    if (customer && customerEmail) {
      const existingUser = await this.repo.findUserByEmail(customerEmail);
      if (existingUser) {
        await this.repo.linkCustomerToUser(workspaceId, customer.id, existingUser.id, userId);
      }
    }

    const applicationFeeAmount = this.resolveApplicationFeeAmount(amount, input.applicationFeeAmount);
    const checkoutMode = this.isRecurringCatalogBillingType(catalogItem?.billingType)
      ? 'subscription'
      : 'payment';
    const paymentMethodTypes = this.resolveConnectPaymentMethodTypes(catalogItem?.billingType ?? 'ONE_TIME', currency);
    await this.assertConnectCheckoutCapabilities({
      workspaceId,
      accountId,
      paymentMethodTypes
    });
    const order = await this.repo.createConnectPaymentOrder({
      workspaceId,
      createdByUserId: userId,
      stripeConnectAccountId: accountId,
      amount,
      currency,
      description,
      customerId: customer?.id ?? null,
      customerName,
      customerEmail,
      customerDocument,
      customerPhone,
      customerAddress,
      applicationFeeAmount,
      metadata: {
        ...safeInputMetadata,
        ...(sourceWorkItemId ? { sourceWorkItemId } : {}),
        ...(sourceWorkItemId
          ? {
              billingLinkedToWorkItem: 'true',
              billingHasProposalOrContract: hasFormalCommercialDocument ? 'true' : 'false'
            }
          : {}),
        ...(sourceWorkItemId && !hasFormalCommercialDocument
          ? {
              billingJustification: justification,
              billingJustificationRequired: 'true'
            }
          : {}),
        ...(catalogItem
          ? {
              catalogItemId: catalogItem.id,
              catalogBillingType: catalogItem.billingType
            }
          : {})
      }
    });
    const portalToken = this.createCustomerPortalToken({
      workspaceId,
      orderId: order.id,
      customerEmail,
      scopes: DEFAULT_BILLING_PORTAL_SCOPES
    });
    const clientPortalUrl = this.buildCustomerPaymentPortalUrl(portalToken.token);
    await this.repo.revokeBillingPortalTokensForOrder(workspaceId, order.id, userId);
    await this.repo.createBillingPortalTokenRecord({
      workspaceId,
      orderId: order.id,
      tokenId: portalToken.tokenId,
      tokenHash: portalToken.tokenHash,
      customerEmail,
      scopes: portalToken.scopes,
      expiresAt: portalToken.expiresAt,
      createdByUserId: userId,
      metadata: {
        source: 'checkout_session'
      }
    });
    await this.repo.updateConnectPaymentOrder(order.id, {
      metadata: {
        ...(order.metadata ?? {}),
        clientPortalTokenHash: portalToken.tokenHash,
        clientPortalTokenId: portalToken.tokenId,
        clientPortalTokenExpiresAt: portalToken.expiresAt.toISOString(),
        clientPortalTokenScopes: portalToken.scopes.join(','),
        clientPortalTokenIssuedAt: new Date().toISOString(),
        clientPortalTokenRevokedAt: ''
      }
    });
    const fiscalMetadata = this.buildFiscalCheckoutMetadata({
      workspaceId,
      orderId: order.id,
      catalogItem,
      customer,
      metadata: {
        ...safeInputMetadata,
        ...(sourceWorkItemId ? { sourceWorkItemId } : {}),
        ...(sourceWorkItemId && !hasFormalCommercialDocument ? { billingJustification: justification } : {})
      }
    });

    const sessionPayload: Record<string, unknown> = {
      mode: checkoutMode,
      payment_method_types: paymentMethodTypes,
      client_reference_id: order.id,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: amount,
            product_data: {
              name: description
            },
            ...(checkoutMode === 'subscription'
              ? {
                  recurring: {
                    interval: this.mapRecurringInterval(catalogItem?.recurringInterval ?? 'MONTH'),
                    interval_count: catalogItem?.recurringIntervalCount ?? 1
                  }
                }
              : {})
          }
        }
      ],
      customer_email: customerEmail,
      success_url: input.successUrl ?? `${this.appPublicUrl}/billing/success`,
      cancel_url: input.cancelUrl ?? `${this.appPublicUrl}/billing/cancel`,
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      locale: 'pt-BR',
      metadata: {
        connectOrderId: order.id,
        workspaceId,
        platformUserId: userId,
        ...(catalogItem ? { catalogItemId: catalogItem.id } : {}),
        ...fiscalMetadata
      }
    };
    if (checkoutMode === 'payment') {
      sessionPayload.payment_intent_data = {
        application_fee_amount: applicationFeeAmount,
        transfer_data: {
          destination: accountId
        },
        metadata: {
          connectOrderId: order.id,
          workspaceId,
          platformUserId: userId,
          ...(catalogItem ? { catalogItemId: catalogItem.id } : {}),
          ...fiscalMetadata
        }
      };
    } else {
      sessionPayload.subscription_data = {
        application_fee_percent: this.resolveApplicationFeePercent(input.applicationFeeAmount, amount),
        transfer_data: {
          destination: accountId
        },
        metadata: {
          connectOrderId: order.id,
          workspaceId,
          platformUserId: userId,
          ...(catalogItem ? { catalogItemId: catalogItem.id } : {}),
          ...fiscalMetadata
        }
      };
    }

    let session: Awaited<ReturnType<StripeInstance['checkout']['sessions']['create']>>;
    try {
      session = await this.stripe.checkout.sessions.create(sessionPayload);
    } catch (error) {
      const statusReason = redactBillingSecretValue(error).slice(0, 500) || 'Stripe checkout creation failed';

      await this.updateConnectPaymentOrderAndSync(order.id, {
        status: 'FAILED',
        failedAt: new Date(),
        statusReason
      });

      logger.error({
        event: 'billing.connect.checkout.create_failed',
        workspaceId,
        userId,
        accountId,
        orderId: order.id,
        currency,
        checkoutMode,
        error: statusReason
      });

      throw new AppError('Failed to create connected checkout session', 500, { reason: statusReason });
    }

    if (!session.url) {
      throw new AppError('Failed to create connected checkout session', 500);
    }

    await this.updateConnectPaymentOrderAndSync(order.id, {
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id,
      checkoutUrl: session.url,
      status: 'CHECKOUT_OPEN'
    });

    logger.info({
      event: 'billing.connect.checkout.created',
      workspaceId,
      userId,
      accountId,
      sessionId: session.id,
      amount,
      currency,
      checkoutMode,
      applicationFeeAmount
    });

    if (input.sendEmail && customerEmail && this.emailService) {
      const formattedAmount = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: currency.toUpperCase()
      }).format(amount / 100);

      void this.emailService
        .sendCheckoutLinkEmail(customerEmail, {
          workspaceName: workspace.name,
          description,
          amount: formattedAmount,
          checkoutUrl: clientPortalUrl
        })
        .catch((err: unknown) => {
          logger.error({ event: 'billing.connect.checkout.email_failed', orderId: order.id, error: redactBillingSecretValue(err) });
        });
    }

    return {
      url: clientPortalUrl,
      sessionId: session.id,
      orderId: order.id
    };
  }

  async resendConnectPaymentOrderEmail(
    workspaceId: string,
    userId: string,
    orderId: string
  ): Promise<void> {
    const workspace = await this.assertWorkspaceBillingManager(workspaceId, userId);

    const order = await this.repo.findConnectPaymentOrderById(orderId);
    if (!order || order.workspaceId !== workspaceId) {
      throw new AppError('Payment order not found', 404);
    }
    if (!order.checkoutUrl) {
      throw new AppError('This order has no checkout URL to resend', 409);
    }
    if (!order.customerEmail) {
      throw new AppError('This order has no customer email on record', 409);
    }
    if (['PAID', 'REFUNDED', 'SUBSCRIPTION_ACTIVE', 'SUBSCRIPTION_CANCELED'].includes(order.status)) {
      throw new AppError('Cannot resend reminder for a completed order', 409);
    }
    if (!this.emailService) {
      throw new AppError('Email service is not configured', 503);
    }

    const formattedAmount = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: order.currency.toUpperCase()
    }).format(order.amount / 100);

    await this.emailService.sendPaymentReminderEmail(order.customerEmail, {
      workspaceName: workspace.name,
      description: order.description,
      amount: formattedAmount,
      checkoutUrl: this.resolveCustomerPortalUrl(order) ?? order.checkoutUrl ?? ''
    });

    logger.info({ event: 'billing.connect.reminder.sent', orderId, workspaceId });
  }

  async cancelConnectPaymentOrder(
    workspaceId: string,
    userId: string,
    orderId: string
  ): Promise<void> {
    this.assertStripeRuntimeConfigured('connect');
    await this.assertWorkspaceBillingManager(workspaceId, userId);

    const order = await this.repo.findConnectPaymentOrderById(orderId);
    if (!order || order.workspaceId !== workspaceId) {
      throw new AppError('Payment order not found', 404);
    }
    if (['PAID', 'REFUNDED', 'CANCELED', 'SUBSCRIPTION_ACTIVE', 'SUBSCRIPTION_CANCELED'].includes(order.status)) {
      throw new AppError('Order is already in a terminal state', 409);
    }

    if (order.stripeCheckoutSessionId) {
      const workspace = await this.repo.findWorkspaceBillingConnectInfo(workspaceId);
      if (workspace?.connectAccountId) {
        try {
          await this.stripe.checkout.sessions.expire(
            order.stripeCheckoutSessionId,
            undefined,
            { stripeAccount: workspace.connectAccountId }
          );
        } catch (err) {
          logger.warn({ event: 'billing.connect.cancel.expire_failed', orderId, error: redactBillingSecretValue(err) });
        }
      }
    }

    await this.updateConnectPaymentOrderAndSync(orderId, {
      status: 'CANCELED',
      canceledAt: new Date(),
      statusReason: 'Canceled by workspace manager'
    });

    logger.info({ event: 'billing.connect.order.canceled', orderId, workspaceId });
  }

  async createConnectPaymentOrderPortalToken(
    workspaceId: string,
    userId: string,
    orderId: string,
    input: CreateBillingPortalTokenInput = {}
  ): Promise<{ url: string; expiresAt: string; scopes: BillingPortalTokenScope[] }> {
    this.assertBillingPortalTokenSecretConfigured();
    await this.assertWorkspaceBillingManager(workspaceId, userId);

    const order = await this.repo.findConnectPaymentOrderById(orderId);
    if (!order || order.workspaceId !== workspaceId) {
      throw new AppError('Payment order not found', 404);
    }
    if (!order.customerEmail) {
      throw new AppError('Payment order has no customer email for portal access', 409);
    }

    const portalToken = this.createCustomerPortalToken({
      workspaceId,
      orderId: order.id,
      customerEmail: order.customerEmail,
      scopes: input.scopes ?? DEFAULT_BILLING_PORTAL_SCOPES,
      expiresInSeconds: input.expiresInSeconds
    });
    const url = this.buildCustomerPaymentPortalUrl(portalToken.token);
    await this.repo.revokeBillingPortalTokensForOrder(workspaceId, order.id, userId);
    await this.repo.createBillingPortalTokenRecord({
      workspaceId,
      orderId: order.id,
      tokenId: portalToken.tokenId,
      tokenHash: portalToken.tokenHash,
      customerEmail: order.customerEmail,
      scopes: portalToken.scopes,
      expiresAt: portalToken.expiresAt,
      createdByUserId: userId,
      metadata: {
        source: 'manual_portal_token'
      }
    });
    await this.repo.updateConnectPaymentOrder(order.id, {
      metadata: {
        ...(order.metadata ?? {}),
        clientPortalTokenHash: portalToken.tokenHash,
        clientPortalTokenId: portalToken.tokenId,
        clientPortalTokenExpiresAt: portalToken.expiresAt.toISOString(),
        clientPortalTokenScopes: portalToken.scopes.join(','),
        clientPortalTokenIssuedAt: new Date().toISOString(),
        clientPortalTokenRevokedAt: ''
      }
    });

    logger.info({ event: 'billing.connect.portal_token.created', workspaceId, userId, orderId });
    return {
      url,
      expiresAt: portalToken.expiresAt.toISOString(),
      scopes: portalToken.scopes
    };
  }

  async revokeConnectPaymentOrderPortalToken(
    workspaceId: string,
    userId: string,
    orderId: string
  ): Promise<void> {
    await this.assertWorkspaceBillingManager(workspaceId, userId);

    const order = await this.repo.findConnectPaymentOrderById(orderId);
    if (!order || order.workspaceId !== workspaceId) {
      throw new AppError('Payment order not found', 404);
    }

    await this.repo.revokeBillingPortalTokensForOrder(workspaceId, order.id, userId);
    await this.repo.updateConnectPaymentOrder(order.id, {
      metadata: {
        ...(order.metadata ?? {}),
        clientPortalTokenRevokedAt: new Date().toISOString(),
        clientPortalUrl: ''
      }
    });

    logger.info({ event: 'billing.connect.portal_token.revoked', workspaceId, userId, orderId });
  }

  async listConnectPaymentOrders(
    workspaceId: string,
    userId: string,
    input: number | ListConnectPaymentOrdersInput = {}
  ): Promise<ConnectPaymentOrderListItem[]> {
    const scope = await this.assertWorkspaceBillingReader(workspaceId, userId);
    const options = typeof input === 'number' ? { pageSize: input } : input;
    const safePageSize = Math.max(1, Math.min(options.pageSize ?? options.limit ?? 50, 201));
    const orders = await this.repo.listConnectPaymentOrdersByWorkspace({
      workspaceId,
      pageSize: safePageSize,
      cursor: options.cursor,
      customerIds: scope.isClient ? scope.customerIds : undefined,
      customerId: options.customerId,
      status: options.status,
      email: options.email,
      search: options.search
    });
    return orders.map((order) => this.mapConnectPaymentOrder(order));
  }

  async syncConnectPaymentOrderStatusBySessionId(
    workspaceId: string,
    userId: string,
    sessionId: string
  ): Promise<ConnectPaymentOrderListItem> {
    this.assertStripeRuntimeConfigured('connect');
    await this.assertWorkspaceBillingManager(workspaceId, userId);

    const order = await this.repo.findConnectPaymentOrderByCheckoutSessionId(sessionId);
    if (!order || order.workspaceId !== workspaceId) {
      throw new AppError('Payment order not found for this checkout session', 404);
    }

    const session = await this.stripe.checkout.sessions.retrieve(
      sessionId,
      undefined,
      { stripeAccount: order.stripeConnectAccountId }
    ) as unknown as StripeCheckoutSession;

    const nextStatus: ConnectPaymentOrderStatus =
      session.mode === 'subscription' && session.payment_status === 'paid'
        ? 'SUBSCRIPTION_ACTIVE'
        : session.payment_status === 'paid'
          ? 'PAID'
          : session.payment_status === 'unpaid'
            ? (session.status === 'complete' ? 'PENDING' : 'CHECKOUT_OPEN')
            : session.status === 'expired'
              ? 'CANCELED'
              : session.status === 'complete'
                ? 'CHECKOUT_COMPLETED'
                : 'CHECKOUT_OPEN';

    const updated = await this.updateConnectPaymentOrderAndSync(order.id, {
      status: nextStatus,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id,
      paidAt: nextStatus === 'PAID' || nextStatus === 'SUBSCRIPTION_ACTIVE' ? order.paidAt ?? new Date() : order.paidAt,
      canceledAt: nextStatus === 'CANCELED' ? order.canceledAt ?? new Date() : order.canceledAt,
      lastWebhookEvent: 'checkout.session.sync'
    });

    return this.mapConnectPaymentOrder(updated);
  }

  async listConnectCatalogItems(
    workspaceId: string,
    userId: string,
    input: boolean | ListConnectCatalogItemsInput = true
  ): Promise<ConnectCatalogItemListItem[]> {
    await this.assertWorkspaceBillingManager(workspaceId, userId);
    const options = typeof input === 'boolean' ? { includeInactive: input } : input;
    const items = await this.repo.listConnectCatalogItemsByWorkspace({
      workspaceId,
      includeInactive: options.includeInactive ?? true,
      pageSize: Math.max(1, Math.min(options.pageSize ?? options.limit ?? 100, 201)),
      cursor: options.cursor,
      kind: options.kind,
      billingType: options.billingType,
      status: options.status,
      search: options.search
    });
    return items.map((item) => this.mapConnectCatalogItem(item));
  }

  async createConnectCatalogItem(
    workspaceId: string,
    userId: string,
    input: CreateConnectCatalogItemInput
  ): Promise<ConnectCatalogItemListItem> {
    this.assertStripeRuntimeConfigured('connect');
    await this.assertWorkspaceBillingManager(workspaceId, userId);
    const workspace = await this.repo.findWorkspaceBillingConnectInfo(workspaceId);
    const accountId = workspace?.connectAccountId;
    if (!accountId) {
      throw new AppError('Workspace has no Stripe Connect account configured', 409);
    }
    const currency = (input.currency ?? 'brl').toLowerCase();
    const name = input.name.trim();
    if (name.length < 2) {
      throw new AppError('name must have at least 2 characters', 422);
    }
    if (this.isRecurringCatalogBillingType(input.billingType) && !input.recurringInterval) {
      throw new AppError('recurringInterval is required for recurring items', 422);
    }

    const product = await this.stripe.products.create(
      {
        name,
        description: input.description?.trim() || undefined,
        metadata: {
          workspaceId,
          createdByUserId: userId,
          billingType: input.billingType
        }
      },
      { stripeAccount: accountId }
    );
    const recurring = this.isRecurringCatalogBillingType(input.billingType)
      ? {
          interval: this.mapRecurringInterval(input.recurringInterval ?? 'MONTH'),
          interval_count: input.recurringIntervalCount ?? 1
        }
      : undefined;
    const price = await this.stripe.prices.create(
      {
        product: product.id,
        currency,
        unit_amount: input.amount,
        recurring
      },
      { stripeAccount: accountId }
    );

    const item = await this.repo.createConnectCatalogItem({
      workspaceId,
      createdByUserId: userId,
      kind: input.kind,
      billingType: this.normalizeCatalogBillingTypeForPersistence(input.billingType),
      recurringInterval: input.recurringInterval,
      recurringIntervalCount: input.recurringIntervalCount,
      name,
      description: input.description?.trim() || undefined,
      amount: input.amount,
      currency,
      stripeConnectAccountId: accountId,
      stripeProductId: product.id,
      stripePriceId: price.id,
      metadata: redactBillingMetadata(input.metadata ?? {}) as Record<string, string>
    });

    return this.mapConnectCatalogItem(item);
  }

  async updateConnectCatalogItem(
    workspaceId: string,
    userId: string,
    itemId: string,
    input: UpdateConnectCatalogItemInput
  ): Promise<ConnectCatalogItemListItem> {
    this.assertStripeRuntimeConfigured('connect');
    await this.assertWorkspaceBillingManager(workspaceId, userId);
    const workspace = await this.repo.findWorkspaceBillingConnectInfo(workspaceId);
    const accountId = workspace?.connectAccountId;
    if (!accountId) {
      throw new AppError('Workspace has no Stripe Connect account configured', 409);
    }

    const current = await this.repo.findConnectCatalogItemById(itemId);
    if (!current || current.workspaceId !== workspaceId || !current.isActive) {
      throw new AppError('Catalog item not found for this workspace', 404);
    }
    if (current.stripeConnectAccountId && current.stripeConnectAccountId !== accountId) {
      throw new AppError('Catalog item belongs to a different connected account', 409);
    }

    const currency = (input.currency ?? 'brl').toLowerCase();
    const name = input.name.trim();
    const description = input.description?.trim() || undefined;
    if (name.length < 2) {
      throw new AppError('name must have at least 2 characters', 422);
    }
    if (this.isRecurringCatalogBillingType(input.billingType) && !input.recurringInterval) {
      throw new AppError('recurringInterval is required for recurring items', 422);
    }

    let stripeProductId = current.stripeProductId;
    if (stripeProductId) {
      await this.stripe.products.update(
        stripeProductId,
        {
          name,
          description,
          metadata: {
            workspaceId,
            updatedByUserId: userId,
            billingType: input.billingType
          }
        },
        { stripeAccount: accountId }
      );
    } else {
      const product = await this.stripe.products.create(
        {
          name,
          description,
          metadata: {
            workspaceId,
            createdByUserId: current.createdByUserId,
            updatedByUserId: userId,
            billingType: input.billingType
          }
        },
        { stripeAccount: accountId }
      );
      stripeProductId = product.id;
    }

    const nextBillingType = this.normalizeCatalogBillingTypeForPersistence(input.billingType);
    const nextRecurringInterval = this.isRecurringCatalogBillingType(input.billingType)
      ? input.recurringInterval ?? 'MONTH'
      : null;
    const nextRecurringIntervalCount = this.isRecurringCatalogBillingType(input.billingType)
      ? input.recurringIntervalCount ?? 1
      : null;
    let stripePriceId = current.stripePriceId;
    const pricingChanged =
      current.amount !== input.amount ||
      current.currency !== currency ||
      current.billingType !== nextBillingType ||
      current.recurringInterval !== nextRecurringInterval ||
      current.recurringIntervalCount !== nextRecurringIntervalCount;

    if (pricingChanged) {
      if (!stripeProductId) {
        throw new AppError('Catalog item has no Stripe product mapping', 409);
      }
      const recurring = this.isRecurringCatalogBillingType(input.billingType)
        ? {
            interval: this.mapRecurringInterval(nextRecurringInterval ?? 'MONTH'),
            interval_count: nextRecurringIntervalCount ?? 1
          }
        : undefined;
      const price = await this.stripe.prices.create(
        {
          product: stripeProductId,
          currency,
          unit_amount: input.amount,
          recurring
        },
        { stripeAccount: accountId }
      );
      stripePriceId = price.id;

      if (current.stripePriceId) {
        try {
          await this.stripe.prices.update(current.stripePriceId, { active: false }, { stripeAccount: accountId });
        } catch (err) {
          logger.warn({
            event: 'billing.connect.catalog_price_deactivate_failed',
            workspaceId,
            itemId,
            stripePriceId: current.stripePriceId,
            error: redactBillingSecretValue(err)
          });
        }
      }
    }

    const updated = await this.repo.updateConnectCatalogItem(itemId, {
      kind: input.kind,
      billingType: nextBillingType,
      recurringInterval: nextRecurringInterval,
      recurringIntervalCount: nextRecurringIntervalCount,
      name,
      description,
      amount: input.amount,
      currency,
      stripeProductId,
      stripePriceId,
      metadata: redactBillingMetadata(input.metadata ?? {}) as Record<string, string>
    });

    return this.mapConnectCatalogItem(updated);
  }

  async deactivateConnectCatalogItem(
    workspaceId: string,
    userId: string,
    itemId: string
  ): Promise<ConnectCatalogItemListItem> {
    await this.assertWorkspaceBillingManager(workspaceId, userId);
    const item = await this.repo.findConnectCatalogItemById(itemId);
    if (!item || item.workspaceId !== workspaceId) {
      throw new AppError('Catalog item not found for this workspace', 404);
    }
    if (!item.isActive) {
      return this.mapConnectCatalogItem(item);
    }

    const updated = await this.repo.updateConnectCatalogItem(itemId, { isActive: false });
    return this.mapConnectCatalogItem(updated);
  }

  private buildFiscalCheckoutMetadata(input: {
    workspaceId: string;
    orderId: string;
    catalogItem: ConnectCatalogItem | null;
    customer: BillingCustomerSnapshot | null;
    metadata?: Record<string, string>;
  }): Record<string, string> {
    const source = input.metadata ?? {};
    const catalogTypeHint = input.catalogItem?.kind === 'SERVICE' ? 'nfse' : 'nfe';
    const saleOriginHint =
      this.isRecurringCatalogBillingType(input.catalogItem?.billingType) ? 'stripe_subscription' : 'stripe_payment';
    const customerName = getBillingCustomerDisplayName(input.customer);

    const merged: Record<string, string> = {
      ...source,
      workspace_id: source.workspace_id ?? input.workspaceId,
      workspace_business_id: source.workspace_business_id ?? '',
      internal_sale_id: source.internal_sale_id ?? input.orderId,
      customer_id: source.customer_id ?? input.customer?.id ?? '',
      customer_name: source.customer_name ?? customerName ?? '',
      customer_document: source.customer_document ?? normalizedMetadataValue(input.customer?.document),
      customer_email: source.customer_email ?? normalizedMetadataValue(input.customer?.email),
      customer_phone: source.customer_phone ?? normalizedMetadataValue(input.customer?.phone),
      customer_state_registration:
        source.customer_state_registration ?? normalizedMetadataValue(input.customer?.stateRegistration),
      customer_municipal_registration:
        source.customer_municipal_registration ?? normalizedMetadataValue(input.customer?.municipalRegistration),
      customer_tax_regime: source.customer_tax_regime ?? normalizedMetadataValue(input.customer?.taxRegime),
      catalog_item_ids: source.catalog_item_ids ?? (input.catalogItem?.id ?? ''),
      order_id: source.order_id ?? input.orderId,
      document_hint: source.document_hint ?? catalogTypeHint,
      sale_origin: source.sale_origin ?? saleOriginHint,
      emit_after_payment: source.emit_after_payment ?? 'false'
    };

    return Object.entries(merged).reduce<Record<string, string>>((acc, [key, value]) => {
      const normalized = typeof value === 'string' ? value.trim() : '';
      if (normalized.length > 0) {
        acc[key] = normalized.slice(0, 500);
      }
      return acc;
    }, {});
  }

  private buildBlockedMessage(status: SubscriptionStatus | null): string {
    if (!status) return 'Escolha um plano para acessar a plataforma.';
    if (status === 'PAST_DUE') return 'Pagamento pendente. Regularize para continuar.';
    if (status === 'CANCELED') return 'Assinatura cancelada. Assine novamente para continuar.';
    if (status === 'UNPAID') return 'Pagamento nao realizado. Verifique seus dados de pagamento.';
    if (status === 'INCOMPLETE' || status === 'INCOMPLETE_EXPIRED')
      return 'Pagamento incompleto. Inicie uma nova assinatura.';
    return 'Assinatura inativa. Assine um plano para continuar.';
  }

  private resolveConnectPaymentMethodTypes(
    billingType: ConnectCatalogBillingType,
    currency: string
  ): StripeCheckoutPaymentMethodType[] {
    if (currency !== 'brl') {
      return CARD_ONLY_PAYMENT_METHODS;
    }

    if (this.isRecurringCatalogBillingType(billingType)) {
      return CARD_ONLY_PAYMENT_METHODS;
    }

    return BRL_PAYMENT_METHODS;
  }

  private async assertConnectCheckoutCapabilities(input: {
    workspaceId: string;
    accountId: string;
    paymentMethodTypes: StripeCheckoutPaymentMethodType[];
  }): Promise<void> {
    const account = await this.stripe.accounts.retrieve(input.accountId) as StripeConnectAccountCapabilitySnapshot;
    const capabilities = account.capabilities ?? {};
    const missingCapabilities: string[] = [];

    if (this.connectRequiredCapabilities.includes('charges_enabled') && account.charges_enabled !== true) {
      missingCapabilities.push('charges_enabled');
    }
    if (this.connectRequiredCapabilities.includes('transfers') && capabilities.transfers !== 'active') {
      missingCapabilities.push('transfers');
    }
    if (
      (this.connectRequiredCapabilities.includes('card_payments') || input.paymentMethodTypes.includes('card')) &&
      capabilities.card_payments !== 'active'
    ) {
      missingCapabilities.push('card_payments');
    }
    if (
      (this.connectRequiredCapabilities.includes('boleto_payments') || input.paymentMethodTypes.includes('boleto')) &&
      capabilities.boleto_payments !== 'active'
    ) {
      missingCapabilities.push('boleto_payments');
    }
    if (this.connectRequiredCapabilities.includes('pix_payments') && capabilities.pix_payments !== 'active') {
      missingCapabilities.push('pix_payments');
    }

    if (missingCapabilities.length === 0) {
      return;
    }

    logger.warn({
      event: 'billing.connect.checkout.capabilities_missing',
      workspaceId: input.workspaceId,
      accountId: input.accountId,
      missingCapabilities: Array.from(new Set(missingCapabilities))
    });

    throw new AppError('Connected account is missing required payment capabilities', 409, {
      code: 'STRIPE_CONNECT_CAPABILITY_MISSING',
      missingCapabilities: Array.from(new Set(missingCapabilities))
    });
  }

  private isRecurringCatalogBillingType(
    billingType: ConnectCatalogBillingType | null | undefined
  ): boolean {
    return billingType === 'ASSINATURA' || billingType === 'SUBSCRIPTION';
  }

  private async getDefaultPaymentMethodConfiguration(
    accountId: string,
    workspaceId: string
  ): Promise<StripePaymentMethodConfigurationObject | null> {
    try {
      const configurations = await this.stripe.paymentMethodConfigurations.list(
        { limit: 10 },
        { stripeAccount: accountId }
      );
      return configurations.data.find((configuration) => configuration.is_default) ?? configurations.data[0] ?? null;
    } catch (err) {
      logger.warn({
        event: 'billing.connect.payment_method_configuration_read_failed',
        workspaceId,
        accountId,
        error: redactBillingSecretValue(err)
      });
      return null;
    }
  }

  private resolvePaymentMethodConfigurationStatus(
    paymentMethod:
      | { available: boolean; display_preference?: { preference?: string | null; value?: string | null } }
      | null
      | undefined,
    capabilityStatus: string | null | undefined
  ): string | null {
    if (paymentMethod?.available || capabilityStatus === 'active') {
      return 'active';
    }
    if (paymentMethod?.display_preference?.preference === 'on' || paymentMethod?.display_preference?.value === 'on') {
      return capabilityStatus === 'pending' ? 'pending' : 'enabled';
    }
    if (paymentMethod?.display_preference?.preference === 'off' || paymentMethod?.display_preference?.value === 'off') {
      return 'inactive';
    }
    return capabilityStatus ?? null;
  }

  private resolveRequestedPaymentMethodStatus(status: string | null): string {
    if (status === 'active') return 'active';
    return 'enabled';
  }

  private buildPaymentMethodConfigurationPreference(
    paymentMethod: ConnectLocalPaymentMethod,
    preference: 'on' | 'off'
  ): StripePaymentMethodConfigurationUpdateParams {
    if (paymentMethod === 'pix') {
      return { pix: { display_preference: { preference } } };
    }

    return { boleto: { display_preference: { preference } } };
  }

  // ---------------------------------------------------------------------------
  // Webhook
  // ---------------------------------------------------------------------------

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    this.assertStripeRuntimeConfigured('webhook');
    this.assertStripeWebhookConfigured();
    let event: StripeWebhookEvent;

    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret) as StripeWebhookEvent;
    } catch (err) {
      logger.warn({ event: 'billing.webhook.invalid_signature', error: redactBillingSecretValue(err) });
      throw new AppError('Invalid webhook signature', 400);
    }

    logger.info({ event: 'billing.webhook.received', type: event.type, id: event.id });

    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await this.handleCheckoutCompleted(event.data.object as StripeCheckoutSession);
          break;
        case 'checkout.session.async_payment_succeeded':
          await this.handleConnectCheckoutAsyncPaymentSucceeded(event.data.object as StripeCheckoutSession);
          break;
        case 'checkout.session.async_payment_failed':
          await this.handleConnectCheckoutAsyncPaymentFailed(event.data.object as StripeCheckoutSession);
          break;
        case 'checkout.session.expired':
          await this.handleConnectCheckoutExpired(event.data.object as StripeCheckoutSession);
          break;
        case 'payment_intent.succeeded':
          await this.handleConnectPaymentIntentSucceeded(event.data.object as StripePaymentIntentObject);
          break;
        case 'payment_intent.payment_failed':
          await this.handleConnectPaymentIntentFailed(event.data.object as StripePaymentIntentObject);
          break;
        case 'charge.refunded':
          await this.handleConnectChargeRefunded(event.data.object as StripeChargeObject);
          break;
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpsert(event.data.object as StripeSubscriptionObject, event.type);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as StripeSubscriptionObject);
          break;
        case 'invoice.paid':
          await this.handleInvoicePaid(event.data.object as StripeInvoiceObject);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as StripeInvoiceObject);
          break;
        default:
          logger.info({ event: 'billing.webhook.unhandled', type: event.type });
      }
    } catch (err) {
      logger.error({ event: 'billing.webhook.processing_error', type: event.type, error: redactBillingSecretValue(err) });
      // Re-throw so Stripe retries the webhook
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Webhook handlers (private)
  // ---------------------------------------------------------------------------

  private async handleCheckoutCompleted(session: StripeCheckoutSession): Promise<void> {
    if (session.metadata?.connectOrderId) {
      await this.handleConnectCheckoutCompleted(session);
      return;
    }

    const userId = session.metadata?.userId;
    const planCode = session.metadata?.planCode as SubscriptionPlan | undefined;

    if (!userId || !planCode) {
      logger.warn({ event: 'billing.checkout.missing_metadata', sessionId: session.id });
      return;
    }

    if (session.mode !== 'subscription' || !session.subscription) {
      return;
    }

    const stripeSubId =
      typeof session.subscription === 'string' ? session.subscription : session.subscription.id;

    // Fetch full subscription object (cast to our local interface as Stripe v22 moved period fields)
    const retrieveSubscription = this.stripe.subscriptions
      .retrieve as unknown as StripeRetrieveSubscription;
    const stripeSub = await retrieveSubscription(stripeSubId);
    logger.info({
      event: 'billing.debug.subscription_shape',
      stripeSubId,
      top_level_start: stripeSub.current_period_start,
      top_level_end: stripeSub.current_period_end,
      items_count: stripeSub.items?.data?.length,
      item0_start: stripeSub.items?.data?.[0]?.current_period_start,
      item0_end: stripeSub.items?.data?.[0]?.current_period_end,
      status: stripeSub.status,
    });
    const customerId =
      typeof stripeSub.customer === 'string' ? stripeSub.customer : stripeSub.customer.id;

    const existing = await this.repo.findSubscriptionByStripeId(stripeSubId);
    const status = mapStripeStatus(stripeSub.status);

    const { start, end } = extractPeriodDates(stripeSub);

    if (existing) {
      const updated = await this.repo.updateSubscription(stripeSubId, {
        status,
        planCode,
        currentPeriodStart: start,
        currentPeriodEnd: end,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        lastWebhookEvent: 'checkout.session.completed'
      });
      await this.repo.syncUserBillingFields(userId, updated);
    } else {
      const amount = await this.resolveSubscriptionAmount(stripeSub, planCode, session.amount_total);
      const created = await this.repo.createSubscription({
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: stripeSubId,
        stripeCheckoutSessionId: session.id,
        planCode,
        status,
        amount,
        currentPeriodStart: start,
        currentPeriodEnd: end,
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        lastWebhookEvent: 'checkout.session.completed'
      });
      await this.repo.syncUserBillingFields(userId, created);
    }

    logger.info({ event: 'billing.checkout.activated', userId, planCode, stripeSubId });
  }

  private async handleConnectCheckoutCompleted(session: StripeCheckoutSession): Promise<void> {
    const orderId = session.metadata?.connectOrderId;
    if (!orderId) {
      return;
    }

    const nextStatus: ConnectPaymentOrderStatus =
      session.mode === 'subscription' && session.payment_status === 'paid'
        ? 'SUBSCRIPTION_ACTIVE'
        : session.payment_status === 'paid'
          ? 'PAID'
          : session.payment_status === 'unpaid'
            ? 'PENDING'
            : 'CHECKOUT_COMPLETED';
    const paidAt = nextStatus === 'PAID' || nextStatus === 'SUBSCRIPTION_ACTIVE' ? new Date() : null;

    await this.updateConnectPaymentOrderAndSync(orderId, {
      status: nextStatus,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id,
      lastWebhookEvent: 'checkout.session.completed',
      paidAt
    });
  }

  private async handleConnectCheckoutAsyncPaymentSucceeded(session: StripeCheckoutSession): Promise<void> {
    const orderId = session.metadata?.connectOrderId;
    if (!orderId) {
      return;
    }

    await this.updateConnectPaymentOrderAndSync(orderId, {
      status: 'PAID',
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id,
      lastWebhookEvent: 'checkout.session.async_payment_succeeded',
      paidAt: new Date()
    });
  }

  private async handleConnectCheckoutAsyncPaymentFailed(session: StripeCheckoutSession): Promise<void> {
    const orderId = session.metadata?.connectOrderId;
    if (!orderId) {
      return;
    }

    await this.updateConnectPaymentOrderAndSync(orderId, {
      status: 'FAILED',
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id,
      lastWebhookEvent: 'checkout.session.async_payment_failed',
      failedAt: new Date(),
      statusReason: 'Async payment failed'
    });
  }

  private async handleConnectCheckoutExpired(session: StripeCheckoutSession): Promise<void> {
    const orderId = session.metadata?.connectOrderId;
    if (!orderId) {
      return;
    }

    await this.updateConnectPaymentOrderAndSync(orderId, {
      status: 'CANCELED',
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id,
      lastWebhookEvent: 'checkout.session.expired',
      canceledAt: new Date(),
      statusReason: 'Checkout session expired'
    });
  }

  private async handleConnectPaymentIntentSucceeded(intent: StripePaymentIntentObject): Promise<void> {
    const order = await this.repo.findConnectPaymentOrderByPaymentIntentId(intent.id);
    if (!order) {
      return;
    }

    await this.updateConnectPaymentOrderAndSync(order.id, {
      status: 'PAID',
      stripePaymentIntentId: intent.id,
      lastWebhookEvent: 'payment_intent.succeeded',
      paidAt: new Date()
    });
  }

  private async handleConnectPaymentIntentFailed(intent: StripePaymentIntentObject): Promise<void> {
    const order = await this.repo.findConnectPaymentOrderByPaymentIntentId(intent.id);
    if (!order) {
      return;
    }

    await this.updateConnectPaymentOrderAndSync(order.id, {
      status: 'FAILED',
      stripePaymentIntentId: intent.id,
      lastWebhookEvent: 'payment_intent.payment_failed',
      failedAt: new Date(),
      statusReason: `Payment intent failed with status ${intent.status}`
    });
  }

  private async handleConnectChargeRefunded(charge: StripeChargeObject): Promise<void> {
    const paymentIntentId =
      typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent?.id;
    if (!paymentIntentId) {
      return;
    }

    const order = await this.repo.findConnectPaymentOrderByPaymentIntentId(paymentIntentId);
    if (!order) {
      return;
    }

    await this.updateConnectPaymentOrderAndSync(order.id, {
      status: 'REFUNDED',
      lastWebhookEvent: 'charge.refunded',
      refundedAt: new Date()
    });
  }

  private async handleSubscriptionUpsert(sub: StripeSubscriptionObject, eventType: string): Promise<void> {
    const connectOrderId = sub.metadata?.connectOrderId;
    if (connectOrderId) {
      await this.updateConnectPaymentOrderAndSync(connectOrderId, {
        status: this.mapConnectSubscriptionStatus(sub.status),
        lastWebhookEvent: eventType,
        statusReason: `Stripe subscription status: ${sub.status}`
      });
      return;
    }

    const userId = sub.metadata?.userId;
    const planCode = isSubscriptionPlan(sub.metadata?.planCode) ? sub.metadata.planCode : undefined;
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const status = mapStripeStatus(sub.status);

    const existing = await this.repo.findSubscriptionByStripeId(sub.id);

    const { start, end } = extractPeriodDates(sub);

    if (existing) {
      const updated = await this.repo.updateSubscription(sub.id, {
        status,
        planCode: planCode ?? existing.planCode,
        currentPeriodStart: start,
        currentPeriodEnd: end,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        lastWebhookEvent: eventType
      });
      await this.repo.syncUserBillingFields(existing.userId, updated);
    } else if (userId && planCode) {
      // Subscription arrived before checkout.session.completed (race condition)
      const amount = await this.resolveSubscriptionAmount(sub, planCode);
      const created = await this.repo.createSubscription({
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        planCode,
        status,
        amount,
        currentPeriodStart: start,
        currentPeriodEnd: end,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        lastWebhookEvent: eventType
      });
      await this.repo.syncUserBillingFields(userId, created);
    }
  }

  private async handleSubscriptionDeleted(sub: StripeSubscriptionObject): Promise<void> {
    const connectOrderId = sub.metadata?.connectOrderId;
    if (connectOrderId) {
      await this.updateConnectPaymentOrderAndSync(connectOrderId, {
        status: 'SUBSCRIPTION_CANCELED',
        canceledAt: new Date(),
        lastWebhookEvent: 'customer.subscription.deleted',
        statusReason: 'Stripe subscription canceled'
      });
      return;
    }

    const existing = await this.repo.findSubscriptionByStripeId(sub.id);
    if (!existing) return;

    const updated = await this.repo.updateSubscription(sub.id, {
      status: 'CANCELED',
      cancelAtPeriodEnd: false,
      lastWebhookEvent: 'customer.subscription.deleted'
    });
    await this.repo.syncUserBillingFields(existing.userId, updated);
    await this.repo.revokeUserAccess(existing.userId);

    logger.info({ event: 'billing.subscription.deleted', userId: existing.userId });
  }

  private async handleInvoicePaid(invoice: StripeInvoiceObject): Promise<void> {
    const subscriptionId =
      typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
    if (!subscriptionId) return;

    const retrieveSubscription = this.stripe.subscriptions
      .retrieve as unknown as StripeRetrieveSubscription;
    const stripeSub = await retrieveSubscription(subscriptionId);
    const connectOrderId = stripeSub.metadata?.connectOrderId;
    if (connectOrderId) {
      const { end } = extractPeriodDates(stripeSub);
      await this.updateConnectPaymentOrderAndSync(connectOrderId, {
        status: this.mapConnectSubscriptionStatus(stripeSub.status),
        paidAt: new Date(),
        lastWebhookEvent: 'invoice.paid',
        statusReason: `Subscription paid through ${end.toISOString()}`
      });
      return;
    }

    const existing = await this.repo.findSubscriptionByStripeId(subscriptionId);
    if (!existing) return;

    const { start, end } = extractPeriodDates(stripeSub);
    const updated = await this.repo.updateSubscription(subscriptionId, {
      status: mapStripeStatus(stripeSub.status),
      currentPeriodStart: start,
      currentPeriodEnd: end,
      lastWebhookEvent: 'invoice.paid'
    });
    await this.repo.syncUserBillingFields(existing.userId, updated);
  }

  private async handleInvoicePaymentFailed(invoice: StripeInvoiceObject): Promise<void> {
    const subscriptionId =
      typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
    if (!subscriptionId) return;

    const existing = await this.repo.findSubscriptionByStripeId(subscriptionId);
    if (!existing) {
      const retrieveSubscription = this.stripe.subscriptions
        .retrieve as unknown as StripeRetrieveSubscription;
      const stripeSub = await retrieveSubscription(subscriptionId);
      if (!stripeSub) {
        return;
      }
      const connectOrderId = stripeSub.metadata?.connectOrderId;
      if (connectOrderId) {
        await this.updateConnectPaymentOrderAndSync(connectOrderId, {
          status: 'OVERDUE',
          lastWebhookEvent: 'invoice.payment_failed',
          statusReason: 'Subscription invoice payment failed'
        });
      }
      return;
    }

    const updated = await this.repo.updateSubscription(subscriptionId, {
      status: 'PAST_DUE',
      lastWebhookEvent: 'invoice.payment_failed'
    });
    await this.repo.syncUserBillingFields(existing.userId, updated);
    await this.repo.revokeUserAccess(existing.userId);

    logger.warn({ event: 'billing.invoice.payment_failed', userId: existing.userId, subscriptionId });
  }

  private async updateConnectPaymentOrderAndSync(
    orderId: string,
    input: UpdateConnectPaymentOrderInput
  ): Promise<ConnectPaymentOrder> {
    const updated = await this.repo.updateConnectPaymentOrder(orderId, input);
    await this.syncLinkedWorkItemBillingSnapshot(updated);
    await this.publishConnectPaymentOrderEvent(updated);
    return updated;
  }

  private async syncLinkedWorkItemBillingSnapshot(order: ConnectPaymentOrder): Promise<void> {
    const metadata = order.metadata;
    const sourceWorkItemId =
      metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? normalizedMetadataValue(metadata.sourceWorkItemId)
        : '';
    if (!sourceWorkItemId) {
      return;
    }

    await this.repo.syncWorkItemBillingSnapshot({
      workspaceId: order.workspaceId,
      itemId: sourceWorkItemId,
      billingOrderId: order.id,
      billingStatus: this.mapCustomerFacingPaymentStatus(order.status),
      checkoutUrl: this.resolveCustomerPortalUrl(order) ?? order.checkoutUrl,
      updatedBy: order.createdByUserId
    });
  }

  private async publishConnectPaymentOrderEvent(order: ConnectPaymentOrder): Promise<void> {
    if (!this.eventPublisher) {
      return;
    }

    const metadata = order.metadata && typeof order.metadata === 'object' && !Array.isArray(order.metadata)
      ? order.metadata
      : {};
    const sourceWorkItemId = normalizedMetadataValue(metadata.sourceWorkItemId);
    const hasFormalJustification = normalizedMetadataValue(metadata.billingJustification).length > 0;
    const eventName =
      order.status === 'PAID' || order.status === 'SUBSCRIPTION_ACTIVE'
        ? DomainEventNames.BillingPaymentConfirmed
        : order.status === 'CHECKOUT_OPEN' || order.status === 'PENDING'
          ? hasFormalJustification
            ? DomainEventNames.BillingRequestedWithJustification
            : DomainEventNames.BillingRequested
          : order.status === 'FAILED'
            ? DomainEventNames.BillingPaymentFailed
            : order.status === 'OVERDUE'
              ? DomainEventNames.BillingOverdue
              : null;

    if (!eventName || !sourceWorkItemId) {
      return;
    }

    await this.eventPublisher.publish({
      id: crypto.randomUUID(),
      name: eventName,
      aggregateType: 'connect_payment_order',
      aggregateId: order.id,
      occurredAt: new Date(),
      payload: {
        workspaceId: order.workspaceId,
        itemId: sourceWorkItemId,
        linkedEntityType: 'work_item',
        linkedEntityId: sourceWorkItemId,
        billingOrderId: order.id,
        status: this.mapCustomerFacingPaymentStatus(order.status),
        connectPaymentOrderStatus: order.status,
        customerId: order.customerId,
        justification: hasFormalJustification ? metadata.billingJustification : undefined,
        hasProposalOrContract: metadata.billingHasProposalOrContract === 'true',
        requestedBy: order.createdByUserId
      }
    });
  }

  private async assertWorkspaceBillingManager(workspaceId: string, userId: string) {
    const membership = await this.repo.findWorkspaceMembership(workspaceId, userId);
    if (!membership) {
      throw new AppError('Workspace not found', 404);
    }

    if (!['OWNER', 'ADMIN'].includes(membership.role)) {
      throw new AppError('Only workspace OWNER or ADMIN can manage billing connect settings', 403);
    }

    const workspace = await this.repo.findWorkspaceBillingConnectInfo(workspaceId);
    if (!workspace) {
      throw new AppError('Workspace not found', 404);
    }

    return workspace;
  }

  private async assertWorkspaceBillingOwner(workspaceId: string, userId: string) {
    const membership = await this.repo.findWorkspaceMembership(workspaceId, userId);
    if (!membership) {
      throw new AppError('Workspace not found', 404);
    }

    if (membership.role !== 'OWNER') {
      throw new AppError('Only workspace OWNER can manage sensitive billing connect settings', 403);
    }

    const workspace = await this.repo.findWorkspaceBillingConnectInfo(workspaceId);
    if (!workspace) {
      throw new AppError('Workspace not found', 404);
    }

    return workspace;
  }

  private async assertWorkspaceBillingReader(
    workspaceId: string,
    userId: string
  ): Promise<{ isClient: boolean; customerIds: string[] }> {
    const membership = await this.repo.findWorkspaceMembership(workspaceId, userId);
    if (!membership) {
      throw new AppError('Workspace not found', 404);
    }

    if (membership.role === 'CLIENT') {
      const customerIds = await this.repo.findCustomerIdsForUser(workspaceId, userId);
      if (customerIds.length === 0) {
        throw new AppError('Customer access is not linked to this workspace', 403);
      }

      return { isClient: true, customerIds };
    }

    if (!['OWNER', 'ADMIN'].includes(membership.role)) {
      throw new AppError('Only workspace OWNER or ADMIN can manage billing connect settings', 403);
    }

    return { isClient: false, customerIds: [] };
  }

  private resolveApplicationFeeAmount(amount: number, explicitFee?: number): number {
    if (typeof explicitFee === 'number') {
      if (explicitFee < 0) {
        throw new AppError('applicationFeeAmount cannot be negative', 422);
      }
      if (explicitFee > amount) {
        throw new AppError('applicationFeeAmount cannot be greater than amount', 422);
      }
      return explicitFee;
    }

    return Math.max(0, Math.floor((amount * this.connectApplicationFeeBps) / 10000));
  }

  private resolveApplicationFeePercent(explicitFeeAmount: number | undefined, amount: number): number {
    if (typeof explicitFeeAmount === 'number') {
      if (explicitFeeAmount < 0 || explicitFeeAmount > amount) {
        throw new AppError('applicationFeeAmount is invalid for subscription pricing', 422);
      }
      return Number(((explicitFeeAmount / amount) * 100).toFixed(4));
    }
    return Number((this.connectApplicationFeeBps / 100).toFixed(4));
  }

  private mapRecurringInterval(
    interval: ConnectCatalogRecurringInterval
  ): 'day' | 'week' | 'month' | 'year' {
    if (interval === 'DAY') return 'day';
    if (interval === 'WEEK') return 'week';
    if (interval === 'YEAR') return 'year';
    return 'month';
  }

  private mapConnectPaymentOrder(order: ConnectPaymentOrder): ConnectPaymentOrderListItem {
    return {
      id: order.id,
      status: order.status,
      customerStatus: this.mapCustomerFacingPaymentStatus(order.status),
      amount: order.amount,
      currency: order.currency,
      description: order.description,
      customerId: order.customerId,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerDocument: order.customerDocument,
      customerPhone: order.customerPhone,
      stripeCheckoutSessionId: order.stripeCheckoutSessionId,
      stripePaymentIntentId: order.stripePaymentIntentId,
      checkoutUrl: order.checkoutUrl,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      paidAt: order.paidAt,
      failedAt: order.failedAt,
      canceledAt: order.canceledAt,
      refundedAt: order.refundedAt,
      customerPortalUrl: this.resolveCustomerPortalUrl(order)
    };
  }

  private mapCustomerFacingPaymentStatus(status: ConnectPaymentOrderStatus): CustomerFacingPaymentStatus {
    if (status === 'PAID') return 'paid';
    if (status === 'OVERDUE') return 'overdue';
    if (status === 'FAILED') return 'failed';
    if (status === 'CANCELED') return 'canceled';
    if (status === 'REFUNDED') return 'refunded';
    if (status === 'SUBSCRIPTION_ACTIVE') return 'subscription_active';
    if (status === 'SUBSCRIPTION_CANCELED') return 'subscription_canceled';
    return 'pending';
  }

  private mapConnectSubscriptionStatus(stripeStatus: string): ConnectPaymentOrderStatus {
    if (stripeStatus === 'active' || stripeStatus === 'trialing') {
      return 'SUBSCRIPTION_ACTIVE';
    }
    if (stripeStatus === 'canceled' || stripeStatus === 'incomplete_expired') {
      return 'SUBSCRIPTION_CANCELED';
    }
    if (stripeStatus === 'past_due' || stripeStatus === 'unpaid') {
      return 'OVERDUE';
    }
    if (stripeStatus === 'incomplete') {
      return 'PENDING';
    }
    return 'PENDING';
  }

  private buildCustomerPaymentPortalUrl(token: string): string {
    return `${this.appPublicUrl}/portal/billing?token=${encodeURIComponent(token)}`;
  }

  private createCustomerPortalToken(input: {
    workspaceId: string;
    orderId: string;
    customerEmail?: string | null;
    scopes?: BillingPortalTokenScope[];
    expiresInSeconds?: number;
  }) {
    this.assertBillingPortalTokenSecretConfigured();
    return createBillingPortalToken({
      workspaceId: input.workspaceId,
      orderId: input.orderId,
      customerEmail: input.customerEmail ?? null,
      scopes: input.scopes,
      expiresInSeconds: input.expiresInSeconds,
      secret: this.portalTokenSecret
    });
  }

  private resolveCustomerPortalUrl(order: Pick<ConnectPaymentOrder, 'metadata'>): string | null {
    const metadata = order.metadata;
    if (!metadata || typeof metadata !== 'object') {
      return null;
    }
    return null;
  }

  private assertCheckoutCustomerFiscalData(input: {
    customer: BillingCustomerSnapshot;
    customerEmail: string | undefined;
    customerDocument: string | null;
  }): void {
    const missingFields: string[] = [];
    if (!getBillingCustomerDisplayName(input.customer)?.trim()) {
      missingFields.push('customerName');
    }
    if (!input.customerEmail) {
      missingFields.push('customerEmail');
    }
    if (!isValidBrazilianFiscalDocument(input.customerDocument)) {
      missingFields.push('customerDocument');
    }

    if (missingFields.length > 0) {
      throw new AppError(
        'Customer fiscal data is required before creating checkout',
        422,
        {
          code: 'FISCAL_CUSTOMER_REQUIRED',
          missingFields
        }
      );
    }
  }

  private mapConnectCatalogItem(item: ConnectCatalogItem): ConnectCatalogItemListItem {
    return {
      id: item.id,
      kind: item.kind,
      billingType: this.normalizeCatalogBillingTypeForApi(item.billingType),
      recurringInterval: item.recurringInterval,
      recurringIntervalCount: item.recurringIntervalCount,
      name: item.name,
      description: item.description,
      amount: item.amount,
      currency: item.currency,
      stripeConnectAccountId: item.stripeConnectAccountId,
      stripeProductId: item.stripeProductId,
      stripePriceId: item.stripePriceId,
      isActive: item.isActive,
      metadata: item.metadata,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }

  private normalizeCatalogBillingTypeForPersistence(
    billingType: ConnectCatalogBillingType
  ): ConnectCatalogBillingType {
    // `ASSINATURA` is the product-facing label, but some local databases may still
    // have the older enum shape applied. Persist the legacy recurring value so
    // creation works even before the enum migration is run.
    return billingType === 'ASSINATURA' ? 'SUBSCRIPTION' : billingType;
  }

  private normalizeCatalogBillingTypeForApi(
    billingType: ConnectCatalogBillingType
  ): ConnectCatalogBillingType {
    return billingType === 'SUBSCRIPTION' ? 'ASSINATURA' : billingType;
  }
}

function normalizeCustomerEmail(email: string | null | undefined): string | null {
  const normalized = email?.trim().toLowerCase();
  return normalized && normalized.includes('@') ? normalized : null;
}

function normalizeFiscalDocument(value: string | null | undefined): string {
  return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}

function isValidBrazilianFiscalDocument(value: string | null | undefined): boolean {
  const digits = normalizeFiscalDocument(value);
  return digits.length === 11 || digits.length === 14;
}
