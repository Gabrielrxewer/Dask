import type { Prisma } from '@prisma/client';

export type AIAgentData = {
  id: string;
  workspaceId: string;
  key: string;
  name: string;
  description: string | null;
  model: string;
  temperature: number;
  systemPrompt: string;
  config: Prisma.JsonValue;
  isActive: boolean;
  isDefault: boolean;
  updatedAt: Date;
};

export type AIAgentListItem = Pick<
  AIAgentData,
  | 'id'
  | 'key'
  | 'name'
  | 'description'
  | 'model'
  | 'temperature'
  | 'systemPrompt'
  | 'config'
  | 'isActive'
  | 'isDefault'
  | 'updatedAt'
>;

export type CreateAgentData = {
  workspaceId: string;
  key: string;
  name: string;
  description?: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  config?: Prisma.InputJsonValue;
  isActive: boolean;
  isDefault?: boolean;
};

export type PatchAgentData = {
  name?: string;
  description?: string | null;
  model?: string;
  temperature?: number;
  systemPrompt?: string;
  config?: Prisma.InputJsonValue;
  isActive?: boolean;
};

export interface AIAgentRepository {
  existsForWorkspace(workspaceId: string): Promise<boolean>;
  findActiveById(agentId: string, workspaceId: string): Promise<AIAgentData | null>;
  findTopActive(workspaceId: string): Promise<AIAgentData | null>;
  listForWorkspace(workspaceId: string): Promise<AIAgentListItem[]>;
  create(data: CreateAgentData): Promise<{ id: string }>;
  patch(agentId: string, workspaceId: string, data: PatchAgentData): Promise<{ count: number }>;
}
