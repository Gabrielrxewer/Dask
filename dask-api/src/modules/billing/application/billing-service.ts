import type Stripe from 'stripe';
import { logger } from '@/core/logging/logger';
import { AppError } from '@/core/errors/app-error';
import type { BillingRepository } from '../repositories/billing-repository';
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
  mode: string | null;
  subscription: string | { id: string } | null;
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
  data: { object: unknown };
}

interface BillingServiceDeps {
  repo: BillingRepository;
  stripe: StripeInstance;
  appPublicUrl: string;
  webhookSecret: string;
  priceIds?: Partial<Record<SubscriptionPlan, string>>;
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
  private readonly priceIds: Partial<Record<SubscriptionPlan, string>>;

  constructor(deps: BillingServiceDeps) {
    this.repo = deps.repo;
    this.stripe = deps.stripe;
    this.appPublicUrl = deps.appPublicUrl;
    this.webhookSecret = deps.webhookSecret;
    this.priceIds = deps.priceIds ?? PLAN_PRICE_IDS;
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

    return {
      hasActiveSubscription: user.hasActiveSubscription,
      plan: (user.subscriptionPlan as SubscriptionPlan | null) ?? null,
      status: (user.subscriptionStatus as SubscriptionStatus | null) ?? null,
      currentPeriodEnd: user.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: latestSubscription?.cancelAtPeriodEnd ?? false,
      canAccessPlatform: active,
      canCreateWorkspace: active,
      message: active ? null : this.buildBlockedMessage(user.subscriptionStatus as SubscriptionStatus | null)
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
}
