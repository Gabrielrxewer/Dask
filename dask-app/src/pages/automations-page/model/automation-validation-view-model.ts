import type { Connection, Edge } from "@xyflow/react";
import type { FlowStudioValidationIssue } from "@/shared/ui";
import { buildNodeConfigZodSchema, readNodeConfigPath, hasNodeConfigValue } from "@/shared/flow-node-config";
import { createAutomationNodeConfigDescriptor } from "./automation-node-registry";
import { summarizeConfig } from "./automation-page-view-model";
import type { AutomationCanvasNode, AutomationNodeMetaMap, FieldOption } from "./automation-page.types";

export function buildWorkflowPreview(
  nodes: AutomationCanvasNode[],
  edges: Edge[],
  nodeMeta: AutomationNodeMetaMap
) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const triggerNodes = nodes.filter((node) => node.data.nodeType === "trigger");
  const orderedNodes = orderNodesForPreview(nodes, edges);

  if (triggerNodes.length === 0) {
    errors.push("Adicione pelo menos um gatilho.");
  }
  if (nodes.length > 1 && edges.length === 0) {
    warnings.push("Conecte os nos para deixar a ordem de execucao explicita.");
  }

  for (const node of nodes) {
    const schema = nodeMeta.get(node.data.nodeType)?.configSchema;
    if (!schema) continue;
    for (const field of schema.required) {
      const value = readNodeConfigPath(node.data.config, field);
      if (!hasNodeConfigValue(value)) {
        errors.push(`${node.data.label}: preencha ${field}.`);
      }
    }
    for (const group of schema.requiredAny ?? []) {
      if (!group.some((field) => hasNodeConfigValue(readNodeConfigPath(node.data.config, field)))) {
        errors.push(`${node.data.label}: preencha pelo menos um de ${group.join(", ")}.`);
      }
    }
  }

  return {
    errors,
    warnings,
    steps: orderedNodes.map((node, index) => ({
      id: node.id,
      index: index + 1,
      type: node.data.nodeType,
      label: node.data.label,
      description: describePreviewStep(node.data.nodeType, node.data.config, nodeMeta)
    }))
  };
}

export function validateAutomationConnection(nodes: AutomationCanvasNode[], edges: Edge[], connection: Connection): string | null {
  if (!connection.source || !connection.target) return "Conexao incompleta.";
  if (connection.source === connection.target) return "Um no nao pode conectar nele mesmo.";
  const source = nodes.find((node) => node.id === connection.source);
  const target = nodes.find((node) => node.id === connection.target);
  if (!source || !target) return "Origem ou destino nao existe mais no grafo.";
  if (source.data.nodeType === "end") return "O no Fim nao pode iniciar outra conexao.";
  if (target.data.nodeType === "trigger") return "Gatilhos nao podem receber conexoes.";
  if (edges.some((edge) => edge.source === connection.source && edge.target === connection.target && edge.sourceHandle === (connection.sourceHandle ?? null))) {
    return "Essa conexao ja existe.";
  }
  if (createsCycle(edges, connection.source, connection.target)) {
    return "Essa conexao criaria um ciclo.";
  }
  return null;
}

export function buildAutomationValidationIssues(
  nodes: AutomationCanvasNode[],
  edges: Edge[],
  nodeMeta: AutomationNodeMetaMap
): FlowStudioValidationIssue[] {
  const preview = buildWorkflowPreview(nodes, edges, nodeMeta);
  const issues: FlowStudioValidationIssue[] = [
    ...preview.errors.map((message, index) => ({
      id: `preview-error-${index}`,
      severity: "error" as const,
      message
    })),
    ...preview.warnings.map((message, index) => ({
      id: `preview-warning-${index}`,
      severity: "warning" as const,
      message
    }))
  ];

  const nodeIds = new Set(nodes.map((node) => node.id));
  for (const edge of edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      issues.push({
        id: `edge-${edge.id}-missing-node`,
        severity: "error",
        edgeId: edge.id,
        message: "Conexao aponta para um no inexistente."
      });
    }
  }

  return issues;
}

export function buildNodeConfigValidationIssues(input: {
  nodes: AutomationCanvasNode[];
  nodeMeta: AutomationNodeMetaMap;
  boardColumns: FieldOption[];
  workflowStates: FieldOption[];
  customFields: FieldOption[];
  itemTypes: FieldOption[];
}): FlowStudioValidationIssue[] {
  const issues: FlowStudioValidationIssue[] = [];

  for (const node of input.nodes) {
    const meta = input.nodeMeta.get(node.data.nodeType);
    const descriptor = createAutomationNodeConfigDescriptor({
      nodeType: node.data.nodeType,
      nodeLabel: meta?.label ?? node.data.label,
      configSchema: meta?.configSchema,
      boardColumns: input.boardColumns,
      workflowStates: input.workflowStates,
      customFields: input.customFields,
      itemTypes: input.itemTypes
    });
    const result = buildNodeConfigZodSchema(descriptor).safeParse(node.data.config);
    if (result.success) continue;

    result.error.issues.forEach((issue, index) => {
      issues.push({
        id: `node-config-${node.id}-${index}`,
        severity: "error",
        nodeId: node.id,
        path: issue.path.join("."),
        message: `${node.data.label}: ${issue.message}`
      });
    });
  }

  return issues;
}

function orderNodesForPreview(nodes: AutomationCanvasNode[], edges: Edge[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const outgoing = edges.reduce<Map<string, string[]>>((acc, edge) => {
    acc.set(edge.source, [...(acc.get(edge.source) ?? []), edge.target]);
    return acc;
  }, new Map());
  const incoming = new Set(edges.map((edge) => edge.target));
  const roots = nodes.filter((node) => node.data.nodeType === "trigger" || !incoming.has(node.id));
  const ordered: AutomationCanvasNode[] = [];
  const seen = new Set<string>();
  const visit = (node: AutomationCanvasNode) => {
    if (seen.has(node.id)) return;
    seen.add(node.id);
    ordered.push(node);
    for (const target of outgoing.get(node.id) ?? []) {
      const next = byId.get(target);
      if (next) visit(next);
    }
  };
  roots.forEach(visit);
  nodes.forEach(visit);
  return ordered;
}

function describePreviewStep(type: string, config: Record<string, unknown>, nodeMeta: AutomationNodeMetaMap) {
  if (type === "trigger") return `Dispara por ${String(config.triggerType ?? config.eventName ?? "manual")}.`;
  if (type === "move_work_item") return `Move para ${String(config.columnSlug ?? config.stateSlug ?? "destino configurado")}.`;
  if (type === "update_work_item_fields") return "Atualiza campos nativos, metadata ou campos customizados do card.";
  if (type === "create_proposal") return `Cria proposta usando ${String(config.templateKey ?? "template configurado")}.`;
  if (type === "create_contract") return `Cria contrato usando ${String(config.templateKey ?? "template configurado")}.`;
  if (type === "send_document") return `Envia ${String(config.kind ?? "documento")} para ${String(config.email ?? config.emailPath ?? "destinatario configurado")}.`;
  if (type === "create_billing_order") return `Cria cobranca com ${String(config.catalogItemFieldSlug ?? config.amountFieldSlug ?? "valor configurado")}.`;
  if (type === "ensure_customer_from_work_item") return "Cria ou vincula cliente a partir dos dados do card.";
  if (type === "create_followup_task") return `Cria follow-up com prazo de ${String(config.dueInDays ?? config.dueAt ?? "prazo configurado")}.`;
  if (type === "register_card_activity") return String(config.message ?? "Registra atividade no historico do card.");
  return nodeMeta.get(type)?.description ?? summarizeConfig(config);
}

function createsCycle(edges: Edge[], source: string, target: string): boolean {
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]);
  }
  outgoing.set(source, [...(outgoing.get(source) ?? []), target]);

  const visited = new Set<string>();
  const stack = new Set<string>();
  const visit = (nodeId: string): boolean => {
    if (stack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);
    stack.add(nodeId);
    for (const next of outgoing.get(nodeId) ?? []) {
      if (visit(next)) return true;
    }
    stack.delete(nodeId);
    return false;
  };

  return visit(source);
}
