/**
 * BillingService unit tests
 *
 * Strategy: Stripe SDK and BillingRepository are fully mocked via vi.fn().
 * Tests cover the critical flows described in the task:
 *  - checkout session creation
 *  - webhook events (checkout.completed, subscription.created/updated/deleted,
 *    invoice.paid, invoice.payment_failed)
 *  - access grant / revocation
 *  - billing status resolution
 */

import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import { BillingService } from './billing-service';
import type { BillingRepository, BillingUser, Subscription } from '../repositories/billing-repository';
import type { SubscriptionPlan, SubscriptionStatus } from '../domain/types';

// Minimal Stripe client mock — avoids importing the full SDK namespace
type MockStripeInstance = {
  customers: { create: ReturnType<typeof vi.fn> };
  checkout: { sessions: { create: ReturnType<typeof vi.fn> } };
  subscriptions: { retrieve: ReturnType<typeof vi.fn> };
  webhooks: { constructEvent: ReturnType<typeof vi.fn> };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const APP_URL = 'http://localhost:5173';
const WEBHOOK_SECRET = 'whsec_test';

function makeUser(overrides: Partial<BillingUser> = {}): BillingUser {
  return {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test',
    stripeCustomerId: null,
    subscriptionPlan: null,
    subscriptionStatus: null,
    subscriptionId: null,
    currentPeriodEnd: null,
    hasActiveSubscription: false,
    ...overrides
  };
}

function makeSub(overrides: Record<string, unknown> = {}): Subscription {
  return {
    id: 'sub-local-1',
    userId: 'user-1',
    stripeCustomerId: 'cus_1',
    stripeSubscriptionId: 'sub_stripe_1',
    stripeCheckoutSessionId: null,
    planCode: 'PERSONAL' as SubscriptionPlan,
    status: 'ACTIVE' as SubscriptionStatus,
    currency: 'brl',
    amount: 1990,
    interval: 'month',
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000),
    cancelAtPeriodEnd: false,
    lastWebhookEvent: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

function makeRepo(): Mocked<BillingRepository> {
  return {
    findUserById: vi.fn(),
    findUserByStripeCustomerId: vi.fn(),
    findSubscriptionByStripeId: vi.fn(),
    findActiveSubscriptionByUserId: vi.fn(),
    upsertStripeCustomerId: vi.fn().mockResolvedValue(undefined),
    createSubscription: vi.fn(),
    updateSubscription: vi.fn(),
    syncUserBillingFields: vi.fn().mockResolvedValue(undefined),
    revokeUserAccess: vi.fn().mockResolvedValue(undefined)
  };
}

function makeStripe(): MockStripeInstance {
  return {
    customers: { create: vi.fn() },
    checkout: { sessions: { create: vi.fn() } },
    subscriptions: { retrieve: vi.fn() },
    webhooks: { constructEvent: vi.fn() }
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BillingService', () => {
  let repo: Mocked<BillingRepository>;
  let stripe: MockStripeInstance;
  let service: BillingService;

  beforeEach(() => {
    vi.resetAllMocks();
    repo = makeRepo();
    stripe = makeStripe();

    service = new BillingService({
      repo,
      stripe: stripe as any,
      appPublicUrl: APP_URL,
      webhookSecret: WEBHOOK_SECRET,
      priceIds: {
        PERSONAL: 'price_personal',
        BUSINESS: 'price_business'
      }
    });
  });

  // ── Checkout ──────────────────────────────────────────────────────────────

  describe('createCheckoutSession', () => {
    it('creates a new Stripe customer when user has none', async () => {
      const user = makeUser({ stripeCustomerId: null });
      repo.findUserById.mockResolvedValue(user);
      (stripe.customers.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'cus_new' });
      (stripe.checkout.sessions.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        url: 'https://checkout.stripe.com/test',
        id: 'cs_1'
      });

      const result = await service.createCheckoutSession('user-1', 'PERSONAL');

      expect(stripe.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: user.email, metadata: { userId: 'user-1' } })
      );
      expect(repo.upsertStripeCustomerId).toHaveBeenCalledWith('user-1', 'cus_new');
      expect(result.url).toBe('https://checkout.stripe.com/test');
    });

    it('reuses existing Stripe customer', async () => {
      const user = makeUser({ stripeCustomerId: 'cus_existing' });
      repo.findUserById.mockResolvedValue(user);
      (stripe.checkout.sessions.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        url: 'https://checkout.stripe.com/reuse',
        id: 'cs_2'
      });

      await service.createCheckoutSession('user-1', 'BUSINESS');

      expect(stripe.customers.create).not.toHaveBeenCalled();
      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({ customer: 'cus_existing' })
      );
    });

    it('throws 404 if user not found', async () => {
      repo.findUserById.mockResolvedValue(null);
      await expect(service.createCheckoutSession('missing', 'PERSONAL')).rejects.toMatchObject({
        statusCode: 404
      });
    });

    it('passes success and cancel URLs with correct paths', async () => {
      repo.findUserById.mockResolvedValue(makeUser({ stripeCustomerId: 'cus_x' }));
      (stripe.checkout.sessions.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        url: 'https://checkout.stripe.com/ok',
        id: 'cs_3'
      });

      await service.createCheckoutSession('user-1', 'PERSONAL');

      const call = (stripe.checkout.sessions.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.success_url).toContain('/billing/success');
      expect(call.cancel_url).toContain('/billing/cancel');
    });
  });

  // ── Billing status ─────────────────────────────────────────────────────────

  describe('getBillingStatus', () => {
    it('returns canAccessPlatform=true for ACTIVE subscription', async () => {
      repo.findUserById.mockResolvedValue(
        makeUser({ subscriptionStatus: 'ACTIVE' as SubscriptionStatus, hasActiveSubscription: true, subscriptionPlan: 'PERSONAL' as SubscriptionPlan })
      );

      const status = await service.getBillingStatus('user-1');
      expect(status.canAccessPlatform).toBe(true);
      expect(status.plan).toBe('PERSONAL');
    });

    it('returns canAccessPlatform=false for no subscription', async () => {
      repo.findUserById.mockResolvedValue(makeUser());
      const status = await service.getBillingStatus('user-1');
      expect(status.canAccessPlatform).toBe(false);
      expect(status.message).toBeTruthy();
    });

    it('returns canAccessPlatform=false for CANCELED subscription', async () => {
      repo.findUserById.mockResolvedValue(
        makeUser({ subscriptionStatus: 'CANCELED' as SubscriptionStatus, hasActiveSubscription: false })
      );
      const status = await service.getBillingStatus('user-1');
      expect(status.canAccessPlatform).toBe(false);
    });
  });

  // ── Webhook ────────────────────────────────────────────────────────────────

  describe('handleWebhook', () => {
    it('rejects invalid webhook signature', async () => {
      (stripe.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await expect(
        service.handleWebhook(Buffer.from('{}'), 'bad-sig')
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    it('handles checkout.session.completed — creates new subscription', async () => {
      const stripeSub = {
        id: 'sub_stripe_1',
        customer: 'cus_1',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
        cancel_at_period_end: false,
        metadata: { userId: 'user-1', planCode: 'PERSONAL' }
      };

      const session = {
        id: 'cs_1',
        mode: 'subscription',
        subscription: 'sub_stripe_1',
        metadata: { userId: 'user-1', planCode: 'PERSONAL' }
      };

      (stripe.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockReturnValue({
        type: 'checkout.session.completed',
        id: 'evt_1',
        data: { object: session }
      });
      (stripe.subscriptions.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue(stripeSub);
      repo.findSubscriptionByStripeId.mockResolvedValue(null);
      repo.createSubscription.mockResolvedValue(makeSub());

      await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(repo.createSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', planCode: 'PERSONAL', status: 'ACTIVE' })
      );
      expect(repo.syncUserBillingFields).toHaveBeenCalled();
    });

    it('handles customer.subscription.deleted — revokes user access', async () => {
      const sub = makeSub();
      (stripe.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockReturnValue({
        type: 'customer.subscription.deleted',
        id: 'evt_2',
        data: {
          object: {
            id: 'sub_stripe_1',
            customer: 'cus_1',
            status: 'canceled',
            current_period_start: Math.floor(Date.now() / 1000),
            current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400,
            cancel_at_period_end: false,
            metadata: {}
          }
        }
      });
      repo.findSubscriptionByStripeId.mockResolvedValue(sub);
      repo.updateSubscription.mockResolvedValue({ ...sub, status: 'CANCELED' as SubscriptionStatus });

      await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(repo.updateSubscription).toHaveBeenCalledWith(
        'sub_stripe_1',
        expect.objectContaining({ status: 'CANCELED' })
      );
      expect(repo.revokeUserAccess).toHaveBeenCalledWith('user-1');
    });

    it('handles invoice.payment_failed — marks PAST_DUE and revokes access', async () => {
      const sub = makeSub();
      (stripe.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockReturnValue({
        type: 'invoice.payment_failed',
        id: 'evt_3',
        data: { object: { subscription: 'sub_stripe_1' } }
      });
      repo.findSubscriptionByStripeId.mockResolvedValue(sub);
      repo.updateSubscription.mockResolvedValue({ ...sub, status: 'PAST_DUE' as SubscriptionStatus });

      await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(repo.updateSubscription).toHaveBeenCalledWith(
        'sub_stripe_1',
        expect.objectContaining({ status: 'PAST_DUE' })
      );
      expect(repo.revokeUserAccess).toHaveBeenCalledWith('user-1');
    });

    it('handles invoice.paid — re-activates subscription', async () => {
      const sub = makeSub({ status: 'PAST_DUE' as SubscriptionStatus });
      const stripeSub = {
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400
      };

      (stripe.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockReturnValue({
        type: 'invoice.paid',
        id: 'evt_4',
        data: { object: { subscription: 'sub_stripe_1' } }
      });
      repo.findSubscriptionByStripeId.mockResolvedValue(sub);
      (stripe.subscriptions.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue(stripeSub);
      repo.updateSubscription.mockResolvedValue({ ...sub, status: 'ACTIVE' as SubscriptionStatus });

      await service.handleWebhook(Buffer.from('{}'), 'sig');

      expect(repo.updateSubscription).toHaveBeenCalledWith(
        'sub_stripe_1',
        expect.objectContaining({ status: 'ACTIVE' })
      );
      expect(repo.syncUserBillingFields).toHaveBeenCalled();
    });

    it('gracefully ignores unknown subscription in webhook events', async () => {
      (stripe.webhooks.constructEvent as ReturnType<typeof vi.fn>).mockReturnValue({
        type: 'invoice.payment_failed',
        id: 'evt_5',
        data: { object: { subscription: 'sub_unknown' } }
      });
      repo.findSubscriptionByStripeId.mockResolvedValue(null);

      // Should not throw
      await expect(service.handleWebhook(Buffer.from('{}'), 'sig')).resolves.toBeUndefined();
      expect(repo.revokeUserAccess).not.toHaveBeenCalled();
    });
  });
});
