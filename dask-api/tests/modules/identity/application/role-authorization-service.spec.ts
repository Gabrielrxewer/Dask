import { MembershipRole } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { RoleAuthorizationService } from '@/modules/identity/application/role-authorization-service';
import type { Permission } from '@/modules/identity/domain/authorization';

function makeService(input: {
  role?: MembershipRole;
  permissions?: Record<string, unknown> | null;
  workspaceConfig?: Record<string, unknown> | null;
  subscriptionPlan?: string | null;
  missingMembership?: boolean;
} = {}) {
  const prisma = {
    workspaceMembership: {
      findFirst: vi.fn().mockResolvedValue(input.missingMembership
        ? null
        : {
            role: input.role ?? MembershipRole.MEMBER,
            permissions: input.permissions ?? {},
            workspace: {
              config: input.workspaceConfig ?? {}
            }
          })
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ subscriptionPlan: input.subscriptionPlan ?? 'BUSINESS' })
    }
  };

  return {
    service: new RoleAuthorizationService(prisma as never),
    prisma
  };
}

async function can(role: MembershipRole, permission: Permission, permissions?: Record<string, unknown> | null) {
  const { service } = makeService({ role, permissions });
  return service.can('user-1', permission, { workspaceId: 'workspace-1' });
}

describe('RoleAuthorizationService', () => {
  it('lets owners exercise owner-only permissions', async () => {
    await expect(can(MembershipRole.OWNER, 'workspace.delete')).resolves.toBe(true);
  });

  it('lets admins manage operational modules but not delete workspaces', async () => {
    await expect(can(MembershipRole.ADMIN, 'billing.manage')).resolves.toBe(true);
    await expect(can(MembershipRole.ADMIN, 'workspace.delete')).resolves.toBe(false);
  });

  it('keeps member access narrower and honors explicit allow/deny overrides', async () => {
    await expect(can(MembershipRole.MEMBER, 'item.update')).resolves.toBe(true);
    await expect(can(MembershipRole.MEMBER, 'billing.manage')).resolves.toBe(false);
    await expect(can(MembershipRole.MEMBER, 'billing.manage', { allow: ['billing.manage'] })).resolves.toBe(true);
    await expect(can(MembershipRole.MEMBER, 'item.update', { deny: ['item.update'] })).resolves.toBe(false);
  });

  it('denies access across workspace boundaries when no membership exists', async () => {
    const { service, prisma } = makeService({ missingMembership: true });

    await expect(service.can('user-1', 'item.read', { workspaceId: 'workspace-2' })).resolves.toBe(false);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('does not consult workspace membership for global permissions without a workspace context', async () => {
    const { service, prisma } = makeService({ missingMembership: true });

    await expect(service.can('user-1', 'audit.read', {})).resolves.toBe(true);
    expect(prisma.workspaceMembership.findFirst).not.toHaveBeenCalled();
  });
});
