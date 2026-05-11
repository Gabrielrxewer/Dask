import type { Edge } from "@xyflow/react";
import type { AutomationWorkflowVersion } from "@/modules/workspace/model";
import {
  isRecord,
  summarizeConfig
} from "./automation-page-view-model";
import type {
  AutomationCanvasNode,
  AutomationNodeMetaMap,
  AutomationNodeType,
  AutomationWorkflowGraph,
  AutomationWorkflowGraphEdge,
  AutomationWorkflowGraphNode
} from "./automation-page.types";

export function readVersionGraph(
  version: AutomationWorkflowVersion | null,
  defaultGraph: AutomationWorkflowGraph,
  nodeMeta: AutomationNodeMetaMap
): AutomationWorkflowGraph {
  if (!version) return defaultGraph;
  const definitionGraph = isRecord(version.definitionJson.graph) ? version.definitionJson.graph : null;
  const nodes = Array.isArray(definitionGraph?.nodes) ? definitionGraph.nodes : version.graphNodesJson;
  const edges = Array.isArray(definitionGraph?.edges) ? definitionGraph.edges : version.graphEdgesJson;
  return {
    version: 1,
    nodes: (Array.isArray(nodes) ? nodes : []).map((node, index) => normalizeGraphNode(node, index, nodeMeta)),
    edges: (Array.isArray(edges) ? edges : []).map((edge, index) => normalizeGraphEdge(edge, index)),
    metadata: isRecord(definitionGraph?.metadata) ? definitionGraph.metadata : {}
  };
}

export function normalizeGraphNode(value: unknown, index: number, nodeMeta: AutomationNodeMetaMap): AutomationWorkflowGraphNode {
  const raw = isRecord(value) ? value : {};
  const type = typeof raw.type === "string" && nodeMeta.has(raw.type as AutomationNodeType)
    ? raw.type as AutomationNodeType
    : "noop";
  const meta = nodeMeta.get(type);
  const position = isRecord(raw.position) && typeof raw.position.x === "number" && typeof raw.position.y === "number"
    ? { x: raw.position.x, y: raw.position.y }
    : { x: 120 + index * 220, y: 120 };

  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id : `${type}-${index + 1}`,
    type,
    label: typeof raw.label === "string" && raw.label.trim() ? raw.label : meta?.label ?? type,
    config: isRecord(raw.config) ? raw.config : {},
    position
  };
}

export function normalizeGraphEdge(value: unknown, index: number): AutomationWorkflowGraphEdge {
  const raw = isRecord(value) ? value : {};
  return {
    id: typeof raw.id === "string" && raw.id.trim() ? raw.id : `edge-${index + 1}`,
    source: typeof raw.source === "string" ? raw.source : "",
    target: typeof raw.target === "string" ? raw.target : "",
    sourceHandle: typeof raw.sourceHandle === "string" ? raw.sourceHandle : null,
    targetHandle: typeof raw.targetHandle === "string" ? raw.targetHandle : null,
    condition: isRecord(raw.condition) ? raw.condition : undefined
  };
}

export function graphToCanvas(graph: AutomationWorkflowGraph, nodeMeta: AutomationNodeMetaMap): { nodes: AutomationCanvasNode[]; edges: Edge[] } {
  return {
    nodes: graph.nodes.map((node, index) => {
      const type = node.type as AutomationNodeType;
      const meta = nodeMeta.get(type);
      return {
        id: node.id,
        type,
        position: node.position ?? { x: 120 + index * 220, y: 120 },
        data: {
          nodeType: type,
          label: node.label ?? meta?.label ?? type,
          summary: summarizeConfig(node.config),
          config: node.config ?? {}
        }
      };
    }),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
      type: "smoothstep"
    }))
  };
}

export function canvasToGraph(nodes: AutomationCanvasNode[], edges: Edge[]): AutomationWorkflowGraph {
  return {
    version: 1,
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type ?? node.data.nodeType,
      label: node.data.label,
      config: node.data.config,
      position: node.position
    })),
    edges: edges.map((edge, index) => ({
      id: edge.id || `edge-${index + 1}`,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null
    })),
    metadata: { editor: "automation-studio" }
  };
}
