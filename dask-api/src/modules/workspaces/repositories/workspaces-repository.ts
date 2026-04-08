import type { Board, BoardTemplate, Workspace } from '@prisma/client';

export interface WorkspacesRepository {
  createWorkspace(input: {
    organizationId: string;
    name: string;
    key: string;
    config?: Record<string, unknown>;
    ownerUserId: string;
  }): Promise<Workspace>;
  createBoard(input: {
    workspaceId: string;
    templateId?: string;
    name: string;
    description?: string;
    config?: Record<string, unknown>;
  }): Promise<Board>;
  createTemplate(input: {
    workspaceId: string;
    name: string;
    description?: string;
    schema: Record<string, unknown>;
    rules?: Record<string, unknown>;
  }): Promise<BoardTemplate>;
}
