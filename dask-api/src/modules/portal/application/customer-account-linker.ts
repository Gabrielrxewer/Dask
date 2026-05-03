import type { PrismaClient } from '@prisma/client';
import { logger } from '@/core/logging/logger';
import { normalizeEmail } from '@/modules/identity/domain/password-policy';

export class CustomerAccountLinker {
  public constructor(private readonly prisma: PrismaClient) {}

  public async linkExistingCustomersByEmail(input: {
    userId: string;
    userEmail: string;
    createdBy?: string | null;
  }): Promise<{ linkedCustomers: number; linkedWorkspaces: number }> {
    const email = normalizeEmail(input.userEmail);
    if (!email) {
      return { linkedCustomers: 0, linkedWorkspaces: 0 };
    }

    const customers = await this.prisma.customer.findMany({
      where: {
        email: { equals: email, mode: 'insensitive' }
      },
      select: {
        id: true,
        workspaceId: true
      }
    });

    const workspaceIds = Array.from(new Set(customers.map((customer) => customer.workspaceId)));

    await this.prisma.$transaction(async (tx) => {
      for (const workspaceId of workspaceIds) {
        const existingMembership = await tx.workspaceMembership.findUnique({
          where: { workspaceId_userId: { workspaceId, userId: input.userId } },
          select: { id: true }
        });

        if (!existingMembership) {
          await tx.workspaceMembership.create({
            data: {
              workspaceId,
              userId: input.userId,
              role: 'CLIENT'
            }
          });
        }
      }

      for (const customer of customers) {
        await (tx as any).workspaceCustomerUser.upsert({
          where: {
            workspaceId_customerId_userId: {
              workspaceId: customer.workspaceId,
              customerId: customer.id,
              userId: input.userId
            }
          },
          create: {
            workspaceId: customer.workspaceId,
            customerId: customer.id,
            userId: input.userId,
            createdBy: input.createdBy ?? null
          },
          update: {}
        });
      }
    });

    if (customers.length > 0) {
      logger.info({
        event: 'portal.customer_account_linked_by_email',
        userId: input.userId,
        linkedCustomers: customers.length,
        linkedWorkspaces: workspaceIds.length
      });
    }

    return {
      linkedCustomers: customers.length,
      linkedWorkspaces: workspaceIds.length
    };
  }
}
