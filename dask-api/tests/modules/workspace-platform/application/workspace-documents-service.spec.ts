import path from 'path';
import { promises as fs } from 'fs';
import { createHash } from 'crypto';
import { describe, expect, it, vi } from 'vitest';
import { MembershipRole } from '@prisma/client';
import { DomainEventNames } from '@/core/events/event-names';
import { WorkspaceDocumentsService } from '@/modules/workspace-platform/application/workspace-documents-service';

const now = new Date('2026-05-10T00:00:00.000Z');

function makeDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 'document-1',
    workspaceId: 'workspace-1',
    title: 'Documento',
    content: '# Documento',
    kind: 'proposal',
    linkedEntityType: null,
    linkedEntityId: null,
    tags: [],
    metadata: {},
    position: 0,
    createdBy: 'user-internal',
    updatedBy: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function makeFolder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'folder-1',
    workspaceId: 'workspace-1',
    name: 'Pasta',
    parentId: null,
    position: 0,
    createdBy: 'user-client',
    updatedBy: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function makeService(input: {
  membershipRole?: MembershipRole;
  customerIds?: string[];
  prisma?: Record<string, Record<string, unknown>>;
} = {}) {
  const defaultPrisma = {
    workspaceMembership: {
      findFirst: vi.fn().mockResolvedValue({ role: input.membershipRole ?? MembershipRole.CLIENT })
    },
    workspaceCustomerUser: {
      findMany: vi.fn().mockResolvedValue((input.customerIds ?? ['customer-1']).map((customerId) => ({ customerId })))
    },
    workspaceDocument: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      delete: vi.fn()
    },
    item: {
      findMany: vi.fn().mockResolvedValue([])
    },
    workspaceDocumentFolder: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    documentAsset: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      delete: vi.fn()
    },
    user: {
      findFirst: vi.fn().mockResolvedValue(null)
    },
    workspace: {
      findUnique: vi.fn().mockResolvedValue(null)
    },
    $transaction: vi.fn(async (queries: Promise<unknown>[]) => Promise.all(queries))
  };
  const prisma = {
    ...defaultPrisma,
    ...input.prisma,
    workspaceMembership: { ...defaultPrisma.workspaceMembership, ...input.prisma?.workspaceMembership },
    workspaceCustomerUser: { ...defaultPrisma.workspaceCustomerUser, ...input.prisma?.workspaceCustomerUser },
    workspaceDocument: { ...defaultPrisma.workspaceDocument, ...input.prisma?.workspaceDocument },
    workspaceDocumentFolder: { ...defaultPrisma.workspaceDocumentFolder, ...input.prisma?.workspaceDocumentFolder },
    documentAsset: { ...defaultPrisma.documentAsset, ...input.prisma?.documentAsset },
    item: { ...defaultPrisma.item, ...input.prisma?.item },
    user: { ...defaultPrisma.user, ...input.prisma?.user },
    workspace: { ...defaultPrisma.workspace, ...input.prisma?.workspace }
  };
  const configService = {
    ensureReadableWorkspace: vi.fn().mockResolvedValue(undefined),
    ensureItemWritableWorkspace: vi.fn().mockResolvedValue(undefined)
  };
  const eventPublisher = {
    publish: vi.fn().mockResolvedValue(undefined)
  };
  const emailService = {
    sendCommercialDocumentEmail: vi.fn().mockResolvedValue(undefined)
  };

  const service = new WorkspaceDocumentsService(
    prisma as never,
    configService as never,
    eventPublisher as never,
    emailService as never
  );

  return { service, prisma, configService, eventPublisher, emailService };
}

async function cleanupAsset(storageKey: string) {
  await fs.rm(path.resolve(process.cwd(), 'data/document-assets', storageKey), { force: true });
}

describe('WorkspaceDocumentsService client folder governance', () => {
  it('lets clients create folders inside their own managed scope without internal write permission', async () => {
    const createdFolder = makeFolder({ id: 'folder-client', name: 'Cliente' });
    const { service, prisma, configService, eventPublisher } = makeService({
      prisma: {
        workspaceDocumentFolder: {
          create: vi.fn().mockResolvedValue(createdFolder)
        }
      }
    });

    const result = await service.createFolder({
      workspaceId: 'workspace-1',
      userId: 'user-client',
      payload: { name: 'Cliente' }
    });

    expect(result).toMatchObject({ id: 'folder-client', name: 'Cliente', createdBy: 'user-client' });
    expect(configService.ensureItemWritableWorkspace).not.toHaveBeenCalled();
    expect(prisma.workspaceDocumentFolder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: 'workspace-1',
          name: 'Cliente',
          parentId: null,
          createdBy: 'user-client'
        })
      })
    );
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: DomainEventNames.DocumentFolderCreated,
        aggregateId: 'folder-client'
      })
    );
  });

  it('blocks clients from renaming folders they do not own', async () => {
    const { service, prisma } = makeService({
      prisma: {
        workspaceDocumentFolder: {
          findFirst: vi.fn().mockResolvedValue(makeFolder({ createdBy: 'user-internal' }))
        }
      }
    });

    await expect(
      service.updateFolder({
        workspaceId: 'workspace-1',
        folderId: 'folder-1',
        userId: 'user-client',
        payload: { name: 'Novo nome' }
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      details: expect.objectContaining({ code: 'DOCUMENT_FOLDER_NOT_MANAGEABLE' })
    });
    expect(prisma.workspaceDocumentFolder.update).not.toHaveBeenCalled();
  });

  it('lets clients move visible documents only to their own folders', async () => {
    const currentDocument = makeDocument({
      kind: 'proposal',
      metadata: { folderId: 'old-folder', customerId: 'customer-1' },
      linkedEntityType: 'customer',
      linkedEntityId: 'customer-1'
    });
    const movedDocument = makeDocument({
      ...currentDocument,
      metadata: { folderId: 'folder-client', customerId: 'customer-1' }
    });
    const { service, prisma, configService, eventPublisher } = makeService({
      prisma: {
        workspaceDocument: {
          findFirst: vi.fn().mockResolvedValueOnce(currentDocument).mockResolvedValueOnce({ id: currentDocument.id }),
          update: vi.fn().mockResolvedValue(movedDocument)
        },
        workspaceDocumentFolder: {
          findFirst: vi.fn().mockResolvedValue(makeFolder({ id: 'folder-client', createdBy: 'user-client' }))
        }
      }
    });

    const result = await service.updateDocument({
      workspaceId: 'workspace-1',
      documentId: 'document-1',
      userId: 'user-client',
      payload: { metadata: { folderId: 'folder-client', customerId: 'customer-1' } }
    });

    expect(result.metadata).toMatchObject({ folderId: 'folder-client' });
    expect(configService.ensureItemWritableWorkspace).not.toHaveBeenCalled();
    expect(prisma.workspaceDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({ folderId: 'folder-client' }),
          updatedBy: 'user-client'
        })
      })
    );
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: DomainEventNames.DocumentMoved,
        payload: expect.objectContaining({ source: 'client', folderId: 'folder-client' })
      })
    );
  });

  it('blocks clients from editing document content through the organize endpoint', async () => {
    const { service, prisma } = makeService({
      prisma: {
        workspaceDocument: {
          findFirst: vi.fn().mockResolvedValue(makeDocument({ metadata: { customerId: 'customer-1' } }))
        }
      }
    });

    await expect(
      service.updateDocument({
        workspaceId: 'workspace-1',
        documentId: 'document-1',
        userId: 'user-client',
        payload: { content: 'conteudo alterado' }
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      details: expect.objectContaining({ code: 'DOCUMENT_CLIENT_UPDATE_NOT_ALLOWED' })
    });
    expect(prisma.workspaceDocument.update).not.toHaveBeenCalled();
  });
});

describe('WorkspaceDocumentsService commercial lifecycle', () => {
  it('stores the validated send policy, selected assets and resolved snapshot', async () => {
    const currentDocument = makeDocument({
      kind: 'proposal',
      title: 'Proposta',
      content: '# Proposta\nValor resolvido',
      metadata: {}
    });
    const { service, prisma, emailService, eventPublisher } = makeService({
      membershipRole: MembershipRole.ADMIN,
      prisma: {
        workspaceDocument: {
          findFirst: vi.fn().mockResolvedValue({
            ...currentDocument,
            workspace: { name: 'Dask' }
          }),
          update: vi
            .fn()
            .mockResolvedValueOnce({ ...currentDocument, metadata: { publicToken: 'existing-token' } })
            .mockResolvedValueOnce(
              makeDocument({
                ...currentDocument,
                metadata: {
                  publicToken: 'existing-token',
                  status: 'sent',
                  sentToEmail: 'client@example.com',
                  sentToEmails: ['client@example.com', 'finance@example.com'],
                  sendSubject: 'Proposta Dask',
                  sendMessage: 'Segue proposta',
                  includeAttachments: false,
                  selectedAssetIds: ['asset-1'],
                  publicTokenExpiresAt: '2026-06-01T00:00:00.000Z',
                  requireLogin: true,
                  allowAcceptReject: true,
                  linkedWorkItemId: 'item-1',
                  resolvedPreviewSnapshot: '# Proposta resolvida',
                  sentContentHash: createHash('sha256').update(currentDocument.content).digest('hex'),
                  sentVersion: now.toISOString()
                }
              })
            )
        }
      }
    });

    const result = await service.sendCommercialDocument({
      workspaceId: 'workspace-1',
      documentId: 'document-1',
      userId: 'user-internal',
      payload: {
        emails: [' client@example.com ', 'finance@example.com', 'client@example.com'],
        subject: 'Proposta Dask',
        message: 'Segue proposta',
        includeAttachments: false,
        selectedAssetIds: ['asset-1'],
        expirationDate: '2026-06-01T00:00:00.000Z',
        requireLogin: true,
        allowAcceptReject: true,
        linkedWorkItemId: 'item-1',
        resolvedPreviewSnapshot: '# Proposta resolvida'
      }
    });

    expect(result.metadata).toMatchObject({
      status: 'sent',
      sentToEmails: ['client@example.com', 'finance@example.com'],
      includeAttachments: false,
      selectedAssetIds: ['asset-1'],
      requireLogin: true,
      allowAcceptReject: true,
      linkedWorkItemId: 'item-1',
      resolvedPreviewSnapshot: '# Proposta resolvida'
    });
    expect(emailService.sendCommercialDocumentEmail).toHaveBeenCalledTimes(2);
    expect(prisma.workspaceDocument.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            sentToEmails: ['client@example.com', 'finance@example.com'],
            sentContentHash: createHash('sha256').update(currentDocument.content).digest('hex'),
            sentVersion: now.toISOString()
          })
        })
      })
    );
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: DomainEventNames.ProposalSent,
        payload: expect.not.objectContaining({
          publicToken: expect.any(String)
        })
      })
    );
  });

  it('sets a default public token expiration when no expiration is provided', async () => {
    const currentDocument = makeDocument({
      kind: 'proposal',
      title: 'Proposta',
      content: '# Proposta',
      metadata: {}
    });
    const { service, prisma } = makeService({
      membershipRole: MembershipRole.ADMIN,
      prisma: {
        workspaceDocument: {
          findFirst: vi.fn().mockResolvedValue({
            ...currentDocument,
            workspace: { name: 'Dask' }
          }),
          update: vi.fn(async ({ data }) => makeDocument({
            ...currentDocument,
            metadata: data.metadata,
            updatedBy: data.updatedBy
          }))
        }
      }
    });

    await service.sendCommercialDocument({
      workspaceId: 'workspace-1',
      documentId: 'document-1',
      userId: 'user-internal',
      payload: {
        emails: ['client@example.com']
      }
    });

    const lastUpdate = prisma.workspaceDocument.update.mock.calls.at(-1)?.[0];
    const expiresAt = new Date(lastUpdate.data.metadata.publicTokenExpiresAt);
    expect(Number.isNaN(expiresAt.getTime())).toBe(false);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('records internal decisions with identity, source, version and content hash', async () => {
    const currentDocument = makeDocument({
      kind: 'contract',
      content: 'Contrato final',
      metadata: { status: 'sent' }
    });
    const updatedDocument = makeDocument({
      ...currentDocument,
      metadata: {
        status: 'signed',
        acceptedByUserId: 'user-internal',
        decisionSource: 'internal',
        decisionContentHash: createHash('sha256').update(currentDocument.content).digest('hex'),
        decisionVersion: now.toISOString()
      }
    });
    const { service, prisma, eventPublisher } = makeService({
      membershipRole: MembershipRole.ADMIN,
      prisma: {
        workspaceDocument: {
          findFirst: vi.fn().mockResolvedValue(currentDocument),
          update: vi.fn().mockResolvedValue(updatedDocument)
        }
      }
    });

    const result = await service.decideInternalCommercialDocument({
      workspaceId: 'workspace-1',
      documentId: 'document-1',
      userId: 'user-internal',
      payload: { decision: 'sign' }
    });

    expect(result.metadata).toMatchObject({
      status: 'signed',
      acceptedByUserId: 'user-internal',
      decisionSource: 'internal',
      decisionContentHash: createHash('sha256').update(currentDocument.content).digest('hex'),
      decisionVersion: now.toISOString()
    });
    expect(prisma.workspaceDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            status: 'signed',
            decisionSource: 'internal'
          })
        })
      })
    );
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: DomainEventNames.DocumentDecisionRecorded,
        payload: expect.objectContaining({
          decision: 'sign',
          source: 'internal',
          contentHash: createHash('sha256').update(currentDocument.content).digest('hex')
        })
      })
    );
  });

  it('invalidates a terminal commercial decision when the document content changes', async () => {
    const currentDocument = makeDocument({
      kind: 'proposal',
      content: 'Versao aceita',
      metadata: { status: 'approved', acceptedAt: '2026-05-01T00:00:00.000Z' }
    });
    const updatedDocument = makeDocument({
      ...currentDocument,
      content: 'Nova versao',
      metadata: {
        status: 'sent',
        acceptedAt: '2026-05-01T00:00:00.000Z',
        previousDecisionStatus: 'approved',
        decisionInvalidatedAt: '2026-05-10T01:00:00.000Z'
      }
    });
    const { service, prisma } = makeService({
      membershipRole: MembershipRole.ADMIN,
      prisma: {
        workspaceDocument: {
          findFirst: vi.fn().mockResolvedValue(currentDocument),
          update: vi.fn().mockResolvedValue(updatedDocument)
        }
      }
    });

    await service.updateDocument({
      workspaceId: 'workspace-1',
      documentId: 'document-1',
      userId: 'user-internal',
      payload: {
        content: 'Nova versao',
        metadata: { status: 'approved', acceptedAt: '2026-05-01T00:00:00.000Z' }
      }
    });

    expect(prisma.workspaceDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            status: 'sent',
            previousDecisionStatus: 'approved',
            decisionInvalidatedAt: expect.any(String)
          })
        })
      })
    );
  });
});

describe('WorkspaceDocumentsService document assets', () => {
  it('persists uploaded buffers with checksum and storage metadata', async () => {
    const content = Buffer.from('logo persistente');
    let createdStorageKey = '';
    const { service, prisma, eventPublisher } = makeService({
      membershipRole: MembershipRole.ADMIN,
      prisma: {
        workspaceDocument: {
          findFirst: vi.fn().mockResolvedValue({ id: 'document-1' })
        },
        documentAsset: {
          create: vi.fn(async ({ data }) => {
            createdStorageKey = data.storageKey;
            return {
              ...data,
              createdAt: now
            };
          })
        }
      }
    });

    try {
      const result = await service.uploadDocumentAsset({
        workspaceId: 'workspace-1',
        documentId: 'document-1',
        userId: 'user-internal',
        payload: {
          type: 'logo',
          filename: 'logo.png',
          contentType: 'image/png',
          buffer: content
        }
      });

      expect(result).toMatchObject({
        workspaceId: 'workspace-1',
        documentId: 'document-1',
        type: 'logo',
        filename: 'logo.png',
        contentType: 'image/png',
        size: content.length,
        checksum: createHash('sha256').update(content).digest('hex')
      });
      expect(prisma.documentAsset.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            storageKey: expect.stringContaining('workspace-1/document-1/'),
            checksum: createHash('sha256').update(content).digest('hex'),
            uploadedBy: 'user-internal'
          })
        })
      );
      expect(eventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          name: DomainEventNames.DocumentAssetUploaded,
          payload: expect.objectContaining({
            documentId: 'document-1',
            contentType: 'image/png',
            size: content.length
          })
        })
      );
    } finally {
      if (createdStorageKey) {
        await cleanupAsset(createdStorageKey);
      }
    }
  });
});

describe('WorkspaceDocumentsService client isolation', () => {
  it('filters client documentation to linked proposals and contracts', async () => {
    const { service, prisma } = makeService();

    await service.listDocuments({ workspaceId: 'workspace-1', userId: 'user-client' });

    const call = prisma.workspaceDocument.findMany.mock.calls[0]?.[0] as {
      where?: { AND?: unknown[] };
    };

    expect(call).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            { workspaceId: 'workspace-1' },
            {
              kind: { in: ['proposal', 'contract'] },
              OR: expect.arrayContaining([
                { linkedEntityType: 'customer', linkedEntityId: 'customer-1' },
                { metadata: { path: ['customerId'], equals: 'customer-1' } },
                { metadata: { path: ['customer', 'id'], equals: 'customer-1' } }
              ])
            }
          ])
        })
      })
    );
  });
});

function makePublicDocumentService(input: {
  metadata?: Record<string, unknown>;
  kind?: 'proposal' | 'contract';
  content?: string;
  user?: { id: string; email: string } | null;
} = {}) {
  const publicToken = 'public-token-12345678901234567890123456789012';
  const recipientEmail = 'client@example.com';
  const metadata = {
    publicToken,
    status: 'sent',
    sentToEmail: recipientEmail,
    sentToEmails: [recipientEmail],
    contactEmail: recipientEmail,
    clientUserId: 'recipient-user',
    dealValue: 'R$ 234,00',
    requireLogin: true,
    allowAcceptReject: true,
    publicTokenExpiresAt: '2099-06-01T00:00:00.000Z',
    ...input.metadata
  };
  const document = {
    id: 'document-1',
    workspaceId: 'workspace-1',
    title: 'Proposta Comercial - Dask',
    content: input.content ?? '# Proposta\nCliente: Dask\nContato: {{contactEmail}}',
    kind: input.kind ?? 'proposal',
    linkedEntityType: null,
    linkedEntityId: null,
    tags: [],
    position: 0,
    createdBy: 'user-internal',
    updatedBy: null,
    createdAt: now,
    updatedAt: now,
    metadata,
    workspace: {
      name: 'Dask'
    }
  };
  const user = input.user === undefined ? { id: 'recipient-user', email: recipientEmail } : input.user;
  const prisma = {
    workspaceDocument: {
      findFirst: vi.fn().mockResolvedValue(document),
      update: vi.fn(async ({ data }) => ({
        ...document,
        metadata: data.metadata,
        updatedBy: data.updatedBy
      }))
    },
    user: {
      findFirst: vi.fn().mockResolvedValue(user ? { id: user.id } : null),
      findUnique: vi.fn().mockResolvedValue(user)
    },
    workspace: {
      findUnique: vi.fn().mockResolvedValue({ id: 'workspace-1', key: 'dask', name: 'Dask' })
    }
  };
  const configService = {
    ensureReadableWorkspace: vi.fn().mockResolvedValue(undefined)
  };
  const eventPublisher = {
    publish: vi.fn().mockResolvedValue(undefined)
  };

  const service = new WorkspaceDocumentsService(
    prisma as never,
    configService as never,
    eventPublisher as never,
    { sendCommercialDocumentEmail: vi.fn() } as never
  );

  return { service, prisma, eventPublisher, publicToken };
}

describe('WorkspaceDocumentsService public document access', () => {
  it('reveals public preview with a valid token when login is not required', async () => {
    const { service, publicToken } = makePublicDocumentService({
      metadata: {
        requireLogin: false,
        internalNote: 'operational',
        publicToken: 'public-token-12345678901234567890123456789012'
      }
    });

    const result = await service.getPublicCommercialDocument({ token: publicToken });

    expect(result.masked).toBe(false);
    expect(result.access).toBe('public_token');
    expect(result.requiresLogin).toBe(false);
    expect(result.canDecide).toBe(false);
    expect(result.content).toContain('Cliente: Dask');
    expect(result.metadata).toMatchObject({
      contactEmail: 'client@example.com',
      dealValue: 'R$ 234,00',
      status: 'sent'
    });
    expect(result.metadata).not.toHaveProperty('publicToken');
    expect(JSON.stringify(result)).not.toContain(publicToken);
    expect(result.recipientEmail).toBe('');
    expect(result.recipientEmails).toEqual([]);
  });

  it('rejects expired public tokens', async () => {
    const { service, publicToken } = makePublicDocumentService({
      metadata: {
        publicTokenExpiresAt: '2000-01-01T00:00:00.000Z'
      }
    });

    await expect(service.getPublicCommercialDocument({ token: publicToken })).rejects.toMatchObject({
      statusCode: 410,
      details: expect.objectContaining({ code: 'TOKEN_EXPIRED' })
    });
  });

  it('requires a valid recipient session when requireLogin is true', async () => {
    const { service, publicToken } = makePublicDocumentService();

    await expect(service.getPublicCommercialDocument({ token: publicToken })).rejects.toMatchObject({
      statusCode: 401,
      details: expect.objectContaining({ code: 'DOCUMENT_AUTH_REQUIRED' })
    });
  });

  it('resolves public token routing hints without exposing recipient emails by default', async () => {
    const { service, publicToken } = makePublicDocumentService();

    const result = await service.resolvePublicDocumentToken({ token: publicToken });

    expect(result).toEqual(expect.objectContaining({
      workspaceId: 'workspace-1',
      workspaceSlug: 'dask',
      documentId: 'document-1',
      documentKind: 'proposal',
      recipientEmail: '',
      recipientEmails: []
    }));
  });

  it('exposes content and sanitized metadata to the authenticated recipient', async () => {
    const { service, prisma, publicToken } = makePublicDocumentService();

    const result = await service.getPublicCommercialDocument({
      token: publicToken,
      requestingUserId: 'recipient-user',
      requestingUserEmail: 'client@example.com'
    });

    expect(result.masked).toBe(false);
    expect(result.access).toBe('authenticated_recipient');
    expect(result.requiresLogin).toBe(true);
    expect(result.allowAcceptReject).toBe(true);
    expect(result.canDecide).toBe(true);
    expect(result.content).toContain('Cliente: Dask');
    expect(result.metadata).toMatchObject({
      contactEmail: 'client@example.com',
      dealValue: 'R$ 234,00',
      status: 'sent'
    });
    expect(result.metadata).not.toHaveProperty('publicToken');
    expect(JSON.stringify(result)).not.toContain(publicToken);
    expect(result.recipientEmail).toBe('client@example.com');
    expect(result.recipientEmails).toEqual(['client@example.com']);
    expect(result.recipientUserExists).toBe(true);
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: { in: ['client@example.com'] } },
      select: { id: true }
    });
  });

  it('exposes content and metadata to the linked client user', async () => {
    const { service, publicToken } = makePublicDocumentService();

    const result = await service.getPublicCommercialDocument({
      token: publicToken,
      requestingUserId: 'recipient-user',
      requestingUserEmail: 'changed@example.com'
    });

    expect(result.masked).toBe(false);
    expect(result.content).toContain('Cliente: Dask');
    expect(result.recipientEmail).toBe('client@example.com');
  });

  it('records authorized public accept decisions with audit metadata', async () => {
    const { service, prisma, eventPublisher, publicToken } = makePublicDocumentService();

    const result = await service.decidePublicCommercialDocument({
      token: publicToken,
      userId: 'recipient-user',
      decision: 'approve',
      requestContext: {
        ip: '127.0.0.1',
        userAgent: 'vitest'
      }
    });

    expect(result.metadata).toMatchObject({
      status: 'approved',
      approvedAt: expect.any(String),
      acceptedByEmail: 'client@example.com',
      acceptedByUserId: 'recipient-user',
      acceptedIp: '127.0.0.1',
      acceptedUserAgent: 'vitest',
      decisionSource: 'public',
      decisionContentHash: createHash('sha256').update('# Proposta\nCliente: Dask\nContato: {{contactEmail}}').digest('hex'),
      decisionVersion: now.toISOString()
    });
    expect(prisma.workspaceDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          updatedBy: 'recipient-user',
          metadata: expect.objectContaining({ status: 'approved' })
        })
      })
    );
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: DomainEventNames.DocumentDecisionRecorded,
        payload: expect.objectContaining({
          decision: 'approve',
          source: 'public',
          status: 'approved',
          ip: '127.0.0.1',
          userAgent: 'vitest'
        })
      })
    );
  });

  it('records authorized public reject decisions with audit metadata', async () => {
    const { service, eventPublisher, publicToken } = makePublicDocumentService();

    const result = await service.decidePublicCommercialDocument({
      token: publicToken,
      userId: 'recipient-user',
      decision: 'reject',
      requestContext: {
        ip: '127.0.0.1',
        userAgent: 'vitest'
      }
    });

    expect(result.metadata).toMatchObject({
      status: 'rejected',
      rejectedAt: expect.any(String),
      rejectedByEmail: 'client@example.com',
      rejectedByUserId: 'recipient-user',
      rejectedIp: '127.0.0.1',
      rejectedUserAgent: 'vitest',
      decisionSource: 'public'
    });
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: DomainEventNames.DocumentDecisionRecorded,
        payload: expect.objectContaining({
          decision: 'reject',
          source: 'public',
          status: 'rejected'
        })
      })
    );
  });

  it('denies public decisions without recipient permission or with disabled decisions', async () => {
    const wrongUser = makePublicDocumentService({
      user: { id: 'other-user', email: 'other@example.com' }
    });

    await expect(wrongUser.service.decidePublicCommercialDocument({
      token: wrongUser.publicToken,
      userId: 'other-user',
      decision: 'approve'
    })).rejects.toMatchObject({
      statusCode: 403,
      details: expect.objectContaining({ code: 'RECIPIENT_EMAIL_MISMATCH' })
    });

    const disabled = makePublicDocumentService({
      metadata: {
        allowAcceptReject: false
      }
    });

    await expect(disabled.service.decidePublicCommercialDocument({
      token: disabled.publicToken,
      userId: 'recipient-user',
      decision: 'reject'
    })).rejects.toMatchObject({
      statusCode: 403,
      details: expect.objectContaining({ code: 'DOCUMENT_DECISION_DISABLED' })
    });

    expect(wrongUser.prisma.workspaceDocument.update).not.toHaveBeenCalled();
    expect(disabled.prisma.workspaceDocument.update).not.toHaveBeenCalled();
  });
});
