import type {
  Prisma,
  WorkspaceKind} from '@prisma/client';
import {
  MembershipRole,
  type Board,
  type BoardTemplate,
  type PrismaClient,
  type Workspace
} from '@prisma/client';
import { AppError } from '@/core/errors/app-error';
import { ensureWorkspaceDefaultConfiguration } from '@/modules/workspaces/application/default-workspace-seed';
import {
  getWorkspaceTemplateByKey,
  type WorkspaceTemplateKey
} from '@/modules/workspaces/application/workspace-template-catalog';
import type {
  BoardSnapshot,
  UserWorkspaceSummary,
  WorkspaceBoardTemplateSummary,
  WorkspaceBoardSummary,
  WorkspacesRepository
} from '@/modules/workspaces/repositories/workspaces-repository';

export class PrismaWorkspacesRepository implements WorkspacesRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public findWorkspaceById(workspaceId: string): Promise<Workspace | null> {
    return this.prisma.workspace.findUnique({
      where: { id: workspaceId }
    });
  }

  public updateWorkspace(input: {
    workspaceId: string;
    name?: string;
    key?: string;
    config?: Record<string, unknown>;
  }, db?: Prisma.TransactionClient): Promise<Workspace> {
    const execute = async (tx: Prisma.TransactionClient): Promise<Workspace> => {
      const workspace = await tx.workspace.findUnique({
        where: { id: input.workspaceId },
        select: { id: true }
      });

      if (!workspace) {
        throw new AppError('Workspace not found', 404);
      }

      return tx.workspace.update({
        where: { id: input.workspaceId },
        data: {
          name: input.name,
          key: input.key,
          config: input.config as Prisma.InputJsonValue | undefined
        }
      });
    };

    if (db) {
      return execute(db);
    }

    return this.prisma.$transaction(execute);
  }

  public deleteWorkspace(input: {
    workspaceId: string;
  }, db?: Prisma.TransactionClient): Promise<void> {
    const execute = async (tx: Prisma.TransactionClient): Promise<void> => {
      const workspace = await tx.workspace.findUnique({
        where: { id: input.workspaceId },
        select: { id: true }
      });

      if (!workspace) {
        throw new AppError('Workspace not found', 404);
      }

      await tx.workspace.delete({
        where: { id: input.workspaceId }
      });
    };

    if (db) {
      return execute(db);
    }

    return this.prisma.$transaction(execute);
  }

  public createWorkspace(input: {
    organizationId?: string;
    kind: WorkspaceKind;
    name: string;
    key: string;
    templateKey?: WorkspaceTemplateKey;
    config?: Record<string, unknown>;
    ownerUserId: string;
  }, db?: Prisma.TransactionClient): Promise<Workspace> {
    const execute = async (tx: Prisma.TransactionClient): Promise<Workspace> => {
      const workspace = await tx.workspace.create({
        data: {
          organizationId: input.organizationId ?? null,
          kind: input.kind,
          name: input.name,
          key: input.key,
          config: input.config as Prisma.InputJsonValue | undefined
        }
      });

      await tx.workspaceMembership.create({
        data: {
          workspaceId: workspace.id,
          userId: input.ownerUserId,
          role: MembershipRole.OWNER
        }
      });

      await ensureWorkspaceDefaultConfiguration(tx, {
        workspaceId: workspace.id,
        ownerUserId: input.ownerUserId,
        templateKey: input.templateKey
      });

      const selectedTemplate = getWorkspaceTemplateByKey(input.templateKey);
      if (selectedTemplate) {
        const boardTemplate = await tx.boardTemplate.create({
          data: {
            workspaceId: workspace.id,
            name: selectedTemplate.name,
            description: selectedTemplate.description,
            schema: selectedTemplate.schema as Prisma.InputJsonValue,
            rules: selectedTemplate.rules as Prisma.InputJsonValue
          }
        });

        const defaultBoard = await tx.board.findFirst({
          where: { workspaceId: workspace.id },
          orderBy: { createdAt: 'asc' },
          select: { id: true }
        });

        if (defaultBoard) {
          await tx.board.update({
            where: { id: defaultBoard.id },
            data: {
              templateId: boardTemplate.id,
              name: selectedTemplate.boardName,
              description: selectedTemplate.boardDescription
            }
          });
        }
      }

      return workspace;
    };

    if (db) {
      return execute(db);
    }

    return this.prisma.$transaction(execute);
  }

  public createBoard(input: {
    workspaceId: string;
    templateId?: string;
    name: string;
    description?: string;
    config?: Record<string, unknown>;
  }, db?: Prisma.TransactionClient): Promise<Board> {
    const execute = async (tx: Prisma.TransactionClient): Promise<Board> => {
      const workspace = await tx.workspace.findUnique({
        where: { id: input.workspaceId },
        select: { id: true }
      });

      if (!workspace) {
        throw new AppError('Workspace not found', 404);
      }

      if (input.templateId) {
        const template = await tx.boardTemplate.findUnique({
          where: { id: input.templateId },
          select: { id: true, workspaceId: true }
        });

        if (!template) {
          throw new AppError('Template not found', 404);
        }

        if (template.workspaceId !== input.workspaceId) {
          throw new AppError('Template does not belong to this workspace', 400);
        }
      }

      return tx.board.create({
        data: {
          workspaceId: input.workspaceId,
          templateId: input.templateId,
          name: input.name,
          description: input.description,
          config: input.config as Prisma.InputJsonValue | undefined
        }
      });
    };

    if (db) {
      return execute(db);
    }

    return this.prisma.$transaction(execute);
  }

  public createTemplate(input: {
    workspaceId: string;
    name: string;
    description?: string;
    schema: Record<string, unknown>;
    rules?: Record<string, unknown>;
  }, db?: Prisma.TransactionClient): Promise<BoardTemplate> {
    const execute = async (tx: Prisma.TransactionClient): Promise<BoardTemplate> => {
      const workspace = await tx.workspace.findUnique({
        where: { id: input.workspaceId },
        select: { id: true }
      });

      if (!workspace) {
        throw new AppError('Workspace not found', 404);
      }

      return tx.boardTemplate.create({
        data: {
          workspaceId: input.workspaceId,
          name: input.name,
          description: input.description,
          schema: input.schema as Prisma.InputJsonValue,
          rules: input.rules as Prisma.InputJsonValue | undefined
        }
      });
    };

    if (db) {
      return execute(db);
    }

    return this.prisma.$transaction(execute);
  }

  public async listUserWorkspaces(userId: string): Promise<UserWorkspaceSummary[]> {
    const memberships = await this.prisma.workspaceMembership.findMany({
      where: { userId },
      select: {
        role: true,
        workspace: {
          select: {
            id: true,
            organizationId: true,
            kind: true,
            name: true,
            key: true,
            createdAt: true,
            updatedAt: true
          }
        }
      },
      orderBy: {
        workspace: {
          updatedAt: 'desc'
        }
      }
    });

    return memberships.map((membership) => ({
      id: membership.workspace.id,
      organizationId: membership.workspace.organizationId,
      kind: membership.workspace.kind,
      name: membership.workspace.name,
      key: membership.workspace.key,
      role: membership.role,
      createdAt: membership.workspace.createdAt,
      updatedAt: membership.workspace.updatedAt
    }));
  }

  public async getUserSubscriptionAccess(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        hasActiveSubscription: true,
        subscriptionPlan: true
      }
    });

    if (!user) {
      return null;
    }

    return {
      hasActiveSubscription: user.hasActiveSubscription,
      subscriptionPlan: user.subscriptionPlan as 'PERSONAL' | 'BASIC' | 'PRO' | 'BUSINESS' | 'ENTERPRISE' | null
    };
  }

  public async getOrganizationRoleForUser(
    organizationId: string,
    userId: string
  ): Promise<MembershipRole | null> {
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        organizationId,
        userId
      },
      select: {
        role: true
      }
    });

    return membership?.role ?? null;
  }

  public async getWorkspaceRoleForUser(
    workspaceId: string,
    userId: string
  ): Promise<MembershipRole | null> {
    const membership = await this.prisma.workspaceMembership.findFirst({
      where: {
        workspaceId,
        userId
      },
      select: {
        role: true
      }
    });

    return membership?.role ?? null;
  }

  public async listBoardsByWorkspace(workspaceId: string): Promise<WorkspaceBoardSummary[]> {
    const boards = await this.prisma.board.findMany({
      where: { workspaceId },
      include: {
        _count: {
          select: {
            items: true,
            columns: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    return boards.map((board) => ({
      id: board.id,
      workspaceId: board.workspaceId,
      templateId: board.templateId,
      name: board.name,
      description: board.description,
      createdAt: board.createdAt,
      updatedAt: board.updatedAt,
      itemCount: board._count.items,
      columnCount: board._count.columns
    }));
  }

  public async listTemplatesByWorkspace(workspaceId: string): Promise<WorkspaceBoardTemplateSummary[]> {
    return this.prisma.boardTemplate.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' }
    });
  }

  public async findBoardSnapshot(input: {
    workspaceId: string;
    boardId: string;
    itemLimit: number;
  }): Promise<BoardSnapshot | null> {
    const board = await this.prisma.board.findFirst({
      where: {
        id: input.boardId,
        workspaceId: input.workspaceId
      },
      include: {
        columns: {
          orderBy: {
            position: 'asc'
          }
        },
        items: {
          orderBy: {
            updatedAt: 'desc'
          },
          take: input.itemLimit
        }
      }
    });

    if (!board) {
      return null;
    }

    return {
      board: {
        id: board.id,
        workspaceId: board.workspaceId,
        templateId: board.templateId,
        name: board.name,
        description: board.description,
        config: board.config,
        createdAt: board.createdAt,
        updatedAt: board.updatedAt
      },
      columns: board.columns.map((column) => ({
        id: column.id,
        boardId: column.boardId,
        name: column.name,
        code: column.code,
        position: column.position,
        settings: column.settings
      })),
      items: board.items.map((item) => ({
        id: item.id,
        boardId: item.boardId,
        workspaceId: item.workspaceId,
        columnId: item.columnId,
        boardColumnId: item.boardColumnId,
        type: item.type,
        typeId: item.typeId,
        title: item.title,
        description: item.description,
        status: item.status,
        stateId: item.stateId,
        fields: item.fields,
        metadata: item.metadata,
        checklist: item.checklist,
        assigneeId: item.assigneeId,
        parentId: item.parentId,
        dueDate: item.dueDate,
        position: item.position,
        createdBy: item.createdBy,
        updatedBy: item.updatedBy,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }))
    };
  }
}
