import type { Edge, Node, XYPosition } from "@xyflow/react";

export interface FlowLayoutEngine<TNode extends Node = Node> {
  id: string;
  label: string;
  layout: (input: { nodes: TNode[]; edges: Edge[] }) => TNode[];
}

export interface FlowLayoutOptions {
  origin?: XYPosition;
  columnGap?: number;
  rowGap?: number;
  fallbackColumns?: number;
}

const DEFAULT_ORIGIN = { x: 120, y: 120 };

function buildIncomingCount(edges: Edge[]): Map<string, number> {
  return edges.reduce<Map<string, number>>((acc, edge) => {
    acc.set(edge.target, (acc.get(edge.target) ?? 0) + 1);
    return acc;
  }, new Map());
}

function buildOutgoing(edges: Edge[]): Map<string, string[]> {
  return edges.reduce<Map<string, string[]>>((acc, edge) => {
    acc.set(edge.source, [...(acc.get(edge.source) ?? []), edge.target]);
    return acc;
  }, new Map());
}

function computeDepths(nodes: Node[], edges: Edge[]): Map<string, number> {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const incoming = buildIncomingCount(edges);
  const outgoing = buildOutgoing(edges);
  const roots = nodes.filter((node) => (incoming.get(node.id) ?? 0) === 0);
  const queue = roots.length > 0 ? roots.map((node) => node.id) : nodes.slice(0, 1).map((node) => node.id);
  const depths = new Map<string, number>();

  for (const root of queue) {
    depths.set(root, 0);
  }

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    const depth = depths.get(nodeId) ?? 0;
    for (const target of outgoing.get(nodeId) ?? []) {
      if (!nodeIds.has(target)) continue;
      const nextDepth = depth + 1;
      if ((depths.get(target) ?? -1) < nextDepth) {
        depths.set(target, nextDepth);
        queue.push(target);
      }
    }
  }

  for (const node of nodes) {
    if (!depths.has(node.id)) {
      depths.set(node.id, Math.max(0, depths.size));
    }
  }

  return depths;
}

export function applyLayeredFlowLayout<TNode extends Node>(
  nodes: TNode[],
  edges: Edge[],
  options: FlowLayoutOptions = {}
): TNode[] {
  const origin = options.origin ?? DEFAULT_ORIGIN;
  const columnGap = options.columnGap ?? 280;
  const rowGap = options.rowGap ?? 150;
  const depths = computeDepths(nodes, edges);
  const lanes = new Map<number, TNode[]>();

  for (const node of nodes) {
    const depth = depths.get(node.id) ?? 0;
    lanes.set(depth, [...(lanes.get(depth) ?? []), node]);
  }

  const laneEntries = Array.from(lanes.entries()).sort(([left], [right]) => left - right);
  const positioned = new Map<string, XYPosition>();

  for (const [depth, laneNodes] of laneEntries) {
    const laneHeight = (laneNodes.length - 1) * rowGap;
    laneNodes.forEach((node, index) => {
      positioned.set(node.id, {
        x: origin.x + depth * columnGap,
        y: origin.y + index * rowGap - laneHeight / 2
      });
    });
  }

  return nodes.map((node) => ({
    ...node,
    position: positioned.get(node.id) ?? node.position
  }));
}

export const manualFlowLayoutEngine: FlowLayoutEngine = {
  id: "manual",
  label: "Manual",
  layout: ({ nodes }) => nodes
};

export const layeredFlowLayoutEngine: FlowLayoutEngine = {
  id: "layered",
  label: "Auto-layout",
  layout: ({ nodes, edges }) => applyLayeredFlowLayout(nodes, edges)
};
