import { MembershipRole, type Board, type BoardTemplate, type PrismaClient, type Workspace } from '@prisma/client';
import type { WorkspacesRepository } from '@/modules/workspaces/repositories/workspaces-repository';

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
          config: input.config
        }
      });

      await tx.workspaceMembership.create({
        data: {
          workspaceId: workspace.id,
          userId: input.ownerUserId,
          role: MembershipRole.OWNER
        }
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
      data: input
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
      data: input
    });
  }
}
