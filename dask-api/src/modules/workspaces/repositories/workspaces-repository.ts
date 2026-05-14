import type { Board, BoardTemplate, MembershipRole, Prisma, Workspace, WorkspaceKind } from '@prisma/client';
import type { WorkspaceTemplateKey } from '@/modules/workspaces/application/workspace-template-catalog';

export type UserWorkspaceSummary = {
  id: string;
  organizationId: string | null;
  kind: WorkspaceKind;
  name: string;
  key: string;
  role: MembershipRole;
  createdAt: Date;
  updatedAt: Date;
};

export type UserSubscriptionAccess = {
  hasActiveSubscription: boolean;
  subscriptionPlan: 'PERSONAL' | 'BASIC' | 'PRO' | 'BUSINESS' | 'ENTERPRISE' | null;
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

export type WorkspaceBoardTemplateSummary = {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  schema: unknown;
  rules: unknown;
  createdAt: Date;
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
  boardColumnId: string | null;
  type: string;
  typeId: string | null;
  title: string;
  description: string | null;
  status: string;
  stateId: string | null;
  fields: unknown;
  metadata: unknown;
  checklist: unknown;
  assigneeId: string | null;
  parentId: string | null;
  dueDate: Date | null;
  position: number;
  createdBy: string;
  updatedBy: string | null;
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
  findWorkspaceById(workspaceId: string): Promise<Workspace | null>;
  updateWorkspace(input: {
    workspaceId: string;
    name?: string;
    key?: string;
    config?: Record<string, unknown>;
  }, db?: Prisma.TransactionClient): Promise<Workspace>;
  deleteWorkspace(input: {
    workspaceId: string;
  }, db?: Prisma.TransactionClient): Promise<void>;
  createWorkspace(input: {
    organizationId?: string;
    kind: WorkspaceKind;
    name: string;
    key: string;
    templateKey?: WorkspaceTemplateKey;
    config?: Record<string, unknown>;
    ownerUserId: string;
  }, db?: Prisma.TransactionClient): Promise<Workspace>;
  createBoard(input: {
    workspaceId: string;
    templateId?: string;
    name: string;
    description?: string;
    config?: Record<string, unknown>;
  }, db?: Prisma.TransactionClient): Promise<Board>;
  createTemplate(input: {
    workspaceId: string;
    name: string;
    description?: string;
    schema: Record<string, unknown>;
    rules?: Record<string, unknown>;
  }, db?: Prisma.TransactionClient): Promise<BoardTemplate>;
  listUserWorkspaces(userId: string): Promise<UserWorkspaceSummary[]>;
  getUserSubscriptionAccess(userId: string): Promise<UserSubscriptionAccess | null>;
  getOrganizationRoleForUser(organizationId: string, userId: string): Promise<MembershipRole | null>;
  getWorkspaceRoleForUser(workspaceId: string, userId: string): Promise<MembershipRole | null>;
  listBoardsByWorkspace(workspaceId: string): Promise<WorkspaceBoardSummary[]>;
  listTemplatesByWorkspace(workspaceId: string): Promise<WorkspaceBoardTemplateSummary[]>;
  findBoardSnapshot(input: {
    workspaceId: string;
    boardId: string;
    itemLimit: number;
  }): Promise<BoardSnapshot | null>;
}
