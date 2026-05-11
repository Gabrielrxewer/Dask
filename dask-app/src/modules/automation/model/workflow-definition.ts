import type {
  AutomationRunDetail,
  AutomationRunEventSummary,
  AutomationRunListItem,
  AutomationStepRunSummary,
  AutomationWorkflowGraph,
  AutomationWorkflowGraphEdge,
  AutomationWorkflowGraphNode
} from "@/modules/workspace/model";

export type AutomationDefinitionSourceKind =
  | "automation"
  | "marketing_journey"
  | "marketing-journey"
  | "ai_agent"
  | "ai-agent";

export interface AutomationDefinitionSource {
  kind: AutomationDefinitionSourceKind;
  refId?: string | null;
  key?: string | null;
  name?: string | null;
}

export interface AutomationTriggerDefinition {
  type: string;
  eventName?: string;
  config?: Record<string, unknown>;
}

export interface AutomationNodeDefinition extends AutomationWorkflowGraphNode {
  executable?: boolean;
}

export interface AutomationEdgeDefinition extends AutomationWorkflowGraphEdge {
  branch?: string | null;
}

export interface AutomationExecutionPlan {
  schemaVersion: 1;
  entryNodeIds: string[];
  terminalNodeIds: string[];
  parallelGroups: Array<{
    sourceNodeId: string;
    targetNodeIds: string[];
  }>;
}

export interface AutomationWorkflowDefinition {
  schemaVersion: 1;
  definitionType: "automation_workflow";
  source: AutomationDefinitionSource;
  trigger?: AutomationTriggerDefinition | Record<string, unknown>;
  variables?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  graph: AutomationWorkflowGraph;
  executionPlan: AutomationExecutionPlan;
  metadata?: {
    visual?: Record<string, unknown>;
    executable?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

export type AutomationRun = AutomationRunListItem | AutomationRunDetail["run"];
export type AutomationRunStep = AutomationStepRunSummary;
export type AutomationDebugTrace = AutomationRunEventSummary | AutomationStepRunSummary;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeGraph(graph: AutomationWorkflowGraph): AutomationWorkflowGraph {
  return {
    version: 1,
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      label: node.label,
      config: isRecord(node.config) ? node.config : {},
      position: node.position
    })),
    edges: graph.edges.map((edge, index) => ({
      id: edge.id || `edge-${index + 1}`,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
      condition: isRecord(edge.condition) ? edge.condition : undefined
    })),
    metadata: isRecord(graph.metadata) ? graph.metadata : {}
  };
}

export function buildAutomationExecutionPlan(graph: AutomationWorkflowGraph): AutomationExecutionPlan {
  const targetIds = new Set(graph.edges.map((edge) => edge.target));
  const sourceIds = new Set(graph.edges.map((edge) => edge.source));
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, string[]>();

  for (const edge of graph.edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
  }

  const entryNodeIds = graph.nodes
    .filter((node) => node.type === "trigger" || !targetIds.has(node.id))
    .map((node) => node.id);
  const terminalNodeIds = graph.nodes
    .filter((node) => node.type === "end" || !sourceIds.has(node.id))
    .map((node) => node.id);
  const parallelGroups = Array.from(outgoing.entries())
    .filter(([, targetNodeIds]) => targetNodeIds.length > 1)
    .map(([sourceNodeId, targetNodeIds]) => ({
      sourceNodeId,
      targetNodeIds: targetNodeIds.filter((nodeId) => nodesById.has(nodeId))
    }))
    .filter((group) => group.targetNodeIds.length > 1);

  return {
    schemaVersion: 1,
    entryNodeIds,
    terminalNodeIds,
    parallelGroups
  };
}

export function automationGraphToWorkflowDefinition(input: {
  graph: AutomationWorkflowGraph;
  source?: AutomationDefinitionSource;
  trigger?: AutomationTriggerDefinition | Record<string, unknown>;
  variables?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): AutomationWorkflowDefinition {
  const graph = normalizeGraph(input.graph);

  return {
    schemaVersion: 1,
    definitionType: "automation_workflow",
    source: input.source ?? { kind: "automation" },
    trigger: input.trigger,
    variables: input.variables,
    settings: input.settings,
    graph,
    executionPlan: buildAutomationExecutionPlan(graph),
    metadata: {
      visual: graph.metadata,
      executable: input.metadata ?? {}
    }
  };
}

const sensitiveKeyPattern = /(secret|token|password|apiKey|apikey|authorization|prompt|output|response|content)/i;

export function maskAutomationDebugValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(maskAutomationDebugValue);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      sensitiveKeyPattern.test(key) ? "[masked]" : maskAutomationDebugValue(entry)
    ])
  );
}
