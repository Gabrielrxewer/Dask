import type { Edge, Node } from '@xyflow/react';

export type AgentNodeKind = 'trigger' | 'llm' | 'rag' | 'tool' | 'condition' | 'output';

export interface TriggerNodeData extends Record<string, unknown> {
  kind: 'trigger';
  label: string;
  triggerType: 'manual' | 'card_created' | 'card_updated' | 'card_status_changed';
}

export interface LlmNodeData extends Record<string, unknown> {
  kind: 'llm';
  label: string;
  model: string;
  temperature: number;
  systemPrompt: string;
}

export type RagSource = 'none' | 'documentation' | 'card' | 'card_and_documentation';

export interface RagNodeData extends Record<string, unknown> {
  kind: 'rag';
  label: string;
  source: RagSource;
  topK: number;
  contextInstruction: string;
  includeSemanticContext: boolean;
  includeLinkedDocuments: boolean;
}

export type ToolId = string;

export interface ToolNodeData extends Record<string, unknown> {
  kind: 'tool';
  label: string;
  toolId: ToolId;
}

export interface ConditionNodeData extends Record<string, unknown> {
  kind: 'condition';
  label: string;
  condition: string;
}

export type OutputType = 'text_response' | 'update_card';

export interface OutputNodeData extends Record<string, unknown> {
  kind: 'output';
  label: string;
  outputType: OutputType;
}

export type AgentNodeData =
  | TriggerNodeData
  | LlmNodeData
  | RagNodeData
  | ToolNodeData
  | ConditionNodeData
  | OutputNodeData;

export type AgentFlowNode = Node<AgentNodeData, AgentNodeKind>;
export type AgentFlowEdge = Edge;

export interface AgentFlow {
  nodes: AgentFlowNode[];
  edges: AgentFlowEdge[];
}

// ── palette metadata ──────────────────────────────────────────────────────────

export interface NodeKindMeta {
  kind: AgentNodeKind;
  label: string;
  description: string;
  color: string;
}

export const NODE_KIND_META: NodeKindMeta[] = [
  {
    kind: 'trigger',
    label: 'Trigger',
    description: 'Ponto de entrada do fluxo',
    color: 'var(--decorative-cyan)',
  },
  {
    kind: 'llm',
    label: 'LLM',
    description: 'Chamada ao modelo de linguagem',
    color: 'var(--decorative-purple)',
  },
  {
    kind: 'rag',
    label: 'Contexto',
    description: 'Recuperação de documentos / cards',
    color: 'var(--text-secondary)',
  },
  {
    kind: 'tool',
    label: 'Tool',
    description: 'Executa uma ação externa',
    color: 'var(--warning)',
  },
  {
    kind: 'condition',
    label: 'Condição',
    description: 'Ramificação condicional',
    color: 'var(--danger)',
  },
  {
    kind: 'output',
    label: 'Resposta',
    description: 'Saída final do fluxo',
    color: 'var(--decorative-purple)',
  },
];

export function getNodeColor(kind: AgentNodeKind): string {
  return NODE_KIND_META.find((m) => m.kind === kind)?.color ?? 'var(--primary)';
}
