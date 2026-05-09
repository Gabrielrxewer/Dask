import { AppError } from '@/core/errors/app-error';
import { automationNodeCatalog } from '@/modules/automation/application/automation-capabilities';
import { validateAutomationNodeConfig } from '@/modules/automation/application/automation-node-config-schemas';
import type {
  AutomationGraphEdge,
  AutomationGraphNode,
  AutomationWorkflowDefinition,
  AutomationWorkflowGraph
} from '@/modules/automation/application/workflow-execution-types';

const defaultAutomationNodeTypes = new Set<string>(automationNodeCatalog.map((node) => node.type));
const triggerNodeTypes = new Set(['trigger']);

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
  const nodesById = new Map<string, AutomationGraphNode>();
  const triggerSignatures = new Map<string, string>();
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

    const configIssues = validateAutomationNodeConfig(node);
    if (configIssues.length > 0) {
      throw new AppError('Automation workflow node config is invalid.', 422, {
        nodeId: node.id,
        nodeType: node.type,
        issues: configIssues
      });
    }

    if (triggerNodeTypes.has(node.type)) {
      const signature = buildTriggerSignature(node);
      const duplicated = triggerSignatures.get(signature);
      if (duplicated) {
        throw new AppError('Automation workflow graph contains ambiguous duplicate triggers.', 422, {
          nodeId: node.id,
          duplicateOf: duplicated,
          signature
        });
      }
      triggerSignatures.set(signature, node.id);
    }

    nodeIds.add(node.id);
    nodesById.set(node.id, node);
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

  assertReachability(graph, nodesById);
  assertAcyclic(graph);
  assertNoObviousEventLoops(graph, nodesById);
}

function readText(config: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = config[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }

  return '';
}

function readTextList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).map((entry) => entry.trim());
  }

  return typeof value === 'string' && value.trim().length > 0 ? [value.trim()] : [];
}

function buildTriggerSignature(node: AutomationGraphNode): string {
  const config = isRecord(node.config) ? node.config : {};
  const explicitEvents = [
    ...readTextList(config.eventName),
    ...readTextList(config.eventNames),
    ...readTextList(config.domainEvent),
    ...readTextList(config.domainEvents)
  ].sort();

  if (explicitEvents.length > 0) {
    return `events:${explicitEvents.join(',')}:${readText(config, ['status', 'stateSlug'])}:${readText(config, ['column', 'columnSlug', 'toColumnKey'])}`;
  }

  const triggerType = readText(config, ['triggerType', 'type']) || 'manual';
  return [
    triggerType,
    readText(config, ['column', 'columnSlug', 'toColumnKey']),
    readText(config, ['state', 'stateSlug', 'toStateSlug', 'status']),
    readTextList(config.itemTypeSlug).concat(readTextList(config.itemTypeSlugs)).sort().join(',')
  ].join('|');
}

function buildOutgoing(graph: AutomationWorkflowGraph): Map<string, string[]> {
  const outgoing = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const next = outgoing.get(edge.source) ?? [];
    next.push(edge.target);
    outgoing.set(edge.source, next);
  }
  return outgoing;
}

function assertReachability(graph: AutomationWorkflowGraph, nodesById: Map<string, AutomationGraphNode>): void {
  const outgoing = buildOutgoing(graph);
  const triggerIds = graph.nodes.filter((node) => node.type === 'trigger').map((node) => node.id);
  const reachable = new Set<string>();
  const pending = [...triggerIds];

  while (pending.length > 0) {
    const nodeId = pending.shift()!;
    if (reachable.has(nodeId)) {
      continue;
    }
    reachable.add(nodeId);
    pending.push(...(outgoing.get(nodeId) ?? []));
  }

  const unreachable = graph.nodes.find((node) => !reachable.has(node.id));
  if (unreachable) {
    throw new AppError('Automation workflow graph contains unreachable nodes.', 422, {
      nodeId: unreachable.id,
      nodeType: nodesById.get(unreachable.id)?.type
    });
  }
}

function assertAcyclic(graph: AutomationWorkflowGraph): void {
  const outgoing = buildOutgoing(graph);
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) {
      return true;
    }
    if (visited.has(nodeId)) {
      return false;
    }

    visiting.add(nodeId);
    for (const target of outgoing.get(nodeId) ?? []) {
      if (visit(target)) {
        return true;
      }
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  };

  for (const node of graph.nodes) {
    if (visit(node.id)) {
      throw new AppError('Automation workflow graph contains an invalid cycle.', 422, {
        nodeId: node.id
      });
    }
  }
}

function collectReachableActionNodes(
  graph: AutomationWorkflowGraph,
  nodesById: Map<string, AutomationGraphNode>,
  triggerId: string
): AutomationGraphNode[] {
  const outgoing = buildOutgoing(graph);
  const found: AutomationGraphNode[] = [];
  const visited = new Set<string>();
  const pending = [...(outgoing.get(triggerId) ?? [])];

  while (pending.length > 0) {
    const nodeId = pending.shift()!;
    if (visited.has(nodeId)) {
      continue;
    }
    visited.add(nodeId);
    const node = nodesById.get(nodeId);
    if (node) {
      found.push(node);
    }
    pending.push(...(outgoing.get(nodeId) ?? []));
  }

  return found;
}

function assertNoObviousEventLoops(graph: AutomationWorkflowGraph, nodesById: Map<string, AutomationGraphNode>): void {
  for (const trigger of graph.nodes.filter((node) => node.type === 'trigger')) {
    const config = isRecord(trigger.config) ? trigger.config : {};
    const triggerType = readText(config, ['triggerType', 'type']);
    const actions = collectReachableActionNodes(graph, nodesById, trigger.id);

    for (const action of actions) {
      const actionConfig = isRecord(action.config) ? action.config : {};
      if (triggerType === 'work_item_moved_to_column' && action.type === 'move_work_item') {
        const triggerColumn = readText(config, ['column', 'columnSlug', 'toColumnKey']);
        const actionColumn = readText(actionConfig, ['column', 'columnSlug']);
        if (triggerColumn && actionColumn && triggerColumn === actionColumn) {
          throw new AppError('Automation workflow graph can loop on the same work item move event.', 422, {
            triggerNodeId: trigger.id,
            actionNodeId: action.id,
            column: triggerColumn
          });
        }
      }

      if (triggerType === 'work_item_state_changed' && action.type === 'move_work_item') {
        const triggerState = readText(config, ['stateSlug', 'status', 'toStateSlug']);
        const actionState = readText(actionConfig, ['stateSlug', 'status']);
        if (triggerState && actionState && triggerState === actionState) {
          throw new AppError('Automation workflow graph can loop on the same work item state event.', 422, {
            triggerNodeId: trigger.id,
            actionNodeId: action.id,
            state: triggerState
          });
        }
      }

      if (triggerType === 'proposal_status_changed' && action.type === 'update_document_status') {
        const status = readText(config, ['status']);
        if (readText(actionConfig, ['kind']) === 'proposal' && status && status === readText(actionConfig, ['status'])) {
          throw new AppError('Automation workflow graph can loop on the same proposal status event.', 422, {
            triggerNodeId: trigger.id,
            actionNodeId: action.id,
            status
          });
        }
      }

      if (triggerType === 'contract_status_changed' && action.type === 'update_document_status') {
        const status = readText(config, ['status']);
        if (readText(actionConfig, ['kind']) === 'contract' && status && status === readText(actionConfig, ['status'])) {
          throw new AppError('Automation workflow graph can loop on the same contract status event.', 422, {
            triggerNodeId: trigger.id,
            actionNodeId: action.id,
            status
          });
        }
      }

      if (triggerType === 'billing_requested' && action.type === 'create_billing_order') {
        throw new AppError('Automation workflow graph can loop by creating billing from billing.requested.', 422, {
          triggerNodeId: trigger.id,
          actionNodeId: action.id
        });
      }
    }
  }
}
