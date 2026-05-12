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

import { describe, it, expect, vi, beforeEach, afterEach, type Mocked } from 'vitest';
import { BillingService } from '@/modules/billing/application/billing-service';
import { listMissingStripeBillingProductionEnv } from '@/modules/billing/application/billing-runtime-env';
import { redactBillingMetadata, redactBillingSecretValue } from '@/modules/billing/domain/redaction';
import type {
  BillingRepository,
  BillingUser,
  ConnectPaymentOrder,
  Subscription
} from '@/modules/billing/repositories/billing-repository';
import type { SubscriptionPlan, SubscriptionStatus } from '@/modules/billing/domain/types';

// Minimal Stripe client mock — avoids importing the full SDK namespace
type MockStripeInstance = {
  customers: { create: ReturnType<typeof vi.fn> };
  checkout: { sessions: { create: ReturnType<typeof vi.fn> } };
  subscriptions: { retrieve: ReturnType<typeof vi.fn> };
  webhooks: { constructEvent: ReturnType<typeof vi.fn> };
  accounts: {
    create: ReturnType<typeof vi.fn>;
    retrieve: ReturnType<typeof vi.fn>;
    updateCapability: ReturnType<typeof vi.fn>;
  };
  paymentMethodConfigurations: {
    list: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  accountLinks: { create: ReturnType<typeof vi.fn> };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const APP_URL = 'http://localhost:5173';
const WEBHOOK_SECRET = 'whsec_test';
const PORTAL_TOKEN_SECRET = 'billing-portal-token-secret-for-unit-tests';

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

function makeWorkspace(overrides: Record<string, unknown> = {}) {
  return {
    id: 'workspace-1',
    name: 'Workspace Test',
    connectAccountId: null as string | null,
    ...overrides
  };
}

function makeConnectAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acct_existing',
    details_submitted: true,
    charges_enabled: true,
    payouts_enabled: true,
    capabilities: {
      card_payments: 'active',
      transfers: 'active',
      boleto_payments: 'active',
      pix_payments: 'inactive'
    },
    requirements: { currently_due: [] },
    ...overrides
  };
}

function makeBillingCustomer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'customer-1',
    workspaceId: 'workspace-1',
    name: 'Cliente Teste',
    tradeName: null,
    legalName: 'Cliente Teste Ltda',
    document: '12.345.678/0001-90',
    stateRegistration: null,
    municipalRegistration: null,
    taxRegime: null,
    email: 'cliente@example.com',
    phone: null,
    address: null,
    ...overrides
  };
}

function makeConnectPaymentOrder(overrides: Partial<ConnectPaymentOrder> = {}): ConnectPaymentOrder {
  return {
    id: 'order-connect-1',
    workspaceId: 'workspace-1',
    createdByUserId: 'user-1',
    stripeConnectAccountId: 'acct_existing',
    stripeCheckoutSessionId: null,
    stripePaymentIntentId: null,
    amount: 10000,
    currency: 'brl',
    description: 'Servico mensal',
    customerId: 'customer-1',
    customerName: 'Cliente Teste Ltda',
    customerEmail: 'cliente@example.com',
    customerDocument: '12.345.678/0001-90',
    customerPhone: null,
    customerAddress: null,
    applicationFeeAmount: 500,
    status: 'DRAFT',
    statusReason: null,
    metadata: { orderId: 'order-1', sourceWorkItemId: 'item-1' },
    checkoutUrl: null,
    paidAt: null,
    failedAt: null,
    canceledAt: null,
    refundedAt: null,
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
    findUserByEmail: vi.fn(),
    findUserByStripeCustomerId: vi.fn(),
    findSubscriptionByStripeId: vi.fn(),
    findActiveSubscriptionByUserId: vi.fn(),
    findLatestSubscriptionByUserId: vi.fn(),
    hasGuestWorkspaceMembership: vi.fn().mockResolvedValue(false),
    findWorkspaceMembership: vi.fn(),
    findCustomerIdsForUser: vi.fn(),
    findWorkspaceBillingConnectInfo: vi.fn(),
    findCustomerById: vi.fn(),
    findCustomerByEmail: vi.fn(),
    createCustomerForBilling: vi.fn(),
    linkCustomerToUser: vi.fn(),
    findConnectCatalogItemById: vi.fn(),
    listConnectCatalogItemsByWorkspace: vi.fn(),
    findConnectPaymentOrderById: vi.fn(),
    findConnectPaymentOrderByCheckoutSessionId: vi.fn(),
    findConnectPaymentOrderByPaymentIntentId: vi.fn(),
    listConnectPaymentOrdersByWorkspace: vi.fn(),
    hasWorkItemProposalOrContract: vi.fn().mockResolvedValue(true),
    upsertStripeCustomerId: vi.fn().mockResolvedValue(undefined),
    upsertWorkspaceConnectAccountId: vi.fn().mockResolvedValue(undefined),
    createConnectCatalogItem: vi.fn(),
    createConnectPaymentOrder: vi.fn(),
    updateConnectPaymentOrder: vi.fn(),
    createBillingPortalTokenRecord: vi.fn(),
    revokeBillingPortalTokensForOrder: vi.fn().mockResolvedValue(undefined),
    syncWorkItemBillingSnapshot: vi.fn().mockResolvedValue(undefined),
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
    webhooks: { constructEvent: vi.fn() },
    accounts: { create: vi.fn(), retrieve: vi.fn(), updateCapability: vi.fn().mockResolvedValue({}) },
    paymentMethodConfigurations: {
      list: vi.fn().mockResolvedValue({ data: [] }),
      update: vi.fn().mockResolvedValue({})
    },
    accountLinks: { create: vi.fn() }
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
      portalTokenSecret: PORTAL_TOKEN_SECRET,
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

    it('blocks production Stripe actions when STRIPE_SECRET_KEY is not configured', async () => {
      const productionService = new BillingService({
        repo,
        stripe: stripe as any,
        appPublicUrl: APP_URL,
        webhookSecret: WEBHOOK_SECRET,
        environment: 'production',
        stripeSecretConfigured: false,
        priceIds: {
          PERSONAL: 'price_personal',
          BUSINESS: 'price_business'
        }
      });

      await expect(productionService.createCheckoutSession('user-1', 'PERSONAL')).rejects.toMatchObject({
        statusCode: 503,
        details: {
          code: 'STRIPE_BILLING_ENV_MISSING',
          missingEnv: ['STRIPE_SECRET_KEY']
        }
      });
      expect(repo.findUserById).not.toHaveBeenCalled();
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });
  });

  // ── Billing status ─────────────────────────────────────────────────────────

  describe('getBillingStatus', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

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

  describe('Stripe Connect', () => {
    it('creates connect account and onboarding link for workspace owner', async () => {
      repo.findWorkspaceMembership.mockResolvedValue({
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: 'OWNER'
      });
      repo.findWorkspaceBillingConnectInfo.mockResolvedValue(makeWorkspace());
      (stripe.accounts.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'acct_123' });
      (stripe.accountLinks.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        url: 'https://connect.stripe.com/setup/acct_123'
      });

      const result = await service.createConnectOnboardingLink('workspace-1', 'user-1');

      expect(stripe.accounts.create).toHaveBeenCalled();
      expect(repo.upsertWorkspaceConnectAccountId).toHaveBeenCalledWith('workspace-1', 'acct_123');
      expect(result).toEqual({
        url: 'https://connect.stripe.com/setup/acct_123',
        accountId: 'acct_123'
      });
    });

    it('uses existing account for onboarding link when workspace already connected', async () => {
      repo.findWorkspaceMembership.mockResolvedValue({
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: 'OWNER'
      });
      repo.findWorkspaceBillingConnectInfo.mockResolvedValue(
        makeWorkspace({ connectAccountId: 'acct_existing' })
      );
      (stripe.accountLinks.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        url: 'https://connect.stripe.com/setup/acct_existing'
      });

      const result = await service.createConnectOnboardingLink('workspace-1', 'user-1');

      expect(stripe.accounts.create).not.toHaveBeenCalled();
      expect(result.accountId).toBe('acct_existing');
    });

    it('blocks sensitive connect setup for workspace admin', async () => {
      repo.findWorkspaceMembership.mockResolvedValue({
        workspaceId: 'workspace-1',
        userId: 'user-admin',
        role: 'ADMIN'
      });

      await expect(service.createConnectOnboardingLink('workspace-1', 'user-admin')).rejects.toMatchObject({
        statusCode: 403,
        message: 'Only workspace OWNER can manage sensitive billing connect settings'
      });
      expect(repo.findWorkspaceBillingConnectInfo).not.toHaveBeenCalled();
      expect(stripe.accountLinks.create).not.toHaveBeenCalled();
    });

    it('blocks sensitive connect setup for workspace member', async () => {
      repo.findWorkspaceMembership.mockResolvedValue({
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: 'MEMBER'
      });

      await expect(service.createConnectOnboardingLink('workspace-1', 'user-1')).rejects.toMatchObject({
        statusCode: 403
      });
    });

    it('allows owner to update sensitive connect payment method configuration', async () => {
      repo.findWorkspaceMembership.mockResolvedValue({
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: 'OWNER'
      });
      repo.findWorkspaceBillingConnectInfo.mockResolvedValue(
        makeWorkspace({ connectAccountId: 'acct_existing' })
      );
      (stripe.paymentMethodConfigurations.list as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: [{ id: 'pmc_1', is_default: true, boleto: { available: false } }]
      });
      (stripe.accounts.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue(makeConnectAccount({
        capabilities: {
          card_payments: 'active',
          transfers: 'active',
          boleto_payments: 'inactive'
        }
      }));

      const status = await service.requestConnectLocalPaymentMethod('workspace-1', 'user-1', 'boleto');

      expect(stripe.paymentMethodConfigurations.update).toHaveBeenCalledWith(
        'pmc_1',
        { boleto: { display_preference: { preference: 'on' } } },
        { stripeAccount: 'acct_existing' }
      );
      expect(status.boletoPaymentsStatus).toBe('enabled');
    });

    it('blocks admin from sensitive connect payment method configuration', async () => {
      repo.findWorkspaceMembership.mockResolvedValue({
        workspaceId: 'workspace-1',
        userId: 'user-admin',
        role: 'ADMIN'
      });

      await expect(
        service.requestConnectLocalPaymentMethod('workspace-1', 'user-admin', 'boleto')
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'Only workspace OWNER can manage sensitive billing connect settings'
      });
      expect(repo.findWorkspaceBillingConnectInfo).not.toHaveBeenCalled();
      expect(stripe.paymentMethodConfigurations.update).not.toHaveBeenCalled();
    });

    it('blocks member from sensitive connect payment method configuration', async () => {
      repo.findWorkspaceMembership.mockResolvedValue({
        workspaceId: 'workspace-1',
        userId: 'user-member',
        role: 'MEMBER'
      });

      await expect(
        service.requestConnectLocalPaymentMethod('workspace-1', 'user-member', 'boleto')
      ).rejects.toMatchObject({
        statusCode: 403
      });
      expect(stripe.paymentMethodConfigurations.update).not.toHaveBeenCalled();
    });

    it('creates connected checkout session with platform fee', async () => {
      repo.findWorkspaceMembership.mockResolvedValue({
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: 'OWNER'
      });
      repo.findWorkspaceBillingConnectInfo.mockResolvedValue(
        makeWorkspace({ connectAccountId: 'acct_existing' })
      );
      (stripe.accounts.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue(makeConnectAccount());
      repo.findCustomerById.mockResolvedValue(makeBillingCustomer());
      repo.createConnectPaymentOrder.mockResolvedValue(makeConnectPaymentOrder());
      repo.updateConnectPaymentOrder.mockResolvedValue(makeConnectPaymentOrder({
        stripeCheckoutSessionId: 'cs_connect_1',
        status: 'CHECKOUT_OPEN',
        checkoutUrl: 'https://checkout.stripe.com/connect/cs_connect_1'
      }));
      (stripe.checkout.sessions.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'cs_connect_1',
        url: 'https://checkout.stripe.com/connect/cs_connect_1'
      });

      const response = await service.createConnectCheckoutSession('workspace-1', 'user-1', {
        amount: 10000,
        currency: 'brl',
        description: 'Servico mensal',
        customerId: 'customer-1',
        metadata: { orderId: 'order-1', sourceWorkItemId: 'item-1' }
      });

      expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'payment',
          payment_method_types: ['card', 'boleto'],
          payment_intent_data: expect.objectContaining({
            application_fee_amount: 500,
            transfer_data: {
              destination: 'acct_existing'
            }
          })
        })
      );
      expect(response.sessionId).toBe('cs_connect_1');
      expect(response.orderId).toBe('order-connect-1');
      expect(stripe.accounts.retrieve).toHaveBeenCalledWith('acct_existing');
      const metadataUpdate = repo.updateConnectPaymentOrder.mock.calls.find(([, input]) =>
        Boolean(input.metadata?.clientPortalTokenId)
      )?.[1].metadata;
      expect(metadataUpdate).toMatchObject({
        clientPortalTokenId: expect.any(String),
        clientPortalTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/)
      });
      expect(metadataUpdate).not.toHaveProperty('clientPortalUrl');
      const sessionPayload = (stripe.checkout.sessions.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(JSON.stringify(sessionPayload)).not.toContain('clientPortalUrl');
      expect(JSON.stringify(sessionPayload)).not.toContain('/portal/billing?token=');
      expect(repo.syncWorkItemBillingSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'workspace-1',
          itemId: 'item-1',
          billingOrderId: 'order-connect-1',
          billingStatus: 'pending'
        })
      );
    });

    it('blocks connected checkout when required capabilities are missing', async () => {
      repo.findWorkspaceMembership.mockResolvedValue({
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: 'OWNER'
      });
      repo.findWorkspaceBillingConnectInfo.mockResolvedValue(
        makeWorkspace({ connectAccountId: 'acct_existing' })
      );
      repo.findCustomerById.mockResolvedValue(makeBillingCustomer());
      (stripe.accounts.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue(makeConnectAccount({
        charges_enabled: true,
        capabilities: {
          card_payments: 'inactive',
          transfers: 'active',
          boleto_payments: 'active'
        }
      }));

      await expect(service.createConnectCheckoutSession('workspace-1', 'user-1', {
        amount: 10000,
        currency: 'brl',
        description: 'Servico mensal',
        customerId: 'customer-1'
      })).rejects.toMatchObject({
        statusCode: 409,
        details: {
          code: 'STRIPE_CONNECT_CAPABILITY_MISSING',
          missingCapabilities: ['card_payments']
        }
      });
      expect(repo.createConnectPaymentOrder).not.toHaveBeenCalled();
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('honors configured Stripe Connect required capabilities before dependent checkout flow', async () => {
      const capabilityService = new BillingService({
        repo,
        stripe: stripe as any,
        appPublicUrl: APP_URL,
        webhookSecret: WEBHOOK_SECRET,
        portalTokenSecret: PORTAL_TOKEN_SECRET,
        connectRequiredCapabilities: ['charges_enabled', 'transfers', 'card_payments', 'pix_payments'],
        priceIds: {
          PERSONAL: 'price_personal',
          BUSINESS: 'price_business'
        }
      });
      repo.findWorkspaceMembership.mockResolvedValue({
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: 'OWNER'
      });
      repo.findWorkspaceBillingConnectInfo.mockResolvedValue(
        makeWorkspace({ connectAccountId: 'acct_existing' })
      );
      repo.findCustomerById.mockResolvedValue(makeBillingCustomer());
      (stripe.accounts.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue(makeConnectAccount({
        capabilities: {
          card_payments: 'active',
          transfers: 'active',
          boleto_payments: 'active',
          pix_payments: 'inactive'
        }
      }));

      await expect(capabilityService.createConnectCheckoutSession('workspace-1', 'user-1', {
        amount: 10000,
        currency: 'brl',
        description: 'Servico mensal',
        customerId: 'customer-1'
      })).rejects.toMatchObject({
        statusCode: 409,
        details: {
          code: 'STRIPE_CONNECT_CAPABILITY_MISSING',
          missingCapabilities: ['pix_payments']
        }
      });
      expect(repo.createConnectPaymentOrder).not.toHaveBeenCalled();
      expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
    });

    it('does not derive billing portal token secrets from webhook secrets', async () => {
      const noPortalSecretService = new BillingService({
        repo,
        stripe: stripe as any,
        appPublicUrl: APP_URL,
        webhookSecret: WEBHOOK_SECRET,
        priceIds: {
          PERSONAL: 'price_personal',
          BUSINESS: 'price_business'
        }
      });

      await expect(noPortalSecretService.createConnectPaymentOrderPortalToken(
        'workspace-1',
        'user-1',
        'order-connect-1'
      )).rejects.toMatchObject({
        statusCode: 503,
        details: {
          code: 'BILLING_PORTAL_TOKEN_SECRET_MISSING'
        }
      });
      expect(repo.findWorkspaceMembership).not.toHaveBeenCalled();
    });

    it('returns safe provider errors without leaking Stripe secrets or portal tokens', async () => {
      repo.findWorkspaceMembership.mockResolvedValue({
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: 'OWNER'
      });
      repo.findWorkspaceBillingConnectInfo.mockResolvedValue(
        makeWorkspace({ connectAccountId: 'acct_existing' })
      );
      (stripe.accounts.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue(makeConnectAccount());
      repo.findCustomerById.mockResolvedValue(makeBillingCustomer());
      repo.createConnectPaymentOrder.mockResolvedValue(makeConnectPaymentOrder());
      repo.updateConnectPaymentOrder.mockResolvedValue(makeConnectPaymentOrder({ status: 'FAILED' }));
      (stripe.checkout.sessions.create as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Stripe failed with sk_live_secret123456 and https://app.test/portal/billing?token=raw-token')
      );

      await expect(service.createConnectCheckoutSession('workspace-1', 'user-1', {
        amount: 10000,
        currency: 'brl',
        description: 'Servico mensal',
        customerId: 'customer-1'
      })).rejects.toMatchObject({
        statusCode: 500,
        details: {
          reason: expect.not.stringContaining('sk_live_secret123456')
        }
      });

      const failedUpdate = repo.updateConnectPaymentOrder.mock.calls.find(([, input]) => input.status === 'FAILED')?.[1];
      expect(failedUpdate?.statusReason).toContain('[REDACTED]');
      expect(failedUpdate?.statusReason).not.toContain('raw-token');
    });

    it('returns connect account status', async () => {
      repo.findWorkspaceMembership.mockResolvedValue({
        workspaceId: 'workspace-1',
        userId: 'user-1',
        role: 'OWNER'
      });
      repo.findWorkspaceBillingConnectInfo.mockResolvedValue(
        makeWorkspace({ connectAccountId: 'acct_existing' })
      );
      (stripe.accounts.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 'acct_existing',
        details_submitted: true,
        charges_enabled: true,
        payouts_enabled: true,
        requirements: { currently_due: [] }
      });

      const status = await service.getConnectAccountStatus('workspace-1', 'user-1');

      expect(status.onboardingComplete).toBe(true);
      expect(status.stripeAccountId).toBe('acct_existing');
    });

    it('keeps connect account status readable for workspace admin', async () => {
      repo.findWorkspaceMembership.mockResolvedValue({
        workspaceId: 'workspace-1',
        userId: 'user-admin',
        role: 'ADMIN'
      });
      repo.findWorkspaceBillingConnectInfo.mockResolvedValue(
        makeWorkspace({ connectAccountId: 'acct_existing' })
      );
      (stripe.accounts.retrieve as ReturnType<typeof vi.fn>).mockResolvedValue(makeConnectAccount());

      const status = await service.getConnectAccountStatus('workspace-1', 'user-admin');

      expect(status.stripeAccountId).toBe('acct_existing');
    });

    it('blocks connect account status for workspace member', async () => {
      repo.findWorkspaceMembership.mockResolvedValue({
        workspaceId: 'workspace-1',
        userId: 'user-member',
        role: 'MEMBER'
      });

      await expect(service.getConnectAccountStatus('workspace-1', 'user-member')).rejects.toMatchObject({
        statusCode: 403
      });
      expect(stripe.accounts.retrieve).not.toHaveBeenCalled();
    });
  });

  describe('client billing isolation', () => {
    it('lists only payment orders for the customers linked to a CLIENT membership', async () => {
      repo.findWorkspaceMembership.mockResolvedValue({
        workspaceId: 'workspace-1',
        userId: 'user-client',
        role: 'CLIENT'
      });
      repo.findCustomerIdsForUser.mockResolvedValue(['customer-1', 'customer-2']);
      repo.listConnectPaymentOrdersByWorkspace.mockResolvedValue([]);

      await service.listConnectPaymentOrders('workspace-1', 'user-client', 30);

      expect(repo.listConnectPaymentOrdersByWorkspace).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'workspace-1',
          pageSize: 30,
          customerIds: ['customer-1', 'customer-2']
        })
      );
    });

    it('rejects CLIENT billing access when no customer link exists', async () => {
      repo.findWorkspaceMembership.mockResolvedValue({
        workspaceId: 'workspace-1',
        userId: 'user-client',
        role: 'CLIENT'
      });
      repo.findCustomerIdsForUser.mockResolvedValue([]);

      await expect(service.listConnectPaymentOrders('workspace-1', 'user-client', 30)).rejects.toMatchObject({
        statusCode: 403
      });
      expect(repo.listConnectPaymentOrdersByWorkspace).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhook', () => {
    it('fails explicitly when webhook secret is absent', async () => {
      const missingSecretService = new BillingService({
        repo,
        stripe: stripe as any,
        appPublicUrl: APP_URL,
        webhookSecret: '',
        webhookSecretConfigured: false,
        priceIds: {
          PERSONAL: 'price_personal',
          BUSINESS: 'price_business'
        }
      });

      await expect(missingSecretService.handleWebhook(Buffer.from('{}'), 'sig')).rejects.toMatchObject({
        statusCode: 503,
        details: {
          code: 'STRIPE_WEBHOOK_SECRET_MISSING',
          missingEnv: ['STRIPE_WEBHOOK_SECRET']
        }
      });
      expect(stripe.webhooks.constructEvent).not.toHaveBeenCalled();
    });

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
        metadata: { userId: 'user-1', planCode: 'PERSONAL' },
        items: { data: [{ price: { unit_amount: 2900 } }] }
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

  describe('runtime env and redaction', () => {
    it('lists production Stripe envs required by platform billing and secure portal links', () => {
      expect(listMissingStripeBillingProductionEnv({
        nodeEnv: 'production',
        stripeSecretKey: '',
        stripePublicKey: '',
        stripeWebhookSecret: undefined,
        billingPortalTokenSecret: null,
        priceIds: {
          PERSONAL: '',
          BUSINESS: 'price_business'
        }
      })).toEqual([
        'STRIPE_SECRET_KEY',
        'STRIPE_PUBLIC_KEY',
        'STRIPE_WEBHOOK_SECRET',
        'BILLING_PORTAL_TOKEN_SECRET',
        'STRIPE_PRICE_ID_PERSONAL_MONTHLY'
      ]);
    });

    it('redacts Stripe secrets and raw billing portal tokens from diagnostic text and metadata', () => {
      expect(redactBillingSecretValue(
        'failed sk_live_123456789 webhook whsec_123456789 url=https://app.test/portal/billing?token=raw-token'
      )).not.toContain('sk_live_123456789');
      expect(redactBillingSecretValue(
        'failed sk_live_123456789 webhook whsec_123456789 url=https://app.test/portal/billing?token=raw-token'
      )).not.toContain('raw-token');

      expect(redactBillingMetadata({
        clientPortalUrl: 'https://app.test/portal/billing?token=raw-token',
        harmless: 'price_123'
      })).toEqual({
        clientPortalUrl: '[REDACTED]',
        harmless: 'price_123'
      });
    });
  });
});
