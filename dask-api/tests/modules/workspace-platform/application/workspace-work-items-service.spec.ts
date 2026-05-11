import { describe, expect, it, vi } from 'vitest';
import { MembershipRole, Prisma } from '@prisma/client';
import { WorkspaceWorkItemsService } from '@/modules/workspace-platform/application/workspace-work-items-service';
import { patchWorkItemScheduleDto } from '@/modules/workspace-platform/http/dto';

function makeService() {
  const transaction = {
    item: {
      update: vi.fn().mockResolvedValue({})
    }
  };
  const prisma = {
    $transaction: vi.fn((callback) => callback(transaction)),
    workspaceMembership: {
      findFirst: vi.fn().mockResolvedValue({ role: MembershipRole.CLIENT })
    },
    workspaceCustomerUser: {
      findMany: vi.fn().mockResolvedValue([{ customerId: 'customer-1' }])
    },
    item: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue({
        id: 'item-1',
        fields: {
          plannedStartAt: '2026-05-10T10:00:00.000Z',
          untouched: 'keep-me'
        }
      })
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
    }),
    ensureItemWritableWorkspace: vi.fn().mockResolvedValue({
      role: MembershipRole.ADMIN,
      isClient: false,
      customerIds: [],
      ownCardsOnly: false,
      allowedModules: ['board'],
      moduleEntitlements: {},
      allowedBoardViewKeys: null,
      workspace: { id: 'workspace-1', name: 'Workspace', key: 'workspace', kind: 'CORPORATE' }
    })
  };
  const publisher = {
    publish: vi.fn(),
    publishInTransaction: vi.fn()
  };

  const service = new WorkspaceWorkItemsService(
    prisma as never,
    configService as never,
    publisher as never
  );

  return { service, prisma, transaction, configService, publisher };
}

describe('WorkspaceWorkItemsService client isolation', () => {
  it('filters listed work items by the customers linked to the client user', async () => {
    const { service, prisma } = makeService();

    await service.listWorkItems({ workspaceId: 'workspace-1', userId: 'user-client' });

    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'workspace-1',
          AND: expect.arrayContaining([
            {
              metadata: {
                path: ['archivedAt'],
                equals: Prisma.AnyNull
              }
            },
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
          ])
        })
      })
    );
  });
});

describe('WorkspaceWorkItemsService schedule update', () => {
  it('updates only schedule fields and preserves the remaining work item data', async () => {
    const { service, prisma, transaction, configService } = makeService();
    const serialized = {
      id: 'item-1',
      fields: {
        untouched: 'keep-me',
        plannedStartAt: '2026-05-11T12:00:00.000Z',
        plannedEndAt: '2026-05-11T13:00:00.000Z'
      }
    };
    const serializedSpy = vi.spyOn(service as never, 'getSerializedWorkItemById').mockResolvedValue(serialized as never);
    const publishSpy = vi.spyOn(service as never, 'publishItemUpdatedEvent').mockResolvedValue(undefined as never);

    const result = await service.updateWorkItemSchedule({
      workspaceId: 'workspace-1',
      itemId: 'item-1',
      userId: 'user-admin',
      payload: {
        plannedStartAt: '2026-05-11T12:00:00.000Z',
        plannedEndAt: '2026-05-11T13:00:00.000Z',
        reason: 'agenda_drag_reschedule'
      }
    });

    expect(result).toBe(serialized);
    expect(configService.ensureItemWritableWorkspace).toHaveBeenCalledWith('workspace-1', 'user-admin');
    expect(prisma.item.findFirst).toHaveBeenCalledWith({
      where: { id: 'item-1', workspaceId: 'workspace-1' },
      select: { id: true, fields: true }
    });
    expect(transaction.item.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: {
        fields: {
          plannedStartAt: '2026-05-11T12:00:00.000Z',
          untouched: 'keep-me',
          plannedEndAt: '2026-05-11T13:00:00.000Z'
        },
        updatedBy: 'user-admin'
      }
    });
    expect(serializedSpy).toHaveBeenCalledWith('workspace-1', 'item-1', transaction);
    expect(publishSpy).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'workspace-1',
      requestedBy: 'user-admin',
      patch: {
        fields: {
          plannedStartAt: '2026-05-11T12:00:00.000Z',
          plannedEndAt: '2026-05-11T13:00:00.000Z'
        },
        reason: 'agenda_drag_reschedule'
      }
    }));
  });

  it('does not update when the user cannot edit work items', async () => {
    const { service, prisma, configService } = makeService();
    configService.ensureItemWritableWorkspace.mockRejectedValue(new Error('Forbidden'));

    await expect(service.updateWorkItemSchedule({
      workspaceId: 'workspace-1',
      itemId: 'item-1',
      userId: 'user-viewer',
      payload: {
        plannedStartAt: '2026-05-11T12:00:00.000Z'
      }
    })).rejects.toThrow('Forbidden');

    expect(prisma.item.findFirst).not.toHaveBeenCalled();
  });

  it('fails when the work item does not belong to the workspace', async () => {
    const { service, prisma, transaction } = makeService();
    prisma.item.findFirst.mockResolvedValue(null);

    await expect(service.updateWorkItemSchedule({
      workspaceId: 'workspace-2',
      itemId: 'item-1',
      userId: 'user-admin',
      payload: {
        plannedStartAt: '2026-05-11T12:00:00.000Z'
      }
    })).rejects.toMatchObject({ statusCode: 404 });

    expect(transaction.item.update).not.toHaveBeenCalled();
  });
});

describe('patchWorkItemScheduleDto', () => {
  it('accepts a valid schedule payload', () => {
    expect(patchWorkItemScheduleDto.parse({
      plannedStartAt: '2026-05-11T12:00:00.000Z',
      plannedEndAt: '2026-05-11T13:00:00.000Z',
      reason: 'agenda_drag_reschedule'
    })).toEqual({
      plannedStartAt: '2026-05-11T12:00:00.000Z',
      plannedEndAt: '2026-05-11T13:00:00.000Z',
      reason: 'agenda_drag_reschedule'
    });
  });

  it('rejects invalid dates and inverted ranges', () => {
    expect(() => patchWorkItemScheduleDto.parse({
      plannedStartAt: 'not-a-date'
    })).toThrow();

    expect(() => patchWorkItemScheduleDto.parse({
      plannedStartAt: '2026-05-11T13:00:00.000Z',
      plannedEndAt: '2026-05-11T12:00:00.000Z'
    })).toThrow();
  });
});
