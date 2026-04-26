import { Prisma, type PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AppError } from '@/core/errors/app-error';
import { DomainEventNames } from '@/core/events/event-names';
import type { EventPublisher } from '@/core/events/event-publisher';
import type { WorkspaceConfigService } from '@/modules/workspace-platform/application/workspace-config-service';

type DocumentKind = 'wiki' | 'proposal' | 'contract';
type DocumentLinkedEntityType = 'work_item' | 'customer' | 'proposal' | 'contract';
type DocumentMetadata = Record<string, unknown>;

const documentKinds = new Set<DocumentKind>(['wiki', 'proposal', 'contract']);

function normalizeDocumentKind(kind: string | null | undefined): DocumentKind {
  return kind && documentKinds.has(kind as DocumentKind) ? (kind as DocumentKind) : 'wiki';
}

function toInputJson(value: DocumentMetadata | undefined): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : (value as Prisma.InputJsonObject);
}

function readMetadataStatus(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const status = (metadata as Record<string, unknown>).status;
  return typeof status === 'string' && status.trim().length > 0 ? status.trim() : null;
}

export class WorkspaceDocumentsService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly configService: WorkspaceConfigService,
    private readonly eventPublisher: EventPublisher
  ) {}

  public async listDocuments(input: { workspaceId: string; userId: string }) {
    await this.configService.ensureReadableWorkspace(input.workspaceId, input.userId);

    const documents = await this.prisma.workspaceDocument.findMany({
      where: { workspaceId: input.workspaceId },
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
        metadata: toInputJson(input.payload.metadata),
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
    const document = await this.prisma.workspaceDocument.update({
      where: { id: current.id },
      data: {
        title: input.payload.title,
        content: input.payload.content,
        kind: input.payload.kind,
        linkedEntityType: input.payload.linkedEntityType,
        linkedEntityId: input.payload.linkedEntityId,
        tags: input.payload.tags,
        metadata: toInputJson(input.payload.metadata),
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
      metadata: document.metadata ?? {},
      position: document.position,
      createdBy: document.createdBy,
      updatedBy: document.updatedBy,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt
    };
  }
}
