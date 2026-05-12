import { describe, expect, it, vi } from 'vitest';
import { AIAgentService } from '@/modules/ai/application/ai-agent-service';

const publishedRuntimeConfig = {
  automationRuntime: {
    executor: 'automation',
    workflowId: 'workflow-1',
    workflowVersionId: 'version-1'
  }
};

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
    config: publishedRuntimeConfig,
    isActive: true,
    isDefault: false,
    updatedAt: new Date(),
    ...overrides
  };
}

function buildPrismaMock(agentOverrides: Record<string, unknown> = {}) {
  return {
    aIAgent: {
      findFirst: vi.fn().mockResolvedValue(buildAgent(agentOverrides))
    },
    automationWorkflow: {
      findFirst: vi.fn().mockResolvedValue(null)
    },
    automationRun: {
      count: vi.fn().mockResolvedValue(0)
    },
    automationStepRun: {
      findMany: vi.fn().mockResolvedValue([
        {
          nodeType: 'ai_generate_message_draft',
          outputJson: { draftText: 'Runtime output' },
          finishedAt: new Date('2026-05-12T00:00:01.000Z'),
          createdAt: new Date('2026-05-12T00:00:00.000Z')
        }
      ])
    },
    workspaceDocument: {
      findMany: vi.fn().mockResolvedValue([])
    },
    item: {
      findFirst: vi.fn()
    }
  };
}

function buildAgentRepository(agentOverrides: Record<string, unknown> = {}) {
  return {
    existsForWorkspace: vi.fn().mockResolvedValue(true),
    findActiveById: vi.fn().mockResolvedValue(buildAgent(agentOverrides)),
    findTopActive: vi.fn().mockResolvedValue(buildAgent(agentOverrides)),
    listForWorkspace: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    patch: vi.fn().mockResolvedValue({ count: 1 })
  };
}

function buildEventPublisher() {
  return {
    publish: vi.fn().mockResolvedValue(undefined)
  };
}

function buildService(input: {
  prisma?: ReturnType<typeof buildPrismaMock>;
  agentRepository?: ReturnType<typeof buildAgentRepository>;
  workflowRunnerService?: { startRun: ReturnType<typeof vi.fn> };
  runObservabilityService?: { listRuns: ReturnType<typeof vi.fn> };
  generateText?: ReturnType<typeof vi.fn>;
} = {}) {
  const prisma = input.prisma ?? buildPrismaMock();
  const agentRepository = input.agentRepository ?? buildAgentRepository();
  const generateText = input.generateText ?? vi.fn();
  const workflowRunnerService = input.workflowRunnerService ?? {
    startRun: vi.fn().mockResolvedValue({
      run: {
        id: 'run-1',
        workflowVersionId: 'version-1',
        status: 'completed'
      },
      executionResult: {
        status: 'completed',
        executedNodeIds: ['trigger-1', 'llm-1']
      }
    })
  };
  const runObservabilityService = input.runObservabilityService ?? {
    listRuns: vi.fn().mockResolvedValue({ items: [] })
  };

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
    buildEventPublisher() as any,
    {
      workflowRunnerService: workflowRunnerService as any,
      runObservabilityService: runObservabilityService as any
    }
  );

  return { service, prisma, agentRepository, workflowRunnerService, runObservabilityService, generateText };
}

describe('AIAgentService', () => {
  it('publishes an AI agent as an active automation workflow version', async () => {
    const prisma = {
      aIAgent: {
        findFirst: vi.fn().mockResolvedValue(buildAgent({
          id: 'agent-1',
          config: {
            flow: {
              nodes: [
                { id: 'trigger', type: 'trigger', data: { label: 'Input' } },
                { id: 'llm', type: 'llm', data: { label: 'LLM' } },
                { id: 'output', type: 'output', data: { label: 'Output' } }
              ],
              edges: [
                { id: 'e1', source: 'trigger', target: 'llm' },
                { id: 'e2', source: 'llm', target: 'output' }
              ]
            }
          }
        }))
      },
      automationWorkflow: {
        findFirst: vi.fn().mockResolvedValue(null)
      }
    };
    const agentRepository = buildAgentRepository();
    const workflowService = {
      createWorkflow: vi.fn().mockResolvedValue({ id: 'workflow-1' }),
      updateWorkflow: vi.fn()
    };
    const workflowVersionService = {
      createDraftVersion: vi.fn().mockResolvedValue({ id: 'version-draft-1' }),
      publishVersion: vi.fn().mockResolvedValue({
        id: 'version-1',
        publishedAt: new Date('2026-05-10T00:00:00.000Z')
      })
    };

    const service = new AIAgentService(
      prisma as any,
      agentRepository as any,
      { generateText: vi.fn() } as any,
      { search: vi.fn().mockResolvedValue([]) } as any,
      { can: vi.fn().mockResolvedValue(true) } as any,
      buildEventPublisher() as any,
      {
        workflowService: workflowService as any,
        workflowVersionService: workflowVersionService as any
      }
    );

    const result = await service.publishAgentRuntime({
      workspaceId: 'ws-1',
      agentId: 'agent-1',
      requestedBy: 'user-1'
    });

    expect(result.workflowId).toBe('workflow-1');
    expect(result.workflowVersionId).toBe('version-1');
    expect(workflowVersionService.createDraftVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: 'workflow-1',
        graph: expect.objectContaining({ version: 1 })
      })
    );
    expect(agentRepository.patch).toHaveBeenCalledWith(
      'agent-1',
      'ws-1',
      expect.objectContaining({
        config: expect.objectContaining({
          automationRuntime: expect.objectContaining({
            workflowId: 'workflow-1',
            workflowVersionId: 'version-1'
          })
        })
      })
    );
  });

  it('runs AI agents only through Automation Runtime with redacted context', async () => {
    const { service, workflowRunnerService, generateText } = buildService();

    const result = await service.runAgentRuntime({
      workspaceId: 'ws-1',
      agentId: 'agent-1',
      requestedBy: 'user-1',
      instruction: 'Use Bearer abcdefghijklmnop and email owner@corp.test',
      context: {
        apiKey: 'secret-key',
        payloadJson: { token: 'raw-token' },
        itemId: 'item-1'
      }
    });

    expect(result).toMatchObject({
      runId: 'run-1',
      status: 'completed',
      executionStatus: 'completed'
    });
    expect(generateText).not.toHaveBeenCalled();
    expect(workflowRunnerService.startRun).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowId: 'workflow-1',
        triggerType: 'ai.agent.run'
      })
    );
    const startInput = workflowRunnerService.startRun.mock.calls[0][0];
    const serializedContext = JSON.stringify(startInput.context);
    expect(serializedContext).not.toContain('secret-key');
    expect(serializedContext).not.toContain('raw-token');
    expect(serializedContext).not.toContain('owner@corp.test');
    expect(serializedContext).toContain('[REDACTED]');
  });

  it('adapts legacy item runs to Automation Runtime and returns runtime output', async () => {
    const { service, workflowRunnerService, prisma } = buildService();

    const result = await service.runAgentOnItem({
      workspaceId: 'ws-1',
      itemId: 'item-1',
      agentId: 'agent-1',
      requestedBy: 'user-1',
      instruction: 'Run it',
      includeSemanticContext: true,
      topKContextDocs: 5
    });

    expect(result).toEqual({
      runId: 'run-1',
      content: 'Runtime output'
    });
    expect(workflowRunnerService.startRun).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerType: 'ai.agent.item.run',
        triggerRefId: expect.stringContaining('agent-1:item-1:')
      })
    );
    expect(prisma.automationStepRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ runId: 'run-1' })
      })
    );
  });

  it('lists AI runs from central automation observability', async () => {
    const runObservabilityService = {
      listRuns: vi.fn().mockResolvedValue({
        items: [
          {
            runId: 'run-1',
            triggerRefId: 'agent-1:item-1:nonce',
            status: 'failed',
            durationMs: 42,
            createdAt: new Date('2026-05-12T00:00:00.000Z'),
            finishedAt: new Date('2026-05-12T00:00:01.000Z'),
            error: { message: 'Runtime failed' }
          }
        ]
      })
    };
    const { service } = buildService({ runObservabilityService });

    const result = await service.listRuns({
      workspaceId: 'ws-1',
      itemId: 'item-1',
      limit: 10
    });

    expect(runObservabilityService.listRuns).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      triggerTypes: ['ai.agent.run', 'ai.agent.item.run', 'ai.agent.risk_analysis', 'ai.documentation.run'],
      triggerRefIdContains: ':item-1:',
      limit: 10
    });
    expect(result[0]).toMatchObject({
      id: 'run-1',
      agentId: 'agent-1',
      itemId: 'item-1',
      status: 'failed',
      provider: 'automation-runtime',
      latencyMs: 42,
      error: 'Runtime failed'
    });
  });

  it('audits AI agent runtime failures with redacted errors', async () => {
    const eventPublisher = buildEventPublisher();
    const workflowRunnerService = {
      startRun: vi.fn().mockRejectedValue(new Error('Runtime exploded with Bearer abcdefghijklmnop and admin@corp.test'))
    };
    const prisma = buildPrismaMock();
    const service = new AIAgentService(
      prisma as any,
      buildAgentRepository() as any,
      { generateText: vi.fn() } as any,
      { search: vi.fn().mockResolvedValue([]) } as any,
      { can: vi.fn().mockResolvedValue(true) } as any,
      eventPublisher as any,
      {
        workflowRunnerService: workflowRunnerService as any,
        runObservabilityService: { listRuns: vi.fn().mockResolvedValue({ items: [] }) } as any
      }
    );

    await expect(
      service.runAgentRuntime({
        workspaceId: 'ws-1',
        agentId: 'agent-1',
        requestedBy: 'user-1',
        instruction: 'Run it'
      })
    ).rejects.toThrow('Runtime exploded');

    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'ai.agent.run.failed',
        aggregateType: 'ai-agent',
        aggregateId: 'agent-1',
        payload: expect.objectContaining({
          workspaceId: 'ws-1',
          agentId: 'agent-1',
          requestedBy: 'user-1',
          workflowId: 'workflow-1',
          error: expect.stringContaining('[REDACTED]')
        })
      })
    );
    expect(JSON.stringify(eventPublisher.publish.mock.calls)).not.toContain('admin@corp.test');
    expect(JSON.stringify(eventPublisher.publish.mock.calls)).not.toContain('abcdefghijklmnop');
  });
});
