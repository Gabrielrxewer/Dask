import type { NextFunction, Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import { isSubscriptionActive } from '@/modules/billing/domain/types';
import type { SubscriptionStatus } from '@/modules/billing/domain/types';

/**
 * Requires the authenticated user to have an active Stripe subscription.
 * Must be applied after authMiddleware.
 */
export function createSubscriptionMiddleware(prisma: PrismaClient) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const userId = req.auth?.userId;
    if (!userId) {
      next(new AppError('Authentication required', 401));
      return;
    }

    // NOTE: `hasActiveSubscription` and `subscriptionStatus` are added by the billing migration.
    // Run `prisma migrate dev` and `prisma generate` before using this middleware.
    const user = await (prisma.user.findUnique as Function)({
      where: { id: userId },
      select: { hasActiveSubscription: true, subscriptionStatus: true }
    }) as { hasActiveSubscription: boolean; subscriptionStatus: string | null } | null;

    if (!user) {
      next(new AppError('User not found', 404));
      return;
    }

    if (!isSubscriptionActive(user.subscriptionStatus as SubscriptionStatus | null)) {
      next(
        new AppError(
          'Subscription required. Choose a plan to access this resource.',
          402,
          { code: 'SUBSCRIPTION_REQUIRED', status: user.subscriptionStatus ?? 'NONE' }
        )
      );
      return;
    }

    next();
  };
}
