import type { MembershipRole } from '@prisma/client';

export type AuthUserContext = {
  userId: string;
  email: string;
  roles: MembershipRole[];
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthUserContext;
    }
  }
}
