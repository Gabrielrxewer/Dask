import type { PrismaClient } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '@/core/errors/app-error';
import type { AuthorizationService, Permission } from '@/modules/identity/domain/authorization';
import { resolveWorkspaceAccessPolicy, type WorkspaceModuleKey } from '@/modules/identity/domain/access-policy';

type WorkspaceMembershipRole = 'CLIENT' | 'VIEWER' | 'MEMBER' | 'ADMIN' | 'OWNER';

const roleRank: Record<WorkspaceMembershipRole, number> = {
  CLIENT: 0,
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
          permissions: true,
          workspace: {
            select: {
              id: true,
              key: true,
              name: true,
              organizationId: true,
              kind: true,
              config: true
            }
          }
        }
      });

      if (!membership) {
        next(new AppError('Workspace not found', 404));
        return;
      }

      const userAccess = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          hasActiveSubscription: true,
          subscriptionPlan: true
        }
      });
      if (membership.workspace.kind === 'CORPORATE') {
        const hasCorporateAccess = process.env.NODE_ENV !== 'production'
          ? true
          : userAccess?.hasActiveSubscription === true &&
            userAccess.subscriptionPlan === 'BUSINESS';
        const hasGuestCorporateAccess = membership.role !== 'OWNER';

        if (!hasCorporateAccess && !hasGuestCorporateAccess) {
          next(new AppError('Corporate workspace requires an active BUSINESS plan', 403));
          return;
        }
      }

      const policy = resolveWorkspaceAccessPolicy({
        role: membership.role,
        membershipPermissions: membership.permissions,
        workspaceConfig: membership.workspace.config,
        subscriptionPlan: userAccess?.subscriptionPlan ?? null
      });

      req.workspace = {
        id: membership.workspace.id,
        key: membership.workspace.key,
        name: membership.workspace.name,
        organizationId: membership.workspace.organizationId,
        role: membership.role,
        effectivePermissions: policy.permissions,
        allowedModules: policy.allowedModules,
        moduleEntitlements: policy.moduleEntitlements,
        allowedBoardViewKeys: policy.allowedBoardViewKeys,
        ownCardsOnly: policy.ownCardsOnly
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

      if (workspace.effectivePermissions && !workspace.effectivePermissions.includes(permission)) {
        next(new AppError('Forbidden', 403));
        return;
      }
      if (workspace.effectivePermissions) {
        next();
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

export const requireWorkspaceModule = (moduleKey: WorkspaceModuleKey) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.workspace) {
      next(new AppError('Workspace context missing', 500));
      return;
    }

    if (!req.workspace.allowedModules?.includes(moduleKey)) {
      next(new AppError(`Module '${moduleKey}' is not available for this member or plan`, 403));
      return;
    }

    next();
  };
};
