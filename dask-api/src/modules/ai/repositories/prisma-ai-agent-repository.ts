import type { PrismaClient } from '@prisma/client';
import type {
  AIAgentData,
  AIAgentListItem,
  AIAgentRepository,
  CreateAgentData,
  PatchAgentData
} from '@/modules/ai/repositories/ai-agent-repository';

export class PrismaAIAgentRepository implements AIAgentRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async existsForWorkspace(workspaceId: string): Promise<boolean> {
    const found = await this.prisma.aIAgent.findFirst({
      where: { workspaceId },
      select: { id: true }
    });
    return found !== null;
  }

  public async findActiveById(agentId: string, workspaceId: string): Promise<AIAgentData | null> {
    return this.prisma.aIAgent.findFirst({
      where: { id: agentId, workspaceId, isActive: true }
    });
  }

  public async findTopActive(workspaceId: string): Promise<AIAgentData | null> {
    return this.prisma.aIAgent.findFirst({
      where: { workspaceId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
    });
  }

  public async listForWorkspace(workspaceId: string): Promise<AIAgentListItem[]> {
    return this.prisma.aIAgent.findMany({
      where: { workspaceId },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        model: true,
        temperature: true,
        isActive: true,
        isDefault: true,
        updatedAt: true
      },
      orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }]
    });
  }

  public async create(data: CreateAgentData): Promise<{ id: string }> {
    return this.prisma.aIAgent.create({
      data: {
        workspaceId: data.workspaceId,
        key: data.key,
        name: data.name,
        description: data.description,
        model: data.model,
        temperature: data.temperature,
        systemPrompt: data.systemPrompt,
        config: data.config,
        isActive: data.isActive,
        isDefault: data.isDefault ?? false
      },
      select: { id: true }
    });
  }

  public async patch(
    agentId: string,
    workspaceId: string,
    data: PatchAgentData
  ): Promise<{ count: number }> {
    const result = await this.prisma.aIAgent.updateMany({
      where: { id: agentId, workspaceId },
      data: {
        name: data.name,
        description: data.description,
        model: data.model,
        temperature: data.temperature,
        systemPrompt: data.systemPrompt,
        config: data.config,
        isActive: data.isActive
      }
    });
    return { count: result.count };
  }
}
