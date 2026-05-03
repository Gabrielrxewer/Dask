import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MembershipRole } from '@prisma/client';
import { WorkspaceConfigService } from '@/modules/workspace-platform/application/workspace-config-service';

const defaultSeedMocks = vi.hoisted(() => ({
  ensureWorkspaceDefaultConfiguration: vi.fn()
}));

vi.mock('@/modules/workspaces/application/default-workspace-seed', () => ({
  ensureWorkspaceDefaultConfiguration: defaultSeedMocks.ensureWorkspaceDefaultConfiguration
}));

function makeResetTemplatePrisma() {
  const tx = {
    item: { updateMany: vi.fn().mockResolvedValue(undefined) },
    workItemViewPlacement: { deleteMany: vi.fn().mockResolvedValue(undefined) },
    automationView: { deleteMany: vi.fn().mockResolvedValue(undefined) },
    columnStateMapping: { deleteMany: vi.fn().mockResolvedValue(undefined) },
    customFieldDefinition: { deleteMany: vi.fn().mockResolvedValue(undefined) },
    tagDefinition: { deleteMany: vi.fn().mockResolvedValue(undefined) },
    boardColumn: { deleteMany: vi.fn().mockResolvedValue(undefined) },
    workflowState: { deleteMany: vi.fn().mockResolvedValue(undefined) },
    workItemType: { deleteMany: vi.fn().mockResolvedValue(undefined) },
    workspacePreferences: {
      findUnique: vi
        .fn()
        .mockResolvedValueOnce({
          settings: {
            templateKey: 'software_delivery',
            companyProfile: {
              legalName: 'Dask Tecnologia Ltda',
              document: '12.345.678/0001-90',
              address: 'Rua Central, 123',
              jurisdictionCity: 'Sao Paulo',
              jurisdictionState: 'SP',
              noticePeriod: '30 dias'
            }
          }
        })
        .mockResolvedValueOnce({
          settings: {
            templateKey: 'commercial_crm',
            visibleFieldsByType: { deal: ['clientName'] }
          }
        }),
      deleteMany: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined)
    },
    columnDefinition: { deleteMany: vi.fn().mockResolvedValue(undefined) },
    boardTemplate: {
      deleteMany: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue({ id: 'template-1' })
    },
    board: { update: vi.fn().mockResolvedValue(undefined) }
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<void>) => callback(tx))
  };

  return { prisma, tx };
}

describe('WorkspaceConfigService template reset', () => {
  beforeEach(() => {
    defaultSeedMocks.ensureWorkspaceDefaultConfiguration.mockReset();
    defaultSeedMocks.ensureWorkspaceDefaultConfiguration.mockResolvedValue({ defaultBoardId: 'board-1' });
  });

  it('preserves the company profile when changing workspace template', async () => {
    const { prisma, tx } = makeResetTemplatePrisma();
    const service = new WorkspaceConfigService(prisma as never);

    vi.spyOn(service, 'ensureConfigWritableWorkspace').mockResolvedValue(undefined);
    vi.spyOn(service, 'ensureReadableWorkspace').mockResolvedValue({
      role: MembershipRole.ADMIN,
      isClient: false,
      customerIds: [],
      ownCardsOnly: false,
      allowedModules: ['board', 'settings'],
      moduleEntitlements: {},
      allowedBoardViewKeys: null,
      workspace: {
        id: 'workspace-1',
        name: 'Workspace',
        key: 'WORK',
        kind: 'CORPORATE',
        organizationId: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02')
      }
    });
    vi.spyOn(service, 'loadWorkspaceConfig').mockResolvedValue({
      preferences: {
        settings: {}
      }
    } as never);

    await service.resetWorkspaceToTemplate({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      templateKey: 'commercial_crm'
    });

    expect(tx.workspacePreferences.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace-1' }
    });
    expect(defaultSeedMocks.ensureWorkspaceDefaultConfiguration).toHaveBeenCalledWith(tx, {
      workspaceId: 'workspace-1',
      ownerUserId: 'user-1',
      templateKey: 'commercial_crm'
    });
    expect(tx.workspacePreferences.update).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace-1' },
      data: {
        settings: {
          templateKey: 'commercial_crm',
          visibleFieldsByType: { deal: ['clientName'] },
          companyProfile: {
            legalName: 'Dask Tecnologia Ltda',
            document: '12.345.678/0001-90',
            address: 'Rua Central, 123',
            jurisdictionCity: 'Sao Paulo',
            jurisdictionState: 'SP',
            noticePeriod: '30 dias'
          }
        }
      }
    });
  });
});
