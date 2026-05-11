import { describe, expect, it } from 'vitest';
import { compileAiAgentToAutomationWorkflow } from '@/modules/ai/model/ai-agent-runtime-compiler';
import type { AIAgentData } from '@/modules/ai/repositories/ai-agent-repository';

function buildAgent(config: Record<string, unknown>): AIAgentData {
  return {
    id: 'agent-1',
    workspaceId: 'ws-1',
    key: 'support-agent',
    name: 'Support Agent',
    description: null,
    model: 'gpt-4.1-mini',
    temperature: 0.2,
    systemPrompt: 'Help the operator.',
    config,
    isActive: true,
    isDefault: false,
    updatedAt: new Date()
  };
}

describe('compileAiAgentToAutomationWorkflow', () => {
  it('compiles visual AI agent flow into a valid automation workflow definition', () => {
    const compiled = compileAiAgentToAutomationWorkflow(buildAgent({
      flow: {
        nodes: [
          { id: 'trigger', type: 'trigger', position: { x: 0, y: 0 }, data: { label: 'Input', triggerType: 'manual' } },
          { id: 'rag', type: 'rag', position: { x: 200, y: 0 }, data: { label: 'Context', source: 'documentation', topK: 5 } },
          { id: 'llm', type: 'llm', position: { x: 400, y: 0 }, data: { label: 'LLM', model: 'gpt-4.1-mini' } },
          { id: 'output', type: 'output', position: { x: 600, y: 0 }, data: { label: 'Output', outputType: 'text_response' } }
        ],
        edges: [
          { id: 'e1', source: 'trigger', target: 'rag' },
          { id: 'e2', source: 'rag', target: 'llm' },
          { id: 'e3', source: 'llm', target: 'output' }
        ]
      }
    }));

    expect(compiled.issues).toEqual([]);
    expect(compiled.definition.graph?.nodes.map((node) => node.type)).toEqual([
      'trigger',
      'ai_summarize_context',
      'ai_generate_message_draft',
      'end'
    ]);
    expect(compiled.definition.source.agentKey).toBe('support-agent');
  });

  it('reports graph problems before publication', () => {
    const compiled = compileAiAgentToAutomationWorkflow(buildAgent({
      flow: {
        nodes: [
          { id: 'trigger', type: 'trigger', data: { label: 'Input' } },
          { id: 'output', type: 'output', data: { label: 'Output' } }
        ],
        edges: [{ id: 'broken', source: 'trigger', target: 'missing' }]
      }
    }));

    expect(compiled.issues.some((issue) => issue.includes('missing') || issue.includes('inexistente'))).toBe(true);
  });
});
