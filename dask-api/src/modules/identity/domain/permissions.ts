import type { MembershipRole } from '@prisma/client';

export const permissionCatalog = [
  'workspace.read',
  'workspace.manage',
  'workspace.delete',
  'member.read',
  'member.invite',
  'member.update_role',
  'member.remove',
  'role.read',
  'role.manage',
  'permission.manage',
  'project.read',
  'project.create',
  'project.update',
  'project.delete',
  'board.read',
  'board.configure',
  'item.read',
  'item.create',
  'item.update',
  'item.delete',
  'item.transition',
  'comment.read',
  'comment.create',
  'comment.delete',
  'file.read',
  'file.upload',
  'file.delete',
  'automation.read',
  'automation.create',
  'automation.update',
  'automation.delete',
  'automation.run',
  'integration.read',
  'integration.manage',
  'billing.read',
  'billing.manage',
  'fiscal.read',
  'fiscal.issue',
  'fiscal.config',
  'audit.read',
  'ai.use',
  'ai.configure',
  // Compat aliases for existing route guards.
  'workspace.write',
  'board.write',
  'item.write'
] as const;

export type Permission = (typeof permissionCatalog)[number];

export type RoleTemplate = MembershipRole | 'MANAGER' | 'GUEST';

export type PermissionOverrides = {
  allow: Permission[];
  deny: Permission[];
};

const allPermissions = [...permissionCatalog];
const withoutCriticalWorkspaceDelete = allPermissions.filter((permission) => permission !== 'workspace.delete');

export const rolePermissionPresets: Record<RoleTemplate, Permission[]> = {
  OWNER: allPermissions,
  ADMIN: withoutCriticalWorkspaceDelete,
  MANAGER: [
    'workspace.read',
    'member.read',
    'member.invite',
    'project.read',
    'project.create',
    'project.update',
    'project.delete',
    'board.read',
    'board.configure',
    'item.read',
    'item.create',
    'item.update',
    'item.delete',
    'item.transition',
    'comment.read',
    'comment.create',
    'comment.delete',
    'file.read',
    'file.upload',
    'file.delete',
    'automation.read',
    'automation.create',
    'automation.update',
    'automation.delete',
    'automation.run',
    'integration.read',
    'fiscal.read',
    'fiscal.issue',
    'audit.read',
    'ai.use',
    'ai.configure',
    'workspace.write',
    'board.write',
    'item.write'
  ],
  MEMBER: [
    'workspace.read',
    'member.read',
    'project.read',
    'board.read',
    'item.read',
    'item.create',
    'item.update',
    'item.transition',
    'comment.read',
    'comment.create',
    'file.read',
    'file.upload',
    'automation.read',
    'automation.run',
    'fiscal.read',
    'audit.read',
    'ai.use',
    'item.write'
  ],
  VIEWER: [
    'workspace.read',
    'member.read',
    'project.read',
    'board.read',
    'item.read',
    'comment.read',
    'file.read',
    'automation.read',
    'fiscal.read',
    'audit.read'
  ],
  GUEST: [
    'project.read',
    'board.read',
    'item.read',
    'comment.read',
    'file.read'
  ]
};

export function isPermission(value: string): value is Permission {
  return permissionCatalog.includes(value as Permission);
}

export function resolvePermissionsForMembership(
  role: MembershipRole,
  overrides?: Partial<PermissionOverrides> | null
): Permission[] {
  const effective = new Set<Permission>(rolePermissionPresets[role] ?? []);

  for (const permission of overrides?.allow ?? []) {
    if (isPermission(permission)) {
      effective.add(permission);
    }
  }

  for (const permission of overrides?.deny ?? []) {
    if (isPermission(permission)) {
      effective.delete(permission);
    }
  }

  return Array.from(effective);
}
