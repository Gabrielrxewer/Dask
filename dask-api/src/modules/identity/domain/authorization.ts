import type { Permission } from '@/modules/identity/domain/permissions';
export type { Permission } from '@/modules/identity/domain/permissions';

export type PermissionContext = {
  organizationId?: string;
  workspaceId?: string;
  boardId?: string;
  itemId?: string;
};

export interface AuthorizationService {
  can(userId: string, permission: Permission, context: PermissionContext): Promise<boolean>;
}
