import { AppError } from '@/core/errors/app-error';
import {
  buildCanonicalAutomationWorkflowGraph,
  validateAutomationWorkflowGraph,
} from '@/modules/automation/application/automation-workflow-graph-validation';
import type {
  AutomationExecutionPlan,
  AutomationWorkflowDefinition,
  AutomationWorkflowEdge,
  AutomationWorkflowGraph,
  AutomationWorkflowNode,
} from '@/modules/automation/application/workflow-execution-types';

type MarketingJourneyStatus = 'draft' | 'active' | 'paused' | 'archived' | 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

type MarketingJourneyStepKind = 'TRIGGER' | 'CONDITION' | 'DELAY' | 'ACTION' | 'BRANCH' | 'EXIT';

type MarketingJourneyNode = {
  id: string;
  kind: MarketingJourneyStepKind;
  label?: string;
  config: Record<string, unknown>;
  position?: { x: number; y: number };
};

type MarketingJourneyStep = MarketingJourneyNode & {
  nextStepId?: string | null;
};

type MarketingJourneyEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  condition?: Record<string, unknown>;
};

type MarketingJourneySourceDefinition = {
  version: 1;
  nodes: MarketingJourneyNode[];
  edges: MarketingJourneyEdge[];
  metadata: Record<string, unknown>;
};

type MarketingJourneyRuntimeMetadata = Record<string, unknown> & {
  source: 'marketing_journey';
  compilerVersion: 1;
  graphVersion: 1;
  flowId: string;
  compiledAt: string;
  triggerCount: number;
  actionCount: number;
  approvalCount: number;
  branchCount: number;
  controlCount: number;
  terminalCount: number;
};

export type MarketingJourneyRuntimeSource = Record<string, unknown> & {
  kind: 'marketing_journey';
  flowId: string;
  compiledAt: string;
  compilerVersion: 1;
  sourceVersion?: 1;
  sourceHash?: string;
};

export type CompiledMarketingJourneyRuntimeDefinition = AutomationWorkflowDefinition & {
  schemaVersion: 1;
  definitionType: 'automation_workflow';
  source: MarketingJourneyRuntimeSource;
  graph: AutomationWorkflowGraph;
  metadata: MarketingJourneyRuntimeMetadata;
  executionPlan: AutomationExecutionPlan;
};

export type CompiledMarketingJourneyRuntime = {
  definition: CompiledMarketingJourneyRuntimeDefinition;
  graph: AutomationWorkflowGraph;
};

export type CompileMarketingJourneyRuntimeInput = {
  flowId: string;
  name?: string;
  description?: string | null;
  status?: MarketingJourneyStatus | null;
  triggerDefinition: Record<string, unknown>;
};

const supportedJourneyActionTypes = new Set(['send_campaign', 'human_approval', 'approval']);

export function compileMarketingJourneyRuntime(input: CompileMarketingJourneyRuntimeInput): CompiledMarketingJourneyRuntime | null {
  const sourceDefinition = readMarketingJourneySourceDefinition(input.triggerDefinition);
  const compiledAt = readCompiledAt(input.triggerDefinition);

  const graph = sourceDefinition
    ? compileSourceDefinitionToRuntimeGraph(input.flowId, sourceDefinition, compiledAt)
    : readPersistedRuntimeGraph(input.triggerDefinition, input.flowId, compiledAt);

  if (!graph) {
    return null;
  }

  if (sourceDefinition) {
    validatePersistedRuntimeGraphMatchesSource(input.triggerDefinition, graph);
  }

  const metadata = buildRuntimeMetadata(input.flowId, graph, compiledAt);
  const graphWithMetadata: AutomationWorkflowGraph = {
    ...graph,
    metadata,
  };

  const definition: CompiledMarketingJourneyRuntimeDefinition = {
    schemaVersion: 1,
    definitionType: 'automation_workflow',
    source: {
      kind: 'marketing_journey',
      flowId: input.flowId,
      compiledAt,
      compilerVersion: 1,
      sourceVersion: sourceDefinition?.version,
      sourceHash: readText(sourceDefinition?.metadata.sourceHash),
    },
    trigger: buildRuntimeDefinitionTrigger(input.triggerDefinition, sourceDefinition),
    variables: {},
    settings: buildRuntimeSettings(input),
    graph: graphWithMetadata,
    executionPlan: buildExecutionPlan(graphWithMetadata),
    metadata,
  };

  return {
    definition,
    graph: graphWithMetadata,
  };
}

function compileSourceDefinitionToRuntimeGraph(
  flowId: string,
  definition: MarketingJourneySourceDefinition,
  compiledAt: string,
): AutomationWorkflowGraph {
  validateMarketingJourneySource(definition);

  const graph: AutomationWorkflowGraph = {
    version: 1,
    nodes: definition.nodes.map(compileJourneyNode),
    edges: definition.edges.map(compileJourneyEdge),
    metadata: {
      source: 'marketing_journey',
      compilerVersion: 1,
      graphVersion: 1,
      flowId,
      compiledAt,
    },
  };

  const canonicalGraph = buildCanonicalAutomationWorkflowGraph({ graph });
  validateAutomationWorkflowGraph(canonicalGraph);
  return canonicalGraph;
}

function readMarketingJourneySourceDefinition(
  triggerDefinition: Record<string, unknown>,
): MarketingJourneySourceDefinition | null {
  const nodes = readJourneyNodes(triggerDefinition.nodes);
  const steps = nodes ? null : readJourneySteps(triggerDefinition.steps);

  if (!nodes && !steps) {
    return null;
  }

  const version = readOptionalNumber(triggerDefinition.version);
  if (version !== 1) {
    throw new AppError('Marketing journey definition version must be 1 before runtime compilation.', 422, {
      receivedVersion: version,
    });
  }

  const sourceNodes = nodes ?? buildJourneyNodesFromSteps(steps ?? []);
  const sourceEdges = nodes ? readJourneyEdges(triggerDefinition.edges) : buildJourneyEdgesFromSteps(steps ?? []);

  return {
    version: 1,
    nodes: sourceNodes,
    edges: sourceEdges,
    metadata: readRecord(triggerDefinition.metadata) ?? {},
  };
}

function readPersistedRuntimeGraph(
  triggerDefinition: Record<string, unknown>,
  flowId: string,
  compiledAt: string,
): AutomationWorkflowGraph | null {
  const graphCandidate = readRuntimeGraphCandidate(triggerDefinition);
  if (!graphCandidate) {
    return null;
  }

  assertRuntimeGraphVersion(graphCandidate);
  const graph = buildCanonicalAutomationWorkflowGraph({ graph: graphCandidate });
  validateAutomationWorkflowGraph(graph);

  return {
    ...graph,
    metadata: {
      ...(readRecord(graph.metadata) ?? {}),
      source: 'marketing_journey',
      compilerVersion: 1,
      graphVersion: 1,
      flowId,
      compiledAt,
    },
  };
}

function validatePersistedRuntimeGraphMatchesSource(
  triggerDefinition: Record<string, unknown>,
  compiledGraph: AutomationWorkflowGraph,
): void {
  const graphCandidate = readRuntimeGraphCandidate(triggerDefinition);
  if (!graphCandidate) {
    return;
  }

  assertRuntimeGraphVersion(graphCandidate);
  const persistedGraph = buildCanonicalAutomationWorkflowGraph({ graph: graphCandidate });
  validateAutomationWorkflowGraph(persistedGraph);

  if (!runtimeGraphsHaveSameShape(persistedGraph, compiledGraph)) {
    throw new AppError('Persisted Marketing Journey runtimeGraph is stale or does not match the journey source.', 422);
  }
}

function validateMarketingJourneySource(definition: MarketingJourneySourceDefinition): void {
  if (definition.nodes.length === 0) {
    throw new AppError('Marketing journey must contain at least one node before runtime compilation.', 422);
  }

  const nodeIds = new Set<string>();
  for (const node of definition.nodes) {
    if (nodeIds.has(node.id)) {
      throw new AppError(`Marketing journey contains duplicate node "${node.id}".`, 422);
    }
    nodeIds.add(node.id);
    validateJourneyNodeConfig(node);
  }

  const triggerNodes = definition.nodes.filter((node) => node.kind === 'TRIGGER');
  if (triggerNodes.length === 0) {
    throw new AppError('Marketing journey must contain a trigger node before activation.', 422);
  }
  if (triggerNodes.length > 1) {
    throw new AppError('Marketing journey must contain exactly one trigger node before activation.', 422);
  }

  for (const edge of definition.edges) {
    if (!nodeIds.has(edge.source)) {
      throw new AppError(`Marketing journey edge "${edge.id}" references missing source node "${edge.source}".`, 422);
    }
    if (!nodeIds.has(edge.target)) {
      throw new AppError(`Marketing journey edge "${edge.id}" references missing target node "${edge.target}".`, 422);
    }
  }

  assertEveryNodeIsReachable(definition, triggerNodes[0].id);
}

function validateJourneyNodeConfig(node: MarketingJourneyNode): void {
  switch (node.kind) {
    case 'TRIGGER':
      if (!readText(node.config.event) && !readText(node.config.triggerType) && !readText(node.config.domainEvent)) {
        throw new AppError(`Marketing journey trigger node "${node.id}" must define an event.`, 422);
      }
      return;
    case 'DELAY': {
      const delay = readDelayConfig(node.config);
      if (delay.amount <= 0) {
        throw new AppError(`Marketing journey delay node "${node.id}" must define a positive duration.`, 422);
      }
      return;
    }
    case 'CONDITION':
    case 'BRANCH':
      if (!hasConditionConfig(node.config)) {
        throw new AppError(`Marketing journey condition node "${node.id}" must define rules or an expression.`, 422);
      }
      return;
    case 'ACTION':
      validateActionConfig(node);
      return;
    case 'EXIT':
      return;
  }
}

function validateActionConfig(node: MarketingJourneyNode): void {
  const actionType = readText(node.config.type);
  if (!actionType) {
    throw new AppError(`Marketing journey action node "${node.id}" must define an action type.`, 422);
  }

  if (!supportedJourneyActionTypes.has(actionType)) {
    throw new AppError(`Marketing journey action "${actionType}" is not supported by Automation Runtime.`, 422, {
      nodeId: node.id,
      actionType,
    });
  }

  if (actionType === 'send_campaign' && !readText(node.config.campaignId)) {
    throw new AppError(`Marketing journey action node "${node.id}" must define a campaignId.`, 422);
  }

  if ((actionType === 'human_approval' || actionType === 'approval') && !readText(node.config.requestedBy) && !readText(node.config.requestedByPath)) {
    throw new AppError(`Marketing journey approval action node "${node.id}" must define requestedBy or requestedByPath.`, 422);
  }
}

function compileJourneyNode(node: MarketingJourneyNode): AutomationWorkflowNode {
  switch (node.kind) {
    case 'TRIGGER':
      return {
        id: node.id,
        type: 'trigger',
        label: node.label,
        position: node.position,
        config: compileTriggerConfig(node.config),
      };
    case 'CONDITION':
    case 'BRANCH':
      return {
        id: node.id,
        type: 'condition',
        label: node.label,
        position: node.position,
        config: compileConditionConfig(node.config),
      };
    case 'DELAY': {
      const delay = readDelayConfig(node.config);
      return {
        id: node.id,
        type: 'delay',
        label: node.label,
        position: node.position,
        config: {
          delayFor: {
            amount: delay.amount,
            unit: delay.unit,
          },
        },
      };
    }
    case 'ACTION':
      return compileActionNode(node);
    case 'EXIT':
      return {
        id: node.id,
        type: 'end',
        label: node.label,
        position: node.position,
        config: readRecord(node.config) ?? {},
      };
  }
}

function compileActionNode(node: MarketingJourneyNode): AutomationWorkflowNode {
  const actionType = readText(node.config.type);

  if (actionType === 'send_campaign') {
    return {
      id: node.id,
      type: 'communication_send',
      label: node.label,
      position: node.position,
      config: {
        channel: readText(node.config.channel) ?? 'email',
        provider: readText(node.config.provider) ?? 'mock',
        to: readText(node.config.to) ?? '{{contact.email}}',
        templateKey: readText(node.config.campaignId),
        metadata: {
          source: 'marketing_journey',
          marketingCampaignId: readText(node.config.campaignId),
        },
      },
    };
  }

  return {
    id: node.id,
    type: 'human_approval',
    label: node.label,
    position: node.position,
    config: {
      type: readText(node.config.approvalType) ?? readText(node.config.intent) ?? 'marketing_journey_action',
      title: readText(node.config.title) ?? node.label ?? 'Marketing journey approval',
      description: readText(node.config.description) ?? 'Review and approve this marketing journey action.',
      requestedBy: readText(node.config.requestedBy),
      requestedByPath: readText(node.config.requestedByPath),
      metadata: {
        source: 'marketing_journey',
        actionType,
      },
    },
  };
}

function compileJourneyEdge(edge: MarketingJourneyEdge): AutomationWorkflowEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? null,
    targetHandle: edge.targetHandle ?? null,
    condition: edge.condition,
  };
}

function compileTriggerConfig(config: Record<string, unknown>): Record<string, unknown> {
  const event = readText(config.event) ?? readText(config.triggerType) ?? readText(config.domainEvent);

  if (event === 'commercial_work_item.created') {
    return {
      domainEvent: 'commercial_work_item.created',
      segmentId: readText(config.segmentId),
      filters: readRecord(config.filters) ?? {},
    };
  }

  if (event === 'commercial_work_item.score_updated') {
    return {
      domainEvent: 'marketing.commercial_work_item.score.changed',
      filters: readRecord(config.filters) ?? {},
    };
  }

  if (event === 'invoice.overdue') {
    return {
      triggerType: 'billing_overdue',
      status: 'overdue',
      filters: readRecord(config.filters) ?? {},
    };
  }

  if (event === 'campaign.opened' || event === 'campaign.clicked') {
    return {
      domainEvent: event === 'campaign.opened' ? 'marketing.email.opened' : 'marketing.email.clicked',
      campaignId: readText(config.campaignId),
      filters: readRecord(config.filters) ?? {},
    };
  }

  if (event === 'manual') {
    return {
      triggerType: 'manual',
    };
  }

  return {
    domainEvent: event,
    filters: readRecord(config.filters) ?? {},
  };
}

function compileConditionConfig(config: Record<string, unknown>): Record<string, unknown> {
  return {
    logic: readText(config.logic) ?? 'all',
    rules: Array.isArray(config.rules) ? config.rules : undefined,
    expression: readText(config.expression),
    metadata: {
      source: 'marketing_journey',
    },
  };
}

function readJourneyNodes(value: unknown): MarketingJourneyNode[] | null {
  if (value == null) {
    return null;
  }
  if (!Array.isArray(value)) {
    throw new AppError('Marketing journey nodes must be an array.', 422);
  }

  return value.map((nodeValue, index) => {
    const node = requireRecord(nodeValue, `Marketing journey node at index ${index} must be an object.`);
    const data = readRecord(node.data) ?? {};
    const id = readRequiredText(node.id, `Marketing journey node at index ${index} must define an id.`);
    const kind = readStepKind(data.kind ?? node.kind ?? node.type, id);
    const config = readRecord(data.config) ?? readRecord(node.config) ?? {};
    const label = readText(data.label) ?? readText(node.label) ?? readText(node.name);

    return {
      id,
      kind,
      label,
      config,
      position: readPosition(node.position),
    };
  });
}

function readJourneySteps(value: unknown): MarketingJourneyStep[] | null {
  if (value == null) {
    return null;
  }
  if (!Array.isArray(value)) {
    throw new AppError('Marketing journey steps must be an array.', 422);
  }

  return value.map((stepValue, index) => {
    const step = requireRecord(stepValue, `Marketing journey step at index ${index} must be an object.`);
    const id = readRequiredText(step.id ?? step.key, `Marketing journey step at index ${index} must define an id or key.`);
    return {
      id,
      kind: readStepKind(step.kind ?? step.type, id),
      label: readText(step.name) ?? readText(step.label),
      config: readRecord(step.config) ?? {},
      position: readPosition(step.position) ?? { x: index * 260, y: 120 },
      nextStepId: readText(step.nextStepId) ?? readText(step.nextStepKey) ?? null,
    };
  });
}

function readJourneyEdges(value: unknown): MarketingJourneyEdge[] {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new AppError('Marketing journey edges must be an array.', 422);
  }

  return value.map((edgeValue, index) => {
    const edge = requireRecord(edgeValue, `Marketing journey edge at index ${index} must be an object.`);
    const source = readRequiredText(edge.source, `Marketing journey edge at index ${index} must define a source.`);
    const target = readRequiredText(edge.target, `Marketing journey edge at index ${index} must define a target.`);

    return {
      id: readText(edge.id) ?? `${source}->${target}`,
      source,
      target,
      sourceHandle: readText(edge.sourceHandle),
      targetHandle: readText(edge.targetHandle),
      condition: readEdgeCondition(edge),
    };
  });
}

function buildJourneyNodesFromSteps(steps: MarketingJourneyStep[]): MarketingJourneyNode[] {
  return steps.map((step) => ({
    id: step.id,
    kind: step.kind,
    label: step.label,
    config: step.config,
    position: step.position,
  }));
}

function buildJourneyEdgesFromSteps(steps: MarketingJourneyStep[]): MarketingJourneyEdge[] {
  return steps.flatMap((step) => {
    const nextStepId = step.nextStepId;
    if (!nextStepId) {
      return [];
    }

    return [
      {
        id: `${step.id}->${nextStepId}`,
        source: step.id,
        target: nextStepId,
        sourceHandle: null,
        targetHandle: null,
      },
    ];
  });
}

function readEdgeCondition(edge: Record<string, unknown>): Record<string, unknown> | undefined {
  const explicitCondition = readRecord(edge.condition);
  if (explicitCondition) {
    return explicitCondition;
  }

  const data = readRecord(edge.data) ?? {};
  const branchType = readText(data.branchType) ?? readText(edge.sourceHandle);
  if (!branchType || branchType === 'default') {
    return undefined;
  }

  return {
    branchType,
  };
}

function readStepKind(value: unknown, nodeId: string): MarketingJourneyStepKind {
  if (
    value === 'TRIGGER' ||
    value === 'CONDITION' ||
    value === 'DELAY' ||
    value === 'ACTION' ||
    value === 'BRANCH' ||
    value === 'EXIT'
  ) {
    return value;
  }

  throw new AppError(`Marketing journey node "${nodeId}" has an unsupported kind.`, 422, {
    kind: value,
  });
}

function readDelayConfig(config: Record<string, unknown>): { amount: number; unit: string } {
  const delayFor = readRecord(config.delayFor);
  const amount = readOptionalNumber(delayFor?.amount) ?? readOptionalNumber(config.duration) ?? readOptionalNumber(config.amount);
  const unit = readText(delayFor?.unit) ?? readText(config.unit) ?? 'minutes';

  return {
    amount: amount ?? 0,
    unit,
  };
}

function hasConditionConfig(config: Record<string, unknown>): boolean {
  if (Array.isArray(config.rules) && config.rules.length > 0) {
    return true;
  }
  return Boolean(readText(config.expression));
}

function assertEveryNodeIsReachable(definition: MarketingJourneySourceDefinition, triggerNodeId: string): void {
  const adjacency = new Map<string, string[]>();
  for (const node of definition.nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of definition.edges) {
    adjacency.get(edge.source)?.push(edge.target);
  }

  const visited = new Set<string>();
  const stack = [triggerNodeId];
  while (stack.length > 0) {
    const nodeId = stack.pop();
    if (!nodeId || visited.has(nodeId)) {
      continue;
    }
    visited.add(nodeId);
    for (const target of adjacency.get(nodeId) ?? []) {
      stack.push(target);
    }
  }

  const orphanNode = definition.nodes.find((node) => !visited.has(node.id));
  if (orphanNode) {
    throw new AppError(`Marketing journey node "${orphanNode.id}" is not reachable from the trigger node.`, 422);
  }
}

function readRuntimeGraphCandidate(triggerDefinition: Record<string, unknown>): unknown | null {
  const metadata = readRecord(triggerDefinition.metadata);
  const metadataRuntimeGraph = metadata ? metadata.runtimeGraph : undefined;
  if (metadataRuntimeGraph) {
    return metadataRuntimeGraph;
  }

  const runtimeGraph = triggerDefinition.runtimeGraph;
  if (runtimeGraph) {
    return runtimeGraph;
  }

  const automationDefinition = readRecord(triggerDefinition.automationDefinition) ?? readRecord(metadata?.automationDefinition);
  return automationDefinition?.graph ?? null;
}

function assertRuntimeGraphVersion(value: unknown): void {
  const graph = requireRecord(value, 'Marketing journey runtimeGraph must be an object.');
  const version = readOptionalNumber(graph.version);
  if (version !== 1) {
    throw new AppError('Marketing journey runtimeGraph version must be 1.', 422, {
      receivedVersion: version,
    });
  }
}

function buildRuntimeDefinitionTrigger(
  triggerDefinition: Record<string, unknown>,
  sourceDefinition: MarketingJourneySourceDefinition | null,
): Record<string, unknown> {
  const explicitTrigger = readRecord(triggerDefinition.trigger);
  if (!sourceDefinition) {
    return explicitTrigger ?? {};
  }

  const triggerNode = sourceDefinition.nodes.find((node) => node.kind === 'TRIGGER');
  if (!triggerNode) {
    return explicitTrigger ?? {};
  }

  const event = readText(triggerNode.config.event) ?? readText(triggerNode.config.triggerType) ?? readText(triggerNode.config.domainEvent);
  return {
    event,
    config: compileTriggerConfig(triggerNode.config),
  };
}

function buildRuntimeSettings(input: CompileMarketingJourneyRuntimeInput): Record<string, unknown> {
  return {
    name: input.name,
    description: input.description ?? undefined,
    status: input.status ? String(input.status).toLowerCase() : undefined,
  };
}

function buildRuntimeMetadata(flowId: string, graph: AutomationWorkflowGraph, compiledAt: string): MarketingJourneyRuntimeMetadata {
  const triggerCount = graph.nodes.filter((node) => node.type === 'trigger').length;
  const approvalCount = graph.nodes.filter((node) => node.type === 'human_approval').length;
  const terminalCount = graph.nodes.filter((node) => node.type === 'end').length;
  const branchCount = graph.nodes.filter((node) => node.type === 'condition').length;
  const actionCount = graph.nodes.filter((node) => !['trigger', 'condition', 'delay', 'end', 'human_approval'].includes(node.type)).length;
  const controlCount = graph.nodes.filter((node) => ['condition', 'delay'].includes(node.type)).length;

  return {
    ...(readRecord(graph.metadata) ?? {}),
    source: 'marketing_journey',
    compilerVersion: 1,
    graphVersion: graph.version,
    flowId,
    compiledAt,
    triggerCount,
    actionCount,
    approvalCount,
    branchCount,
    controlCount,
    terminalCount,
  };
}

function buildExecutionPlan(graph: AutomationWorkflowGraph): AutomationExecutionPlan {
  const outgoingSources = new Set(graph.edges.map((edge) => edge.source));
  return {
    schemaVersion: 1,
    entryNodeIds: graph.nodes.filter((node) => node.type === 'trigger').map((node) => node.id),
    terminalNodeIds: graph.nodes.filter((node) => node.type === 'end' || !outgoingSources.has(node.id)).map((node) => node.id),
    parallelGroups: [],
  };
}

function runtimeGraphsHaveSameShape(left: AutomationWorkflowGraph, right: AutomationWorkflowGraph): boolean {
  return JSON.stringify(normalizeRuntimeGraphForComparison(left)) === JSON.stringify(normalizeRuntimeGraphForComparison(right));
}

function normalizeRuntimeGraphForComparison(graph: AutomationWorkflowGraph): Record<string, unknown> {
  return {
    version: graph.version,
    nodes: graph.nodes
      .map((node) => ({
        id: node.id,
        type: node.type,
        label: node.label,
        config: node.config,
        position: node.position,
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
    edges: graph.edges
      .map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle ?? null,
        targetHandle: edge.targetHandle ?? null,
        condition: edge.condition,
      }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}

function readCompiledAt(triggerDefinition: Record<string, unknown>): string {
  const metadata = readRecord(triggerDefinition.metadata);
  return readText(metadata?.compiledAt) ?? readText(triggerDefinition.compiledAt) ?? new Date().toISOString();
}

function readPosition(value: unknown): { x: number; y: number } | undefined {
  const position = readRecord(value);
  if (!position) {
    return undefined;
  }

  const x = readOptionalNumber(position.x);
  const y = readOptionalNumber(position.y);
  if (x == null || y == null) {
    return undefined;
  }

  return { x, y };
}

function readRequiredText(value: unknown, message: string): string {
  const text = readText(value);
  if (!text) {
    throw new AppError(message, 422);
  }
  return text;
}

function readText(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function requireRecord(value: unknown, message: string): Record<string, unknown> {
  const record = readRecord(value);
  if (!record) {
    throw new AppError(message, 422);
  }
  return record;
}
