import { MembershipRole, type Prisma, type PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';

export type CustomerAccessScope = {
  role: MembershipRole;
  isClient: boolean;
  customerIds: string[];
};

export async function resolveCustomerAccessScope(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: { workspaceId: string; userId: string }
): Promise<CustomerAccessScope> {
  const membership = await prisma.workspaceMembership.findFirst({
    where: {
      workspaceId: input.workspaceId,
      userId: input.userId
    },
    select: {
      role: true
    }
  });

  if (!membership) {
    throw new AppError('Workspace not found', 404);
  }

  const isClient = membership.role === MembershipRole.CLIENT;
  if (!isClient) {
    return {
      role: membership.role,
      isClient: false,
      customerIds: []
    };
  }

  const links = await prisma.workspaceCustomerUser.findMany({
    where: {
      workspaceId: input.workspaceId,
      userId: input.userId
    },
    select: {
      customerId: true
    }
  });

  return {
    role: membership.role,
    isClient: true,
    customerIds: links.map((link) => link.customerId)
  };
}

export function requireClientCustomerScope(scope: CustomerAccessScope): string[] {
  if (!scope.isClient) {
    return [];
  }

  if (scope.customerIds.length === 0) {
    throw new AppError('Customer access is not linked to this workspace', 403);
  }

  return scope.customerIds;
}

