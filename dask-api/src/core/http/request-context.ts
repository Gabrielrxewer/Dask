import type { MembershipRole } from '@prisma/client';

export type AuthUserContext = {
  userId: string;
  email: string;
  roles: MembershipRole[];
};

export type WorkspaceRequestContext = {
  id: string;
  key: string;
  name: string;
  organizationId: string | null;
  role: MembershipRole;
};

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthUserContext;
    workspace?: WorkspaceRequestContext;
  }
}
