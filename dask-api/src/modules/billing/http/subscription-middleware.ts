import type { NextFunction, Request, Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import { isSubscriptionActive } from '@/modules/billing/domain/types';
import type { SubscriptionStatus } from '@/modules/billing/domain/types';

function readWorkspaceIdFromRequest(req: Request): string | null {
  const pathMatch = req.path.match(/\/workspaces\/([0-9a-f-]{36})(?:\/|$)/i);
  if (pathMatch) {
    return pathMatch[1];
  }

  const queryWorkspaceId = req.query.workspaceId;
  if (typeof queryWorkspaceId === 'string' && queryWorkspaceId.trim().length > 0) {
    return queryWorkspaceId.trim();
  }

  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    const bodyWorkspaceId = (req.body as { workspaceId?: unknown }).workspaceId;
    if (typeof bodyWorkspaceId === 'string' && bodyWorkspaceId.trim().length > 0) {
      return bodyWorkspaceId.trim();
    }
  }

  return null;
}

async function hasGuestWorkspaceMembership(prisma: PrismaClient, userId: string): Promise<boolean> {
  const membership = await prisma.workspaceMembership.findFirst({
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

async function canAccessWorkspaceWithoutSubscription(
  prisma: PrismaClient,
  userId: string,
  workspaceId: string
): Promise<boolean> {
  const membership = await prisma.workspaceMembership.findFirst({
    where: {
      workspaceId,
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

    if (process.env.NODE_ENV !== 'production') {
      next();
      return;
    }

    // NOTE: `hasActiveSubscription` and `subscriptionStatus` are added by the billing migration.
    // Run `prisma migrate dev` and `prisma generate` before using this middleware.
    type FindUserWithSubscription = (args: {
      where: { id: string };
      select: { hasActiveSubscription: true; subscriptionStatus: true };
    }) => Promise<{ hasActiveSubscription: boolean; subscriptionStatus: string | null } | null>;
    const findUserWithSubscription = prisma.user.findUnique as unknown as FindUserWithSubscription;

    const user = await findUserWithSubscription({
      where: { id: userId },
      select: { hasActiveSubscription: true, subscriptionStatus: true }
    });

    if (!user) {
      next(new AppError('User not found', 404));
      return;
    }

    if (!isSubscriptionActive(user.subscriptionStatus as SubscriptionStatus | null)) {
      if (req.method === 'GET' && req.path === '/workspaces' && await hasGuestWorkspaceMembership(prisma, userId)) {
        next();
        return;
      }

      const workspaceId = readWorkspaceIdFromRequest(req);
      if (workspaceId && await canAccessWorkspaceWithoutSubscription(prisma, userId, workspaceId)) {
        next();
        return;
      }

      next(
        new AppError('Subscription required. Choose a plan to access this resource.', 402, {
          code: 'SUBSCRIPTION_REQUIRED',
          status: user.subscriptionStatus ?? 'NONE'
        })
      );
      return;
    }

    next();
  };
}
