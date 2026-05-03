import { describe, expect, it, vi } from 'vitest';
import { MembershipRole } from '@prisma/client';
import { WorkspaceWorkItemsService } from '@/modules/workspace-platform/application/workspace-work-items-service';

function makeService() {
  const prisma = {
    workspaceMembership: {
      findFirst: vi.fn().mockResolvedValue({ role: MembershipRole.CLIENT })
    },
    workspaceCustomerUser: {
      findMany: vi.fn().mockResolvedValue([{ customerId: 'customer-1' }])
    },
    item: {
      findMany: vi.fn().mockResolvedValue([])
    }
  };
  const configService = {
    ensureReadableWorkspace: vi.fn().mockResolvedValue({
      role: MembershipRole.CLIENT,
      isClient: true,
      customerIds: ['customer-1'],
      ownCardsOnly: true,
      allowedModules: ['board', 'documentation', 'billing', 'fiscal'],
      moduleEntitlements: {},
      allowedBoardViewKeys: null,
      workspace: { id: 'workspace-1', name: 'Workspace', key: 'workspace', kind: 'CORPORATE' }
    })
  };

  const service = new WorkspaceWorkItemsService(
    prisma as never,
    configService as never,
    { publish: vi.fn(), publishInTransaction: vi.fn() } as never
  );

  return { service, prisma };
}

describe('WorkspaceWorkItemsService client isolation', () => {
  it('filters listed work items by the customers linked to the client user', async () => {
    const { service, prisma } = makeService();

    await service.listWorkItems({ workspaceId: 'workspace-1', userId: 'user-client' });

    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'workspace-1',
          AND: [
            expect.objectContaining({
              OR: expect.arrayContaining([
                { fields: { path: ['customerId'], equals: 'customer-1' } },
                { metadata: { path: ['customerId'], equals: 'customer-1' } },
                expect.objectContaining({
                  customFieldValues: expect.objectContaining({
                    some: expect.objectContaining({
                      field: { slug: 'customerId' }
                    })
                  })
                })
              ])
            })
          ]
        })
      })
    );
  });
});
