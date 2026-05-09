import { describe, expect, it, vi } from 'vitest';
import { MembershipRole } from '@prisma/client';
import { WorkspaceDocumentsService } from '@/modules/workspace-platform/application/workspace-documents-service';

function makeService() {
  const prisma = {
    workspaceMembership: {
      findFirst: vi.fn().mockResolvedValue({ role: MembershipRole.CLIENT })
    },
    workspaceCustomerUser: {
      findMany: vi.fn().mockResolvedValue([{ customerId: 'customer-1' }])
    },
    workspaceDocument: {
      findMany: vi.fn().mockResolvedValue([])
    },
    item: {
      findMany: vi.fn().mockResolvedValue([])
    }
  };
  const configService = {
    ensureReadableWorkspace: vi.fn().mockResolvedValue(undefined)
  };

  const service = new WorkspaceDocumentsService(
    prisma as never,
    configService as never,
    { publish: vi.fn() } as never,
    { sendCommercialDocumentEmail: vi.fn() } as never
  );

  return { service, prisma };
}

describe('WorkspaceDocumentsService client isolation', () => {
  it('filters client documentation to linked proposals and contracts', async () => {
    const { service, prisma } = makeService();

    await service.listDocuments({ workspaceId: 'workspace-1', userId: 'user-client' });

    expect(prisma.workspaceDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'workspace-1',
          kind: { in: ['proposal', 'contract'] },
          OR: expect.arrayContaining([
            { linkedEntityType: 'customer', linkedEntityId: 'customer-1' },
            { metadata: { path: ['customerId'], equals: 'customer-1' } },
            { metadata: { path: ['customer', 'id'], equals: 'customer-1' } }
          ])
        })
      })
    );
  });
});

function makePublicDocumentService() {
  const publicToken = 'public-token-12345678901234567890123456789012';
  const document = {
    id: 'document-1',
    workspaceId: 'workspace-1',
    title: 'Proposta Comercial - Dask',
    content: '# Proposta\nCliente: Dask\nContato: {{contactEmail}}',
    kind: 'proposal',
    metadata: {
      publicToken,
      status: 'sent',
      sentToEmail: 'client@example.com',
      sentToEmails: ['client@example.com'],
      contactEmail: 'client@example.com',
      clientUserId: 'recipient-user',
      dealValue: 'R$ 234,00'
    },
    workspace: {
      name: 'Dask'
    }
  };
  const prisma = {
    workspaceDocument: {
      findFirst: vi.fn().mockResolvedValue(document)
    },
    user: {
      findFirst: vi.fn().mockResolvedValue({ id: 'recipient-user' })
    }
  };
  const configService = {
    ensureReadableWorkspace: vi.fn().mockResolvedValue(undefined)
  };

  const service = new WorkspaceDocumentsService(
    prisma as never,
    configService as never,
    { publish: vi.fn() } as never,
    { sendCommercialDocumentEmail: vi.fn() } as never
  );

  return { service, prisma, publicToken };
}

describe('WorkspaceDocumentsService public document access', () => {
  it('does not expose content or metadata without an authenticated recipient', async () => {
    const { service, prisma, publicToken } = makePublicDocumentService();

    const result = await service.getPublicCommercialDocument({ token: publicToken });

    expect(result.masked).toBe(true);
    expect(result.content).toBe('');
    expect(result.metadata).toEqual({});
    expect(result.recipientEmail).toBe('');
    expect(result.recipientEmails).toEqual([]);
    expect(result.recipientUserExists).toBe(false);
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('exposes content and metadata to the authenticated recipient', async () => {
    const { service, prisma, publicToken } = makePublicDocumentService();

    const result = await service.getPublicCommercialDocument({
      token: publicToken,
      requestingUserId: 'recipient-user',
      requestingUserEmail: 'client@example.com'
    });

    expect(result.masked).toBe(false);
    expect(result.content).toContain('Cliente: Dask');
    expect(result.metadata).toMatchObject({
      contactEmail: 'client@example.com',
      dealValue: 'R$ 234,00',
      status: 'sent'
    });
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
});
