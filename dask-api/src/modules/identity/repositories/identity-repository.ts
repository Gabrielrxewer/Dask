import type { MembershipRole, Organization, User } from '@prisma/client';

export interface IdentityRepository {
  createUser(input: { email: string; name: string; passwordHash: string }): Promise<User>;
  findUserByEmail(email: string): Promise<User | null>;
  createOrganization(input: {
    name: string;
    slug: string;
    ownerUserId: string;
    settings?: Record<string, unknown>;
  }): Promise<Organization>;
  getUserRoles(userId: string): Promise<MembershipRole[]>;
}
