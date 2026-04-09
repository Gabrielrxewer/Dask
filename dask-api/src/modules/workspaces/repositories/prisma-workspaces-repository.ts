import {
  MembershipRole,
  Prisma,
  type Board,
  type BoardTemplate,
  type PrismaClient,
  type Workspace
} from '@prisma/client';
import { ensureWorkspaceDefaultConfiguration } from '@/modules/workspaces/application/default-workspace-seed';
import type {
  BoardSnapshot,
  UserWorkspaceSummary,
  WorkspaceBoardSummary,
  WorkspacesRepository
} from '@/modules/workspaces/repositories/workspaces-repository';

export class PrismaWorkspacesRepository implements WorkspacesRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public createWorkspace(input: {
    organizationId: string;
    name: string;
    key: string;
    config?: Record<string, unknown>;
    ownerUserId: string;
  }): Promise<Workspace> {
    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          organizationId: input.organizationId,
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
        ownerUserId: input.ownerUserId
      });

      return workspace;
    });
  }

  public createBoard(input: {
    workspaceId: string;
    templateId?: string;
    name: string;
    description?: string;
    config?: Record<string, unknown>;
  }): Promise<Board> {
    return this.prisma.board.create({
      data: {
        ...input,
        config: input.config as Prisma.InputJsonValue | undefined
      }
    });
  }

  public createTemplate(input: {
    workspaceId: string;
    name: string;
    description?: string;
    schema: Record<string, unknown>;
    rules?: Record<string, unknown>;
  }): Promise<BoardTemplate> {
    return this.prisma.boardTemplate.create({
      data: {
        ...input,
        schema: input.schema as Prisma.InputJsonValue,
        rules: input.rules as Prisma.InputJsonValue | undefined
      }
    });
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
      name: membership.workspace.name,
      key: membership.workspace.key,
      role: membership.role,
      createdAt: membership.workspace.createdAt,
      updatedAt: membership.workspace.updatedAt
    }));
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
