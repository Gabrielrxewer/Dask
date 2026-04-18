// NOTE: New Prisma fields (subscription, stripeCustomerId, etc.) require
// `prisma migrate dev && prisma generate` before TypeScript recognizes them.
// Until then, we use type assertions for new schema additions.
/* eslint-disable @typescript-eslint/no-explicit-any */

import type { PrismaClient } from '@prisma/client';
import type { SubscriptionStatus } from '../domain/types';
import type {
  BillingRepository,
  BillingUser,
  CreateSubscriptionInput,
  Subscription,
  UpdateSubscriptionInput
} from './billing-repository';
import { isSubscriptionActive } from '../domain/types';

export class PrismaBillingRepository implements BillingRepository {
  constructor(private readonly prisma: PrismaClient) {}

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

  async upsertStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void> {
    await (this.prisma.user as any).update({
      where: { id: userId },
      data: { stripeCustomerId }
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
