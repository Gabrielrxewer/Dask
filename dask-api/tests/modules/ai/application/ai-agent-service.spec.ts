import { describe, expect, it, vi } from 'vitest';
import { AIAgentService } from '@/modules/ai/application/ai-agent-service';

function buildPrismaMock() {
  return {
    aIAgentRun: {
      count: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn()
    },
    workspaceDocument: {
      findMany: vi.fn().mockResolvedValue([])
    },
    item: {
      findFirst: vi.fn(),
      updateMany: vi.fn()
    }
  };
}

function buildAgent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'agent-1',
    workspaceId: 'ws-1',
    key: 'risk-analyst',
    name: 'Risk Analyst',
    description: null,
    model: 'gpt-4.1-mini',
    temperature: 0.2,
    systemPrompt: 'test',
    config: {},
    isActive: true,
    isDefault: false,
    updatedAt: new Date(),
    ...overrides
  };
}

function buildAgentRepository(agentOverrides: Record<string, unknown> = {}) {
  return {
    existsForWorkspace: vi.fn().mockResolvedValue(true),
    findActiveById: vi.fn().mockResolvedValue(buildAgent(agentOverrides)),
    findTopActive: vi.fn().mockResolvedValue(buildAgent(agentOverrides)),
    listForWorkspace: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    patch: vi.fn()
  };
}

function buildEventPublisher() {
  return {
    publish: vi.fn().mockResolvedValue(undefined)
  };
}

describe('AIAgentService', () => {
  it('enforces workspace/agent rate limits', async () => {
    const prisma = buildPrismaMock();
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
      history: [],
      documentLinks: []
    });
    prisma.aIAgentRun.count.mockResolvedValue(99999);
    prisma.aIAgentRun.aggregate.mockResolvedValue({ _sum: { totalTokens: 0 } });

    const agentRepository = buildAgentRepository();
    const service = new AIAgentService(
      prisma as any,
      agentRepository as any,
      {
        generateText: vi.fn(),
        improveDescription: vi.fn(),
        summarize: vi.fn(),
        classify: vi.fn()
      } as any,
      { search: vi.fn().mockResolvedValue([]) } as any,
      { can: vi.fn().mockResolvedValue(true) } as any,
      buildEventPublisher() as any
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
      history: [],
      documentLinks: []
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

    const agentRepository = buildAgentRepository();
    const service = new AIAgentService(
      prisma as any,
      agentRepository as any,
      {
        generateText,
        improveDescription: vi.fn(),
        summarize: vi.fn(),
        classify: vi.fn()
      } as any,
      { search: vi.fn().mockResolvedValue([]) } as any,
      { can: vi.fn().mockResolvedValue(true) } as any,
      buildEventPublisher() as any
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
      history: [],
      documentLinks: []
    });
    prisma.item.updateMany.mockResolvedValue({ count: 1 });
    prisma.aIAgentRun.count.mockResolvedValue(0);
    prisma.aIAgentRun.aggregate.mockResolvedValue({ _sum: { totalTokens: 0 } });
    prisma.aIAgentRun.create.mockResolvedValue({ id: 'run-1' });
    prisma.aIAgentRun.update.mockResolvedValue({});

    const agentRepository = buildAgentRepository({
      config: { tools: { enabled: true, allowed: ['set_item_status'] } }
    });
    const eventPublisher = buildEventPublisher();
    const service = new AIAgentService(
      prisma as any,
      agentRepository as any,
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
      { can: vi.fn().mockResolvedValue(true) } as any,
      eventPublisher as any
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
    expect(eventPublisher.publish).toHaveBeenCalled();
  });
});
