import type { MembershipRole } from '@prisma/client';
import type { Permission } from '@/modules/identity/domain/authorization';
import type { WorkspaceModuleKey } from '@/modules/identity/domain/access-policy';

export type AuthUserContext = {
  userId: string;
  email: string;
  roles: MembershipRole[];
  isPlatformAdmin: boolean;
};

export type WorkspaceRequestContext = {
  id: string;
  key: string;
  name: string;
  organizationId: string | null;
  role: MembershipRole;
  effectivePermissions?: Permission[];
  allowedModules?: WorkspaceModuleKey[];
  moduleEntitlements?: Partial<Record<WorkspaceModuleKey, boolean>>;
  allowedBoardViewKeys?: string[] | null;
  ownCardsOnly?: boolean;
};

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthUserContext;
    workspace?: WorkspaceRequestContext;
  }
}
