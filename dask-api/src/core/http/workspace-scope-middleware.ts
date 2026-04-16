import type { PrismaClient } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '@/core/errors/app-error';
import type { AuthorizationService, Permission } from '@/modules/identity/domain/authorization';

type WorkspaceMembershipRole = 'VIEWER' | 'MEMBER' | 'ADMIN' | 'OWNER';

const roleRank: Record<WorkspaceMembershipRole, number> = {
  VIEWER: 1,
  MEMBER: 2,
  ADMIN: 3,
  OWNER: 4
};

export const workspaceScopeMiddleware = (prisma: PrismaClient) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        next(new AppError('Unauthorized', 401));
        return;
      }

      const workspaceId = req.params.workspaceId;
      if (!workspaceId) {
        next(new AppError('workspaceId route param is required', 400));
        return;
      }

      const membership = await prisma.workspaceMembership.findFirst({
        where: {
          workspaceId,
          userId
        },
        select: {
          role: true,
          workspace: {
            select: {
              id: true,
              key: true,
              name: true,
              organizationId: true,
              kind: true
            }
          }
        }
      });

      if (!membership) {
        next(new AppError('Workspace not found', 404));
        return;
      }

      if (membership.workspace.kind === 'CORPORATE') {
        const userAccess = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            hasActiveSubscription: true,
            subscriptionPlan: true
          }
        });
        const hasCorporateAccess = process.env.NODE_ENV !== 'production'
          ? true
          : userAccess?.hasActiveSubscription === true &&
            userAccess.subscriptionPlan === 'BUSINESS';

        if (!hasCorporateAccess) {
          next(new AppError('Corporate workspace requires an active BUSINESS plan', 403));
          return;
        }
      }

      req.workspace = {
        ...membership.workspace,
        role: membership.role
      };

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const requireWorkspaceRole = (minimumRole: WorkspaceMembershipRole) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.workspace) {
      next(new AppError('Workspace context missing', 500));
      return;
    }

    if (roleRank[req.workspace.role] < roleRank[minimumRole]) {
      next(new AppError('Forbidden', 403));
      return;
    }

    next();
  };
};

export const requireWorkspacePermission = (
  authorizationService: AuthorizationService,
  permission: Permission
) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.auth?.userId;
      const workspace = req.workspace;

      if (!userId) {
        next(new AppError('Unauthorized', 401));
        return;
      }

      if (!workspace) {
        next(new AppError('Workspace context missing', 500));
        return;
      }

      const allowed = await authorizationService.can(userId, permission, {
        workspaceId: workspace.id,
        organizationId: workspace.organizationId ?? undefined
      });

      if (!allowed) {
        next(new AppError('Forbidden', 403));
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
