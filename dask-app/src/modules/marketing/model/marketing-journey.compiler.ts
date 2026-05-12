import type { Edge, Node } from "@xyflow/react";
import type {
  MarketingJourneyDefinition,
  MarketingJourneyStep
} from "@/modules/marketing/model/marketing-journey.schema";
import {
  automationGraphToWorkflowDefinition,
  type AutomationWorkflowDefinition
} from "@/modules/automation/model";
import { marketingJourneyDefinitionSchema } from "@/modules/marketing/model/marketing-journey.schema";

type JourneyNodeLike = Node<Record<string, unknown>>;
type JourneyEdgeLike = Edge<Record<string, unknown>>;

export interface MarketingJourneyCompileIssue {
  code: string;
  message: string;
  nodeId?: string;
  edgeId?: string;
  severity: "error" | "warning";
}

export interface MarketingJourneyRuntimeGraph {
  version: 1;
  nodes: Array<{
    id: string;
    type: string;
    label?: string;
    config: Record<string, unknown>;
    position?: { x: number; y: number };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    condition?: Record<string, unknown>;
  }>;
  metadata: Record<string, unknown>;
}

export interface CompileMarketingJourneyOptions {
  flowId?: string | null;
  workspaceId?: string;
  name: string;
  description?: string | null;
  status?: MarketingJourneyDefinition["status"];
  allowDraft?: boolean;
  now?: string;
}

export interface CompileMarketingJourneyResult {
  definition: MarketingJourneyDefinition | null;
  automationDefinition: AutomationWorkflowDefinition | null;
  runtimeGraph: MarketingJourneyRuntimeGraph | null;
  errors: MarketingJourneyCompileIssue[];
  warnings: MarketingJourneyCompileIssue[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function issue(input: Omit<MarketingJourneyCompileIssue, "severity"> & { severity?: "error" | "warning" }): MarketingJourneyCompileIssue {
  return {
    severity: input.severity ?? "error",
    ...input
  };
}

function triggerRuntimeConfig(event: string, config: Record<string, unknown>): Record<string, unknown> {
  const filters = isRecord(config.filters) ? config.filters : {};

  switch (event) {
    case "commercial_work_item.created":
      return { domainEvent: "commercial_work_item.created", segmentId: config.segmentId, filters };
    case "commercial_work_item.score_updated":
      return { domainEvent: "marketing.commercial_work_item.score.changed", filters };
    case "invoice.overdue":
      return { triggerType: "billing_overdue", status: "overdue", filters };
    case "campaign.opened":
      return { domainEvent: "marketing.email.opened", campaignId: config.campaignId, filters };
    case "campaign.clicked":
      return { domainEvent: "marketing.email.clicked", campaignId: config.campaignId, filters };
    case "manual":
      return { triggerType: "manual" };
    default:
      return { domainEvent: event, filters };
  }
}

function delayToRuntime(config: Record<string, unknown>) {
  return {
    delayFor: {
      amount: Number(config.duration),
      unit: readText(config.unit) || "minutes"
    }
  };
}

function conditionToRuntime(config: Record<string, unknown>): Record<string, unknown> {
  return {
    logic: readText(config.logic) || "all",
    rules: Array.isArray(config.rules) ? config.rules : undefined,
    expression: readText(config.expression) || undefined,
    metadata: {
      source: "marketing_journey"
    }
  };
}

function actionToRuntime(nodeId: string, config: Record<string, unknown>, issues: MarketingJourneyCompileIssue[]) {
  const type = readText(config.type);

  if (type === "send_campaign") {
    const campaignId = readText(config.campaignId);
    if (!campaignId) {
      issues.push(issue({
        code: "send_campaign_requires_campaign",
        message: "Acao de envio precisa de uma campanha/template configurado antes de ativar.",
        nodeId
      }));
    }

    return {
      type: "communication_send",
      config: {
        channel: "email",
        provider: "mock",
        to: "{{contact.email}}",
        templateKey: campaignId || undefined,
        metadata: {
          source: "marketing_journey",
          marketingCampaignId: campaignId || undefined
        }
      }
    };
  }

  if (type === "human_approval" || type === "approval") {
    const requestedBy = readText(config.requestedBy);
    const requestedByPath = readText(config.requestedByPath);
    if (!requestedBy && !requestedByPath) {
      issues.push(issue({
        code: "approval_requires_requester",
        message: "Aprovacao humana precisa de solicitante ou caminho do solicitante.",
        nodeId
      }));
    }

    return {
      type: "human_approval",
      config: {
        type: readText(config.approvalType) || readText(config.intent) || "marketing_journey_action",
        title: readText(config.title) || "Aprovacao da jornada",
        description: readText(config.description) || "Revise e aprove esta etapa da jornada.",
        requestedBy: requestedBy || undefined,
        requestedByPath: requestedByPath || undefined,
        metadata: {
          source: "marketing_journey",
          actionType: type
        }
      }
    };
  }

  issues.push(issue({
    code: "action_not_supported",
    message: `Acao ${type || "sem tipo"} ainda nao e suportada pelo Automation Runtime.`,
    nodeId
  }));

  return { type: "noop", config: { reason: "marketing_action_runtime_pending", marketingAction: config } };
}

function branchCondition(edge: JourneyEdgeLike): Record<string, unknown> | undefined {
  const branchType = readText(readRecord(edge.data).branchType);
  if (!branchType || branchType === "default") {
    return undefined;
  }

  return { branchType };
}

function assertReachable(nodes: JourneyNodeLike[], edges: JourneyEdgeLike[], issues: MarketingJourneyCompileIssue[]) {
  const triggerIds = nodes.filter((node) => readText(readRecord(node.data).kind) === "TRIGGER").map((node) => node.id);
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
  }

  const reachable = new Set<string>();
  const pending = [...triggerIds];
  while (pending.length > 0) {
    const nodeId = pending.shift();
    if (!nodeId || reachable.has(nodeId)) continue;
    reachable.add(nodeId);
    pending.push(...(outgoing.get(nodeId) ?? []));
  }

  for (const node of nodes) {
    if (!reachable.has(node.id)) {
      issues.push(issue({
        code: "orphan_node",
        message: "Jornada possui bloco fora do caminho do gatilho.",
        nodeId: node.id
      }));
      return;
    }
  }
}

function assertAcyclic(nodes: JourneyNodeLike[], edges: JourneyEdgeLike[], issues: MarketingJourneyCompileIssue[]) {
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (nodeId: string): boolean => {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visiting.add(nodeId);
    for (const target of outgoing.get(nodeId) ?? []) {
      if (visit(target)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  };

  for (const node of nodes) {
    if (visit(node.id)) {
      issues.push(issue({
        code: "cycle",
        message: "Runtime atual nao suporta ciclos na jornada.",
        nodeId: node.id
      }));
      return;
    }
  }
}

function validateNodeConfiguration(node: JourneyNodeLike, issues: MarketingJourneyCompileIssue[]) {
  const data = readRecord(node.data);
  const kind = readText(data.kind);
  const label = readText(data.label);
  const config = readRecord(data.config);

  if (!label) {
    issues.push(issue({
      code: "node_label_required",
      message: "Todo bloco da jornada precisa de um nome.",
      nodeId: node.id
    }));
  }

  if (kind === "TRIGGER") {
    if (!readText(config.event)) {
      issues.push(issue({
        code: "trigger_event_required",
        message: "Gatilho precisa de um evento configurado.",
        nodeId: node.id
      }));
    }
    return;
  }

  if (kind === "DELAY") {
    const amount = Number(config.duration);
    if (!Number.isFinite(amount) || amount <= 0) {
      issues.push(issue({
        code: "delay_duration_required",
        message: "Espera precisa de uma duracao positiva.",
        nodeId: node.id
      }));
    }
    if (!readText(config.unit)) {
      issues.push(issue({
        code: "delay_unit_required",
        message: "Espera precisa de uma unidade de tempo.",
        nodeId: node.id
      }));
    }
    return;
  }

  if (kind === "CONDITION" || kind === "BRANCH") {
    const hasRules = Array.isArray(config.rules) && config.rules.length > 0;
    const hasExpression = Boolean(readText(config.expression));
    if (!hasRules && !hasExpression) {
      issues.push(issue({
        code: "condition_rules_required",
        message: "Condicao precisa de pelo menos uma regra ou expressao.",
        nodeId: node.id
      }));
    }
    return;
  }

  if (kind === "ACTION") {
    const actionType = readText(config.type);
    if (!actionType) {
      issues.push(issue({
        code: "action_type_required",
        message: "Acao precisa de um tipo configurado.",
        nodeId: node.id
      }));
      return;
    }
    actionToRuntime(node.id, config, issues);
    return;
  }

  if (kind !== "EXIT") {
    issues.push(issue({
      code: "node_kind_not_supported",
      message: "Jornada possui um bloco com tipo nao suportado.",
      nodeId: node.id
    }));
  }
}

function assertConditionBranchesHaveDestinations(
  nodes: JourneyNodeLike[],
  edges: JourneyEdgeLike[],
  issues: MarketingJourneyCompileIssue[]
) {
  const outgoingBySource = new Map<string, JourneyEdgeLike[]>();
  for (const edge of edges) {
    outgoingBySource.set(edge.source, [...(outgoingBySource.get(edge.source) ?? []), edge]);
  }

  for (const node of nodes) {
    const kind = readText(readRecord(node.data).kind);
    if (kind !== "CONDITION" && kind !== "BRANCH") {
      continue;
    }

    const branchTypes = new Set((outgoingBySource.get(node.id) ?? [])
      .map((edge) => readText(readRecord(edge.data).branchType) || readText(edge.sourceHandle))
      .filter(Boolean));

    if (!branchTypes.has("yes")) {
      issues.push(issue({
        code: "branch_yes_target_required",
        message: "Condicao precisa de um destino para o caminho Sim.",
        nodeId: node.id
      }));
    }
    if (!branchTypes.has("no")) {
      issues.push(issue({
        code: "branch_no_target_required",
        message: "Condicao precisa de um destino para o caminho Nao.",
        nodeId: node.id
      }));
    }
  }
}

export function compileJourneyGraphToAutomationDefinition(
  nodes: JourneyNodeLike[],
  edges: JourneyEdgeLike[],
  options: CompileMarketingJourneyOptions
): CompileMarketingJourneyResult {
  const issues: MarketingJourneyCompileIssue[] = [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const triggerNodes = nodes.filter((node) => readText(readRecord(node.data).kind) === "TRIGGER");
  const triggerNode = triggerNodes[0] ?? null;

  if (!options.name.trim()) {
    issues.push(issue({ code: "name_required", message: "Informe o nome da jornada." }));
  }

  if (nodes.length === 0) {
    issues.push(issue({ code: "nodes_required", message: "Adicione ao menos um bloco na jornada." }));
  }

  if (triggerNodes.length === 0) {
    issues.push(issue({ code: "trigger_required", message: "A jornada precisa de um gatilho." }));
  }

  if (triggerNodes.length > 1) {
    issues.push(issue({ code: "single_trigger", message: "A jornada deve ter um unico gatilho principal." }));
  }

  for (const node of nodes) {
    validateNodeConfiguration(node, issues);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      issues.push(issue({
        code: "invalid_edge",
        message: "Jornada possui uma conexao apontando para bloco inexistente.",
        edgeId: edge.id
      }));
    }
  }

  assertConditionBranchesHaveDestinations(nodes, edges, issues);

  if (triggerNodes.length > 0 && nodes.length > 0) {
    assertReachable(nodes, edges, issues);
    assertAcyclic(nodes, edges, issues);
  }

  const errors = issues.filter((entry) => entry.severity === "error");
  const warnings = issues.filter((entry) => entry.severity === "warning");
  if (errors.length > 0) {
    return {
      definition: null,
      automationDefinition: null,
      runtimeGraph: null,
      errors,
      warnings
    };
  }

  const steps: MarketingJourneyStep[] = nodes.map((node, index) => {
    const data = readRecord(node.data);
    const kind = readText(data.kind);
    const config = readRecord(data.config);
    return {
      key: node.id,
      name: readText(data.label) || `Step ${index + 1}`,
      kind: kind === "DELAY"
        ? "DELAY"
        : kind === "ACTION"
        ? "ACTION"
        : kind === "CONDITION"
        ? "CONDITION"
        : kind === "BRANCH"
        ? "BRANCH"
        : kind === "TRIGGER"
        ? "TRIGGER"
        : "EXIT",
      position: index,
      config
    };
  });

  const runtimeNodes = nodes.map((node) => {
    const data = readRecord(node.data);
    const kind = readText(data.kind);
    const config = readRecord(data.config);
    const label = readText(data.label);

    if (kind === "TRIGGER") {
      return {
        id: node.id,
        type: "trigger",
        label,
        config: triggerRuntimeConfig(readText(config.event) || "manual", config),
        position: node.position
      };
    }

    if (kind === "DELAY") {
      return {
        id: node.id,
        type: "delay",
        label,
        config: delayToRuntime(config),
        position: node.position
      };
    }

    if (kind === "CONDITION" || kind === "BRANCH") {
      return {
        id: node.id,
        type: "condition",
        label,
        config: conditionToRuntime(config),
        position: node.position
      };
    }

    if (kind === "ACTION") {
      const runtimeAction = actionToRuntime(node.id, config, issues);
      return {
        id: node.id,
        type: runtimeAction.type,
        label,
        config: runtimeAction.config,
        position: node.position
      };
    }

    return {
      id: node.id,
      type: "end",
      label,
      config,
      position: node.position
    };
  });

  const runtimeGraph: MarketingJourneyRuntimeGraph = {
    version: 1,
    nodes: runtimeNodes,
    edges: edges.map((edge, index) => ({
      id: edge.id || `edge-${index + 1}`,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle ?? null,
      targetHandle: edge.targetHandle ?? null,
      condition: branchCondition(edge)
    })),
    metadata: {
      source: "marketing_journey",
      flowId: options.flowId ?? null
    }
  };
  const runtimeEdges = runtimeGraph.edges;
  const triggerConfig = readRecord(readRecord(triggerNode?.data).config);
  const automationDefinition = automationGraphToWorkflowDefinition({
    graph: runtimeGraph,
    source: {
      kind: "marketing_journey",
      flowId: options.flowId ?? null,
      refId: options.flowId ?? null,
      name: options.name
    },
    trigger: {
      type: readText(triggerConfig.event) || "manual",
      config: triggerRuntimeConfig(readText(triggerConfig.event) || "manual", triggerConfig)
    },
    metadata: {
      compilerVersion: 1,
      compiledAt: options.now ?? new Date().toISOString()
    }
  });

  const definitionInput = {
    version: 1,
    id: options.flowId ?? undefined,
    workspaceId: options.workspaceId,
    name: options.name,
    description: options.description ?? undefined,
    status: options.status ?? "DRAFT",
    trigger: {
      event: readText(triggerConfig.event) || "manual",
      segmentId: readText(triggerConfig.segmentId) || undefined,
      filters: isRecord(triggerConfig.filters) ? triggerConfig.filters : undefined
    },
    nodes,
    edges: runtimeEdges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      data: edge.condition ? { branchType: readText(edge.condition.branchType) || undefined } : undefined
    })),
    steps,
    metadata: {
      runtimeGraph,
      automationDefinition,
      compiledAt: options.now ?? new Date().toISOString()
    }
  };

  const parsedDefinition = marketingJourneyDefinitionSchema.safeParse(definitionInput);
  if (!parsedDefinition.success) {
    return {
      definition: null,
      automationDefinition: null,
      runtimeGraph: null,
      errors: [
        ...errors,
        issue({
          code: "runtime_definition_invalid",
          message: parsedDefinition.error.issues[0]?.message ?? "RuntimeGraph nao pode ser gerado para esta jornada."
        })
      ],
      warnings
    };
  }

  return {
    definition: parsedDefinition.data,
    automationDefinition,
    runtimeGraph,
    errors,
    warnings
  };
}

export const marketingJourneyGraphToAutomationDefinition = compileJourneyGraphToAutomationDefinition;

export function getMarketingJourneyActivationErrors(result: CompileMarketingJourneyResult): MarketingJourneyCompileIssue[] {
  return [...result.errors, ...result.warnings.filter((entry) => entry.code.endsWith("_runtime_pending"))];
}
