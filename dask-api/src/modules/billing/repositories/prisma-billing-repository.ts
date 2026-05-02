// NOTE: New Prisma fields (subscription, stripeCustomerId, etc.) require
// `prisma migrate dev && prisma generate` before TypeScript recognizes them.
// Until then, we use type assertions for new schema additions.
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { PrismaClient } from '@prisma/client';
import type { SubscriptionStatus } from '../domain/types';
import type {
  BillingRepository,
  BillingCustomerSnapshot,
  BillingUser,
  ConnectCatalogItem,
  ConnectPaymentOrder,
  CreateConnectCatalogItemInput,
  CreateConnectPaymentOrderInput,
  CreateSubscriptionInput,
  Subscription,
  UpdateConnectCatalogItemInput,
  UpdateConnectPaymentOrderInput,
  UpdateSubscriptionInput,
  WorkspaceBillingConnectInfo,
  WorkspaceMembership
} from './billing-repository';
import { isSubscriptionActive } from '../domain/types';

export class PrismaBillingRepository implements BillingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private extractConnectAccountId(config: unknown): string | null {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      return null;
    }

    const billing = (config as { billing?: unknown }).billing;
    if (!billing || typeof billing !== 'object' || Array.isArray(billing)) {
      return null;
    }

    const connect = (billing as { connect?: unknown }).connect;
    if (!connect || typeof connect !== 'object' || Array.isArray(connect)) {
      return null;
    }

    const accountId = (connect as { accountId?: unknown }).accountId;
    return typeof accountId === 'string' && accountId.trim().length > 0 ? accountId : null;
  }

  findUserById(userId: string): Promise<BillingUser | null> {
    return (this.prisma.user as any).findUnique({ where: { id: userId } });
  }

  findUserByStripeCustomerId(customerId: string): Promise<BillingUser | null> {
    return (this.prisma.user as any).findUnique({ where: { stripeCustomerId: customerId } });
  }

  findSubscriptionByStripeId(stripeSubscriptionId: string): Promise<Subscription | null> {
    return (this.prisma as any).subscription.findUnique({ where: { stripeSubscriptionId } });
  }

  findActiveSubscriptionByUserId(userId: string): Promise<Subscription | null> {
    return (this.prisma as any).subscription.findFirst({
      where: {
        userId,
        status: { in: ['ACTIVE', 'TRIALING'] as SubscriptionStatus[] }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  findLatestSubscriptionByUserId(userId: string): Promise<Subscription | null> {
    return (this.prisma as any).subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async hasGuestWorkspaceMembership(userId: string): Promise<boolean> {
    const membership = await this.prisma.workspaceMembership.findFirst({
      where: {
        userId,
        role: {
          not: 'OWNER'
        }
      },
      select: {
        workspaceId: true
      }
    });

    return Boolean(membership);
  }

  async findWorkspaceMembership(
    workspaceId: string,
    userId: string
  ): Promise<WorkspaceMembership | null> {
    return this.prisma.workspaceMembership.findFirst({
      where: { workspaceId, userId },
      select: {
        workspaceId: true,
        userId: true,
        role: true
      }
    });
  }

  async findWorkspaceBillingConnectInfo(workspaceId: string): Promise<WorkspaceBillingConnectInfo | null> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        config: true
      }
    });
    if (!workspace) {
      return null;
    }

    return {
      id: workspace.id,
      name: workspace.name,
      connectAccountId: this.extractConnectAccountId(workspace.config)
    };
  }

  async findCustomerById(workspaceId: string, customerId: string): Promise<BillingCustomerSnapshot | null> {
    return (this.prisma.customer as any).findFirst({
      where: { id: customerId, workspaceId },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        tradeName: true,
        legalName: true,
        document: true,
        stateRegistration: true,
        municipalRegistration: true,
        taxRegime: true,
        email: true,
        phone: true,
        address: true
      }
    });
  }

  findConnectCatalogItemById(itemId: string): Promise<ConnectCatalogItem | null> {
    return (this.prisma as any).connectCatalogItem.findUnique({ where: { id: itemId } });
  }

  listConnectCatalogItemsByWorkspace(
    workspaceId: string,
    includeInactive = false
  ): Promise<ConnectCatalogItem[]> {
    return (this.prisma as any).connectCatalogItem.findMany({
      where: includeInactive ? { workspaceId } : { workspaceId, isActive: true },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }]
    });
  }

  async upsertStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void> {
    await (this.prisma.user as any).update({
      where: { id: userId },
      data: { stripeCustomerId }
    });
  }

  async upsertWorkspaceConnectAccountId(
    workspaceId: string,
    stripeConnectAccountId: string
  ): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { config: true }
    });
    if (!workspace) {
      return;
    }

    const currentConfig =
      workspace.config && typeof workspace.config === 'object' && !Array.isArray(workspace.config)
        ? (workspace.config as Record<string, unknown>)
        : {};
    const billing =
      currentConfig.billing && typeof currentConfig.billing === 'object' && !Array.isArray(currentConfig.billing)
        ? (currentConfig.billing as Record<string, unknown>)
        : {};
    const connect =
      billing.connect && typeof billing.connect === 'object' && !Array.isArray(billing.connect)
        ? (billing.connect as Record<string, unknown>)
        : {};

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        config: {
          ...currentConfig,
          billing: {
            ...billing,
            connect: {
              ...connect,
              accountId: stripeConnectAccountId,
              updatedAt: new Date().toISOString()
            }
          }
        } as any
      }
    });
  }

  findConnectPaymentOrderById(orderId: string): Promise<ConnectPaymentOrder | null> {
    return (this.prisma as any).connectPaymentOrder.findUnique({ where: { id: orderId } });
  }

  findConnectPaymentOrderByCheckoutSessionId(sessionId: string): Promise<ConnectPaymentOrder | null> {
    return (this.prisma as any).connectPaymentOrder.findUnique({ where: { stripeCheckoutSessionId: sessionId } });
  }

  findConnectPaymentOrderByPaymentIntentId(paymentIntentId: string): Promise<ConnectPaymentOrder | null> {
    return (this.prisma as any).connectPaymentOrder.findUnique({ where: { stripePaymentIntentId: paymentIntentId } });
  }

  listConnectPaymentOrdersByWorkspace(workspaceId: string, limit: number): Promise<ConnectPaymentOrder[]> {
    return (this.prisma as any).connectPaymentOrder.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  createConnectPaymentOrder(input: CreateConnectPaymentOrderInput): Promise<ConnectPaymentOrder> {
    return (this.prisma as any).connectPaymentOrder.create({
      data: {
        workspaceId: input.workspaceId,
        createdByUserId: input.createdByUserId,
        stripeConnectAccountId: input.stripeConnectAccountId,
        amount: input.amount,
        currency: input.currency,
        description: input.description,
        customerId: input.customerId,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerDocument: input.customerDocument,
        customerPhone: input.customerPhone,
        customerAddress: input.customerAddress as any,
        applicationFeeAmount: input.applicationFeeAmount,
        metadata: input.metadata as any
      }
    });
  }

  createConnectCatalogItem(input: CreateConnectCatalogItemInput): Promise<ConnectCatalogItem> {
    return (this.prisma as any).connectCatalogItem.create({
      data: {
        workspaceId: input.workspaceId,
        createdByUserId: input.createdByUserId,
        kind: input.kind,
        billingType: input.billingType,
        recurringInterval: input.recurringInterval,
        recurringIntervalCount: input.recurringIntervalCount,
        name: input.name,
        description: input.description,
        amount: input.amount,
        currency: input.currency,
        stripeConnectAccountId: input.stripeConnectAccountId,
        stripeProductId: input.stripeProductId,
        stripePriceId: input.stripePriceId,
        metadata: input.metadata as any
      }
    });
  }

  updateConnectCatalogItem(itemId: string, input: UpdateConnectCatalogItemInput): Promise<ConnectCatalogItem> {
    return (this.prisma as any).connectCatalogItem.update({
      where: { id: itemId },
      data: {
        ...(typeof input.isActive === 'boolean' ? { isActive: input.isActive } : {})
      }
    });
  }

  updateConnectPaymentOrder(orderId: string, input: UpdateConnectPaymentOrderInput): Promise<ConnectPaymentOrder> {
    return (this.prisma as any).connectPaymentOrder.update({
      where: { id: orderId },
      data: {
        stripeCheckoutSessionId: input.stripeCheckoutSessionId,
        stripePaymentIntentId: input.stripePaymentIntentId,
        status: input.status,
        statusReason: input.statusReason,
        checkoutUrl: input.checkoutUrl,
        lastWebhookEvent: input.lastWebhookEvent,
        paidAt: input.paidAt,
        failedAt: input.failedAt,
        canceledAt: input.canceledAt,
        refundedAt: input.refundedAt,
        updatedAt: new Date()
      }
    });
  }

  createSubscription(input: CreateSubscriptionInput): Promise<Subscription> {
    return (this.prisma as any).subscription.create({
      data: {
        userId: input.userId,
        stripeCustomerId: input.stripeCustomerId,
        stripeSubscriptionId: input.stripeSubscriptionId,
        stripeCheckoutSessionId: input.stripeCheckoutSessionId,
        planCode: input.planCode,
        status: input.status,
        amount: input.amount,
        currentPeriodStart: input.currentPeriodStart,
        currentPeriodEnd: input.currentPeriodEnd,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? false,
        lastWebhookEvent: input.lastWebhookEvent
      }
    });
  }

  updateSubscription(stripeSubscriptionId: string, input: UpdateSubscriptionInput): Promise<Subscription> {
    return (this.prisma as any).subscription.update({
      where: { stripeSubscriptionId },
      data: {
        status: input.status,
        planCode: input.planCode,
        currentPeriodStart: input.currentPeriodStart,
        currentPeriodEnd: input.currentPeriodEnd,
        cancelAtPeriodEnd: input.cancelAtPeriodEnd,
        lastWebhookEvent: input.lastWebhookEvent,
        updatedAt: new Date()
      }
    });
  }

  async syncUserBillingFields(userId: string, subscription: Subscription): Promise<void> {
    await (this.prisma.user as any).update({
      where: { id: userId },
      data: {
        subscriptionPlan: subscription.planCode,
        subscriptionStatus: subscription.status,
        subscriptionId: subscription.stripeSubscriptionId,
        currentPeriodEnd: subscription.currentPeriodEnd,
        hasActiveSubscription: isSubscriptionActive(subscription.status as SubscriptionStatus)
      }
    });
  }

  async revokeUserAccess(userId: string): Promise<void> {
    await (this.prisma.user as any).update({
      where: { id: userId },
      data: { hasActiveSubscription: false }
    });
  }
}
