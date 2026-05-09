import type { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthorizationService } from '@/modules/identity/domain/authorization';
import { AutomationBusinessActionService } from '@/modules/automation/application/automation-business-action-service';

const workItem = {
  id: 'item-1',
  workspaceId: 'workspace-1',
  boardId: 'board-1',
  title: 'Conta ACME',
  description: 'Escopo comercial',
  type: 'commercial',
  status: 'proposal_preparing',
  fields: {},
  metadata: {},
  createdBy: 'user-owner',
  updatedBy: null,
  customFieldValues: [
    { value: 'proposal-1', field: { slug: 'proposalId' } },
    { value: 'buyer@example.com', field: { slug: 'contactEmail' } }
  ]
};

function buildService(input?: {
  authorizationService?: AuthorizationService;
  prisma?: Partial<PrismaClient>;
  workItemsService?: Record<string, unknown>;
  documentsService?: Record<string, unknown>;
}) {
  const prisma = {
    item: {
      findFirst: vi.fn(async () => workItem)
    },
    workspaceDocument: {
      findFirst: vi.fn(async () => ({
        id: 'proposal-1',
        kind: 'proposal',
        metadata: { status: 'approved' }
      })),
      update: vi.fn()
    },
    itemHistory: {
      create: vi.fn(async () => ({ id: 'history-1', eventName: 'automation.event' }))
    },
    customFieldDefinition: {
      findFirst: vi.fn(async () => ({ id: 'field-1' })),
      findMany: vi.fn(async () => [])
    },
    ...input?.prisma
  } as unknown as PrismaClient;

  const workItemsService = {
    moveWorkItem: vi.fn(),
    transitionWorkItem: vi.fn(),
    updateWorkItem: vi.fn(),
    createWorkItem: vi.fn(),
    linkDocumentToWorkItem: vi.fn(async () => undefined),
    setWorkItemCustomFieldValue: vi.fn(async () => undefined),
    ...input?.workItemsService
  };

  const documentsService = {
    createDocument: vi.fn(async () => ({
      id: 'document-1',
      kind: 'proposal',
      metadata: { status: 'draft' }
    })),
    updateDocument: vi.fn(),
    sendCommercialDocument: vi.fn(),
    ...input?.documentsService
  };

  return {
    service: new AutomationBusinessActionService({
      prisma,
      workItemsService: workItemsService as never,
      documentsService: documentsService as never,
      customersService: {} as never,
      billingService: null,
      authorizationService: input?.authorizationService ?? {
        can: vi.fn(async () => true)
      }
    }),
    prisma,
    workItemsService,
    documentsService
  };
}

describe('AutomationBusinessActionService', () => {
  it('revalidates runtime RBAC before mutating commercial resources', async () => {
    const authorizationService: AuthorizationService = {
      can: vi.fn(async () => false)
    };
    const { service, workItemsService } = buildService({ authorizationService });

    await expect(service.moveWorkItem({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      itemId: 'item-1',
      columnSlug: 'proposal_sent'
    })).rejects.toMatchObject({
      statusCode: 403,
      message: 'Automation actor is not allowed to perform this business action.'
    });

    expect(authorizationService.can).toHaveBeenCalledWith('user-1', 'item.transition', {
      workspaceId: 'workspace-1',
      itemId: 'item-1'
    });
    expect(workItemsService.moveWorkItem).not.toHaveBeenCalled();
    expect(workItemsService.transitionWorkItem).not.toHaveBeenCalled();
  });

  it('blocks contract creation when the source proposal is not approved', async () => {
    const { service, documentsService } = buildService({
      prisma: {
        workspaceDocument: {
          findFirst: vi.fn(async () => ({
            id: 'proposal-1',
            kind: 'proposal',
            metadata: { status: 'sent' }
          }))
        } as never
      }
    });

    await expect(service.createContract({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      itemId: 'item-1',
      proposalFieldSlug: 'proposalId',
      targetFieldSlug: 'contractId',
      templateKey: 'commercial_contract'
    })).rejects.toMatchObject({
      statusCode: 422,
      message: 'create_contract requires an approved proposal.'
    });

    expect(documentsService.createDocument).not.toHaveBeenCalled();
  });

  it('marks document partial failure when a created proposal cannot be linked back to the card', async () => {
    const { service, prisma, workItemsService } = buildService({
      workItemsService: {
        linkDocumentToWorkItem: vi.fn(async () => {
          throw new Error('link failed');
        })
      },
      prisma: {
        workspaceDocument: {
          findFirst: vi.fn(async () => ({
            id: 'document-1',
            kind: 'proposal',
            metadata: { status: 'draft' }
          })),
          update: vi.fn()
        } as never
      }
    });

    await expect(service.createProposal({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      itemId: 'item-1',
      templateKey: 'commercial_proposal',
      targetFieldSlug: 'proposalDraftId'
    })).rejects.toMatchObject({
      statusCode: 500,
      message: 'Document was created but could not be fully linked to the card.'
    });

    expect(workItemsService.linkDocumentToWorkItem).toHaveBeenCalledWith(expect.objectContaining({
      workspaceId: 'workspace-1',
      itemId: 'item-1',
      documentId: 'document-1',
      userId: 'user-1'
    }));
    expect(prisma.workspaceDocument.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'document-1' },
      data: {
        metadata: expect.objectContaining({
          automationPartialFailure: true,
          automationPartialFailureReason: 'link failed'
        })
      }
    }));
  });
});
