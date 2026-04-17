import { type PrismaClient } from '@prisma/client';
import type {
  AuthorizationService,
  Permission,
  PermissionContext
} from '@/modules/identity/domain/authorization';
import { resolveWorkspaceAccessPolicy } from '@/modules/identity/domain/access-policy';

export class RoleAuthorizationService implements AuthorizationService {
  public constructor(private readonly prisma: PrismaClient) {}

  public async can(userId: string, permission: Permission, context: PermissionContext): Promise<boolean> {
    if (!context.workspaceId) {
      return true;
    }

    const membership = await this.prisma.workspaceMembership.findFirst({
      where: {
        workspaceId: context.workspaceId,
        userId
      },
      select: {
        role: true,
        permissions: true,
        workspace: {
          select: {
            config: true
          }
        }
      }
    });

    if (!membership) {
      return false;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionPlan: true }
    });

    const policy = resolveWorkspaceAccessPolicy({
      role: membership.role,
      membershipPermissions: membership.permissions,
      workspaceConfig: membership.workspace.config,
      subscriptionPlan: user?.subscriptionPlan ?? null
    });

    return policy.permissions.includes(permission);
  }
}
