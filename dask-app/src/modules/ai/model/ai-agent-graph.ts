import type { Edge, Node } from "@xyflow/react";

export type AiAgentNodeKind = "trigger" | "llm" | "rag" | "tool" | "condition" | "transform" | "output" | "fallback";

export interface AiAgentNodeData extends Record<string, unknown> {
  kind: AiAgentNodeKind;
  label: string;
}

export type AiAgentNode = Node<AiAgentNodeData, AiAgentNodeKind>;
export type AiAgentEdge = Edge;

export interface AiAgentGraph {
  nodes: AiAgentNode[];
  edges: AiAgentEdge[];
}
