import { describe, expect, it, vi } from 'vitest';
import { AutomationNativeWorkflowService } from '@/modules/automation/application/native-workflow-service';

const now = new Date('2026-05-12T19:00:00.000Z');

function makePrisma(input?: {
  existingWorkflow?: boolean;
  existingVersion?: boolean;
  localCurrentVersion?: boolean;
}) {
  const definitionJson = {
    native: {
      nativeKey: 'commercial.proposal_approved_to_contract',
      schemaVersion: 1
    },
    graph: {
      version: 1,
      nodes: [
        { id: 'trigger-proposal-approved', type: 'trigger', config: { triggerType: 'proposal_status_changed' } },
        { id: 'end', type: 'end', config: {} }
      ],
      edges: [{ id: 'edge', source: 'trigger-proposal-approved', target: 'end' }]
    }
  };
  const workflow = {
    id: 'workflow-native',
    name: 'Proposta aprovada para contrato',
    description: 'Cria contrato e move o card para contrato em elaboracao.',
    status: 'paused',
    currentVersionId: input?.existingVersion || input?.localCurrentVersion ? 'version-native' : null,
    origin: 'native',
    nativeKey: 'commercial.proposal_approved_to_contract',
    nativeDomain: 'commercial',
    isSystemManaged: true,
    isProtected: true,
    editableMode: 'config_only',
    installedAt: now,
    installedById: 'system',
    schemaVersion: 1,
    currentVersion: input?.existingVersion || input?.localCurrentVersion
      ? {
          definitionJson: input?.localCurrentVersion
            ? {
                graph: {
                  version: 1,
                  nodes: [
                    {
                      id: 'create-contract',
                      type: 'create_contract',
                      config: {
                        itemIdPath: 'event.payload.itemId',
                        templateKey: 'custom_contract'
                      }
                    }
                  ],
                  edges: []
                }
              }
            : definitionJson,
          graphNodesJson: input?.localCurrentVersion
            ? [
                {
                  id: 'create-contract',
                  type: 'create_contract',
                  config: {
                    itemIdPath: 'event.payload.itemId',
                    templateKey: 'custom_contract'
                  }
                }
              ]
            : definitionJson.graph.nodes,
          graphEdgesJson: definitionJson.graph.edges
        }
      : null
  };
  const version = {
    id: 'version-native',
    workflowId: workflow.id,
    version: 1,
    status: 'published',
    definitionJson,
    publishedAt: now,
    publishedById: 'user-1'
  };
  const db = {
    workspace: {
      findUnique: vi.fn(async () => ({ id: 'workspace-1' }))
    },
    automationWorkflow: {
      findFirst: vi.fn(async () => (input?.existingWorkflow ? workflow : null)),
      create: vi.fn(async () => workflow),
      findUnique: vi.fn(async () => ({
        ...workflow,
        origin: 'native',
        nativeKey: 'commercial.proposal_approved_to_contract',
        currentVersion: version
      })),
      update: vi.fn(async (args: { data?: Record<string, unknown>; include?: unknown }) => (
        args.include
          ? {
              ...workflow,
              ...(args.data ?? {}),
              origin: 'native',
              nativeKey: 'commercial.proposal_approved_to_contract',
              currentVersion: version
            }
          : { ...workflow, ...(args.data ?? {}) }
      ))
    },
    automationWorkflowVersion: {
      findMany: vi.fn(async () => (input?.existingVersion ? [version] : [])),
      aggregate: vi.fn(async () => ({ _max: { version: input?.existingVersion ? 1 : 0 } })),
      create: vi.fn(async () => version),
      update: vi.fn(async () => version)
    }
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (tx: typeof db) => Promise<unknown>) => callback(db))
  };

  return { db, prisma };
}

describe('AutomationNativeWorkflowService', () => {
  it('installs a native workflow as a published workflow version', async () => {
    const { db, prisma } = makePrisma();
    const service = new AutomationNativeWorkflowService(prisma as any);

    const result = await service.installNativeWorkflows({
      workspaceId: 'workspace-1',
      nativeKeys: ['commercial.proposal_approved_to_contract'],
      activate: true,
      installedById: 'user-1',
      now
    });

    expect(result.items).toHaveLength(1);
    expect(db.automationWorkflow.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        origin: 'native',
        nativeKey: 'commercial.proposal_approved_to_contract',
        nativeDomain: 'commercial',
        isSystemManaged: true,
        isProtected: true,
        editableMode: 'config_only',
        status: 'active',
        schemaVersion: 1
      })
    }));
    expect(db.automationWorkflowVersion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        version: 1,
        status: 'published'
      })
    }));
  });

  it('is idempotent for an existing workspace/nativeKey/schemaVersion', async () => {
    const { db, prisma } = makePrisma({ existingWorkflow: true, existingVersion: true });
    const service = new AutomationNativeWorkflowService(prisma as any);

    await service.installNativeWorkflows({
      workspaceId: 'workspace-1',
      nativeKeys: ['commercial.proposal_approved_to_contract'],
      activate: true,
      installedById: 'user-1',
      now
    });

    expect(db.automationWorkflow.create).not.toHaveBeenCalled();
    expect(db.automationWorkflowVersion.create).not.toHaveBeenCalled();
    expect(db.automationWorkflow.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'workflow-native' },
      data: { status: 'active' }
    }));
    expect(db.automationWorkflowVersion.update).not.toHaveBeenCalled();
  });

  it('does not rewrite existing native workflows during passive commercial install', async () => {
    const { db, prisma } = makePrisma({ existingWorkflow: true, existingVersion: true });
    const service = new AutomationNativeWorkflowService(prisma as any);

    await service.installNativeWorkflows({
      workspaceId: 'workspace-1',
      nativeKeys: ['commercial.proposal_approved_to_contract'],
      activate: false,
      now
    });

    expect(db.automationWorkflow.create).not.toHaveBeenCalled();
    expect(db.automationWorkflow.update).not.toHaveBeenCalled();
    expect(db.automationWorkflowVersion.create).not.toHaveBeenCalled();
    expect(db.automationWorkflow.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'workflow-native' },
      include: { currentVersion: true }
    }));
  });

  it('installs the 9 commercial native workflows without the legacy Prospect conversion', async () => {
    const { db, prisma } = makePrisma();
    const service = new AutomationNativeWorkflowService(prisma as any);

    const result = await service.installNativeCommercialWorkflows({
      workspaceId: 'workspace-1',
      now
    });

    expect(result.items).toHaveLength(9);
    expect(db.automationWorkflow.create).toHaveBeenCalledTimes(9);
    expect(db.automationWorkflow.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        nativeKey: 'commercial.intake',
        status: 'paused'
      })
    }));
    expect(db.automationWorkflow.create).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        nativeKey: 'prospect-to-lead-native-transformation'
      })
    }));
  });

  it('preserves local node config overrides when creating the next native version', async () => {
    const { db, prisma } = makePrisma({ existingWorkflow: true, localCurrentVersion: true });
    const service = new AutomationNativeWorkflowService(prisma as any);

    await service.installNativeWorkflows({
      workspaceId: 'workspace-1',
      nativeKeys: ['commercial.proposal_approved_to_contract'],
      now
    });

    expect(db.automationWorkflowVersion.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        graphNodesJson: expect.arrayContaining([
          expect.objectContaining({
            id: 'create-contract',
            config: expect.objectContaining({
              templateKey: 'custom_contract'
            })
          })
        ])
      })
    }));
  });

  it('rejects unknown native workflow keys', async () => {
    const { prisma } = makePrisma();
    const service = new AutomationNativeWorkflowService(prisma as any);

    await expect(
      service.installNativeWorkflows({
        workspaceId: 'workspace-1',
        nativeKeys: ['missing-native-workflow']
      })
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});
