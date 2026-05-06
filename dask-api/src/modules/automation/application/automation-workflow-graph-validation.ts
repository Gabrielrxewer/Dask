import { AppError } from '@/core/errors/app-error';
import type {
  AutomationGraphEdge,
  AutomationGraphNode,
  AutomationWorkflowDefinition,
  AutomationWorkflowGraph
} from '@/modules/automation/application/workflow-execution-types';

const defaultAutomationNodeTypes = new Set([
  'trigger',
  'condition',
  'delay',
  'noop',
  'end',
  'communication_send',
  'human_approval',
  'ai_summarize_context',
  'ai_classify_reply',
  'ai_extract_intent',
  'ai_generate_message_draft',
  'ai_recommend_next_action',
  'ai_fill_template_variables'
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizePosition(value: unknown): { x: number; y: number } | undefined {
  if (!isRecord(value) || typeof value.x !== 'number' || typeof value.y !== 'number') {
    return undefined;
  }

  return {
    x: value.x,
    y: value.y
  };
}

function normalizeNode(value: unknown): AutomationGraphNode {
  if (!isRecord(value)) {
    throw new AppError('Automation workflow graph nodes must be objects.', 422);
  }

  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const type = typeof value.type === 'string' ? value.type.trim() : '';

  return {
    id,
    type,
    label: typeof value.label === 'string' && value.label.trim() ? value.label.trim() : undefined,
    config: isRecord(value.config) ? value.config : {},
    position: normalizePosition(value.position)
  };
}

function normalizeEdge(value: unknown): AutomationGraphEdge {
  if (!isRecord(value)) {
    throw new AppError('Automation workflow graph edges must be objects.', 422);
  }

  const id = typeof value.id === 'string' && value.id.trim() ? value.id.trim() : '';
  const source = typeof value.source === 'string' ? value.source.trim() : '';
  const target = typeof value.target === 'string' ? value.target.trim() : '';
  const sourceHandle = typeof value.sourceHandle === 'string' ? value.sourceHandle : null;
  const targetHandle = typeof value.targetHandle === 'string' ? value.targetHandle : null;

  return {
    id,
    source,
    target,
    sourceHandle,
    targetHandle,
    condition: isRecord(value.condition) ? value.condition : undefined
  };
}

export function buildCanonicalAutomationWorkflowGraph(input: {
  definition?: AutomationWorkflowDefinition;
  graph?: unknown;
  graphNodes?: AutomationGraphNode[];
  graphEdges?: AutomationGraphEdge[];
}): AutomationWorkflowGraph {
  const definitionGraph = isRecord(input.definition?.graph) ? input.definition.graph : undefined;
  const sourceGraph = isRecord(input.graph) ? input.graph : definitionGraph;
  const nodesSource = input.graphNodes ?? (Array.isArray(sourceGraph?.nodes) ? sourceGraph.nodes : undefined);
  const edgesSource = input.graphEdges ?? (Array.isArray(sourceGraph?.edges) ? sourceGraph.edges : undefined);

  return {
    version: 1,
    nodes: (nodesSource ?? []).map(normalizeNode),
    edges: (edgesSource ?? []).map(normalizeEdge),
    metadata: isRecord(sourceGraph?.metadata) ? sourceGraph.metadata : {}
  };
}

export function validateAutomationWorkflowGraph(graph: AutomationWorkflowGraph): void {
  if (graph.version !== 1) {
    throw new AppError('Automation workflow graph version must be 1.', 422);
  }

  if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    throw new AppError('Automation workflow graph must contain at least one node.', 422);
  }

  if (!Array.isArray(graph.edges)) {
    throw new AppError('Automation workflow graph edges must be an array.', 422);
  }

  const nodeIds = new Set<string>();
  let hasTrigger = false;

  for (const node of graph.nodes) {
    if (!node.id) {
      throw new AppError('Automation workflow graph contains a node without id.', 422);
    }

    if (nodeIds.has(node.id)) {
      throw new AppError('Automation workflow graph contains duplicated node ids.', 422, { nodeId: node.id });
    }

    if (!node.type) {
      throw new AppError('Automation workflow graph contains a node without type.', 422, { nodeId: node.id });
    }

    if (!defaultAutomationNodeTypes.has(node.type)) {
      throw new AppError(`Unknown automation workflow node type "${node.type}".`, 422, {
        nodeId: node.id,
        nodeType: node.type
      });
    }

    if (!isRecord(node.config)) {
      throw new AppError('Automation workflow node config must be an object.', 422, { nodeId: node.id });
    }

    nodeIds.add(node.id);
    hasTrigger = hasTrigger || node.type === 'trigger';
  }

  if (!hasTrigger) {
    throw new AppError('Automation workflow graph must contain a trigger node.', 422);
  }

  for (const edge of graph.edges) {
    if (!edge.source || !edge.target) {
      throw new AppError('Automation workflow graph contains an edge without source or target.', 422, {
        edgeId: edge.id
      });
    }

    if (!nodeIds.has(edge.source)) {
      throw new AppError('Automation workflow graph edge source does not exist.', 422, {
        edgeId: edge.id,
        source: edge.source
      });
    }

    if (!nodeIds.has(edge.target)) {
      throw new AppError('Automation workflow graph edge target does not exist.', 422, {
        edgeId: edge.id,
        target: edge.target
      });
    }
  }
}
