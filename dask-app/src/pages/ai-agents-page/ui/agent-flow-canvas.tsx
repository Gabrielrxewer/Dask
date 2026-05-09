import type { OnEdgesChange, OnNodesChange } from '@xyflow/react';
import type { AiCapabilities } from '@/modules/workspace/model';
import { FlowCanvas, type FlowCanvasPaletteItem } from '@/shared/ui';
import {
  TriggerNode,
  LlmNode,
  RagNode,
  ToolNode,
  ConditionNode,
  OutputNode,
} from './agent-flow-nodes';
import type {
  AgentFlowNode,
  AgentFlowEdge,
  AgentNodeKind,
  AgentNodeData,
  TriggerNodeData,
  LlmNodeData,
  RagNodeData,
  ToolNodeData,
  ConditionNodeData,
  OutputNodeData,
} from './agent-flow-types';
import { NODE_KIND_META } from './agent-flow-types';

const NODE_TYPES = {
  trigger: TriggerNode,
  llm: LlmNode,
  rag: RagNode,
  tool: ToolNode,
  condition: ConditionNode,
  output: OutputNode,
} as const;

function buildDefaultNodeData(kind: AgentNodeKind, capabilities: AiCapabilities): AgentNodeData {
  const map: Record<AgentNodeKind, AgentNodeData> = {
    trigger: { kind: 'trigger', label: 'Disparador', triggerType: 'manual' } as TriggerNodeData,
    llm: { kind: 'llm', label: 'LLM', model: capabilities.defaults.model, temperature: 0.2, systemPrompt: '' } as LlmNodeData,
    rag: {
      kind: 'rag',
      label: 'Contexto',
      source: capabilities.defaults.ragSource,
      topK: capabilities.defaults.topKContextDocs,
      contextInstruction: '',
      includeSemanticContext: true,
      includeLinkedDocuments: true,
    } as RagNodeData,
    tool: { kind: 'tool', label: 'Tool', toolId: capabilities.tools[0]?.value ?? '' } as ToolNodeData,
    condition: { kind: 'condition', label: 'Condicao', condition: '' } as ConditionNodeData,
    output: { kind: 'output', label: 'Resposta', outputType: 'text_response' } as OutputNodeData,
  };
  return map[kind];
}

interface AgentFlowCanvasProps {
  nodes: AgentFlowNode[];
  edges: AgentFlowEdge[];
  onNodesChange: OnNodesChange<AgentFlowNode>;
  onEdgesChange: OnEdgesChange<AgentFlowEdge>;
  onEdgesAdd: (edges: AgentFlowEdge[]) => void;
  onNodeSelect: (nodeId: string | null) => void;
  onNodesAdd: (nodes: AgentFlowNode[]) => void;
  fitViewKey: number;
  selectedNodeId: string | null;
  capabilities: AiCapabilities;
}

export function AgentFlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onEdgesAdd,
  onNodeSelect,
  onNodesAdd,
  fitViewKey,
  capabilities,
}: AgentFlowCanvasProps) {
  const paletteItems: FlowCanvasPaletteItem<AgentNodeKind, AgentNodeData>[] = NODE_KIND_META.map((meta) => ({
    ...meta,
    buildData: () => buildDefaultNodeData(meta.kind, capabilities),
    deletable: meta.kind !== 'trigger' && meta.kind !== 'output',
  }));

  return (
    <FlowCanvas<AgentNodeData, AgentNodeKind>
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      paletteItems={paletteItems}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onEdgesAdd={onEdgesAdd}
      onNodesAdd={onNodesAdd}
      onNodeSelect={onNodeSelect}
      fitViewKey={fitViewKey}
    />
  );
}
