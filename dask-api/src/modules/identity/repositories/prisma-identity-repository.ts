import {
  MembershipRole,
  Prisma,
  type Organization,
  type PrismaClient,
  type User
} from '@prisma/client';
import type { IdentityRepository } from '@/modules/identity/repositories/identity-repository';

export class PrismaIdentityRepository implements IdentityRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public createUser(input: { email: string; name: string; passwordHash: string }): Promise<User> {
    return this.prisma.user.create({
      data: input
    });
  }

  public findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  public async createOrganization(input: {
    name: string;
    slug: string;
    ownerUserId: string;
    settings?: Record<string, unknown>;
  }): Promise<Organization> {
    return this.prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name: input.name,
          slug: input.slug,
          settings: input.settings as Prisma.InputJsonValue | undefined
        }
      });

      await tx.organizationMembership.create({
        data: {
          organizationId: organization.id,
          userId: input.ownerUserId,
          role: MembershipRole.OWNER
        }
      });

      return organization;
    });
  }

  public async getUserRoles(userId: string): Promise<MembershipRole[]> {
    const orgMemberships = await this.prisma.organizationMembership.findMany({
      where: { userId },
      select: { role: true }
    });
    return orgMemberships.map((membership) => membership.role);
  }
}
