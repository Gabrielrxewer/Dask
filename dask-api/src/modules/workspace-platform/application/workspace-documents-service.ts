import type { PrismaClient } from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import type { WorkspaceConfigService } from '@/modules/workspace-platform/application/workspace-config-service';

export class WorkspaceDocumentsService {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly configService: WorkspaceConfigService
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
        position: input.payload.position ?? defaultPosition,
        createdBy: input.userId,
        updatedBy: input.userId
      }
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

    const document = await this.prisma.workspaceDocument.update({
      where: { id: current.id },
      data: {
        title: input.payload.title,
        content: input.payload.content,
        position: input.payload.position,
        updatedBy: input.userId
      }
    });

    return this.serialize(document);
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
      position: document.position,
      createdBy: document.createdBy,
      updatedBy: document.updatedBy,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt
    };
  }
}
