import { describe, expect, it, vi } from 'vitest';
import { AIAgentService } from '@/modules/ai/application/ai-agent-service';

function buildPrismaMock() {
  return {
    aIAgent: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn()
    },
    aIAgentRun: {
      count: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn()
    },
    item: {
      findFirst: vi.fn(),
      updateMany: vi.fn()
    }
  };
}

describe('AIAgentService', () => {
  it('enforces workspace/agent rate limits', async () => {
    const prisma = buildPrismaMock();
    prisma.aIAgent.findFirst.mockResolvedValue({
      id: 'agent-1',
      workspaceId: 'ws-1',
      model: 'gpt-4.1-mini',
      temperature: 0.2,
      systemPrompt: 'test',
      config: {}
    });
    prisma.item.findFirst.mockResolvedValue({
      id: 'item-1',
      workspaceId: 'ws-1',
      boardId: 'board-1',
      title: 'Card',
      description: 'Desc',
      status: 'todo',
      type: 'task',
      fields: {},
      metadata: {},
      checklist: {},
      updatedAt: new Date(),
      history: []
    });
    prisma.aIAgentRun.count.mockResolvedValue(99999);
    prisma.aIAgentRun.aggregate.mockResolvedValue({ _sum: { totalTokens: 0 } });

    const service = new AIAgentService(
      prisma as any,
      {
        generateText: vi.fn(),
        improveDescription: vi.fn(),
        summarize: vi.fn(),
        classify: vi.fn()
      } as any,
      { search: vi.fn().mockResolvedValue([]) } as any,
      { can: vi.fn().mockResolvedValue(true) } as any
    );

    await expect(
      service.runAgentOnItem({
        workspaceId: 'ws-1',
        itemId: 'item-1',
        agentId: 'agent-1',
        requestedBy: 'user-1',
        instruction: 'Run it',
        includeSemanticContext: true,
        topKContextDocs: 5
      })
    ).rejects.toMatchObject({ statusCode: 429 });
  });

  it('redacts sensitive input before provider call', async () => {
    const prisma = buildPrismaMock();
    prisma.aIAgent.findFirst.mockResolvedValue({
      id: 'agent-1',
      workspaceId: 'ws-1',
      model: 'gpt-4.1-mini',
      temperature: 0.2,
      systemPrompt: 'test',
      config: {}
    });
    prisma.item.findFirst.mockResolvedValue({
      id: 'item-1',
      workspaceId: 'ws-1',
      boardId: 'board-1',
      title: 'Card',
      description: 'Owner email: admin@corp.com',
      status: 'todo',
      type: 'task',
      fields: {},
      metadata: {},
      checklist: {},
      updatedAt: new Date(),
      history: []
    });
    prisma.aIAgentRun.count.mockResolvedValue(0);
    prisma.aIAgentRun.aggregate.mockResolvedValue({ _sum: { totalTokens: 0 } });
    prisma.aIAgentRun.create.mockResolvedValue({ id: 'run-1' });
    prisma.aIAgentRun.update.mockResolvedValue({});

    const generateText = vi.fn().mockResolvedValue({
      content: 'ok',
      model: 'gpt-4.1-mini',
      provider: 'mock',
      latencyMs: 10,
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      toolCalls: []
    });

    const service = new AIAgentService(
      prisma as any,
      {
        generateText,
        improveDescription: vi.fn(),
        summarize: vi.fn(),
        classify: vi.fn()
      } as any,
      { search: vi.fn().mockResolvedValue([]) } as any,
      { can: vi.fn().mockResolvedValue(true) } as any
    );

    await service.runAgentOnItem({
      workspaceId: 'ws-1',
      itemId: 'item-1',
      agentId: 'agent-1',
      requestedBy: 'user-1',
      instruction: 'contact me at owner@corp.com',
      includeSemanticContext: true,
      topKContextDocs: 5
    });

    const payload = generateText.mock.calls[0][0] as { userPrompt: string };
    expect(payload.userPrompt).toContain('[REDACTED]');
  });

  it('executes allowed tool actions with ACL', async () => {
    const prisma = buildPrismaMock();
    prisma.aIAgent.findFirst.mockResolvedValue({
      id: 'agent-1',
      workspaceId: 'ws-1',
      model: 'gpt-4.1-mini',
      temperature: 0.2,
      systemPrompt: 'test',
      config: { tools: { enabled: true, allowed: ['set_item_status'] } }
    });
    prisma.item.findFirst.mockResolvedValue({
      id: 'item-1',
      workspaceId: 'ws-1',
      boardId: 'board-1',
      title: 'Card',
      description: 'Desc',
      status: 'todo',
      type: 'task',
      fields: {},
      metadata: {},
      checklist: {},
      updatedAt: new Date(),
      history: []
    });
    prisma.item.updateMany.mockResolvedValue({ count: 1 });
    prisma.aIAgentRun.count.mockResolvedValue(0);
    prisma.aIAgentRun.aggregate.mockResolvedValue({ _sum: { totalTokens: 0 } });
    prisma.aIAgentRun.create.mockResolvedValue({ id: 'run-1' });
    prisma.aIAgentRun.update.mockResolvedValue({});

    const service = new AIAgentService(
      prisma as any,
      {
        generateText: vi.fn().mockResolvedValue({
          content: 'done',
          model: 'gpt-4.1-mini',
          provider: 'mock',
          latencyMs: 10,
          usage: { inputTokens: 20, outputTokens: 10, totalTokens: 30 },
          toolCalls: [
            {
              name: 'set_item_status',
              arguments: { status: 'in_progress' }
            }
          ]
        }),
        improveDescription: vi.fn(),
        summarize: vi.fn(),
        classify: vi.fn()
      } as any,
      { search: vi.fn().mockResolvedValue([]) } as any,
      { can: vi.fn().mockResolvedValue(true) } as any
    );

    await service.runAgentOnItem({
      workspaceId: 'ws-1',
      itemId: 'item-1',
      agentId: 'agent-1',
      requestedBy: 'user-1',
      instruction: 'move to in progress',
      includeSemanticContext: true,
      topKContextDocs: 5
    });

    expect(prisma.item.updateMany).toHaveBeenCalled();
  });
});

