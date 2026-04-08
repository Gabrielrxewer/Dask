export type Permission =
  | 'workspace.read'
  | 'workspace.write'
  | 'board.read'
  | 'board.write'
  | 'item.read'
  | 'item.write'
  | 'ai.use';

export type PermissionContext = {
  organizationId?: string;
  workspaceId?: string;
  boardId?: string;
  itemId?: string;
};

export interface AuthorizationService {
  can(userId: string, permission: Permission, context: PermissionContext): Promise<boolean>;
}
