import { Prisma, type PrismaClient } from '@prisma/client';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { AppError } from '@/core/errors/app-error';
import { DomainEventNames } from '@/core/events/event-names';
import type { EventPublisher } from '@/core/events/event-publisher';
import { env } from '@/core/config/env';
import type { EmailService } from '@/infra/email/email-service';
import { normalizeEmail } from '@/modules/identity/domain/password-policy';
import type { WorkspaceConfigService } from '@/modules/workspace-platform/application/workspace-config-service';
import {
  requireClientCustomerScope,
  resolveCustomerAccessScope
} from '@/modules/workspace-platform/application/customer-access-scope';

type DocumentKind = 'wiki' | 'proposal' | 'contract';
type DocumentLinkedEntityType = 'work_item' | 'customer' | 'proposal' | 'contract';
type CommercialDocumentStatus = 'draft' | 'sent' | 'viewed' | 'approved' | 'rejected' | 'accepted' | 'signed';
type DocumentMetadata = Record<string, unknown>;
type PublicDocumentDecision = 'approve' | 'accept' | 'sign' | 'reject';
type DocumentAssetType = 'logo' | 'attachment' | 'generated_pdf' | 'exported_html';
type DocumentDecision = PublicDocumentDecision;

type DocumentListFilters = {
  search?: string;
  type?: DocumentKind;
  kind?: DocumentKind;
  folderId?: string | null;
  tags?: string[];
  status?: string;
  commercialStatus?: string;
  linkedWorkItemId?: string;
  createdBy?: string;
  updatedAtFrom?: Date;
  updatedAtTo?: Date;
  visibility?: 'internal' | 'client_visible' | 'commercial_shared' | 'public_authenticated';
  page?: number;
  pageSize?: number;
  limit?: number;
  cursor?: string;
  sort?: 'position_asc' | 'updated_desc' | 'updated_asc' | 'created_desc' | 'created_asc' | 'title_asc';
  paged?: boolean;
};

const allowedLogoContentTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']);
const allowedAttachmentContentTypes = new Set([
  ...allowedLogoContentTypes,
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]);
const maxAssetSizeByType: Record<DocumentAssetType, number> = {
  logo: 5 * 1024 * 1024,
  attachment: 25 * 1024 * 1024,
  generated_pdf: 25 * 1024 * 1024,
  exported_html: 10 * 1024 * 1024
};
const defaultPublicTokenTtlMs = 30 * 24 * 60 * 60 * 1000;
const publicMetadataBlockedKeys = new Set([
  'publicToken',
  'publicTokenRevokedAt',
  'sentBy',
  'sentToEmail',
  'sentToEmails',
  'sendSubject',
  'sendMessage',
  'selectedAssetIds',
  'linkedWorkItemId',
  'clientUserId',
  'acceptedByEmail',
  'acceptedByUserId',
  'acceptedIp',
  'acceptedUserAgent',
  'rejectedByEmail',
  'rejectedByUserId',
  'rejectedIp',
  'rejectedUserAgent',
  'decisionContentHash',
  'decisionVersion',
  'sentContentHash',
  'sentVersion'
]);

const documentKinds = new Set<DocumentKind>(['wiki', 'proposal', 'contract']);
const commercialDocumentStatuses = new Set<CommercialDocumentStatus>([
  'draft',
  'sent',
  'viewed',
  'approved',
  'rejected',
  'accepted',
  'signed'
]);

function normalizeDocumentKind(kind: string | null | undefined): DocumentKind {
  return kind && documentKinds.has(kind as DocumentKind) ? (kind as DocumentKind) : 'wiki';
}

function toInputJson(value: DocumentMetadata | undefined): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : (value as Prisma.InputJsonObject);
}

function toMetadataObject(value: unknown): DocumentMetadata {
  return value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as DocumentMetadata) } : {};
}

function readMetadataStatus(metadata: unknown): string | null {
  const status = toMetadataObject(metadata).status;
  return typeof status === 'string' && status.trim().length > 0 ? status.trim() : null;
}

function normalizeCommercialStatus(kind: DocumentKind, metadata: unknown): CommercialDocumentStatus | null {
  if (kind === 'wiki') {
    return null;
  }

  const status = readMetadataStatus(metadata);
  return status && commercialDocumentStatuses.has(status as CommercialDocumentStatus)
    ? (status as CommercialDocumentStatus)
    : 'draft';
}

function normalizeDocumentMetadata(kind: DocumentKind, metadata: unknown): DocumentMetadata {
  const normalized = toMetadataObject(metadata);
  const status = normalizeCommercialStatus(kind, normalized);

  return status ? { ...normalized, status } : normalized;
}

function readFolderId(metadata: unknown): string | null {
  const folderId = toMetadataObject(metadata).folderId;
  return typeof folderId === 'string' && folderId.trim().length > 0 ? folderId.trim() : null;
}

function readPublicToken(metadata: DocumentMetadata): string | null {
  const token = metadata.publicToken;
  return typeof token === 'string' && token.trim().length >= 32 ? token.trim() : null;
}

function normalizeUniqueEmails(values: unknown[]): string[] {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => normalizeEmail(value))
        .filter(Boolean)
    )
  );
}

function readRecipientEmails(metadata: DocumentMetadata): string[] {
  const sentToEmails = metadata.sentToEmails;
  return normalizeUniqueEmails([
    ...(Array.isArray(sentToEmails) ? sentToEmails : []),
    metadata.sentToEmail
  ]);
}

function buildPublicDocumentUrl(token: string): string {
  return `${env.APP_PUBLIC_URL.replace(/\/+$/, '')}/documents/public/${encodeURIComponent(token)}`;
}

function hashDocumentContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function isTerminalCommercialStatus(status: string | null): boolean {
  return status === 'approved' || status === 'accepted' || status === 'signed' || status === 'rejected';
}

function buildApiUrl(pathname: string): string {
  return `${env.API_PUBLIC_URL.replace(/\/+$/, '')}${env.API_PREFIX.replace(/\/+$/, '')}${pathname}`;
}

function buildInternalAssetUrl(asset: { workspaceId: string; documentId: string; id: string }): string {
  return buildApiUrl(
    `/workspaces/${asset.workspaceId}/documents/${asset.documentId}/assets/${asset.id}/content`
  );
}

function buildPublicAssetUrl(token: string, assetId: string): string {
  return buildApiUrl(`/documents/public/${encodeURIComponent(token)}/assets/${assetId}/content`);
}

function readIsoDate(metadata: DocumentMetadata, key: string): Date | null {
  const value = metadata[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function assertPublicTokenCanOpen(metadata: DocumentMetadata): void {
  if (readIsoDate(metadata, 'publicTokenRevokedAt')) {
    throw new AppError('Document link has been revoked.', 410, { code: 'TOKEN_REVOKED' });
  }

  const expiresAt = readIsoDate(metadata, 'publicTokenExpiresAt');
  if (expiresAt && expiresAt < new Date()) {
    throw new AppError('Document link has expired.', 410, { code: 'TOKEN_EXPIRED' });
  }
}

function readRequireLogin(metadata: DocumentMetadata): boolean {
  return metadata.requireLogin !== false;
}

function readAllowAcceptReject(metadata: DocumentMetadata): boolean {
  return metadata.allowAcceptReject !== false;
}

function sanitizePublicDocumentMetadata(metadata: DocumentMetadata): DocumentMetadata {
  return Object.fromEntries(
    Object.entries(metadata).filter(([key]) => !publicMetadataBlockedKeys.has(key))
  );
}

function buildDefaultPublicTokenExpiresAt(base: Date): string {
  return new Date(base.getTime() + defaultPublicTokenTtlMs).toISOString();
}

export class WorkspaceDocumentsService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly configService: WorkspaceConfigService,
    private readonly eventPublisher: EventPublisher,
    private readonly emailService: EmailService
  ) {}

  public async listDocuments(input: { workspaceId: string; userId: string; filters?: DocumentListFilters }) {
    await this.configService.ensureReadableWorkspace(input.workspaceId, input.userId);
    const customerScope = await resolveCustomerAccessScope(this.prisma, input);
    const customerIds = requireClientCustomerScope(customerScope);

    let clientItemIds: string[] = [];
    if (customerScope.isClient && customerIds.length > 0) {
      const clientItems = await this.prisma.item.findMany({
        where: {
          workspaceId: input.workspaceId,
          OR: customerIds.flatMap((customerId) => [
            { fields: { path: ['customerId'], equals: customerId } },
            { metadata: { path: ['customerId'], equals: customerId } },
            { metadata: { path: ['clientAnchorCustomerId'], equals: customerId } }
          ])
        },
        select: { id: true }
      });
      clientItemIds = clientItems.map((item) => item.id);
    }

    const filters = input.filters ?? {};
    const where = this.buildDocumentListWhere({
      workspaceId: input.workspaceId,
      filters,
      isClient: customerScope.isClient,
      customerIds,
      clientItemIds
    });
    const orderBy = this.buildDocumentListOrderBy(filters);

    if (filters.paged) {
      const pageNumber = typeof filters.page === 'number' ? Math.max(filters.page, 1) : null;
      const take = Math.min(Math.max(filters.pageSize ?? filters.limit ?? 80, 1), 200);
      const findManyArgs: Prisma.WorkspaceDocumentFindManyArgs = {
        where,
        orderBy,
        take: take + 1
      };
      if (pageNumber !== null) {
        findManyArgs.skip = (pageNumber - 1) * take;
      } else if (filters.cursor) {
        findManyArgs.cursor = { id: filters.cursor };
        findManyArgs.skip = 1;
      }

      const [documents, total] = await Promise.all([
        this.prisma.workspaceDocument.findMany(findManyArgs),
        this.prisma.workspaceDocument.count({ where })
      ]);
      const items = documents.slice(0, take);
      const trailing = documents[take];
      const currentPage = pageNumber ?? 1;
      const totalPages = Math.max(Math.ceil(total / take), 1);

      return {
        items: items.map((document) => this.serialize(document)),
        totalCount: total,
        total,
        nextCursor: trailing?.id ?? null,
        hasMore: Boolean(trailing),
        pageInfo: {
          page: currentPage,
          pageSize: take,
          totalPages,
          hasNextPage: pageNumber !== null ? currentPage < totalPages : Boolean(trailing),
          hasPreviousPage: pageNumber !== null ? currentPage > 1 : Boolean(filters.cursor),
          nextCursor: trailing?.id ?? null
        }
      };
    }

    const documents = await this.prisma.workspaceDocument.findMany({
      where,
      orderBy
    });

    return documents.map((document) => this.serialize(document));
  }

  public async listFolders(input: { workspaceId: string; userId: string }) {
    await this.configService.ensureReadableWorkspace(input.workspaceId, input.userId);
    const customerScope = await resolveCustomerAccessScope(this.prisma, input);

    const folders = await this.prisma.workspaceDocumentFolder.findMany({
      where: { workspaceId: input.workspaceId },
      orderBy: [{ position: 'asc' }, { name: 'asc' }]
    });

    if (customerScope.isClient) {
      const documentsResult = await this.listDocuments({ workspaceId: input.workspaceId, userId: input.userId });
      const documents = Array.isArray(documentsResult) ? documentsResult : documentsResult.items;
      const visibleFolderIds = new Set<string>();
      for (const document of documents) {
        const folderId = readFolderId(document.metadata);
        if (folderId) {
          visibleFolderIds.add(folderId);
        }
      }
      for (const folder of folders) {
        if (folder.createdBy === input.userId) {
          visibleFolderIds.add(folder.id);
        }
      }
      let changed = true;
      while (changed) {
        changed = false;
        for (const folder of folders) {
          if (folder.parentId && visibleFolderIds.has(folder.id) && !visibleFolderIds.has(folder.parentId)) {
            visibleFolderIds.add(folder.parentId);
            changed = true;
          }
        }
      }
      return folders.filter((folder) => visibleFolderIds.has(folder.id)).map((folder) => this.serializeFolder(folder));
    }

    return folders.map((folder) => this.serializeFolder(folder));
  }

  public async createFolder(input: {
    workspaceId: string;
    userId: string;
    payload: {
      name: string;
      parentId?: string | null;
      position?: number;
    };
  }) {
    await this.configService.ensureReadableWorkspace(input.workspaceId, input.userId);
    const customerScope = await resolveCustomerAccessScope(this.prisma, input);
    const parentId = input.payload.parentId ?? null;

    if (customerScope.isClient) {
      requireClientCustomerScope(customerScope);
      if (parentId) {
        await this.ensureClientManagedFolder(input.workspaceId, parentId, input.userId);
      }
    } else {
      await this.configService.ensureItemWritableWorkspace(input.workspaceId, input.userId);
      if (parentId) {
        await this.ensureFolder(input.workspaceId, parentId);
      }
    }

    const defaultPosition = await this.prisma.workspaceDocumentFolder.count({
      where: { workspaceId: input.workspaceId, parentId }
    });

    const folder = await this.prisma.workspaceDocumentFolder.create({
      data: {
        workspaceId: input.workspaceId,
        name: input.payload.name.trim(),
        parentId,
        position: input.payload.position ?? defaultPosition,
        createdBy: input.userId,
        updatedBy: input.userId
      }
    });

    await this.publishDocumentationEvent({
      name: DomainEventNames.DocumentFolderCreated,
      workspaceId: input.workspaceId,
      userId: input.userId,
      aggregateId: folder.id,
      payload: {
        folderId: folder.id,
        parentId
      }
    });

    return this.serializeFolder(folder);
  }

  public async updateFolder(input: {
    workspaceId: string;
    folderId: string;
    userId: string;
    payload: {
      name?: string;
      parentId?: string | null;
      position?: number;
    };
  }) {
    await this.configService.ensureReadableWorkspace(input.workspaceId, input.userId);
    const customerScope = await resolveCustomerAccessScope(this.prisma, input);
    const current = await this.ensureFolder(input.workspaceId, input.folderId);

    if (customerScope.isClient) {
      requireClientCustomerScope(customerScope);
      if (current.createdBy !== input.userId) {
        throw new AppError('Clients can only organize their own folders.', 403, {
          code: 'DOCUMENT_FOLDER_NOT_MANAGEABLE'
        });
      }
    } else {
      await this.configService.ensureItemWritableWorkspace(input.workspaceId, input.userId);
    }

    if (input.payload.parentId !== undefined) {
      const nextParentId = input.payload.parentId ?? null;
      if (nextParentId === current.id) {
        throw new AppError('A folder cannot be its own parent', 422);
      }
      if (nextParentId) {
        if (customerScope.isClient) {
          await this.ensureClientManagedFolder(input.workspaceId, nextParentId, input.userId);
        } else {
          await this.ensureFolder(input.workspaceId, nextParentId);
        }
        const descendantIds = await this.collectDescendantFolderIds(input.workspaceId, current.id);
        if (descendantIds.includes(nextParentId)) {
          throw new AppError('A folder cannot be moved inside one of its subfolders', 422);
        }
      }
    }

    const folder = await this.prisma.workspaceDocumentFolder.update({
      where: { id: current.id },
      data: {
        ...(input.payload.name !== undefined ? { name: input.payload.name.trim() } : {}),
        ...(input.payload.parentId !== undefined ? { parentId: input.payload.parentId ?? null } : {}),
        ...(input.payload.position !== undefined ? { position: input.payload.position } : {}),
        updatedBy: input.userId
      }
    });

    await this.publishDocumentationEvent({
      name: DomainEventNames.DocumentFolderUpdated,
      workspaceId: input.workspaceId,
      userId: input.userId,
      aggregateId: folder.id,
      payload: {
        folderId: folder.id,
        previousParentId: current.parentId,
        parentId: folder.parentId,
        renamed: input.payload.name !== undefined
      }
    });

    return this.serializeFolder(folder);
  }

  public async deleteFolder(input: { workspaceId: string; folderId: string; userId: string }) {
    await this.configService.ensureReadableWorkspace(input.workspaceId, input.userId);
    const customerScope = await resolveCustomerAccessScope(this.prisma, input);
    const current = await this.ensureFolder(input.workspaceId, input.folderId);
    const folderIds = [current.id, ...(await this.collectDescendantFolderIds(input.workspaceId, current.id))];

    if (customerScope.isClient) {
      requireClientCustomerScope(customerScope);
      const managedFolders = await this.prisma.workspaceDocumentFolder.findMany({
        where: {
          workspaceId: input.workspaceId,
          id: { in: folderIds }
        },
        select: { id: true, createdBy: true }
      });
      if (managedFolders.some((folder) => folder.createdBy !== input.userId)) {
        throw new AppError('Clients can only delete their own folders.', 403, {
          code: 'DOCUMENT_FOLDER_NOT_MANAGEABLE'
        });
      }
    } else {
      await this.configService.ensureItemWritableWorkspace(input.workspaceId, input.userId);
    }

    const documents = await this.prisma.workspaceDocument.findMany({
      where: {
        workspaceId: input.workspaceId,
        OR: folderIds.map((folderId) => ({
          metadata: {
            path: ['folderId'],
            equals: folderId
          }
        }))
      }
    });

    if (customerScope.isClient) {
      await this.assertClientCanOrganizeDocuments({
        workspaceId: input.workspaceId,
        userId: input.userId,
        documents
      });
    }

    await this.prisma.$transaction([
      ...documents.map((document) => {
        const metadata = normalizeDocumentMetadata(normalizeDocumentKind(document.kind), document.metadata);
        delete metadata.folderId;
        return this.prisma.workspaceDocument.update({
          where: { id: document.id },
          data: {
            metadata: toInputJson(metadata),
            updatedBy: input.userId
          }
        });
      }),
      this.prisma.workspaceDocumentFolder.delete({
        where: { id: current.id }
      })
    ]);

    await this.publishDocumentationEvent({
      name: DomainEventNames.DocumentFolderDeleted,
      workspaceId: input.workspaceId,
      userId: input.userId,
      aggregateId: current.id,
      payload: {
        folderId: current.id,
        folderIds,
        affectedDocumentIds: documents.map((document) => document.id)
      }
    });
  }

  public async createDocument(input: {
    workspaceId: string;
    userId: string;
    payload: {
      title: string;
      content?: string;
      kind?: DocumentKind;
      linkedEntityType?: DocumentLinkedEntityType;
      linkedEntityId?: string;
      tags?: string[];
      metadata?: DocumentMetadata;
      position?: number;
      expectedUpdatedAt?: string;
    };
  }) {
    await this.configService.ensureItemWritableWorkspace(input.workspaceId, input.userId);

    const defaultPosition = await this.prisma.workspaceDocument.count({
      where: { workspaceId: input.workspaceId }
    });
    const metadata = normalizeDocumentMetadata(input.payload.kind ?? 'wiki', input.payload.metadata);
    const folderId = readFolderId(metadata);
    if (folderId) {
      await this.ensureFolder(input.workspaceId, folderId);
    }

    const document = await this.prisma.workspaceDocument.create({
      data: {
        workspaceId: input.workspaceId,
        title: input.payload.title.trim(),
        content: input.payload.content ?? '',
        kind: input.payload.kind ?? 'wiki',
        linkedEntityType: input.payload.linkedEntityType,
        linkedEntityId: input.payload.linkedEntityId,
        tags: input.payload.tags ?? [],
        metadata: toInputJson(metadata),
        position: input.payload.position ?? defaultPosition,
        createdBy: input.userId,
        updatedBy: input.userId
      }
    });

    await this.publishDocumentCreatedEvent({
      workspaceId: input.workspaceId,
      userId: input.userId,
      document
    });

    return this.serialize(document);
  }

  public async sendCommercialDocument(input: {
    workspaceId: string;
    documentId: string;
    userId: string;
    payload: {
      email?: string;
      emails?: string[];
      subject?: string;
      message?: string;
      includeAttachments?: boolean;
      selectedAssetIds?: string[];
      expirationDate?: string | null;
      requireLogin?: boolean;
      allowAcceptReject?: boolean;
      linkedWorkItemId?: string | null;
      resolvedPreviewSnapshot?: string;
    };
  }) {
    await this.configService.ensureItemWritableWorkspace(input.workspaceId, input.userId);

    const current = await this.prisma.workspaceDocument.findFirst({
      where: {
        id: input.documentId,
        workspaceId: input.workspaceId
      },
      include: {
        workspace: {
          select: {
            name: true
          }
        }
      }
    });

    if (!current) {
      throw new AppError('Workspace document not found', 404);
    }

    const kind = normalizeDocumentKind(current.kind);
    if (kind === 'wiki') {
      throw new AppError('Only proposals and contracts can be sent to customers', 422);
    }

    const currentMetadata = normalizeDocumentMetadata(kind, current.metadata);
    const publicToken = readPublicToken(currentMetadata) ?? randomBytes(32).toString('base64url');
    const tokenMetadata: DocumentMetadata = {
      ...currentMetadata,
      publicToken
    };

    if (!readPublicToken(currentMetadata)) {
      await this.prisma.workspaceDocument.update({
        where: { id: current.id },
        data: {
          metadata: toInputJson(tokenMetadata),
          updatedBy: input.userId
        }
      });
    }

    const recipientEmails = normalizeUniqueEmails([
      ...(input.payload.emails ?? []),
      input.payload.email
    ]);

    if (recipientEmails.length === 0) {
      throw new AppError('At least one recipient email is required', 422);
    }

    await Promise.all(
      recipientEmails.map((email) =>
        this.emailService.sendCommercialDocumentEmail(email, {
          workspaceName: current.workspace.name,
          documentTitle: current.title,
          documentType: kind,
          publicUrl: buildPublicDocumentUrl(publicToken)
        })
      )
    );

    const sentAt = new Date();
    const sentMetadata: DocumentMetadata = {
      ...tokenMetadata,
      sentAt: sentAt.toISOString(),
      sentToEmail: recipientEmails[0],
      sentToEmails: recipientEmails,
      sentBy: input.userId,
      status: 'sent',
      sendSubject: input.payload.subject,
      sendMessage: input.payload.message,
      includeAttachments: input.payload.includeAttachments ?? true,
      selectedAssetIds: input.payload.selectedAssetIds ?? [],
      publicTokenExpiresAt: input.payload.expirationDate ?? tokenMetadata.publicTokenExpiresAt ?? buildDefaultPublicTokenExpiresAt(sentAt),
      requireLogin: input.payload.requireLogin ?? true,
      allowAcceptReject: input.payload.allowAcceptReject ?? true,
      linkedWorkItemId: input.payload.linkedWorkItemId ?? tokenMetadata.linkedWorkItemId,
      resolvedPreviewSnapshot: input.payload.resolvedPreviewSnapshot,
      sentContentHash: hashDocumentContent(current.content),
      sentVersion: current.updatedAt.toISOString()
    };
    const document = await this.prisma.workspaceDocument.update({
      where: { id: current.id },
      data: {
        metadata: toInputJson(sentMetadata),
        updatedBy: input.userId
      }
    });

    await this.publishDocumentSentEvent({
      workspaceId: input.workspaceId,
      userId: input.userId,
      document,
      sentAt,
      sentToEmails: recipientEmails
    });

    return this.serialize(document);
  }

  public async resolvePublicDocumentToken(input: { token: string; includeRecipients?: boolean }) {
    const document = await this.findPublicDocumentByToken(input.token);
    const kind = normalizeDocumentKind(document.kind);
    const metadata = normalizeDocumentMetadata(kind, document.metadata);
    const recipientEmails = readRecipientEmails(metadata);
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: document.workspaceId },
      select: { id: true, key: true, name: true }
    });

    if (!workspace) {
      throw new AppError('Workspace not found.', 404);
    }

    return {
      workspaceId: workspace.id,
      workspaceSlug: workspace.key,
      workspaceName: workspace.name,
      documentId: document.id,
      documentTitle: document.title,
      documentKind: kind,
      recipientEmail: input.includeRecipients ? recipientEmails[0] ?? '' : '',
      recipientEmails: input.includeRecipients ? recipientEmails : []
    };
  }

  public async getPublicCommercialDocument(input: {
    token: string;
    requestingUserId?: string | null;
    requestingUserEmail?: string | null;
  }) {
    const document = await this.findPublicDocumentByToken(input.token);
    const kind = normalizeDocumentKind(document.kind);
    const metadata = normalizeDocumentMetadata(kind, document.metadata);
    const recipientEmails = readRecipientEmails(metadata);
    const requestingUserEmail = normalizeEmail(input.requestingUserEmail ?? '');
    const clientUserId = typeof metadata.clientUserId === 'string' ? metadata.clientUserId.trim() : '';
    const requiresLogin = readRequireLogin(metadata);
    const allowAcceptReject = readAllowAcceptReject(metadata);
    const authenticatedRecipient = Boolean(
      input.requestingUserId &&
        ((requestingUserEmail && recipientEmails.includes(requestingUserEmail)) ||
          (clientUserId && clientUserId === input.requestingUserId))
    );
    const canRevealSensitiveData = !requiresLogin || authenticatedRecipient;

    if (requiresLogin && !input.requestingUserId) {
      throw new AppError('Authentication required.', 401, { code: 'DOCUMENT_AUTH_REQUIRED' });
    }

    if (requiresLogin && input.requestingUserId && !authenticatedRecipient) {
      throw new AppError('This document was sent to another email address.', 403, {
        code: 'RECIPIENT_EMAIL_MISMATCH'
      });
    }

    const recipientUserExists = canRevealSensitiveData && authenticatedRecipient
      ? Boolean(
          await this.prisma.user.findFirst({
            where: { email: { in: recipientEmails } },
            select: { id: true }
          })
        )
      : false;
    const revealedMetadata = canRevealSensitiveData ? sanitizePublicDocumentMetadata(metadata) : {};
    if (canRevealSensitiveData && typeof metadata.logoAssetId === 'string') {
      revealedMetadata.clientLogoUrl = buildPublicAssetUrl(input.token, metadata.logoAssetId);
    }
    const currentStatus = normalizeCommercialStatus(kind, metadata);
    const canDecide = authenticatedRecipient && allowAcceptReject && !isTerminalCommercialStatus(currentStatus);

    return {
      title: document.title,
      content: canRevealSensitiveData ? document.content : '',
      kind,
      status: currentStatus,
      metadata: revealedMetadata,
      masked: !canRevealSensitiveData,
      access: authenticatedRecipient ? 'authenticated_recipient' : 'public_token',
      requiresLogin,
      allowAcceptReject,
      canDecide,
      workspace: {
        name: document.workspace.name
      },
      recipientEmail: authenticatedRecipient ? recipientEmails[0] ?? '' : '',
      recipientEmails: authenticatedRecipient ? recipientEmails : [],
      recipientUserExists: authenticatedRecipient ? recipientUserExists : false
    };
  }

  public async decidePublicCommercialDocument(input: {
    token: string;
    userId: string;
    decision: PublicDocumentDecision;
    requestContext?: {
      ip?: string;
      userAgent?: string;
    };
  }) {
    const current = await this.findPublicDocumentByToken(input.token);
    const kind = normalizeDocumentKind(current.kind);
    const metadata = normalizeDocumentMetadata(kind, current.metadata);
    const user = await this.prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, email: true }
    });

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    if (!readAllowAcceptReject(metadata)) {
      throw new AppError('Document decisions are disabled for this link.', 403, {
        code: 'DOCUMENT_DECISION_DISABLED'
      });
    }

    const recipientEmails = readRecipientEmails(metadata);
    if (recipientEmails.length === 0 || !recipientEmails.includes(normalizeEmail(user.email))) {
      throw new AppError('This document was sent to another email address.', 403, {
        code: 'RECIPIENT_EMAIL_MISMATCH'
      });
    }

    const currentStatus = normalizeCommercialStatus(kind, metadata);
    if (currentStatus === 'approved' || currentStatus === 'accepted' || currentStatus === 'signed') {
      throw new AppError('Document has already been accepted.', 409, { code: 'DOCUMENT_ALREADY_ACCEPTED' });
    }
    if (currentStatus === 'rejected') {
      throw new AppError('Document has already been rejected.', 409, { code: 'DOCUMENT_ALREADY_REJECTED' });
    }

    const now = new Date();
    const contentHash = hashDocumentContent(current.content);
    const auditMetadata = {
      acceptedByEmail: user.email,
      acceptedByUserId: user.id,
      acceptedIp: input.requestContext?.ip ?? null,
      acceptedUserAgent: input.requestContext?.userAgent ?? null,
      decisionSource: 'public',
      decisionContentHash: contentHash,
      decisionVersion: current.updatedAt.toISOString()
    };
    let nextStatus: CommercialDocumentStatus;
    let nextMetadata: DocumentMetadata;

    if (input.decision === 'reject') {
      nextStatus = 'rejected';
      nextMetadata = {
        ...metadata,
        status: nextStatus,
        rejectedAt: now.toISOString(),
        rejectedByEmail: user.email,
        rejectedByUserId: user.id,
        rejectedIp: input.requestContext?.ip ?? null,
        rejectedUserAgent: input.requestContext?.userAgent ?? null,
        decisionSource: 'public',
        decisionContentHash: contentHash,
        decisionVersion: current.updatedAt.toISOString()
      };
    } else if (kind === 'proposal' && input.decision === 'approve') {
      nextStatus = 'approved';
      nextMetadata = {
        ...metadata,
        status: nextStatus,
        approvedAt: now.toISOString(),
        ...auditMetadata
      };
    } else if (kind === 'contract' && (input.decision === 'accept' || input.decision === 'sign')) {
      nextStatus = input.decision === 'sign' ? 'signed' : 'accepted';
      nextMetadata = {
        ...metadata,
        status: nextStatus,
        acceptedAt: now.toISOString(),
        signedAt: nextStatus === 'signed' ? now.toISOString() : metadata.signedAt,
        ...auditMetadata
      };
    } else {
      throw new AppError('Invalid decision for document type.', 422, { code: 'INVALID_DOCUMENT_DECISION' });
    }

    const document = await this.prisma.workspaceDocument.update({
      where: { id: current.id },
      data: {
        metadata: toInputJson(nextMetadata),
        updatedBy: user.id
      }
    });

    await this.publishDocumentStatusEvent({
      workspaceId: current.workspaceId,
      userId: user.id,
      document,
      previousStatus: currentStatus,
      nextStatus
    });
    await this.publishDocumentationEvent({
      name: DomainEventNames.DocumentDecisionRecorded,
      workspaceId: current.workspaceId,
      userId: user.id,
      aggregateId: current.id,
      payload: {
        documentId: current.id,
        decision: input.decision,
        source: 'public',
        status: nextStatus,
        contentHash,
        version: current.updatedAt.toISOString(),
        userAgent: input.requestContext?.userAgent ?? null,
        ip: input.requestContext?.ip ?? null
      }
    });

    return this.serialize(document);
  }

  public async decideInternalCommercialDocument(input: {
    workspaceId: string;
    documentId: string;
    userId: string;
    payload: {
      decision: DocumentDecision;
      reason?: string | null;
    };
  }) {
    await this.configService.ensureItemWritableWorkspace(input.workspaceId, input.userId);

    const current = await this.prisma.workspaceDocument.findFirst({
      where: {
        id: input.documentId,
        workspaceId: input.workspaceId
      }
    });

    if (!current) {
      throw new AppError('Workspace document not found', 404);
    }

    const kind = normalizeDocumentKind(current.kind);
    if (kind === 'wiki') {
      throw new AppError('Invalid decision for document type.', 422, { code: 'INVALID_DOCUMENT_DECISION' });
    }

    const metadata = normalizeDocumentMetadata(kind, current.metadata);
    const currentStatus = normalizeCommercialStatus(kind, metadata);
    if (currentStatus === 'approved' || currentStatus === 'accepted' || currentStatus === 'signed') {
      throw new AppError('Document has already been accepted.', 409, { code: 'DOCUMENT_ALREADY_ACCEPTED' });
    }
    if (currentStatus === 'rejected') {
      throw new AppError('Document has already been rejected.', 409, { code: 'DOCUMENT_ALREADY_REJECTED' });
    }

    const now = new Date();
    const contentHash = hashDocumentContent(current.content);
    let nextStatus: CommercialDocumentStatus;
    let nextMetadata: DocumentMetadata;

    if (input.payload.decision === 'reject') {
      nextStatus = 'rejected';
      nextMetadata = {
        ...metadata,
        status: nextStatus,
        rejectedAt: now.toISOString(),
        rejectedByUserId: input.userId,
        rejectedReason: input.payload.reason ?? null,
        decisionSource: 'internal',
        decisionContentHash: contentHash,
        decisionVersion: current.updatedAt.toISOString()
      };
    } else if (kind === 'proposal' && input.payload.decision === 'approve') {
      nextStatus = 'approved';
      nextMetadata = {
        ...metadata,
        status: nextStatus,
        approvedAt: now.toISOString(),
        acceptedByUserId: input.userId,
        decisionSource: 'internal',
        decisionContentHash: contentHash,
        decisionVersion: current.updatedAt.toISOString()
      };
    } else if (kind === 'contract' && (input.payload.decision === 'accept' || input.payload.decision === 'sign')) {
      nextStatus = input.payload.decision === 'sign' ? 'signed' : 'accepted';
      nextMetadata = {
        ...metadata,
        status: nextStatus,
        acceptedAt: now.toISOString(),
        signedAt: nextStatus === 'signed' ? now.toISOString() : metadata.signedAt,
        acceptedByUserId: input.userId,
        decisionSource: 'internal',
        decisionContentHash: contentHash,
        decisionVersion: current.updatedAt.toISOString()
      };
    } else {
      throw new AppError('Invalid decision for document type.', 422, { code: 'INVALID_DOCUMENT_DECISION' });
    }

    const document = await this.prisma.workspaceDocument.update({
      where: { id: current.id },
      data: {
        metadata: toInputJson(nextMetadata),
        updatedBy: input.userId
      }
    });

    await this.publishDocumentStatusEvent({
      workspaceId: input.workspaceId,
      userId: input.userId,
      document,
      previousStatus: currentStatus,
      nextStatus
    });
    await this.publishDocumentationEvent({
      name: DomainEventNames.DocumentDecisionRecorded,
      workspaceId: input.workspaceId,
      userId: input.userId,
      aggregateId: current.id,
      payload: {
        documentId: current.id,
        decision: input.payload.decision,
        source: 'internal',
        status: nextStatus,
        reason: input.payload.reason ?? null,
        contentHash,
        version: current.updatedAt.toISOString()
      }
    });

    return this.serialize(document);
  }

  public async listDocumentAssets(input: { workspaceId: string; documentId: string; userId: string }) {
    await this.ensureDocumentReadableByUser(input);

    const assets = await this.prisma.documentAsset.findMany({
      where: {
        workspaceId: input.workspaceId,
        documentId: input.documentId
      },
      orderBy: [{ createdAt: 'desc' }]
    });

    return assets.map((asset) => this.serializeAsset(asset));
  }

  public async uploadDocumentAsset(input: {
    workspaceId: string;
    documentId: string;
    userId: string;
    payload: {
      type: DocumentAssetType;
      filename: string;
      contentType: string;
      dataBase64?: string;
      buffer?: Buffer;
    };
  }) {
    await this.configService.ensureItemWritableWorkspace(input.workspaceId, input.userId);
    await this.ensureDocument(input.workspaceId, input.documentId);

    const contentType = input.payload.contentType.trim().toLowerCase();
    this.assertAllowedAsset(input.payload.type, contentType);

    let buffer = input.payload.buffer;
    if (!buffer) {
      if (!input.payload.dataBase64) {
        throw new AppError('Invalid asset payload.', 422);
      }
      try {
        buffer = Buffer.from(input.payload.dataBase64, 'base64');
      } catch {
        throw new AppError('Invalid asset payload.', 422);
      }
    }

    if (buffer.length === 0) {
      throw new AppError('Asset file is empty.', 422);
    }

    const maxSize = maxAssetSizeByType[input.payload.type];
    if (buffer.length > maxSize) {
      throw new AppError('Asset file is too large.', 413, { maxSize });
    }

    const assetId = randomUUID();
    const filename = this.safeFilename(input.payload.filename);
    const storageKey = `${input.workspaceId}/${input.documentId}/${assetId}-${filename}`;
    const absolutePath = this.resolveAssetPath(storageKey);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, buffer);

    const asset = await this.prisma.documentAsset.create({
      data: {
        id: assetId,
        workspaceId: input.workspaceId,
        documentId: input.documentId,
        type: input.payload.type,
        storageKey,
        filename,
        contentType,
        size: buffer.length,
        checksum: createHash('sha256').update(buffer).digest('hex'),
        uploadedBy: input.userId
      }
    });

    await this.publishDocumentationEvent({
      name: DomainEventNames.DocumentAssetUploaded,
      workspaceId: input.workspaceId,
      userId: input.userId,
      aggregateId: input.documentId,
      payload: {
        documentId: input.documentId,
        assetId: asset.id,
        assetType: asset.type,
        filename: asset.filename,
        contentType: asset.contentType,
        size: asset.size,
        checksum: asset.checksum
      }
    });

    return this.serializeAsset(asset);
  }

  public async getDocumentAssetContent(input: {
    workspaceId: string;
    documentId: string;
    assetId: string;
    userId: string;
  }) {
    await this.ensureDocumentReadableByUser(input);
    const asset = await this.ensureAsset(input.workspaceId, input.documentId, input.assetId);
    return {
      ...this.serializeAsset(asset),
      absolutePath: this.resolveAssetPath(asset.storageKey)
    };
  }

  public async getPublicDocumentAssetContent(input: {
    token: string;
    assetId: string;
    requestingUserId?: string | null;
    requestingUserEmail?: string | null;
  }) {
    const document = await this.findPublicDocumentByToken(input.token);
    await this.assertPublicDocumentCanReveal({
      document,
      requestingUserId: input.requestingUserId,
      requestingUserEmail: input.requestingUserEmail
    });
    const asset = await this.ensureAsset(document.workspaceId, document.id, input.assetId);
    return {
      ...this.serializeAsset(asset, input.token),
      absolutePath: this.resolveAssetPath(asset.storageKey)
    };
  }

  public async deleteDocumentAsset(input: {
    workspaceId: string;
    documentId: string;
    assetId: string;
    userId: string;
  }) {
    await this.configService.ensureItemWritableWorkspace(input.workspaceId, input.userId);
    const asset = await this.ensureAsset(input.workspaceId, input.documentId, input.assetId);
    await this.prisma.documentAsset.delete({ where: { id: asset.id } });
    await fs.rm(this.resolveAssetPath(asset.storageKey), { force: true });
    await this.publishDocumentationEvent({
      name: DomainEventNames.DocumentAssetDeleted,
      workspaceId: input.workspaceId,
      userId: input.userId,
      aggregateId: input.documentId,
      payload: {
        documentId: input.documentId,
        assetId: asset.id,
        assetType: asset.type,
        filename: asset.filename
      }
    });
  }

  public async updateDocument(input: {
    workspaceId: string;
    documentId: string;
    userId: string;
    payload: {
      title?: string;
      content?: string;
      kind?: DocumentKind;
      linkedEntityType?: DocumentLinkedEntityType | null;
      linkedEntityId?: string | null;
      tags?: string[];
      metadata?: DocumentMetadata;
      position?: number;
      expectedUpdatedAt?: string;
    };
  }) {
    await this.configService.ensureReadableWorkspace(input.workspaceId, input.userId);
    const customerScope = await resolveCustomerAccessScope(this.prisma, input);

    const current = await this.prisma.workspaceDocument.findFirst({
      where: {
        id: input.documentId,
        workspaceId: input.workspaceId
      }
    });

    if (!current) {
      throw new AppError('Workspace document not found', 404);
    }

    const isClientFolderMove = customerScope.isClient && this.isClientFolderMovePayload(input.payload, current.metadata);
    if (customerScope.isClient) {
      requireClientCustomerScope(customerScope);
      if (!isClientFolderMove) {
        throw new AppError('Clients can only organize visible documents.', 403, {
          code: 'DOCUMENT_CLIENT_UPDATE_NOT_ALLOWED'
        });
      }
      await this.ensureDocumentReadableByUser(input);
      const targetFolderId = readFolderId(input.payload.metadata);
      if (targetFolderId) {
        await this.ensureClientManagedFolder(input.workspaceId, targetFolderId, input.userId);
      }
    } else {
      await this.configService.ensureItemWritableWorkspace(input.workspaceId, input.userId);
    }

    if (input.payload.expectedUpdatedAt && current.updatedAt.toISOString() !== input.payload.expectedUpdatedAt) {
      throw new AppError('Document has changed since this draft was loaded.', 409, {
        code: 'DOCUMENT_VERSION_CONFLICT',
        currentUpdatedAt: current.updatedAt.toISOString()
      });
    }

    const previousStatus = readMetadataStatus(current.metadata);
    const nextKind = normalizeDocumentKind(input.payload.kind ?? current.kind);
    const metadata =
      input.payload.metadata === undefined ? undefined : normalizeDocumentMetadata(nextKind, input.payload.metadata);
    const folderId = metadata ? readFolderId(metadata) : null;
    if (folderId) {
      await this.ensureFolder(input.workspaceId, folderId);
    }
    const contentChanged = input.payload.content !== undefined && input.payload.content !== current.content;
    const titleChanged = input.payload.title !== undefined && input.payload.title !== current.title;
    const nextMetadata =
      metadata && (contentChanged || titleChanged) && isTerminalCommercialStatus(previousStatus)
        ? {
            ...metadata,
            status: 'sent',
            decisionInvalidatedAt: new Date().toISOString(),
            previousDecisionStatus: previousStatus
          }
        : metadata;
    const document = await this.prisma.workspaceDocument.update({
      where: { id: current.id },
      data: {
        title: input.payload.title,
        content: input.payload.content,
        kind: input.payload.kind,
        linkedEntityType: input.payload.linkedEntityType,
        linkedEntityId: input.payload.linkedEntityId,
        tags: input.payload.tags,
        metadata: nextMetadata === undefined ? undefined : toInputJson(nextMetadata),
        position: input.payload.position,
        updatedBy: input.userId
      }
    });

    await this.publishDocumentStatusEvent({
      workspaceId: input.workspaceId,
      userId: input.userId,
      document,
      previousStatus,
      nextStatus: readMetadataStatus(document.metadata)
    });
    const previousFolderId = readFolderId(current.metadata);
    const nextFolderId = readFolderId(document.metadata);
    if (previousFolderId !== nextFolderId) {
      await this.publishDocumentationEvent({
        name: DomainEventNames.DocumentMoved,
        workspaceId: input.workspaceId,
        userId: input.userId,
        aggregateId: document.id,
        payload: {
          documentId: document.id,
          previousFolderId,
          folderId: nextFolderId,
          source: customerScope.isClient ? 'client' : 'internal'
        }
      });
    }

    return this.serialize(document);
  }

  private buildDocumentListWhere(input: {
    workspaceId: string;
    filters: DocumentListFilters;
    isClient: boolean;
    customerIds: string[];
    clientItemIds: string[];
  }): Prisma.WorkspaceDocumentWhereInput {
    const filters = input.filters;
    const and: Prisma.WorkspaceDocumentWhereInput[] = [{ workspaceId: input.workspaceId }];
    const kind = filters.kind ?? filters.type;
    const status = filters.commercialStatus ?? filters.status;

    if (kind) {
      and.push({ kind });
    }

    if (filters.search) {
      const search = filters.search.trim();
      and.push({
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { content: { contains: search, mode: 'insensitive' } },
          { tags: { has: search } }
        ]
      });
    }

    if (filters.folderId !== undefined) {
      if (filters.folderId) {
        and.push({ metadata: { path: ['folderId'], equals: filters.folderId } });
      } else {
        and.push({
          NOT: {
            metadata: {
              path: ['folderId'],
              not: Prisma.JsonNull
            }
          }
        });
      }
    }

    if (filters.tags?.length) {
      and.push({ tags: { hasEvery: filters.tags } });
    }

    if (status) {
      and.push({ metadata: { path: ['status'], equals: status } });
    }

    if (filters.visibility) {
      and.push({ metadata: { path: ['visibility'], equals: filters.visibility } });
    }

    if (filters.linkedWorkItemId) {
      and.push({
        OR: [
          { linkedEntityType: 'work_item', linkedEntityId: filters.linkedWorkItemId },
          { itemLinks: { some: { itemId: filters.linkedWorkItemId } } },
          { metadata: { path: ['linkedWorkItemId'], equals: filters.linkedWorkItemId } },
          { metadata: { path: ['workItemId'], equals: filters.linkedWorkItemId } }
        ]
      });
    }

    if (filters.createdBy) {
      and.push({ createdBy: filters.createdBy });
    }

    if (filters.updatedAtFrom || filters.updatedAtTo) {
      and.push({
        updatedAt: {
          ...(filters.updatedAtFrom ? { gte: filters.updatedAtFrom } : {}),
          ...(filters.updatedAtTo ? { lte: filters.updatedAtTo } : {})
        }
      });
    }

    if (input.isClient) {
      and.push({
        kind: {
          in: ['proposal', 'contract']
        },
        OR: [
          ...input.customerIds.flatMap((customerId) => [
            {
              linkedEntityType: 'customer',
              linkedEntityId: customerId
            },
            {
              metadata: {
                path: ['customerId'],
                equals: customerId
              }
            },
            {
              metadata: {
                path: ['customer', 'id'],
                equals: customerId
              }
            }
          ]),
          ...(input.clientItemIds.length > 0
            ? [
                { linkedEntityType: 'work_item', linkedEntityId: { in: input.clientItemIds } },
                { itemLinks: { some: { itemId: { in: input.clientItemIds } } } }
              ]
            : [])
        ]
      });
    }

    return and.length === 1 ? and[0] : { AND: and };
  }

  private buildDocumentListOrderBy(filters: DocumentListFilters): Prisma.WorkspaceDocumentOrderByWithRelationInput[] {
    switch (filters.sort) {
      case 'updated_asc':
        return [{ updatedAt: 'asc' }, { id: 'asc' }];
      case 'created_desc':
        return [{ createdAt: 'desc' }, { id: 'asc' }];
      case 'created_asc':
        return [{ createdAt: 'asc' }, { id: 'asc' }];
      case 'title_asc':
        return [{ title: 'asc' }, { id: 'asc' }];
      case 'updated_desc':
        return [{ updatedAt: 'desc' }, { id: 'asc' }];
      case 'position_asc':
      default:
        return [{ position: 'asc' }, { updatedAt: 'desc' }, { id: 'asc' }];
    }
  }

  private isClientFolderMovePayload(
    payload: {
      title?: string;
      content?: string;
      kind?: DocumentKind;
      linkedEntityType?: DocumentLinkedEntityType | null;
      linkedEntityId?: string | null;
      tags?: string[];
      metadata?: DocumentMetadata;
      position?: number;
      expectedUpdatedAt?: string;
    },
    currentMetadata: unknown
  ): boolean {
    const changedKeys = Object.entries(payload).filter(([key, value]) => key !== 'expectedUpdatedAt' && value !== undefined);
    if (changedKeys.length !== 1 || !payload.metadata) {
      return false;
    }

    const previousMetadata = normalizeDocumentMetadata('wiki', currentMetadata);
    const nextMetadata = normalizeDocumentMetadata('wiki', payload.metadata);
    const previousFolderId = readFolderId(previousMetadata);
    const nextFolderId = readFolderId(nextMetadata);
    if (previousFolderId === nextFolderId) {
      return true;
    }

    const sanitizedPrevious = { ...previousMetadata };
    const sanitizedNext = { ...nextMetadata };
    delete sanitizedPrevious.folderId;
    delete sanitizedNext.folderId;

    return JSON.stringify(sanitizedPrevious) === JSON.stringify(sanitizedNext);
  }

  private async ensureClientManagedFolder(workspaceId: string, folderId: string, userId: string) {
    const folder = await this.ensureFolder(workspaceId, folderId);
    if (folder.createdBy !== userId) {
      throw new AppError('Clients can only organize their own folders.', 403, {
        code: 'DOCUMENT_FOLDER_NOT_MANAGEABLE'
      });
    }
    return folder;
  }

  private async assertClientCanOrganizeDocuments(input: {
    workspaceId: string;
    userId: string;
    documents: Array<{ id: string }>;
  }) {
    await Promise.all(
      input.documents.map((document) =>
        this.ensureDocumentReadableByUser({
          workspaceId: input.workspaceId,
          documentId: document.id,
          userId: input.userId
        })
      )
    );
  }

  private async ensureDocumentReadableByUser(input: { workspaceId: string; documentId: string; userId: string }) {
    await this.configService.ensureReadableWorkspace(input.workspaceId, input.userId);
    const customerScope = await resolveCustomerAccessScope(this.prisma, input);
    const customerIds = requireClientCustomerScope(customerScope);

    let clientItemIds: string[] = [];
    if (customerScope.isClient && customerIds.length > 0) {
      const clientItems = await this.prisma.item.findMany({
        where: {
          workspaceId: input.workspaceId,
          OR: customerIds.flatMap((customerId) => [
            { fields: { path: ['customerId'], equals: customerId } },
            { metadata: { path: ['customerId'], equals: customerId } },
            { metadata: { path: ['clientAnchorCustomerId'], equals: customerId } }
          ])
        },
        select: { id: true }
      });
      clientItemIds = clientItems.map((item) => item.id);
    }

    const document = await this.prisma.workspaceDocument.findFirst({
      where: {
        id: input.documentId,
        ...this.buildDocumentListWhere({
          workspaceId: input.workspaceId,
          filters: {},
          isClient: customerScope.isClient,
          customerIds,
          clientItemIds
        })
      },
      select: { id: true }
    });

    if (!document) {
      throw new AppError('Workspace document not found', 404);
    }
  }

  private async assertPublicDocumentCanReveal(input: {
    document: Awaited<ReturnType<WorkspaceDocumentsService['findPublicDocumentByToken']>>;
    requestingUserId?: string | null;
    requestingUserEmail?: string | null;
  }) {
    const kind = normalizeDocumentKind(input.document.kind);
    const metadata = normalizeDocumentMetadata(kind, input.document.metadata);
    const recipientEmails = readRecipientEmails(metadata);
    const requestingUserEmail = normalizeEmail(input.requestingUserEmail ?? '');
    const clientUserId = typeof metadata.clientUserId === 'string' ? metadata.clientUserId.trim() : '';
    if (!readRequireLogin(metadata)) {
      return;
    }

    const canRevealSensitiveData = Boolean(
      input.requestingUserId &&
        ((requestingUserEmail && recipientEmails.includes(requestingUserEmail)) ||
          (clientUserId && clientUserId === input.requestingUserId))
    );

    if (!canRevealSensitiveData) {
      throw new AppError('Authentication required.', 401, { code: 'DOCUMENT_AUTH_REQUIRED' });
    }
  }

  private async findPublicDocumentByToken(token: string) {
    const trimmedToken = token.trim();

    if (trimmedToken.length < 32) {
      throw new AppError('Document link not found.', 404, { code: 'TOKEN_INVALID' });
    }

    const document = await this.prisma.workspaceDocument.findFirst({
      where: {
        metadata: {
          path: ['publicToken'],
          equals: trimmedToken
        }
      },
      include: {
        workspace: {
          select: { name: true }
        }
      }
    });

    if (!document) {
      throw new AppError('Document link not found.', 404, { code: 'TOKEN_INVALID' });
    }

    const kind = normalizeDocumentKind(document.kind);
    if (kind === 'wiki') {
      throw new AppError('Document link not found.', 404, { code: 'TOKEN_INVALID' });
    }

    const metadata = normalizeDocumentMetadata(kind, document.metadata);
    assertPublicTokenCanOpen(metadata);

    const status = normalizeCommercialStatus(kind, metadata);
    const sentToEmail = typeof metadata.sentToEmail === 'string' ? metadata.sentToEmail.trim() : '';
    if (!status || status === 'draft' || sentToEmail.length === 0) {
      throw new AppError('Document link is not available.', 404, { code: 'DOCUMENT_NOT_SENT' });
    }

    return document;
  }

  private async publishDocumentationEvent(input: {
    name: (typeof DomainEventNames)[keyof typeof DomainEventNames];
    workspaceId: string;
    userId: string;
    aggregateId: string;
    payload: Record<string, unknown>;
  }) {
    await this.eventPublisher.publish({
      id: randomUUID(),
      name: input.name,
      aggregateType: 'document',
      aggregateId: input.aggregateId,
      occurredAt: new Date(),
      payload: {
        workspaceId: input.workspaceId,
        requestedBy: input.userId,
        ...input.payload
      }
    });
  }

  private async publishDocumentCreatedEvent(input: {
    workspaceId: string;
    userId: string;
    document: { id: string; kind?: string | null; linkedEntityType?: string | null; linkedEntityId?: string | null };
  }) {
    const kind = normalizeDocumentKind(input.document.kind);
    const eventName =
      kind === 'proposal'
        ? DomainEventNames.ProposalCreated
        : kind === 'contract'
          ? DomainEventNames.ContractCreated
          : null;

    if (!eventName) {
      return;
    }

    await this.eventPublisher.publish({
      id: randomUUID(),
      name: eventName,
      aggregateType: kind,
      aggregateId: input.document.id,
      occurredAt: new Date(),
      payload: {
        workspaceId: input.workspaceId,
        documentId: input.document.id,
        ...this.toWorkItemLinkPayload(input.document),
        idempotencyKey: `${eventName}:${input.document.id}:${input.document.linkedEntityId ?? 'unlinked'}`,
        requestedBy: input.userId
      }
    });
  }

  private async publishDocumentStatusEvent(input: {
    workspaceId: string;
    userId: string;
    document: { id: string; kind?: string | null; linkedEntityType?: string | null; linkedEntityId?: string | null };
    previousStatus: string | null;
    nextStatus: string | null;
  }) {
    if (!input.nextStatus || input.previousStatus === input.nextStatus) {
      return;
    }

    const kind = normalizeDocumentKind(input.document.kind);
    const eventName =
      kind === 'proposal' && input.nextStatus === 'sent'
        ? DomainEventNames.ProposalSent
        : kind === 'contract' && input.nextStatus === 'sent'
          ? DomainEventNames.ContractSent
        : kind === 'proposal' && input.nextStatus === 'approved'
          ? DomainEventNames.ProposalApproved
          : kind === 'proposal' && input.nextStatus === 'rejected'
            ? DomainEventNames.ProposalRejected
          : kind === 'contract' && (input.nextStatus === 'accepted' || input.nextStatus === 'signed')
            ? DomainEventNames.ContractAccepted
            : kind === 'contract' && input.nextStatus === 'rejected'
              ? DomainEventNames.ContractRejected
              : null;

    if (!eventName) {
      return;
    }

    await this.eventPublisher.publish({
      id: randomUUID(),
      name: eventName,
      aggregateType: kind,
      aggregateId: input.document.id,
      occurredAt: new Date(),
      payload: {
        workspaceId: input.workspaceId,
        documentId: input.document.id,
        status: input.nextStatus,
        ...this.toWorkItemLinkPayload(input.document),
        idempotencyKey: `${eventName}:${input.document.id}:${input.document.linkedEntityId ?? 'unlinked'}:${input.nextStatus}`,
        requestedBy: input.userId
      }
    });
  }

  private async publishDocumentSentEvent(input: {
    workspaceId: string;
    userId: string;
    document: { id: string; kind?: string | null; linkedEntityType?: string | null; linkedEntityId?: string | null };
    sentAt: Date;
    sentToEmails: string[];
  }) {
    const kind = normalizeDocumentKind(input.document.kind);
    const eventName =
      kind === 'proposal'
        ? DomainEventNames.ProposalSent
        : kind === 'contract'
          ? DomainEventNames.ContractSent
          : null;

    if (!eventName) {
      return;
    }

    await this.eventPublisher.publish({
      id: randomUUID(),
      name: eventName,
      aggregateType: kind,
      aggregateId: input.document.id,
      occurredAt: new Date(),
      payload: {
        workspaceId: input.workspaceId,
        documentId: input.document.id,
        status: 'sent',
        sentAt: input.sentAt.toISOString(),
        sentToEmail: input.sentToEmails[0] ?? '',
        sentToEmails: input.sentToEmails,
        publicTokenIssued: true,
        ...this.toWorkItemLinkPayload(input.document),
        idempotencyKey: `${eventName}:${input.document.id}:${input.document.linkedEntityId ?? 'unlinked'}:sent`,
        requestedBy: input.userId
      }
    });
  }

  private toWorkItemLinkPayload(document: { linkedEntityType?: string | null; linkedEntityId?: string | null }) {
    const linkedEntityType = document.linkedEntityType ?? null;
    const linkedEntityId = document.linkedEntityId ?? null;

    if (linkedEntityType === 'work_item' && linkedEntityId) {
      return {
        linkedEntityType,
        linkedEntityId,
        itemId: linkedEntityId,
        workItemId: linkedEntityId
      };
    }

    return {
      linkedEntityType,
      linkedEntityId
    };
  }

  public async deleteDocument(input: { workspaceId: string; documentId: string; userId: string }) {
    await this.configService.ensureItemWritableWorkspace(input.workspaceId, input.userId);

    const current = await this.prisma.workspaceDocument.findFirst({
      where: {
        id: input.documentId,
        workspaceId: input.workspaceId
      },
      select: { id: true }
    });

    if (!current) {
      throw new AppError('Workspace document not found', 404);
    }

    await this.prisma.workspaceDocument.delete({
      where: { id: current.id }
    });
  }

  private async ensureDocument(workspaceId: string, documentId: string) {
    const document = await this.prisma.workspaceDocument.findFirst({
      where: { id: documentId, workspaceId },
      select: { id: true }
    });

    if (!document) {
      throw new AppError('Workspace document not found', 404);
    }

    return document;
  }

  private async ensureAsset(workspaceId: string, documentId: string, assetId: string) {
    const asset = await this.prisma.documentAsset.findFirst({
      where: {
        id: assetId,
        workspaceId,
        documentId
      }
    });

    if (!asset) {
      throw new AppError('Document asset not found', 404);
    }

    return asset;
  }

  private resolveAssetPath(storageKey: string): string {
    const root = path.resolve(process.cwd(), env.DOCUMENT_ASSET_STORAGE_DIR);
    const absolutePath = path.resolve(root, storageKey);
    if (!absolutePath.startsWith(root)) {
      throw new AppError('Invalid asset storage key.', 500);
    }
    return absolutePath;
  }

  private safeFilename(filename: string): string {
    const normalized = filename
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .slice(0, 160);
    return normalized.length > 0 ? normalized : 'asset';
  }

  private assertAllowedAsset(type: DocumentAssetType, contentType: string): void {
    const allowed = type === 'logo' ? allowedLogoContentTypes : allowedAttachmentContentTypes;
    if (!allowed.has(contentType)) {
      throw new AppError('Asset content type is not allowed.', 422, {
        code: 'DOCUMENT_ASSET_TYPE_NOT_ALLOWED',
        contentType
      });
    }
  }

  private async ensureFolder(workspaceId: string, folderId: string) {
    const folder = await this.prisma.workspaceDocumentFolder.findFirst({
      where: { id: folderId, workspaceId }
    });

    if (!folder) {
      throw new AppError('Workspace document folder not found', 404);
    }

    return folder;
  }

  private async collectDescendantFolderIds(workspaceId: string, folderId: string): Promise<string[]> {
    const children = await this.prisma.workspaceDocumentFolder.findMany({
      where: { workspaceId, parentId: folderId },
      select: { id: true }
    });
    const nested = await Promise.all(
      children.map((child) => this.collectDescendantFolderIds(workspaceId, child.id))
    );

    return children.flatMap((child, index) => [child.id, ...(nested[index] ?? [])]);
  }

  private serializeFolder(folder: {
    id: string;
    workspaceId: string;
    name: string;
    parentId: string | null;
    position: number;
    createdBy: string;
    updatedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: folder.id,
      workspaceId: folder.workspaceId,
      name: folder.name,
      parentId: folder.parentId,
      position: folder.position,
      createdBy: folder.createdBy,
      updatedBy: folder.updatedBy,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt
    };
  }

  private serializeAsset(asset: {
    id: string;
    workspaceId: string;
    documentId: string;
    type: string;
    storageKey: string;
    filename: string;
    contentType: string;
    size: number;
    checksum: string;
    uploadedBy: string;
    createdAt: Date;
  }, publicToken?: string) {
    return {
      id: asset.id,
      workspaceId: asset.workspaceId,
      documentId: asset.documentId,
      type: asset.type,
      storageKey: asset.storageKey,
      filename: asset.filename,
      contentType: asset.contentType,
      size: asset.size,
      checksum: asset.checksum,
      uploadedBy: asset.uploadedBy,
      createdAt: asset.createdAt,
      contentUrl: publicToken ? buildPublicAssetUrl(publicToken, asset.id) : buildInternalAssetUrl(asset)
    };
  }

  private serialize(document: {
    id: string;
    workspaceId: string;
    title: string;
    content: string;
    kind?: string | null;
    linkedEntityType?: string | null;
    linkedEntityId?: string | null;
    tags?: string[];
    metadata?: Prisma.JsonValue | null;
    position: number;
    createdBy: string;
    updatedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: document.id,
      workspaceId: document.workspaceId,
      title: document.title,
      content: document.content,
      kind: normalizeDocumentKind(document.kind),
      linkedEntityType: document.linkedEntityType ?? undefined,
      linkedEntityId: document.linkedEntityId ?? undefined,
      tags: document.tags ?? [],
      metadata: normalizeDocumentMetadata(normalizeDocumentKind(document.kind), document.metadata),
      position: document.position,
      createdBy: document.createdBy,
      updatedBy: document.updatedBy,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt
    };
  }
}
