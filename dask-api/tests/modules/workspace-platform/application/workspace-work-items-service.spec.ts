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
      count: vi.fn().mockResolvedValue(0),
      groupBy: vi.fn().mockResolvedValue([]),
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
    }),
    ensureItemTransitionWorkspace: vi.fn().mockResolvedValue({
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

describe('WorkspaceWorkItemsService listWorkItemsPage', () => {
  it('uses cursor pagination and planned schedule window filters', async () => {
    const { service, prisma } = makeService();

    await service.listWorkItemsPage({
      workspaceId: 'workspace-1',
      userId: 'user-admin',
      filters: {
        pageSize: 2,
        cursor: 'cursor-1',
        assigneeId: 'member-1',
        search: 'deploy',
        plannedWindowFrom: new Date('2026-05-04T00:00:00.000Z'),
        plannedWindowTo: new Date('2026-05-11T00:00:00.000Z'),
        sortBy: 'plannedStartAt',
        sortDirection: 'asc'
      }
    });

    const findManyInput = prisma.item.findMany.mock.calls[0]?.[0];
    const encodedWhere = JSON.stringify(findManyInput.where);

    expect(findManyInput).toMatchObject({
      take: 3,
      cursor: { id: 'cursor-1' },
      skip: 1,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }]
    });
    expect(encodedWhere).toContain('plannedStartAt');
    expect(encodedWhere).toContain('plannedEndAt');
    expect(encodedWhere).toContain('2026-05-04T00:00:00.000Z');
    expect(encodedWhere).toContain('2026-05-11T00:00:00.000Z');
    expect(encodedWhere).toContain('member-1');
    expect(encodedWhere).toContain('deploy');
    expect(prisma.item.count).toHaveBeenCalledWith({ where: findManyInput.where });
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

describe('WorkspaceWorkItemsService type transformation', () => {
  it('replicates compatible fields by slug and preserves unmapped source values', () => {
    const { service } = makeService();
    const plan = (service as any).buildWorkItemTypeReplicationPlan({
      sourceValues: [
        {
          fieldId: 'prospect-company',
          value: 'ACME',
          field: {
            id: 'prospect-company',
            slug: 'companyName',
            name: 'Empresa',
            type: 'TEXT',
            variableKey: 'companyName',
            required: false,
            defaultValue: null
          }
        },
        {
          fieldId: 'prospect-message',
          value: 'Mensagem original',
          field: {
            id: 'prospect-message',
            slug: 'message',
            name: 'Mensagem',
            type: 'LONG_TEXT',
            variableKey: null,
            required: false,
            defaultValue: null
          }
        }
      ],
      targetValues: [],
      targetFields: [
        {
          id: 'lead-company',
          slug: 'companyName',
          name: 'Empresa',
          type: 'TEXT',
          variableKey: 'companyName',
          required: false,
          defaultValue: null
        }
      ],
      payloadValues: {}
    });

    expect(plan.valuesByTargetFieldId).toEqual({ 'lead-company': 'ACME' });
    expect(plan.copied).toEqual([
      expect.objectContaining({
        sourceFieldId: 'prospect-company',
        targetFieldId: 'lead-company',
        strategy: 'slug'
      })
    ]);
    expect(plan.skipped).toEqual([
      expect.objectContaining({
        sourceSlug: 'message',
        reason: 'target_field_not_found'
      })
    ]);
    expect(plan.unmappedSourceValues).toEqual({ message: 'Mensagem original' });
  });

  it('transforms Prospect to Lead in-place with replication metadata and audit history', async () => {
    const { service, prisma, configService, publisher } = makeService();
    const transaction = {
      item: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'item-1',
          typeId: 'prospect-type',
          type: 'prospect',
          stateId: 'prospect-state',
          status: 'prospect',
          metadata: { source: 'manual' }
        }),
        update: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockResolvedValue({ fields: { companyName: 'ACME' } })
      },
      workflowState: {
        findFirst: vi.fn().mockResolvedValue({ id: 'lead-state', slug: 'commercial_intake' })
      },
      customFieldDefinition: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'lead-company',
            slug: 'companyName',
            name: 'Empresa',
            scopes: [{ typeId: 'lead-type' }]
          }
        ])
      },
      customFieldValue: {
        upsert: vi.fn().mockResolvedValue({})
      },
      itemHistory: {
        create: vi.fn().mockResolvedValue({})
      }
    };
    prisma.$transaction.mockImplementation((callback) => callback(transaction as never));
    const serialized = {
      id: 'item-1',
      boardId: 'board-1',
      type: { id: 'lead-type', slug: 'commercial', name: 'Lead', color: '#0f766e' },
      title: 'ACME',
      text: 'Contato inicial',
      status: 'commercial_intake',
      state: { id: 'lead-state', slug: 'commercial_intake' },
      column: { id: 'lead-column', slug: 'commercial_intake' },
      assigneeId: null,
      dueDate: null,
      tags: [],
      customFields: { companyName: 'ACME' }
    };
    vi.spyOn(service as never, 'getSerializedWorkItemById').mockResolvedValue(serialized as never);
    vi.spyOn(service as never, 'buildTypeTransformationValidation').mockResolvedValue({
      valid: true,
      reason: null,
      transformation: {
        id: 'default:prospect:lead',
        workspaceId: 'workspace-1',
        fromTypeId: 'prospect-type',
        toTypeId: 'lead-type',
        name: 'Transformar Prospect em Lead',
        description: null,
        enabled: true,
        mode: 'same_work_item_type_change',
        fieldCompatibilityMode: 'replicate_compatible_preserve_unmapped',
        defaultValuesForNewFields: {},
        stateMapping: { prospect: 'commercial_intake' },
        permission: 'commercial.transform'
      },
      fromType: { id: 'prospect-type', slug: 'prospect', name: 'Prospect', color: '#2563eb' },
      toType: { id: 'lead-type', slug: 'commercial', name: 'Lead', color: '#0f766e' },
      replicationPlan: {
        copied: [{ sourceFieldId: 'prospect-company', sourceSlug: 'companyName', targetFieldId: 'lead-company', targetSlug: 'companyName', strategy: 'slug' }],
        skipped: [{ sourceFieldId: 'prospect-message', sourceSlug: 'message', reason: 'target_field_not_found' }],
        incompatible: [],
        valuesByTargetFieldId: { 'lead-company': 'ACME' },
        unmappedSourceValues: { message: 'Mensagem original' }
      },
      preservedFields: [],
      missingFields: [],
      newRequiredFields: [],
      defaultValuesForNewFields: {}
    } as never);

    const result = await service.transformWorkItemType({
      workspaceId: 'workspace-1',
      itemId: 'item-1',
      userId: 'user-admin',
      payload: { transformationId: 'default:prospect:lead' }
    });

    expect(result).toBe(serialized);
    expect(configService.ensureItemTransitionWorkspace).toHaveBeenCalledWith('workspace-1', 'user-admin');
    expect(transaction.item.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'item-1' },
      data: expect.objectContaining({
        typeId: 'lead-type',
        type: 'commercial',
        stateId: 'lead-state',
        status: 'commercial_intake',
        updatedBy: 'user-admin'
      })
    }));
    expect(transaction.customFieldValue.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { fieldId_itemId: { fieldId: 'lead-company', itemId: 'item-1' } },
      create: expect.objectContaining({ value: 'ACME' })
    }));
    expect(transaction.itemHistory.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        itemId: 'item-1',
        eventName: 'work_item_type.transformed_by_native_automation'
      })
    }));
    expect(publisher.publishInTransaction).toHaveBeenCalled();
  });

  it('does not transform when the user cannot transition the work item', async () => {
    const { service, prisma, configService } = makeService();
    configService.ensureItemTransitionWorkspace.mockRejectedValue(new Error('Forbidden'));

    await expect(service.transformWorkItemType({
      workspaceId: 'workspace-1',
      itemId: 'item-1',
      userId: 'user-viewer',
      payload: { toTypeSlug: 'commercial' }
    })).rejects.toThrow('Forbidden');

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not transform work items from another workspace', async () => {
    const { service, prisma } = makeService();
    const transaction = {
      item: {
        findFirst: vi.fn().mockResolvedValue(null),
        update: vi.fn()
      }
    };
    prisma.$transaction.mockImplementation((callback) => callback(transaction as never));
    vi.spyOn(service as never, 'buildTypeTransformationValidation').mockResolvedValue({
      valid: true,
      reason: null,
      transformation: {
        id: 'default:prospect:lead',
        workspaceId: 'workspace-1',
        fromTypeId: 'prospect-type',
        toTypeId: 'lead-type',
        name: 'Transformar Prospect em Lead',
        description: null,
        enabled: true,
        mode: 'same_work_item_type_change',
        fieldCompatibilityMode: 'replicate_compatible_preserve_unmapped',
        defaultValuesForNewFields: {},
        stateMapping: {},
        permission: 'commercial.transform'
      },
      fromType: { id: 'prospect-type', slug: 'prospect', name: 'Prospect', color: '#2563eb' },
      toType: { id: 'lead-type', slug: 'commercial', name: 'Lead', color: '#0f766e' },
      replicationPlan: { copied: [], skipped: [], incompatible: [], valuesByTargetFieldId: {}, unmappedSourceValues: {} },
      preservedFields: [],
      missingFields: [],
      newRequiredFields: [],
      defaultValuesForNewFields: {}
    } as never);

    await expect(service.transformWorkItemType({
      workspaceId: 'workspace-2',
      itemId: 'item-1',
      userId: 'user-admin',
      payload: { transformationId: 'default:prospect:lead' }
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
