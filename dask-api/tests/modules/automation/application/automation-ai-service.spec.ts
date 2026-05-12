import { describe, expect, it, vi } from 'vitest';
import { AutomationAIService } from '@/modules/automation/application/automation-ai-service';

describe('AutomationAIService', () => {
  it('does not create legacy AI agent runs for Automation Runtime AI nodes', async () => {
    const prisma = {
      aIAgent: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'agent-automation',
          model: 'gpt-4.1-mini',
          temperature: 0.2,
          systemPrompt: 'Return JSON.'
        })
      },
      aIAgentRun: {
        create: vi.fn(),
        update: vi.fn()
      }
    };
    const generateText = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        intent: 'question',
        sentiment: 'neutral',
        urgency: 'medium',
        needsHuman: true,
        suggestedCategory: 'commercial_question',
        confidence: 0.8,
        reason: 'Asked a question.'
      }),
      provider: 'mock',
      model: 'gpt-4.1-mini',
      latencyMs: 10,
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      toolCalls: []
    });

    const service = new AutomationAIService(prisma as any, { generateText } as any);

    const result = await service.classifyReply({
      workspaceId: 'ws-1',
      messageText: 'Tenho uma duvida sobre o prazo.'
    });

    expect(result).toMatchObject({
      intent: 'question',
      needsHuman: true
    });
    expect(generateText).toHaveBeenCalled();
    expect(prisma.aIAgentRun.create).not.toHaveBeenCalled();
    expect(prisma.aIAgentRun.update).not.toHaveBeenCalled();
  });
});
