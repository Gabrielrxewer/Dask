import type { Prisma } from '@prisma/client';
import { redactErrorMessage } from '@/core/security/redaction';
import type { AIAgentData } from '@/modules/ai/repositories/ai-agent-repository';
import {
  validateAutomationWorkflowGraph
} from '@/modules/automation/application/automation-workflow-graph-validation';
import type {
  AutomationWorkflowDefinition,
  AutomationWorkflowEdge,
  AutomationWorkflowGraph,
  AutomationWorkflowNode
} from '@/modules/automation/application/workflow-execution-types';

type AgentFlowNode = {
  id?: unknown;
  type?: unknown;
  position?: unknown;
  data?: unknown;
};

type AgentFlowEdge = {
  id?: unknown;
  source?: unknown;
  target?: unknown;
  sourceHandle?: unknown;
  targetHandle?: unknown;
};

export type CompiledAiAgentRuntimeDefinition = AutomationWorkflowDefinition & {
  source: {
    kind: 'ai-agent';
    agentId: string;
    agentKey: string;
    agentName: string;
  };
};

export interface CompiledAiAgentRuntime {
  definition: CompiledAiAgentRuntimeDefinition;
  issues: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function readString(source: Record<string, unknown>, key: string, fallback = ''): string {
  const value = source[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

function readNumber(source: Record<string, unknown>, key: string, fallback: number): number {
  const value = source[key];
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBoolean(source: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = source[key];
  return typeof value === 'boolean' ? value : fallback;
}

function readPosition(value: unknown): { x: number; y: number } | undefined {
  if (!isRecord(value) || typeof value.x !== 'number' || typeof value.y !== 'number') {
    return undefined;
  }

  return { x: value.x, y: value.y };
}

function readAgentConfig(agent: AIAgentData): Record<string, unknown> {
  return isRecord(agent.config) ? agent.config : {};
}

function normalizeFlowFromConfig(config: Record<string, unknown>): { nodes: AgentFlowNode[]; edges: AgentFlowEdge[] } | null {
  const flow = readRecord(config.flow);
  return Array.isArray(flow.nodes)
    ? {
        nodes: flow.nodes.filter(isRecord),
        edges: Array.isArray(flow.edges) ? flow.edges.filter(isRecord) : []
      }
    : null;
}

function defaultAgentFlow(agent: AIAgentData): { nodes: AgentFlowNode[]; edges: AgentFlowEdge[] } {
  const config = readAgentConfig(agent);
  const rag = readRecord(config.rag);
  const ragEnabled = rag.enabled !== false && readString(rag, 'source', 'documentation') !== 'none';
  const nodes: AgentFlowNode[] = [
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 120, y: 120 },
      data: { label: 'Disparador', triggerType: 'manual' }
    }
  ];
  const edges: AgentFlowEdge[] = [];
  let previous = 'trigger-1';

  if (ragEnabled) {
    nodes.push({
      id: 'rag-1',
      type: 'rag',
      position: { x: 420, y: 120 },
      data: {
        label: 'Contexto',
        source: readString(rag, 'source', 'documentation'),
        topK: readNumber(rag, 'topKContextDocs', 5),
        contextInstruction: readString(rag, 'contextInstruction'),
        includeSemanticContext: readBoolean(rag, 'includeSemanticContext', true),
        includeLinkedDocuments: readBoolean(rag, 'includeLinkedDocuments', true)
      }
    });
    edges.push({ id: 'e-trigger-1-rag-1', source: previous, target: 'rag-1' });
    previous = 'rag-1';
  }

  nodes.push({
    id: 'llm-1',
    type: 'llm',
    position: { x: ragEnabled ? 720 : 420, y: 120 },
    data: {
      label: 'LLM',
      model: agent.model,
      temperature: agent.temperature,
      systemPrompt: agent.systemPrompt
    }
  });
  edges.push({ id: `e-${previous}-llm-1`, source: previous, target: 'llm-1' });

  nodes.push({
    id: 'output-1',
    type: 'output',
    position: { x: ragEnabled ? 1020 : 720, y: 120 },
    data: { label: 'Resposta', outputType: 'text_response' }
  });
  edges.push({ id: 'e-llm-1-output-1', source: 'llm-1', target: 'output-1' });

  return { nodes, edges };
}

function normalizeAgentFlow(agent: AIAgentData): { nodes: AgentFlowNode[]; edges: AgentFlowEdge[] } {
  return normalizeFlowFromConfig(readAgentConfig(agent)) ?? defaultAgentFlow(agent);
}

function compileNode(node: AgentFlowNode, index: number, agent: AIAgentData): AutomationWorkflowNode {
  const data = readRecord(node.data);
  const id = typeof node.id === 'string' && node.id.trim().length > 0 ? node.id.trim() : `ai-node-${index + 1}`;
  const kind = typeof node.type === 'string' && node.type.trim().length > 0 ? node.type.trim() : readString(data, 'kind', 'noop');
  const label = readString(data, 'label', kind);
  const position = readPosition(node.position);

  if (kind === 'trigger') {
    return {
      id,
      type: 'trigger',
      label,
      config: {
        triggerType: readString(data, 'triggerType', 'manual'),
        source: 'ai-agent',
        agentId: agent.id,
        agentKey: agent.key
      },
      position
    };
  }

  if (kind === 'rag') {
    return {
      id,
      type: 'ai_summarize_context',
      label,
      config: {
        workItemId: '{{itemId}}',
        contactId: '{{contactId}}',
        include: [readString(data, 'source', 'documentation')],
        topKContextDocs: readNumber(data, 'topK', 5),
        contextInstruction: readString(data, 'contextInstruction'),
        includeSemanticContext: readBoolean(data, 'includeSemanticContext', true),
        includeLinkedDocuments: readBoolean(data, 'includeLinkedDocuments', true)
      },
      position
    };
  }

  if (kind === 'llm') {
    return {
      id,
      type: 'ai_generate_message_draft',
      label,
      config: {
        model: readString(data, 'model', agent.model),
        temperature: readNumber(data, 'temperature', agent.temperature),
        systemPrompt: readString(data, 'systemPrompt', agent.systemPrompt),
        goal: '{{instruction}}',
        contextSummary: '{{previousOutput.summary}}',
        channel: 'email'
      },
      position
    };
  }

  if (kind === 'condition') {
    return {
      id,
      type: 'condition',
      label,
      config: {
        field: readString(data, 'field', 'previousOutput'),
        operator: readString(data, 'operator', 'exists'),
        value: data.value,
        expression: readString(data, 'condition')
      },
      position
    };
  }

  if (kind === 'output') {
    return {
      id,
      type: 'end',
      label,
      config: {
        outputType: readString(data, 'outputType', 'text_response')
      },
      position
    };
  }

  return {
    id,
    type: 'noop',
    label,
    config: {
      source: kind === 'tool' ? 'ai-agent-tool' : 'ai-agent',
      originalKind: kind,
      toolId: data.toolId,
      data
    },
    position
  };
}

function compileEdge(edge: AgentFlowEdge, index: number): AutomationWorkflowEdge {
  return {
    id: typeof edge.id === 'string' && edge.id.trim().length > 0 ? edge.id.trim() : `ai-agent-edge-${index + 1}`,
    source: typeof edge.source === 'string' ? edge.source : '',
    target: typeof edge.target === 'string' ? edge.target : '',
    sourceHandle: typeof edge.sourceHandle === 'string' ? edge.sourceHandle : null,
    targetHandle: typeof edge.targetHandle === 'string' ? edge.targetHandle : null
  };
}

function validateAgentFlow(graph: AutomationWorkflowGraph): string[] {
  const issues: string[] = [];
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const triggers = graph.nodes.filter((node) => node.type === 'trigger');
  const outputs = graph.nodes.filter((node) => node.type === 'end');

  if (triggers.length === 0) issues.push('Adicione um trigger ao agente.');
  if (triggers.length > 1) issues.push('Use apenas um trigger por agente nesta versao.');
  if (outputs.length === 0) issues.push('Adicione um node de saida ao agente.');

  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      issues.push(`Conexao ${edge.id} aponta para node inexistente.`);
    }
  }

  try {
    validateAutomationWorkflowGraph(graph);
  } catch (error) {
    issues.push(redactErrorMessage(error));
  }

  return Array.from(new Set(issues));
}

export function compileAiAgentToAutomationWorkflow(agent: AIAgentData): CompiledAiAgentRuntime {
  const flow = normalizeAgentFlow(agent);
  const graph: AutomationWorkflowGraph = {
    version: 1,
    nodes: flow.nodes.map((node, index) => compileNode(node, index, agent)),
    edges: flow.edges.map(compileEdge),
    metadata: {
      source: 'ai-agent',
      agentId: agent.id,
      agentKey: agent.key,
      compilerVersion: 1
    }
  };

  return {
    definition: {
      trigger: {
        type: 'ai-agent',
        agentId: agent.id,
        agentKey: agent.key
      },
      settings: {
        executionMode: 'automation-runtime',
        supportsParallelBranches: true
      },
      graph,
      source: {
        kind: 'ai-agent',
        agentId: agent.id,
        agentKey: agent.key,
        agentName: agent.name
      }
    },
    issues: validateAgentFlow(graph)
  };
}

export function mergeAiAgentRuntimeConfig(input: {
  config: Prisma.JsonValue | null;
  runtime: Record<string, unknown>;
}): Prisma.InputJsonValue {
  const config = isRecord(input.config) ? input.config : {};
  return {
    ...config,
    automationRuntime: {
      ...readRecord(config.automationRuntime),
      ...input.runtime
    }
  } as Prisma.InputJsonValue;
}
