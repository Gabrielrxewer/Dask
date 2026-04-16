import { type PrismaClient } from '@prisma/client';
import type {
  AuthorizationService,
  Permission,
  PermissionContext
} from '@/modules/identity/domain/authorization';
import { resolvePermissionsForMembership, type PermissionOverrides } from '@/modules/identity/domain/permissions';

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
      select: { role: true, permissions: true }
    });

    if (!membership) {
      return false;
    }

    const overrides =
      membership.permissions && typeof membership.permissions === 'object'
        ? (membership.permissions as Partial<PermissionOverrides>)
        : null;
    const effectivePermissions = resolvePermissionsForMembership(membership.role, overrides);
    return effectivePermissions.includes(permission);
  }
}
