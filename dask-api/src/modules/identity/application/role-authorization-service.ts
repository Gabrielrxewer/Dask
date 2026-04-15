import type { MembershipRole} from '@prisma/client';
import { type PrismaClient } from '@prisma/client';
import type {
  AuthorizationService,
  Permission,
  PermissionContext
} from '@/modules/identity/domain/authorization';

const rolePermissions: Record<MembershipRole, Permission[]> = {
  OWNER: ['workspace.read', 'workspace.write', 'board.read', 'board.write', 'item.read', 'item.write', 'ai.use'],
  ADMIN: ['workspace.read', 'workspace.write', 'board.read', 'board.write', 'item.read', 'item.write', 'ai.use'],
  MEMBER: ['workspace.read', 'board.read', 'item.read', 'item.write', 'ai.use'],
  VIEWER: ['workspace.read', 'board.read', 'item.read']
};

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
      select: { role: true }
    });

    if (!membership) {
      return false;
    }

    return rolePermissions[membership.role].includes(permission);
  }
}
