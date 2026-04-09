import type { Board, BoardTemplate, ItemType, MembershipRole, Workspace } from '@prisma/client';

export type UserWorkspaceSummary = {
  id: string;
  organizationId: string;
  name: string;
  key: string;
  role: MembershipRole;
  createdAt: Date;
  updatedAt: Date;
};

export type WorkspaceBoardSummary = {
  id: string;
  workspaceId: string;
  templateId: string | null;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  itemCount: number;
  columnCount: number;
};

export type BoardColumnSnapshot = {
  id: string;
  boardId: string;
  name: string;
  code: string;
  position: number;
  settings: unknown;
};

export type BoardItemSnapshot = {
  id: string;
  boardId: string;
  workspaceId: string;
  columnId: string | null;
  type: ItemType;
  title: string;
  description: string | null;
  status: string;
  fields: unknown;
  metadata: unknown;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export type BoardSnapshot = {
  board: {
    id: string;
    workspaceId: string;
    templateId: string | null;
    name: string;
    description: string | null;
    config: unknown;
    createdAt: Date;
    updatedAt: Date;
  };
  columns: BoardColumnSnapshot[];
  items: BoardItemSnapshot[];
};

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
  listUserWorkspaces(userId: string): Promise<UserWorkspaceSummary[]>;
  getWorkspaceRoleForUser(workspaceId: string, userId: string): Promise<MembershipRole | null>;
  listBoardsByWorkspace(workspaceId: string): Promise<WorkspaceBoardSummary[]>;
  findBoardSnapshot(input: {
    workspaceId: string;
    boardId: string;
    itemLimit: number;
  }): Promise<BoardSnapshot | null>;
}
