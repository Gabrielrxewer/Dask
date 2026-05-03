import { Prisma, type PrismaClient } from '@prisma/client';
import { randomBytes, randomUUID } from 'crypto';
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

export class WorkspaceDocumentsService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly configService: WorkspaceConfigService,
    private readonly eventPublisher: EventPublisher,
    private readonly emailService: EmailService
  ) {}

  public async listDocuments(input: { workspaceId: string; userId: string }) {
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

    const documents = await this.prisma.workspaceDocument.findMany({
      where: {
        workspaceId: input.workspaceId,
        ...(customerScope.isClient
          ? {
              kind: {
                in: ['proposal', 'contract']
              },
              OR: [
                ...customerIds.flatMap((customerId) => [
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
                ...(clientItemIds.length > 0
                  ? [{ linkedEntityType: 'work_item', linkedEntityId: { in: clientItemIds } }]
                  : [])
              ]
            }
          : {})
      },
      orderBy: [{ position: 'asc' }, { updatedAt: 'desc' }]
    });

    return documents.map((document) => this.serialize(document));
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
    };
  }) {
    await this.configService.ensureItemWritableWorkspace(input.workspaceId, input.userId);

    const defaultPosition = await this.prisma.workspaceDocument.count({
      where: { workspaceId: input.workspaceId }
    });

    const document = await this.prisma.workspaceDocument.create({
      data: {
        workspaceId: input.workspaceId,
        title: input.payload.title.trim(),
        content: input.payload.content ?? '',
        kind: input.payload.kind ?? 'wiki',
        linkedEntityType: input.payload.linkedEntityType,
        linkedEntityId: input.payload.linkedEntityId,
        tags: input.payload.tags ?? [],
        metadata: toInputJson(normalizeDocumentMetadata(input.payload.kind ?? 'wiki', input.payload.metadata)),
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
    const tokenMetadata = {
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
      status: 'sent'
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
      sentToEmails: recipientEmails,
      publicToken
    });

    return this.serialize(document);
  }

  public async resolvePublicDocumentToken(input: { token: string }) {
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
      recipientEmail: recipientEmails[0] ?? '',
      recipientEmails
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
    const canRevealSensitiveData = Boolean(
      input.requestingUserId &&
        ((requestingUserEmail && recipientEmails.includes(requestingUserEmail)) ||
          (clientUserId && clientUserId === input.requestingUserId))
    );
    const recipientUserExists = canRevealSensitiveData
      ? Boolean(
          await this.prisma.user.findFirst({
            where: { email: { in: recipientEmails } },
            select: { id: true }
          })
        )
      : false;

    return {
      title: document.title,
      content: canRevealSensitiveData ? document.content : '',
      kind,
      status: normalizeCommercialStatus(kind, metadata),
      metadata: canRevealSensitiveData ? metadata : {},
      masked: !canRevealSensitiveData,
      workspace: {
        name: document.workspace.name
      },
      recipientEmail: canRevealSensitiveData ? recipientEmails[0] ?? '' : '',
      recipientEmails: canRevealSensitiveData ? recipientEmails : [],
      recipientUserExists: canRevealSensitiveData ? recipientUserExists : false
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
    const auditMetadata = {
      acceptedByEmail: user.email,
      acceptedByUserId: user.id,
      acceptedIp: input.requestContext?.ip ?? null,
      acceptedUserAgent: input.requestContext?.userAgent ?? null
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
        rejectedUserAgent: input.requestContext?.userAgent ?? null
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

    return this.serialize(document);
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

    const previousStatus = readMetadataStatus(current.metadata);
    const nextKind = normalizeDocumentKind(input.payload.kind ?? current.kind);
    const document = await this.prisma.workspaceDocument.update({
      where: { id: current.id },
      data: {
        title: input.payload.title,
        content: input.payload.content,
        kind: input.payload.kind,
        linkedEntityType: input.payload.linkedEntityType,
        linkedEntityId: input.payload.linkedEntityId,
        tags: input.payload.tags,
        metadata:
          input.payload.metadata === undefined
            ? undefined
            : toInputJson(normalizeDocumentMetadata(nextKind, input.payload.metadata)),
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

    return this.serialize(document);
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
        linkedEntityType: input.document.linkedEntityType ?? null,
        linkedEntityId: input.document.linkedEntityId ?? null,
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
          : kind === 'contract' && (input.nextStatus === 'accepted' || input.nextStatus === 'signed')
            ? DomainEventNames.ContractAccepted
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
        linkedEntityType: input.document.linkedEntityType ?? null,
        linkedEntityId: input.document.linkedEntityId ?? null,
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
    publicToken: string;
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
        publicToken: input.publicToken,
        linkedEntityType: input.document.linkedEntityType ?? null,
        linkedEntityId: input.document.linkedEntityId ?? null,
        requestedBy: input.userId
      }
    });
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
