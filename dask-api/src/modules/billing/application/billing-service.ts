import type Stripe from 'stripe';
import { logger } from '@/core/logging/logger';
import { AppError } from '@/core/errors/app-error';
import type { EmailService } from '@/infra/email/email-service';
import type { BillingRepository } from '../repositories/billing-repository';
import type {
  ConnectCatalogBillingType,
  ConnectCatalogItem,
  ConnectCatalogItemKind,
  ConnectCatalogRecurringInterval,
  ConnectPaymentOrder,
  ConnectPaymentOrderStatus
} from '../repositories/billing-repository';
import {
  PLAN_AMOUNTS_BRL,
  PLAN_PRICE_IDS,
  isSubscriptionActive,
  type BillingStatus
} from '../domain/types';
import type { SubscriptionPlan, SubscriptionStatus } from '../domain/types';

// Stripe v22 exports as `export = StripeConstructor` — use InstanceType to get the instance type
type StripeInstance = InstanceType<typeof Stripe>;
type StripeRetrieveSubscription = (subscriptionId: string) => Promise<StripeSubscriptionObject>;

// Minimal local interfaces for Stripe event payloads (avoids namespace type conflicts)
interface StripeCheckoutSession {
  id: string;
  status?: string | null;
  mode: string | null;
  subscription: string | { id: string } | null;
  payment_intent?: string | { id: string } | null;
  payment_status?: string | null;
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

interface BillingServiceDeps {
  repo: BillingRepository;
  stripe: StripeInstance;
  appPublicUrl: string;
  webhookSecret: string;
  emailService?: EmailService;
  priceIds?: Partial<Record<SubscriptionPlan, string>>;
  connectApplicationFeeBps?: number;
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
  sendEmail?: boolean;
  applicationFeeAmount?: number;
  successUrl?: string;
  cancelUrl?: string;
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
  createdAt: Date;
  updatedAt: Date;
}

export interface ConnectPaymentOrderListItem {
  id: string;
  status: ConnectPaymentOrderStatus;
  amount: number;
  currency: string;
  description: string;
  customerEmail: string | null;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  checkoutUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  paidAt: Date | null;
  failedAt: Date | null;
  canceledAt: Date | null;
  refundedAt: Date | null;
}

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
  private readonly priceIds: Partial<Record<SubscriptionPlan, string>>;
  private readonly connectApplicationFeeBps: number;

  constructor(deps: BillingServiceDeps) {
    this.repo = deps.repo;
    this.stripe = deps.stripe;
    this.appPublicUrl = deps.appPublicUrl;
    this.webhookSecret = deps.webhookSecret;
    this.emailService = deps.emailService;
    this.priceIds = deps.priceIds ?? PLAN_PRICE_IDS;
    this.connectApplicationFeeBps = deps.connectApplicationFeeBps ?? 500;
  }

  // ---------------------------------------------------------------------------
  // Checkout
  // ---------------------------------------------------------------------------

  async createCheckoutSession(
    userId: string,
    planCode: SubscriptionPlan
  ): Promise<{ url: string }> {
    const priceId = this.priceIds[planCode];
    if (!priceId) {
      throw new AppError(
        `Stripe price ID for plan ${planCode} is not configured. Set STRIPE_PRICE_ID_${planCode}_MONTHLY in .env.`,
        503
      );
    }

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
    const workspace = await this.assertWorkspaceBillingManager(workspaceId, userId);
    let accountId = workspace.connectAccountId;

    if (!accountId) {
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
    const workspace = await this.assertWorkspaceBillingManager(workspaceId, userId);
    if (!workspace.connectAccountId) {
      throw new AppError('Workspace has no Stripe Connect account yet', 404);
    }

    const account = await this.stripe.accounts.retrieve(workspace.connectAccountId);
    const requirementsDue = account.requirements?.currently_due ?? [];
    return {
      workspaceId,
      stripeAccountId: account.id,
      detailsSubmitted: Boolean(account.details_submitted),
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
      onboardingComplete:
        Boolean(account.details_submitted) &&
        Boolean(account.charges_enabled) &&
        requirementsDue.length === 0,
      requirementsDue
    };
  }

  async createConnectCheckoutSession(
    workspaceId: string,
    userId: string,
    input: CreateConnectCheckoutSessionInput
  ): Promise<{ url: string; sessionId: string; orderId: string }> {
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

    const applicationFeeAmount = this.resolveApplicationFeeAmount(amount, input.applicationFeeAmount);
    const checkoutMode = catalogItem?.billingType === 'SUBSCRIPTION' ? 'subscription' : 'payment';
    const order = await this.repo.createConnectPaymentOrder({
      workspaceId,
      createdByUserId: userId,
      stripeConnectAccountId: accountId,
      amount,
      currency,
      description,
      customerEmail: input.customerEmail,
      applicationFeeAmount,
      metadata: {
        ...(input.metadata ?? {}),
        ...(catalogItem
          ? {
              catalogItemId: catalogItem.id,
              catalogBillingType: catalogItem.billingType
            }
          : {})
      }
    });
    const fiscalMetadata = this.buildFiscalCheckoutMetadata({
      workspaceId,
      orderId: order.id,
      catalogItem,
      metadata: input.metadata
    });

    const sessionPayload: Record<string, unknown> = {
      mode: checkoutMode,
      client_reference_id: order.id,
      line_items: [
        catalogItem?.stripePriceId
          ? {
              quantity: 1,
              price: catalogItem.stripePriceId
            }
          : {
              quantity: 1,
              price_data: {
                currency,
                unit_amount: amount,
                product_data: {
                  name: description
                }
              }
            }
      ],
      customer_email: input.customerEmail,
      success_url: input.successUrl ?? `${this.appPublicUrl}/billing/success`,
      cancel_url: input.cancelUrl ?? `${this.appPublicUrl}/billing/cancel`,
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
      session = await this.stripe.checkout.sessions.create(
        sessionPayload,
        {
          stripeAccount: accountId
        }
      );
    } catch (error) {
      const statusReason = error instanceof Error ? error.message.slice(0, 500) : 'Stripe checkout creation failed';

      await this.repo.updateConnectPaymentOrder(order.id, {
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
        error: String(error)
      });

      throw new AppError('Failed to create connected checkout session', 500);
    }

    if (!session.url) {
      throw new AppError('Failed to create connected checkout session', 500);
    }

    await this.repo.updateConnectPaymentOrder(order.id, {
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

    if (input.sendEmail && input.customerEmail && this.emailService) {
      const formattedAmount = new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: currency.toUpperCase()
      }).format(amount / 100);

      void this.emailService
        .sendCheckoutLinkEmail(input.customerEmail, {
          workspaceName: workspace.name,
          description,
          amount: formattedAmount,
          checkoutUrl: session.url
        })
        .catch((err: unknown) => {
          logger.error({ event: 'billing.connect.checkout.email_failed', orderId: order.id, error: err });
        });
    }

    return {
      url: session.url,
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
    if (['PAID', 'REFUNDED'].includes(order.status)) {
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
      checkoutUrl: order.checkoutUrl
    });

    logger.info({ event: 'billing.connect.reminder.sent', orderId, workspaceId });
  }

  async cancelConnectPaymentOrder(
    workspaceId: string,
    userId: string,
    orderId: string
  ): Promise<void> {
    await this.assertWorkspaceBillingManager(workspaceId, userId);

    const order = await this.repo.findConnectPaymentOrderById(orderId);
    if (!order || order.workspaceId !== workspaceId) {
      throw new AppError('Payment order not found', 404);
    }
    if (['PAID', 'REFUNDED', 'CANCELED'].includes(order.status)) {
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
          logger.warn({ event: 'billing.connect.cancel.expire_failed', orderId, error: String(err) });
        }
      }
    }

    await this.repo.updateConnectPaymentOrder(orderId, {
      status: 'CANCELED',
      canceledAt: new Date(),
      statusReason: 'Canceled by workspace manager'
    });

    logger.info({ event: 'billing.connect.order.canceled', orderId, workspaceId });
  }

  async listConnectPaymentOrders(
    workspaceId: string,
    userId: string,
    limit = 50
  ): Promise<ConnectPaymentOrderListItem[]> {
    await this.assertWorkspaceBillingManager(workspaceId, userId);
    const safeLimit = Math.max(1, Math.min(limit, 200));
    const orders = await this.repo.listConnectPaymentOrdersByWorkspace(workspaceId, safeLimit);
    return orders.map((order) => this.mapConnectPaymentOrder(order));
  }

  async syncConnectPaymentOrderStatusBySessionId(
    workspaceId: string,
    userId: string,
    sessionId: string
  ): Promise<ConnectPaymentOrderListItem> {
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
      session.payment_status === 'paid'
        ? 'PAID'
        : session.payment_status === 'unpaid'
          ? (session.status === 'complete' ? 'PENDING' : 'CHECKOUT_OPEN')
          : session.status === 'expired'
            ? 'CANCELED'
            : session.status === 'complete'
              ? 'CHECKOUT_COMPLETED'
              : 'CHECKOUT_OPEN';

    const updated = await this.repo.updateConnectPaymentOrder(order.id, {
      status: nextStatus,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id,
      paidAt: nextStatus === 'PAID' ? order.paidAt ?? new Date() : order.paidAt,
      canceledAt: nextStatus === 'CANCELED' ? order.canceledAt ?? new Date() : order.canceledAt,
      lastWebhookEvent: 'checkout.session.sync'
    });

    return this.mapConnectPaymentOrder(updated);
  }

  async listConnectCatalogItems(
    workspaceId: string,
    userId: string,
    includeInactive = true
  ): Promise<ConnectCatalogItemListItem[]> {
    await this.assertWorkspaceBillingManager(workspaceId, userId);
    const items = await this.repo.listConnectCatalogItemsByWorkspace(workspaceId, includeInactive);
    return items.map((item) => this.mapConnectCatalogItem(item));
  }

  async createConnectCatalogItem(
    workspaceId: string,
    userId: string,
    input: CreateConnectCatalogItemInput
  ): Promise<ConnectCatalogItemListItem> {
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
    if (input.billingType === 'SUBSCRIPTION' && !input.recurringInterval) {
      throw new AppError('recurringInterval is required for subscription items', 422);
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
    const recurring = input.billingType === 'SUBSCRIPTION'
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
      billingType: input.billingType,
      recurringInterval: input.recurringInterval,
      recurringIntervalCount: input.recurringIntervalCount,
      name,
      description: input.description?.trim() || undefined,
      amount: input.amount,
      currency,
      stripeConnectAccountId: accountId,
      stripeProductId: product.id,
      stripePriceId: price.id,
      metadata: input.metadata
    });

    return this.mapConnectCatalogItem(item);
  }

  private buildFiscalCheckoutMetadata(input: {
    workspaceId: string;
    orderId: string;
    catalogItem: ConnectCatalogItem | null;
    metadata?: Record<string, string>;
  }): Record<string, string> {
    const source = input.metadata ?? {};
    const catalogTypeHint = input.catalogItem?.kind === 'SERVICE' ? 'nfse' : 'nfe';
    const saleOriginHint =
      input.catalogItem?.billingType === 'SUBSCRIPTION' ? 'stripe_subscription' : 'stripe_payment';

    const merged: Record<string, string> = {
      ...source,
      workspace_id: source.workspace_id ?? input.workspaceId,
      workspace_business_id: source.workspace_business_id ?? '',
      internal_sale_id: source.internal_sale_id ?? input.orderId,
      customer_id: source.customer_id ?? '',
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

  // ---------------------------------------------------------------------------
  // Webhook
  // ---------------------------------------------------------------------------

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    let event: StripeWebhookEvent;

    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret) as StripeWebhookEvent;
    } catch (err) {
      logger.warn({ event: 'billing.webhook.invalid_signature', error: String(err) });
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
      logger.error({ event: 'billing.webhook.processing_error', type: event.type, error: String(err) });
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
      const created = await this.repo.createSubscription({
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: stripeSubId,
        stripeCheckoutSessionId: session.id,
        planCode,
        status,
        amount: PLAN_AMOUNTS_BRL[planCode],
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
      session.payment_status === 'paid'
        ? 'PAID'
        : session.payment_status === 'unpaid'
          ? 'PENDING'
          : 'CHECKOUT_COMPLETED';
    const paidAt = nextStatus === 'PAID' ? new Date() : null;

    await this.repo.updateConnectPaymentOrder(orderId, {
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

    await this.repo.updateConnectPaymentOrder(orderId, {
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

    await this.repo.updateConnectPaymentOrder(orderId, {
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

    await this.repo.updateConnectPaymentOrder(orderId, {
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

    await this.repo.updateConnectPaymentOrder(order.id, {
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

    await this.repo.updateConnectPaymentOrder(order.id, {
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

    await this.repo.updateConnectPaymentOrder(order.id, {
      status: 'REFUNDED',
      lastWebhookEvent: 'charge.refunded',
      refundedAt: new Date()
    });
  }

  private async handleSubscriptionUpsert(sub: StripeSubscriptionObject, eventType: string): Promise<void> {
    const userId = sub.metadata?.userId;
    const planCode = sub.metadata?.planCode as SubscriptionPlan | undefined;
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
      const created = await this.repo.createSubscription({
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        planCode,
        status,
        amount: PLAN_AMOUNTS_BRL[planCode],
        currentPeriodStart: start,
        currentPeriodEnd: end,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        lastWebhookEvent: eventType
      });
      await this.repo.syncUserBillingFields(userId, created);
    }
  }

  private async handleSubscriptionDeleted(sub: StripeSubscriptionObject): Promise<void> {
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

    const existing = await this.repo.findSubscriptionByStripeId(subscriptionId);
    if (!existing) return;

    const retrieveSubscription = this.stripe.subscriptions
      .retrieve as unknown as StripeRetrieveSubscription;
    const stripeSub = await retrieveSubscription(subscriptionId);
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
    if (!existing) return;

    const updated = await this.repo.updateSubscription(subscriptionId, {
      status: 'PAST_DUE',
      lastWebhookEvent: 'invoice.payment_failed'
    });
    await this.repo.syncUserBillingFields(existing.userId, updated);
    await this.repo.revokeUserAccess(existing.userId);

    logger.warn({ event: 'billing.invoice.payment_failed', userId: existing.userId, subscriptionId });
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
      amount: order.amount,
      currency: order.currency,
      description: order.description,
      customerEmail: order.customerEmail,
      stripeCheckoutSessionId: order.stripeCheckoutSessionId,
      stripePaymentIntentId: order.stripePaymentIntentId,
      checkoutUrl: order.checkoutUrl,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      paidAt: order.paidAt,
      failedAt: order.failedAt,
      canceledAt: order.canceledAt,
      refundedAt: order.refundedAt
    };
  }

  private mapConnectCatalogItem(item: ConnectCatalogItem): ConnectCatalogItemListItem {
    return {
      id: item.id,
      kind: item.kind,
      billingType: item.billingType,
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
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }
}
