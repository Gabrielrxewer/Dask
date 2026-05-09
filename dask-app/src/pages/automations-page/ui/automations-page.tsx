import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  type Node,
  type NodeProps,
  type OnEdgesChange,
  type OnNodesChange
} from "@xyflow/react";
import { buildBoardMetrics } from "@/entities/task";
import { useWorkspace } from "@/modules/workspace";
import type {
  AutomationApprovalSummary,
  AutomationCapabilities,
  AutomationRunDetail,
  AutomationRunListItem,
  AutomationWorkflow,
  AutomationWorkflowGraph,
  AutomationWorkflowGraphEdge,
  AutomationWorkflowGraphNode,
  AutomationWorkflowStatus,
  AutomationWorkflowVersion,
  CommunicationConversationDetail,
  CommunicationConversationSummary,
  CommunicationTemplate,
  WhatsAppConsent
} from "@/modules/workspace/model";
import { AppIcon, Button, EmptyState, FlowCanvas, FlowNodeCard, FlowNodeSidebarMenu, LoadingState, PanelMenu, PanelMenuItem, StatusBadge, StudioLayout, TextInput, WorkspaceActionButton, WorkspaceFrame, WorkspaceTopNavigation } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import "./automations-page.css";

type StudioTab = "flows" | "runs" | "approvals" | "inbox" | "templates" | "contacts" | "settings";
type AutomationNodeType = string;

type AutomationCanvasData = Record<string, unknown> & {
  nodeType: AutomationNodeType;
  label: string;
  summary: string;
  config: Record<string, unknown>;
};

type AutomationCanvasNode = Node<AutomationCanvasData, AutomationNodeType>;
type FieldOption = { id?: string; slug?: string; name?: string; label?: string; key?: string; type?: string };

const studioTabs: Array<{ id: StudioTab; label: string; icon: Parameters<typeof AppIcon>[0]["name"] }> = [
  { id: "flows", label: "Fluxos", icon: "automation" },
  { id: "runs", label: "Execucoes", icon: "list-ordered" },
  { id: "approvals", label: "Aprovacoes", icon: "square-check" },
  { id: "inbox", label: "Inbox", icon: "message" },
  { id: "templates", label: "Templates", icon: "template" },
  { id: "contacts", label: "Contatos", icon: "users" },
  { id: "settings", label: "Configuracoes", icon: "settings" }
];

type AutomationNodeMeta = AutomationCapabilities["nodeCatalog"][number];
type AutomationNodeMetaMap = Map<string, AutomationNodeMeta>;
type AutomationRecipe = AutomationCapabilities["recipeCatalog"][number];

const nodeGroupLabels: Record<string, string> = {
  triggers: "Gatilhos",
  conditions: "Condicoes",
  time: "Tempo",
  communication: "Comunicacao",
  ai: "IA",
  approval: "Aprovacao humana",
  card: "Card/Kanban",
  proposals: "Propostas",
  contracts: "Contratos",
  documents: "Documentos",
  finance: "Financeiro",
  customers: "Cliente",
  history: "Historico",
  system: "Fim"
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function statusTone(status: string): "default" | "muted" | "success" | "warning" | "danger" | "info" {
  if (["active", "published", "completed", "approved", "sent", "delivered"].includes(status)) return "success";
  if (["paused", "waiting", "pending", "draft", "queued", "running"].includes(status)) return "warning";
  if (["archived", "cancelled", "rejected"].includes(status)) return "muted";
  if (["failed", "expired", "blocked"].includes(status)) return "danger";
  return "default";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function summarizeConfig(config: Record<string, unknown>) {
  const entries = Object.entries(config).filter(([, value]) => value !== undefined && value !== null && value !== "");
  if (entries.length === 0) return "Sem configuracao";
  return entries
    .slice(0, 2)
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(" | ");
}

function toOptionValue(option: FieldOption) {
  return option.slug ?? option.key ?? option.id ?? "";
}

function toOptionLabel(option: FieldOption) {
  return option.name ?? option.label ?? option.slug ?? option.key ?? option.id ?? "";
}

function readVersionGraph(
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

function normalizeGraphNode(value: unknown, index: number, nodeMeta: AutomationNodeMetaMap): AutomationWorkflowGraphNode {
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

function normalizeGraphEdge(value: unknown, index: number): AutomationWorkflowGraphEdge {
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

function graphToCanvas(graph: AutomationWorkflowGraph, nodeMeta: AutomationNodeMetaMap): { nodes: AutomationCanvasNode[]; edges: Edge[] } {
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

function canvasToGraph(nodes: AutomationCanvasNode[], edges: Edge[]): AutomationWorkflowGraph {
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
      const value = readConfigPath(node.data.config, field);
      if (!hasConfigValue(value)) {
        errors.push(`${node.data.label}: preencha ${field}.`);
      }
    }
    for (const group of schema.requiredAny ?? []) {
      if (!group.some((field) => hasConfigValue(readConfigPath(node.data.config, field)))) {
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

function readConfigPath(config: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!isRecord(current)) return undefined;
    return current[segment];
  }, config);
}

function hasConfigValue(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length > 0;
  if (isRecord(value)) return Object.keys(value).length > 0;
  return value !== undefined && value !== null;
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

export function buildDefaultNodeConfig(type: string): Record<string, unknown> {
  switch (type) {
    case "trigger":
      return { triggerType: "manual" };
    case "move_work_item":
      return { itemIdPath: "event.payload.itemId", stateSlug: "" };
    case "update_work_item_fields":
      return { itemIdPath: "event.payload.itemId", customFieldValues: { leadTemperature: "hot" } };
    case "create_proposal":
      return { itemIdPath: "event.payload.itemId", templateKey: "commercial_proposal", binding: "commercial_proposal", targetFieldSlug: "proposalId", status: "draft", skipIfExists: true };
    case "create_contract":
      return { itemIdPath: "event.payload.linkedEntityId", proposalFieldSlug: "proposalId", templateKey: "commercial_contract", binding: "commercial_contract", targetFieldSlug: "contractId", status: "draft", skipIfExists: true };
    case "send_document":
      return { itemIdPath: "event.payload.itemId", kind: "proposal", documentFieldSlug: "proposalId", emailPath: "fields.contactEmail", resend: false };
    case "update_document_status":
      return { itemIdPath: "event.payload.itemId", kind: "proposal", documentFieldSlug: "proposalId", status: "sent" };
    case "ensure_customer_from_work_item":
      return { itemIdPath: "event.payload.itemId", targetFieldSlug: "customerId", status: "active" };
    case "create_billing_order":
      return {
        itemIdPath: "event.payload.itemId",
        targetFieldSlug: "billingOrderId",
        customerIdFieldSlug: "customerId",
        catalogItemFieldSlug: "interest",
        amountFieldSlug: "estimatedValue",
        amountFieldUnit: "major",
        sendEmail: true,
        skipIfExists: true
      };
    case "create_followup_task":
      return { itemIdPath: "event.payload.itemId", title: "Follow-up: {{item.title}}", description: "Acompanhar retorno comercial e registrar proximo passo.", dueInDays: 1, assigneeIdPath: "event.payload.requestedBy" };
    case "register_card_activity":
      return { itemIdPath: "event.payload.itemId", eventName: "automation.activity", message: "Atividade comercial registrada pela automacao.", severity: "info", visibility: "internal", payload: {} };
    case "communication_send":
      return { channel: "whatsapp", provider: "mock", to: "{{fields.contactPhone}}", body: "" };
    case "delay":
      return { delayFor: { amount: 1, unit: "days" } };
    case "human_approval":
      return { type: "apply_ai_recommendation", title: "Aprovar acao", description: "Revise e aprove a acao antes da continuidade do fluxo.", requestedBy: "{{event.payload.requestedBy}}", expiresInDays: 2 };
    default:
      return {};
  }
}

function createAutomationNodeComponent(nodeMeta: AutomationNodeMetaMap) {
  return function AutomationNode({ data, selected }: NodeProps) {
    const nodeData = data as AutomationCanvasData;
    const meta = nodeMeta.get(nodeData.nodeType);
    return (
      <FlowNodeCard
        kind={nodeData.nodeType}
        typeLabel={meta?.label ?? nodeData.nodeType}
        label={nodeData.label}
        meta={nodeData.summary}
        icon={<AppIcon name={(meta?.icon ?? "code") as Parameters<typeof AppIcon>[0]["name"]} size={14} />}
        selected={selected}
        target={nodeData.nodeType !== "trigger"}
        source={nodeData.nodeType !== "end"}
        branches={nodeData.nodeType === "condition" ? [
          { id: "true", label: "Sim", tone: "true" },
          { id: "false", label: "Nao", tone: "false" }
        ] : undefined}
      />
    );
  };
}

function useAsyncReload(callback: () => Promise<void>) {
  const [loading, setLoading] = useState(false);
  return useCallback(async () => {
    setLoading(true);
    try {
      await callback();
    } finally {
      setLoading(false);
    }
  }, [callback, setLoading]) as (() => Promise<void>) & { loading?: boolean };
}

export function AutomationsPage() {
  const {
    snapshot,
    isLoading,
    listAutomationWorkflows,
    createAutomationWorkflow,
    updateAutomationWorkflow,
    activateAutomationWorkflow,
    pauseAutomationWorkflow,
    archiveAutomationWorkflow,
    listAutomationWorkflowVersions,
    createAutomationWorkflowDraftVersion,
    updateAutomationWorkflowVersion,
    publishAutomationWorkflowVersion,
    cloneAutomationWorkflowVersion,
    getAutomationCapabilities,
    runAutomationWorkflow,
    listAutomationRuns,
    getAutomationRunDetail,
    cancelAutomationRun,
    listAutomationApprovals,
    listCommunicationInbox,
    getCommunicationConversation,
    replyCommunicationConversation,
    listCommunicationTemplates,
    listWhatsAppConsents,
    upsertWhatsAppConsent
  } = useWorkspace();

  const metrics = useMemo(() => buildBoardMetrics(snapshot?.tasks ?? []), [snapshot]);
  const [activeTab, setActiveTab] = useState<StudioTab>("flows");
  const [workflows, setWorkflows] = useState<AutomationWorkflow[]>([]);
  const [versions, setVersions] = useState<AutomationWorkflowVersion[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState("");
  const [workflowDescription, setWorkflowDescription] = useState("");
  const [canvasNodes, setCanvasNodes] = useState<AutomationCanvasNode[]>([]);
  const [canvasEdges, setCanvasEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [configText, setConfigText] = useState("{}");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fitViewKey, setFitViewKey] = useState(0);
  const [runs, setRuns] = useState<AutomationRunListItem[]>([]);
  const [selectedRun, setSelectedRun] = useState<AutomationRunDetail | null>(null);
  const [approvals, setApprovals] = useState<AutomationApprovalSummary[]>([]);
  const [conversations, setConversations] = useState<CommunicationConversationSummary[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<CommunicationConversationDetail | null>(null);
  const [replyText, setReplyText] = useState("");
  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [consents, setConsents] = useState<WhatsAppConsent[]>([]);
  const [automationCapabilities, setAutomationCapabilities] = useState<AutomationCapabilities | null>(null);

  const selectedWorkflow = workflows.find((workflow) => workflow.id === selectedWorkflowId) ?? null;
  const selectedVersion = versions.find((version) => version.id === selectedVersionId) ?? null;
  const selectedNode = canvasNodes.find((node) => node.id === selectedNodeId) ?? null;
  const boardColumns = useMemo(() => snapshot?.boardColumns ?? [], [snapshot?.boardColumns]);
  const workflowStates = useMemo(() => snapshot?.workflowStates ?? [], [snapshot?.workflowStates]);
  const customFields = useMemo(() => snapshot?.customFieldDefinitions ?? [], [snapshot?.customFieldDefinitions]);
  const itemTypes = useMemo(() => snapshot?.itemTypes ?? [], [snapshot?.itemTypes]);
  const hasDraft = versions.some((version) => version.status === "draft");
  const currentVersion = versions.find((version) => version.id === selectedWorkflow?.currentVersionId) ?? null;
  const nodeMeta = useMemo(
    () => new Map((automationCapabilities?.nodeCatalog ?? []).map((node) => [node.type, node])),
    [automationCapabilities]
  );
  const automationNodeTypes = useMemo(() => {
    if (!automationCapabilities) return {};
    const NodeComponent = createAutomationNodeComponent(nodeMeta);
    return automationCapabilities.nodeCatalog.reduce<Record<string, typeof NodeComponent>>((acc, node) => {
      acc[node.type] = NodeComponent;
      return acc;
    }, {});
  }, [automationCapabilities, nodeMeta]);
  const workflowPreview = useMemo(
    () => buildWorkflowPreview(canvasNodes, canvasEdges, nodeMeta),
    [canvasEdges, canvasNodes, nodeMeta]
  );
  const nodeMenuSections = useMemo(() => {
    const groups = new Map<string, AutomationNodeMeta[]>();
    for (const node of automationCapabilities?.nodeCatalog ?? []) {
      const group = node.group ?? "system";
      groups.set(group, [...(groups.get(group) ?? []), node]);
    }
    return Array.from(groups.entries()).map(([group, nodes]) => ({
      id: group,
      title: nodeGroupLabels[group] ?? group,
      items: nodes.map((node) => ({
        id: node.type,
        label: node.label,
        description: node.description,
        color: node.color
      }))
    }));
  }, [automationCapabilities]);
  const recipeMenuSections = useMemo(() => {
    const recipes = automationCapabilities?.recipeCatalog ?? [];
    if (recipes.length === 0) return [];
    return [
      {
        id: "crm-recipes",
        title: "Receitas CRM",
        actions: recipes.map((recipe) => ({
          id: recipe.id,
          label: recipe.name,
          disabled: busy
        }))
      }
    ];
  }, [automationCapabilities?.recipeCatalog, busy]);

  const loadWorkflows = useCallback(async () => {
    const result = await listAutomationWorkflows({ limit: 200 });
    setWorkflows(result.items);
    setSelectedWorkflowId((current) => current ?? result.items[0]?.id ?? null);
  }, [listAutomationWorkflows]);

  const loadCapabilities = useCallback(async () => {
    const capabilities = await getAutomationCapabilities();
    setAutomationCapabilities(capabilities);
  }, [getAutomationCapabilities]);

  const loadVersions = useCallback(async (workflowId: string | null) => {
    if (!workflowId) {
      setVersions([]);
      setSelectedVersionId(null);
      return;
    }
    const result = await listAutomationWorkflowVersions(workflowId, { limit: 100 });
    setVersions(result.items);
    const preferred = result.items.find((version) => version.status === "draft")
      ?? result.items.find((version) => version.id === workflows.find((workflow) => workflow.id === workflowId)?.currentVersionId)
      ?? result.items[0]
      ?? null;
    setSelectedVersionId(preferred?.id ?? null);
  }, [listAutomationWorkflowVersions, workflows]);

  const loadRuns = useCallback(async () => {
    const result = await listAutomationRuns({
      workflowId: selectedWorkflowId ?? undefined,
      limit: 100
    });
    setRuns(result.items);
  }, [listAutomationRuns, selectedWorkflowId]);

  const loadOperations = useCallback(async () => {
    const [approvalResult, inboxResult, templateResult, consentResult] = await Promise.all([
      listAutomationApprovals({ limit: 100 }),
      listCommunicationInbox({ limit: 100 }),
      listCommunicationTemplates({ limit: 100 }),
      listWhatsAppConsents({ limit: 100 })
    ]);
    setApprovals(approvalResult.items);
    setConversations(inboxResult.items);
    setTemplates(templateResult.items);
    setConsents(consentResult.items);
  }, [listAutomationApprovals, listCommunicationInbox, listCommunicationTemplates, listWhatsAppConsents]);

  const reloadWorkflows = useAsyncReload(loadWorkflows);

  useEffect(() => {
    void loadCapabilities();
  }, [loadCapabilities]);

  useEffect(() => {
    void reloadWorkflows();
  }, [reloadWorkflows]);

  useEffect(() => {
    void loadVersions(selectedWorkflowId);
  }, [loadVersions, selectedWorkflowId]);

  useEffect(() => {
    if (!selectedWorkflow) {
      setWorkflowName("");
      setWorkflowDescription("");
      return;
    }
    setWorkflowName(selectedWorkflow.name);
    setWorkflowDescription(selectedWorkflow.description ?? "");
  }, [selectedWorkflow]);

  useEffect(() => {
    if (!automationCapabilities) {
      setCanvasNodes([]);
      setCanvasEdges([]);
      return;
    }

    const graph = readVersionGraph(selectedVersion, automationCapabilities.defaultGraph, nodeMeta);
    const next = graphToCanvas(graph, nodeMeta);
    setCanvasNodes(next.nodes);
    setCanvasEdges(next.edges);
    setSelectedNodeId(null);
    setFitViewKey((value) => value + 1);
  }, [automationCapabilities, nodeMeta, selectedVersion]);

  useEffect(() => {
    if (!selectedNode) {
      setConfigText("{}");
      return;
    }
    setConfigText(JSON.stringify(selectedNode.data.config, null, 2));
  }, [selectedNode]);

  useEffect(() => {
    if (activeTab === "runs") {
      void loadRuns();
    }
    if (activeTab === "approvals" || activeTab === "inbox" || activeTab === "templates" || activeTab === "contacts" || activeTab === "settings") {
      void loadOperations();
    }
  }, [activeTab, loadRuns, loadOperations]);

  const onNodesChange: OnNodesChange<AutomationCanvasNode> = useCallback((changes) => {
    setCanvasNodes((nodes) => applyNodeChanges(changes, nodes) as AutomationCanvasNode[]);
  }, []);

  const onEdgesChange: OnEdgesChange<Edge> = useCallback((changes) => {
    setCanvasEdges((edges) => applyEdgeChanges(changes, edges));
  }, []);

  const handleCreateWorkflow = useCallback(async () => {
    if (!automationCapabilities) return;
    setBusy(true);
    setFeedback(null);
    try {
      const workflow = await createAutomationWorkflow({
        name: `Novo fluxo ${workflows.length + 1}`,
        status: "draft"
      });
      await createAutomationWorkflowDraftVersion(workflow.id, {
        graph: automationCapabilities.defaultGraph,
        definition: { graph: automationCapabilities.defaultGraph }
      });
      await loadWorkflows();
      setSelectedWorkflowId(workflow.id);
      setFeedback("Fluxo criado.");
    } finally {
      setBusy(false);
    }
  }, [automationCapabilities, createAutomationWorkflow, createAutomationWorkflowDraftVersion, loadWorkflows, workflows.length]);

  const handleCreateRecipeWorkflow = useCallback(async (recipe: AutomationRecipe) => {
    setBusy(true);
    setFeedback(null);
    try {
      const workflow = await createAutomationWorkflow({
        name: recipe.name,
        description: recipe.description,
        status: "draft"
      });
      await createAutomationWorkflowDraftVersion(workflow.id, {
        graph: recipe.graph,
        definition: { graph: recipe.graph, recipeId: recipe.id }
      });
      await loadWorkflows();
      setSelectedWorkflowId(workflow.id);
      setFeedback("Receita criada como workflow editavel.");
    } finally {
      setBusy(false);
    }
  }, [createAutomationWorkflow, createAutomationWorkflowDraftVersion, loadWorkflows]);

  const handleSaveWorkflow = useCallback(async () => {
    if (!selectedWorkflow || !selectedVersion || selectedVersion.status !== "draft") return;
    setBusy(true);
    setFeedback(null);
    try {
      const graph = canvasToGraph(canvasNodes, canvasEdges);
      await Promise.all([
        updateAutomationWorkflow(selectedWorkflow.id, {
          name: workflowName,
          description: workflowDescription || null
        }),
        updateAutomationWorkflowVersion(selectedWorkflow.id, selectedVersion.id, {
          graph,
          definition: { graph }
        })
      ]);
      await loadWorkflows();
      await loadVersions(selectedWorkflow.id);
      setFeedback("Draft salvo.");
    } finally {
      setBusy(false);
    }
  }, [
    canvasEdges,
    canvasNodes,
    loadVersions,
    loadWorkflows,
    selectedVersion,
    selectedWorkflow,
    updateAutomationWorkflow,
    updateAutomationWorkflowVersion,
    workflowDescription,
    workflowName
  ]);

  const handlePublish = useCallback(async () => {
    if (!selectedWorkflow || !selectedVersion || selectedVersion.status !== "draft") return;
    if (workflowPreview.errors.length > 0) {
      setFeedback(`Corrija antes de publicar: ${workflowPreview.errors[0]}`);
      return;
    }
    await handleSaveWorkflow();
    setBusy(true);
    try {
      await publishAutomationWorkflowVersion(selectedWorkflow.id, selectedVersion.id, { activateWorkflow: true });
      await loadWorkflows();
      await loadVersions(selectedWorkflow.id);
      setFeedback("Versao publicada.");
    } finally {
      setBusy(false);
    }
  }, [handleSaveWorkflow, loadVersions, loadWorkflows, publishAutomationWorkflowVersion, selectedVersion, selectedWorkflow, workflowPreview.errors]);

  const handleCloneVersion = useCallback(async () => {
    if (!selectedWorkflow || !selectedVersion) return;
    setBusy(true);
    try {
      const draft = await cloneAutomationWorkflowVersion(selectedWorkflow.id, selectedVersion.id);
      await loadVersions(selectedWorkflow.id);
      setSelectedVersionId(draft.id);
      setFeedback("Draft criado a partir da versao selecionada.");
    } finally {
      setBusy(false);
    }
  }, [cloneAutomationWorkflowVersion, loadVersions, selectedVersion, selectedWorkflow]);

  const handleStatusChange = useCallback(async (status: Extract<AutomationWorkflowStatus, "active" | "paused" | "archived">) => {
    if (!selectedWorkflow) return;
    setBusy(true);
    try {
      if (status === "active") await activateAutomationWorkflow(selectedWorkflow.id);
      if (status === "paused") await pauseAutomationWorkflow(selectedWorkflow.id);
      if (status === "archived") await archiveAutomationWorkflow(selectedWorkflow.id);
      await loadWorkflows();
    } finally {
      setBusy(false);
    }
  }, [activateAutomationWorkflow, archiveAutomationWorkflow, loadWorkflows, pauseAutomationWorkflow, selectedWorkflow]);

  const handleRun = useCallback(async () => {
    if (!selectedWorkflow) return;
    setBusy(true);
    try {
      const result = await runAutomationWorkflow(selectedWorkflow.id, {
        triggerType: "manual",
        context: { source: "automation_studio_test" }
      });
      setFeedback(`Run criada: ${result.runId}`);
      await loadRuns();
      setActiveTab("runs");
    } finally {
      setBusy(false);
    }
  }, [loadRuns, runAutomationWorkflow, selectedWorkflow]);

  const handleApplyConfig = useCallback(() => {
    if (!selectedNode) return;
    const parsed = JSON.parse(configText) as Record<string, unknown>;
    setCanvasNodes((nodes) => nodes.map((node) => (
      node.id === selectedNode.id
        ? { ...node, data: { ...node.data, config: parsed, summary: summarizeConfig(parsed) } }
        : node
    )));
  }, [configText, selectedNode]);

  const handleAddNodeFromPalette = useCallback((meta: AutomationNodeMeta) => {
    const index = canvasNodes.length;
    const config = buildDefaultNodeConfig(meta.type);
    setCanvasNodes((nodes) => [
      ...nodes,
      {
        id: `${meta.type}-${Date.now()}`,
        type: meta.type,
        position: { x: 120 + index * 80, y: 160 + index * 28 },
        data: {
          nodeType: meta.type,
          label: meta.label,
          summary: summarizeConfig(config),
          config
        }
      }
    ]);
  }, [canvasNodes.length]);

  const handleSelectedNodeConfigChange = useCallback((config: Record<string, unknown>) => {
    if (!selectedNodeId) return;
    setConfigText(JSON.stringify(config, null, 2));
    setCanvasNodes((nodes) => nodes.map((node) => (
      node.id === selectedNodeId
        ? { ...node, data: { ...node.data, config, summary: summarizeConfig(config) } }
        : node
    )));
  }, [selectedNodeId]);

  const handleLoadRunDetail = useCallback(async (runId: string) => {
    const detail = await getAutomationRunDetail(runId);
    setSelectedRun(detail);
  }, [getAutomationRunDetail]);

  const handleCancelRun = useCallback(async (runId: string) => {
    await cancelAutomationRun(runId, "Cancelado pelo Automation Studio");
    await loadRuns();
  }, [cancelAutomationRun, loadRuns]);

  const handleOpenConversation = useCallback(async (conversationId: string) => {
    const detail = await getCommunicationConversation(conversationId);
    setSelectedConversation(detail);
  }, [getCommunicationConversation]);

  const handleReply = useCallback(async () => {
    if (!selectedConversation || !replyText.trim()) return;
    await replyCommunicationConversation(selectedConversation.conversation.id, {
      channel: selectedConversation.conversation.channel === "email" ? "email" : "whatsapp",
      text: replyText,
      sendMode: "manual"
    });
    setReplyText("");
    await handleOpenConversation(selectedConversation.conversation.id);
  }, [handleOpenConversation, replyCommunicationConversation, replyText, selectedConversation]);

  const handleOptOutFirstConsent = useCallback(async () => {
    const first = consents[0];
    if (!first) return;
    await upsertWhatsAppConsent({ address: first.address, status: "opted_out", source: "automation_studio" });
    await loadOperations();
  }, [consents, loadOperations, upsertWhatsAppConsent]);

  if (isLoading || !automationCapabilities) {
    return <LoadingState text="Carregando Automation Studio" animation="automation" />;
  }

  const topNavigation = (
    <WorkspaceTopNavigation<StudioTab>
      value={activeTab}
      items={studioTabs.map((t) => ({ id: t.id, label: t.label }))}
      onChange={setActiveTab}
      ariaLabel="Automacoes"
      className="automations-top-nav"
      actions={activeTab === "flows" && selectedWorkflow ? (
        <>
          <WorkspaceActionButton
            label="Ativar"
            icon={<AppIcon name="play" />}
            onClick={() => void handleStatusChange("active")}
            disabled={busy || !currentVersion}
          />
          <WorkspaceActionButton
            label="Pausar"
            icon={<AppIcon name="pause" />}
            onClick={() => void handleStatusChange("paused")}
            disabled={busy}
          />
          <WorkspaceActionButton
            tone="danger"
            label="Arquivar"
            icon={<AppIcon name="archive" />}
            onClick={() => void handleStatusChange("archived")}
            disabled={busy}
          />
          <WorkspaceActionButton
            label="Clonar versao"
            icon={<AppIcon name="copy" />}
            onClick={handleCloneVersion}
            disabled={busy || !selectedVersion}
          />
          <WorkspaceActionButton
            label="Executar teste"
            icon={<AppIcon name="zap" />}
            onClick={handleRun}
            disabled={busy || selectedWorkflow.status !== "active" || !currentVersion}
          />
          <WorkspaceActionButton
            label="Salvar draft"
            icon={<AppIcon name="check" />}
            onClick={handleSaveWorkflow}
            disabled={busy || selectedVersion?.status !== "draft"}
          />
          <WorkspaceActionButton
            tone="accent"
            label="Publicar"
            icon={<AppIcon name="send" />}
            onClick={handlePublish}
            disabled={busy || selectedVersion?.status !== "draft"}
          />
        </>
      ) : undefined}
    />
  );

  return (
    <AppShell
      metrics={metrics}
      pageLabel="Automation Studio"
      pageTitle="Workflow versionado"
      noPageScroll
      hidePageHeader
      hideSidebarBrandMark
      topNavigation={topNavigation}
    >
      <WorkspaceFrame className="automation-studio" variant="editor" scroll="none">

        {activeTab === "flows" ? (
          <StudioLayout
            sidebar={
              <PanelMenu
                title="Fluxos"
                count={workflows.length}
                action={
                  <button className="ast__create-btn" type="button" onClick={() => void handleCreateWorkflow()} disabled={busy}>
                    <AppIcon name="plus" size={14} />
                  </button>
                }
              >
                {workflows.map((workflow) => (
                  <PanelMenuItem
                    key={workflow.id}
                    selected={workflow.id === selectedWorkflowId}
                    onClick={() => setSelectedWorkflowId(workflow.id)}
                    label={workflow.name}
                    trailing={
                      <StatusBadge size="sm" tone={statusTone(workflow.status)}>
                        {workflow.status}
                      </StatusBadge>
                    }
                  />
                ))}
              </PanelMenu>
            }
            inspector={
              selectedNode ? (
                <NodeInspector
                  node={selectedNode}
                  boardColumns={boardColumns}
                  workflowStates={workflowStates}
                  customFields={customFields}
                  itemTypes={itemTypes}
                  configText={configText}
                  onConfigTextChange={setConfigText}
                  onApplyConfig={handleApplyConfig}
                  onConfigChange={handleSelectedNodeConfigChange}
                  onLabelChange={(label) => setCanvasNodes((nodes) => nodes.map((node) => (
                    node.id === selectedNode.id
                      ? { ...node, data: { ...node.data, label } }
                      : node
                  )))}
                />
              ) : selectedWorkflow ? (
                <>
                  <label className="ast__inspector-label">
                    <span>Nome</span>
                    <TextInput value={workflowName} onChange={(event) => setWorkflowName(event.target.value)} />
                  </label>
                  <label className="ast__inspector-label">
                    <span>Descricao</span>
                    <TextInput value={workflowDescription} onChange={(event) => setWorkflowDescription(event.target.value)} placeholder="Descricao" />
                  </label>
                  <WorkflowPreviewPanel preview={workflowPreview} />
                </>
              ) : (
                <EmptyState className="automation-studio__empty-panel" size="compact">Selecione um fluxo.</EmptyState>
              )
            }
            inspectorOpen={true}
            inspectorWidth={340}
          >
            {selectedWorkflow ? (
              <FlowCanvas<AutomationCanvasData, AutomationNodeType>
                nodes={canvasNodes}
                edges={canvasEdges}
                nodeTypes={automationNodeTypes}
                paletteItems={automationCapabilities.nodeCatalog.map((node) => ({
                  kind: node.type,
                  label: node.label,
                  description: node.description,
                  color: node.color,
                  buildData: () => ({
                    nodeType: node.type,
                    label: node.label,
                    summary: "Sem configuracao",
                    config: buildDefaultNodeConfig(node.type)
                  })
                }))}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onEdgesAdd={setCanvasEdges}
                onNodesAdd={(nodes) => setCanvasNodes((current) => [...current, ...nodes])}
                onNodeSelect={setSelectedNodeId}
                fitViewKey={fitViewKey}
                fitViewMaxZoom={0.78}
                paletteTitle="Adicionar no"
                paletteEyebrow="Workflow"
                sidebarContent={
                  <FlowNodeSidebarMenu
                    sections={nodeMenuSections}
                    actionSections={recipeMenuSections}
                    onItemSelect={(item) => {
                      const meta = nodeMeta.get(item.id);
                      if (meta) handleAddNodeFromPalette(meta);
                    }}
                    onActionSelect={(action) => {
                      const recipe = (automationCapabilities.recipeCatalog ?? []).find((entry) => entry.id === action.id);
                      if (recipe) void handleCreateRecipeWorkflow(recipe);
                    }}
                  />
                }
              />
            ) : (
              <EmptyState className="automation-studio__empty-panel" size="compact">Nenhum fluxo criado.</EmptyState>
            )}
          </StudioLayout>
        ) : null}

        {activeTab === "runs" ? (
          <section className="automation-studio__panel">
            <PanelHeader title="Execucoes" onRefresh={loadRuns} />
            <div className="automation-studio__split">
              <DataList
                items={runs}
                empty="Sem execucoes."
                render={(run) => (
                  <button key={run.runId} type="button" onClick={() => void handleLoadRunDetail(run.runId)}>
                    <span>{run.workflowName}</span>
                    <StatusBadge size="sm" tone={statusTone(run.status)}>{run.status}</StatusBadge>
                    <small>{formatDate(run.createdAt)}</small>
                  </button>
                )}
              />
              <div className="automation-studio__detail">
                {selectedRun ? (
                  <>
                    <h3>{selectedRun.workflow.name}</h3>
                    <p>{selectedRun.run.triggerType} | {selectedRun.summary.stepsCount} passos | {selectedRun.summary.eventsCount} eventos</p>
                    <Button size="sm" variant="outline" disabled={!selectedRun.run.canCancel} onClick={() => void handleCancelRun(selectedRun.run.runId)}>
                      Cancelar
                    </Button>
                    <pre>{JSON.stringify(selectedRun.steps.slice(0, 8), null, 2)}</pre>
                  </>
                ) : (
                  <EmptyState className="automation-studio__empty-panel" size="compact">Abra uma execucao.</EmptyState>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "approvals" ? (
          <section className="automation-studio__panel">
            <PanelHeader title="Aprovacoes" onRefresh={loadOperations} />
            <DataList
              items={approvals}
              empty="Sem aprovacoes."
              render={(approval) => (
                <div key={approval.approvalId} className="automation-studio__row">
                  <span>{approval.title}</span>
                  <StatusBadge size="sm" tone={statusTone(approval.status)}>{approval.status}</StatusBadge>
                  <small>{approval.workflowName}</small>
                </div>
              )}
            />
          </section>
        ) : null}

        {activeTab === "inbox" ? (
          <section className="automation-studio__panel">
            <PanelHeader title="Inbox" onRefresh={loadOperations} />
            <div className="automation-studio__split">
              <DataList
                items={conversations}
                empty="Sem conversas."
                render={(conversation) => (
                  <button key={conversation.conversationId} type="button" onClick={() => void handleOpenConversation(conversation.conversationId)}>
                    <span>{conversation.contactName}</span>
                    <StatusBadge size="sm" tone={statusTone(conversation.status)}>{conversation.status}</StatusBadge>
                    <small>{conversation.lastMessagePreview ?? conversation.contactMasked}</small>
                  </button>
                )}
              />
              <div className="automation-studio__detail">
                {selectedConversation ? (
                  <>
                    <h3>{selectedConversation.contact.displayName ?? selectedConversation.contact.companyName ?? "Contato"}</h3>
                    <div className="automation-studio__messages">
                      {selectedConversation.messages.map((message) => (
                        <div key={message.id}>
                          <strong>{message.direction}</strong>
                          <span>{message.textPreview}</span>
                        </div>
                      ))}
                    </div>
                    <textarea value={replyText} onChange={(event) => setReplyText(event.target.value)} />
                    <Button size="sm" variant="primary" onClick={() => void handleReply()}>Responder</Button>
                  </>
                ) : (
                  <EmptyState className="automation-studio__empty-panel" size="compact">Abra uma conversa.</EmptyState>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "templates" ? (
          <section className="automation-studio__panel">
            <PanelHeader title="Templates" onRefresh={loadOperations} />
            <DataList
              items={templates}
              empty="Sem templates."
              render={(template) => (
                <div key={template.id} className="automation-studio__row">
                  <span>{template.name}</span>
                  <StatusBadge size="sm" tone={statusTone(template.status)}>{template.status}</StatusBadge>
                  <small>{template.channel}</small>
                </div>
              )}
            />
          </section>
        ) : null}

        {activeTab === "contacts" ? (
          <section className="automation-studio__panel">
            <PanelHeader title="Contatos" onRefresh={loadOperations} />
            <DataList
              items={conversations}
              empty="Sem contatos."
              render={(conversation) => (
                <div key={conversation.conversationId} className="automation-studio__row">
                  <span>{conversation.contactName}</span>
                  <StatusBadge size="sm" tone="info">{conversation.channel}</StatusBadge>
                  <small>{conversation.contactMasked}</small>
                </div>
              )}
            />
          </section>
        ) : null}

        {activeTab === "settings" ? (
          <section className="automation-studio__panel">
            <PanelHeader title="Configuracoes" onRefresh={loadOperations} />
            <DataList
              items={consents}
              empty="Sem consentimentos."
              render={(consent) => (
                <div key={consent.id} className="automation-studio__row">
                  <span>{consent.address}</span>
                  <StatusBadge size="sm" tone={statusTone(consent.status)}>{consent.status}</StatusBadge>
                  <small>{formatDate(consent.updatedAt)}</small>
                </div>
              )}
            />
            <Button size="sm" variant="outline" disabled={consents.length === 0} onClick={() => void handleOptOutFirstConsent()}>
              Aplicar opt-out no primeiro item
            </Button>
          </section>
        ) : null}
      </WorkspaceFrame>
    </AppShell>
  );
}

function NodeInspector({
  node,
  boardColumns,
  workflowStates,
  customFields,
  itemTypes,
  configText,
  onConfigTextChange,
  onApplyConfig,
  onConfigChange,
  onLabelChange
}: {
  node: AutomationCanvasNode;
  boardColumns: FieldOption[];
  workflowStates: FieldOption[];
  customFields: FieldOption[];
  itemTypes: FieldOption[];
  configText: string;
  onConfigTextChange: (value: string) => void;
  onApplyConfig: () => void;
  onConfigChange: (config: Record<string, unknown>) => void;
  onLabelChange: (label: string) => void;
}) {
  const config = node.data.config;
  const setConfigValue = (key: string, value: unknown) => {
    onConfigChange({ ...config, [key]: value });
  };
  const setConfigJsonValue = (key: string, value: string) => {
    try {
      setConfigValue(key, value.trim() ? JSON.parse(value) : {});
    } catch {
      setConfigValue(key, value);
    }
  };
  const setCsvValue = (key: string, value: string) => {
    setConfigValue(key, value.split(",").map((entry) => entry.trim()).filter(Boolean));
  };

  return (
    <div className="ast__inspector">
      <label className="ast__inspector-label">
        <span>Rotulo</span>
        <TextInput value={node.data.label} onChange={(event) => onLabelChange(event.target.value)} />
      </label>

      <NodeSpecificConfig
        nodeType={node.data.nodeType}
        config={config}
        boardColumns={boardColumns}
        workflowStates={workflowStates}
        customFields={customFields}
        itemTypes={itemTypes}
        setConfigValue={setConfigValue}
        setConfigJsonValue={setConfigJsonValue}
        setCsvValue={setCsvValue}
      />

      <details className="ast__advanced-config">
        <summary>Avancado JSON</summary>
        <label className="ast__inspector-label">
          <span>Config JSON</span>
          <textarea className="ast__inspector-textarea" value={configText} onChange={(event) => onConfigTextChange(event.target.value)} />
        </label>
        <Button size="sm" variant="outline" onClick={onApplyConfig}>Aplicar JSON</Button>
      </details>
    </div>
  );
}

function NodeSpecificConfig({
  nodeType,
  config,
  boardColumns,
  workflowStates,
  customFields,
  itemTypes,
  setConfigValue,
  setConfigJsonValue,
  setCsvValue
}: {
  nodeType: string;
  config: Record<string, unknown>;
  boardColumns: FieldOption[];
  workflowStates: FieldOption[];
  customFields: FieldOption[];
  itemTypes: FieldOption[];
  setConfigValue: (key: string, value: unknown) => void;
  setConfigJsonValue: (key: string, value: string) => void;
  setCsvValue: (key: string, value: string) => void;
}) {
  const triggerType = String(config.triggerType ?? "manual");
  const selectedCustomFieldSlug = String(config.fieldSlug ?? customFields[0]?.slug ?? customFields[0]?.id ?? "");
  const customFieldValues = isRecord(config.customFieldValues) ? config.customFieldValues : {};
  const setCustomFieldValue = (fieldSlug: string, value: string) => {
    setConfigValue("customFieldValues", {
      ...customFieldValues,
      [fieldSlug]: value
    });
    setConfigValue("fieldSlug", fieldSlug);
  };

  if (nodeType === "trigger") {
    return (
      <ConfigGroup title="Gatilho">
        <SelectField
          label="Evento"
          value={triggerType}
          onChange={(value) => setConfigValue("triggerType", value)}
          options={[
            { value: "manual", label: "Manual" },
            { value: "work_item_created", label: "Card criado" },
            { value: "work_item_moved_to_column", label: "Card entrou na coluna" },
            { value: "work_item_state_changed", label: "Card mudou de estado" },
            { value: "work_item_updated", label: "Card atualizado" },
            { value: "work_item_field_updated", label: "Campo do card atualizado" },
            { value: "proposal_created", label: "Proposta criada" },
            { value: "proposal_status_changed", label: "Status da proposta" },
            { value: "contract_created", label: "Contrato criado" },
            { value: "contract_status_changed", label: "Status do contrato" },
            { value: "billing_requested", label: "Cobranca gerada" },
            { value: "billing_payment_confirmed", label: "Pagamento confirmado" },
            { value: "billing_payment_failed", label: "Pagamento falhou" },
            { value: "billing_overdue", label: "Cobranca vencida" },
            { value: "lead_captured", label: "Lead capturado" }
          ]}
        />
        {triggerType === "work_item_moved_to_column" ? (
          <SelectField
            label="Coluna"
            value={String(config.column ?? "")}
            onChange={(value) => setConfigValue("column", value)}
            options={boardColumns.map((column) => ({ value: toOptionValue(column), label: toOptionLabel(column) }))}
            placeholder="Qualquer coluna"
          />
        ) : null}
        {triggerType === "work_item_state_changed" ? (
          <SelectField
            label="Estado"
            value={String(config.stateSlug ?? "")}
            onChange={(value) => setConfigValue("stateSlug", value)}
            options={workflowStates.map((state) => ({ value: toOptionValue(state), label: toOptionLabel(state) }))}
            placeholder="Qualquer estado"
          />
        ) : null}
        {triggerType === "proposal_status_changed" || triggerType === "contract_status_changed" || triggerType.startsWith("billing") ? (
          <TextConfigField label="Status" value={String(config.status ?? "")} onChange={(value) => setConfigValue("status", value)} />
        ) : null}
        {triggerType.startsWith("work_item") ? (
          <TextConfigField
            label="Tipos de card"
            value={Array.isArray(config.itemTypeSlugs) ? config.itemTypeSlugs.join(", ") : String(config.itemTypeSlugs ?? "")}
            onChange={(value) => setCsvValue("itemTypeSlugs", value)}
            placeholder={itemTypes.map(toOptionValue).filter(Boolean).slice(0, 3).join(", ")}
          />
        ) : null}
      </ConfigGroup>
    );
  }

  if (nodeType === "move_work_item") {
    return (
      <ConfigGroup title="Movimentacao">
        <TextConfigField label="Item ID path" value={String(config.itemIdPath ?? "event.payload.itemId")} onChange={(value) => setConfigValue("itemIdPath", value)} />
        <SelectField label="Coluna" value={String(config.columnSlug ?? "")} onChange={(value) => setConfigValue("columnSlug", value)} options={boardColumns.map((column) => ({ value: toOptionValue(column), label: toOptionLabel(column) }))} placeholder="Resolver pela etapa" />
        <SelectField label="Estado" value={String(config.stateSlug ?? "")} onChange={(value) => setConfigValue("stateSlug", value)} options={workflowStates.map((state) => ({ value: toOptionValue(state), label: toOptionLabel(state) }))} placeholder="Manter estado" />
        <TextConfigField label="Motivo" value={String(config.reason ?? "")} onChange={(value) => setConfigValue("reason", value)} placeholder="Avanco automatico do fluxo comercial" />
        <CheckboxConfigField label="Registrar historico" checked={config.registerHistory !== false} onChange={(value) => setConfigValue("registerHistory", value)} />
        <CheckboxConfigField label="Bloquear loop para mesma etapa" checked={config.preventLoop !== false} onChange={(value) => setConfigValue("preventLoop", value)} />
      </ConfigGroup>
    );
  }

  if (nodeType === "create_proposal" || nodeType === "create_contract") {
    const isContract = nodeType === "create_contract";
    return (
      <ConfigGroup title={isContract ? "Contrato" : "Proposta"}>
        <TextConfigField label="Item ID path" value={String(config.itemIdPath ?? (isContract ? "event.payload.linkedEntityId" : "event.payload.itemId"))} onChange={(value) => setConfigValue("itemIdPath", value)} />
        {isContract ? (
          <SelectField label="Campo da proposta base" value={String(config.proposalFieldSlug ?? "proposalId")} onChange={(value) => setConfigValue("proposalFieldSlug", value)} options={customFields.map((field) => ({ value: toOptionValue(field), label: toOptionLabel(field) }))} />
        ) : null}
        <TextConfigField label="Template" value={String(config.templateKey ?? (isContract ? "commercial_contract" : "commercial_proposal"))} onChange={(value) => setConfigValue("templateKey", value)} />
        <SelectField label="Campo de vinculo" value={String(config.targetFieldSlug ?? (isContract ? "contractId" : "proposalId"))} onChange={(value) => setConfigValue("targetFieldSlug", value)} options={customFields.map((field) => ({ value: toOptionValue(field), label: toOptionLabel(field) }))} />
        <SelectField label="Status inicial" value={String(config.status ?? "draft")} onChange={(value) => setConfigValue("status", value)} options={[{ value: "draft", label: "Rascunho" }, { value: "sent", label: "Enviado" }]} />
        <TextConfigField label="Titulo" value={String(config.title ?? "")} onChange={(value) => setConfigValue("title", value)} placeholder={isContract ? "Contrato - {{item.title}}" : "Proposta - {{item.title}}"} />
        <TextAreaConfigField label="Conteudo customizado" value={String(config.content ?? "")} onChange={(value) => setConfigValue("content", value)} />
        <CheckboxConfigField label="Nao duplicar se ja existir" checked={config.skipIfExists !== false} onChange={(value) => setConfigValue("skipIfExists", value)} />
      </ConfigGroup>
    );
  }

  if (nodeType === "send_document" || nodeType === "update_document_status") {
    return (
      <ConfigGroup title="Documento">
        <TextConfigField label="Item ID path" value={String(config.itemIdPath ?? "event.payload.itemId")} onChange={(value) => setConfigValue("itemIdPath", value)} />
        <SelectField label="Tipo" value={String(config.kind ?? "proposal")} onChange={(value) => setConfigValue("kind", value)} options={[{ value: "proposal", label: "Proposta" }, { value: "contract", label: "Contrato" }]} />
        <SelectField label="Campo do documento" value={String(config.documentFieldSlug ?? "")} onChange={(value) => setConfigValue("documentFieldSlug", value)} options={customFields.map((field) => ({ value: toOptionValue(field), label: toOptionLabel(field) }))} placeholder="Selecione um campo" />
        {nodeType === "send_document" ? (
          <>
            <SelectField label="Canal" value={String(config.channel ?? "email")} onChange={(value) => setConfigValue("channel", value)} options={[{ value: "email", label: "E-mail" }]} />
            <TextConfigField label="E-mail fixo" value={String(config.email ?? "")} onChange={(value) => setConfigValue("email", value)} placeholder="cliente@empresa.com" />
            <TextConfigField label="Caminho do e-mail" value={String(config.emailPath ?? "fields.contactEmail")} onChange={(value) => setConfigValue("emailPath", value)} />
            <TextAreaConfigField label="Mensagem" value={String(config.message ?? "Segue o link do documento comercial para avaliacao.")} onChange={(value) => setConfigValue("message", value)} />
            <CheckboxConfigField label="Permitir reenvio" checked={config.resend === true} onChange={(value) => setConfigValue("resend", value)} />
          </>
        ) : null}
        {nodeType === "update_document_status" ? (
          <SelectField label="Status" value={String(config.status ?? "sent")} onChange={(value) => setConfigValue("status", value)} options={["draft", "sent", "viewed", "approved", "rejected", "accepted", "signed"].map((status) => ({ value: status, label: status }))} />
        ) : null}
      </ConfigGroup>
    );
  }

  if (nodeType === "ensure_customer_from_work_item") {
    return (
      <ConfigGroup title="Cliente">
        <TextConfigField label="Item ID path" value={String(config.itemIdPath ?? "event.payload.itemId")} onChange={(value) => setConfigValue("itemIdPath", value)} />
        <SelectField label="Campo cliente" value={String(config.targetFieldSlug ?? "customerId")} onChange={(value) => setConfigValue("targetFieldSlug", value)} options={customFields.map((field) => ({ value: toOptionValue(field), label: toOptionLabel(field) }))} />
        <SelectField label="Status" value={String(config.status ?? "active")} onChange={(value) => setConfigValue("status", value)} options={[{ value: "prospect", label: "Prospect" }, { value: "active", label: "Ativo" }, { value: "inactive", label: "Inativo" }, { value: "archived", label: "Arquivado" }]} />
      </ConfigGroup>
    );
  }

  if (nodeType === "create_billing_order") {
    return (
      <ConfigGroup title="Cobranca">
        <TextConfigField label="Item ID path" value={String(config.itemIdPath ?? "event.payload.itemId")} onChange={(value) => setConfigValue("itemIdPath", value)} />
        <SelectField label="Campo ordem" value={String(config.targetFieldSlug ?? "billingOrderId")} onChange={(value) => setConfigValue("targetFieldSlug", value)} options={customFields.map((field) => ({ value: toOptionValue(field), label: toOptionLabel(field) }))} />
        <SelectField label="Campo catalogo" value={String(config.catalogItemFieldSlug ?? "interest")} onChange={(value) => setConfigValue("catalogItemFieldSlug", value)} options={customFields.map((field) => ({ value: toOptionValue(field), label: toOptionLabel(field) }))} />
        <SelectField label="Campo valor" value={String(config.amountFieldSlug ?? "estimatedValue")} onChange={(value) => setConfigValue("amountFieldSlug", value)} options={customFields.map((field) => ({ value: toOptionValue(field), label: toOptionLabel(field) }))} />
        <SelectField label="Campo cliente" value={String(config.customerIdFieldSlug ?? "customerId")} onChange={(value) => setConfigValue("customerIdFieldSlug", value)} options={customFields.map((field) => ({ value: toOptionValue(field), label: toOptionLabel(field) }))} />
        <SelectField label="Documento vinculado" value={String(config.documentFieldSlug ?? "contractId")} onChange={(value) => setConfigValue("documentFieldSlug", value)} options={customFields.map((field) => ({ value: toOptionValue(field), label: toOptionLabel(field) }))} />
        <SelectField label="Unidade do valor" value={String(config.amountFieldUnit ?? "major")} onChange={(value) => setConfigValue("amountFieldUnit", value)} options={[{ value: "major", label: "Reais" }, { value: "minor", label: "Centavos" }]} />
        <TextConfigField label="Vencimento em dias" value={String(config.dueInDays ?? "7")} onChange={(value) => setConfigValue("dueInDays", Number(value) || 7)} />
        <SelectField label="Forma de pagamento" value={String(config.paymentMethod ?? "checkout")} onChange={(value) => setConfigValue("paymentMethod", value)} options={[{ value: "checkout", label: "Checkout" }, { value: "pix", label: "Pix" }, { value: "boleto", label: "Boleto" }]} />
        <TextAreaConfigField label="Descricao" value={String(config.description ?? "{{item.title}}")} onChange={(value) => setConfigValue("description", value)} />
        <CheckboxConfigField label="Enviar e-mail de cobranca" checked={config.sendEmail !== false} onChange={(value) => setConfigValue("sendEmail", value)} />
      </ConfigGroup>
    );
  }

  if (nodeType === "update_work_item_fields") {
    return (
      <ConfigGroup title="Campos do card">
        <TextConfigField label="Item ID path" value={String(config.itemIdPath ?? "event.payload.itemId")} onChange={(value) => setConfigValue("itemIdPath", value)} />
        <TextConfigField label="Titulo" value={String(config.title ?? "")} onChange={(value) => setConfigValue("title", value)} />
        <TextAreaConfigField label="Descricao" value={String(config.description ?? "")} onChange={(value) => setConfigValue("description", value)} />
        <SelectField label="Campo customizado" value={selectedCustomFieldSlug} onChange={(value) => setConfigValue("fieldSlug", value)} options={customFields.map((field) => ({ value: toOptionValue(field), label: `${toOptionLabel(field)} (${field.type ?? "campo"})` }))} />
        <TextConfigField label="Valor do campo" value={String(customFieldValues[selectedCustomFieldSlug] ?? "")} onChange={(value) => setCustomFieldValue(selectedCustomFieldSlug, value)} placeholder="{{event.payload.valor}}" />
        <TextConfigField label="Tipo do card" value={String(config.typeSlug ?? "")} onChange={(value) => setConfigValue("typeSlug", value)} placeholder={itemTypes.map(toOptionValue).filter(Boolean)[0]} />
      </ConfigGroup>
    );
  }

  if (nodeType === "create_followup_task") {
    return (
      <ConfigGroup title="Follow-up">
        <TextConfigField label="Item ID path" value={String(config.itemIdPath ?? "event.payload.itemId")} onChange={(value) => setConfigValue("itemIdPath", value)} />
        <TextConfigField label="Titulo" value={String(config.title ?? "Follow-up: {{item.title}}")} onChange={(value) => setConfigValue("title", value)} />
        <TextAreaConfigField label="Descricao" value={String(config.description ?? "")} onChange={(value) => setConfigValue("description", value)} />
        <TextConfigField label="Responsavel path" value={String(config.assigneeIdPath ?? "event.payload.requestedBy")} onChange={(value) => setConfigValue("assigneeIdPath", value)} />
        <TextConfigField label="Prazo em dias" value={String(config.dueInDays ?? "1")} onChange={(value) => setConfigValue("dueInDays", Number(value) || 1)} />
        <SelectField label="Canal" value={String(config.channel ?? "task")} onChange={(value) => setConfigValue("channel", value)} options={[{ value: "task", label: "Tarefa interna" }, { value: "email", label: "E-mail" }, { value: "whatsapp", label: "WhatsApp" }]} />
        <SelectField label="Coluna" value={String(config.columnSlug ?? "")} onChange={(value) => setConfigValue("columnSlug", value)} options={boardColumns.map((column) => ({ value: toOptionValue(column), label: toOptionLabel(column) }))} placeholder="Mesma etapa" />
      </ConfigGroup>
    );
  }

  if (nodeType === "register_card_activity") {
    return (
      <ConfigGroup title="Historico">
        <TextConfigField label="Item ID path" value={String(config.itemIdPath ?? "event.payload.itemId")} onChange={(value) => setConfigValue("itemIdPath", value)} />
        <TextConfigField label="Evento" value={String(config.eventName ?? "automation.activity")} onChange={(value) => setConfigValue("eventName", value)} />
        <TextAreaConfigField label="Mensagem" value={String(config.message ?? "")} onChange={(value) => setConfigValue("message", value)} />
        <SelectField label="Severidade" value={String(config.severity ?? "info")} onChange={(value) => setConfigValue("severity", value)} options={[{ value: "info", label: "Info" }, { value: "warning", label: "Aviso" }, { value: "critical", label: "Critico" }]} />
        <SelectField label="Visibilidade" value={String(config.visibility ?? "internal")} onChange={(value) => setConfigValue("visibility", value)} options={[{ value: "internal", label: "Interna" }, { value: "customer", label: "Cliente" }]} />
        <TextAreaConfigField label="Payload JSON" value={JSON.stringify(config.payload ?? {}, null, 2)} onChange={(value) => setConfigJsonValue("payload", value)} />
      </ConfigGroup>
    );
  }

  if (nodeType === "human_approval") {
    return (
      <ConfigGroup title="Aprovacao humana">
        <SelectField label="Tipo" value={String(config.type ?? "apply_ai_recommendation")} onChange={(value) => setConfigValue("type", value)} options={[{ value: "send_message", label: "Enviar mensagem" }, { value: "move_card", label: "Mover card" }, { value: "create_task", label: "Criar tarefa" }, { value: "apply_ai_recommendation", label: "Aplicar sugestao de IA" }]} />
        <TextConfigField label="Aprovador/solicitante" value={String(config.requestedBy ?? "{{event.payload.requestedBy}}")} onChange={(value) => setConfigValue("requestedBy", value)} />
        <TextConfigField label="SLA em dias" value={String(config.expiresInDays ?? "2")} onChange={(value) => setConfigValue("expiresInDays", Number(value) || 2)} />
        <TextConfigField label="Titulo" value={String(config.title ?? "Aprovar acao")} onChange={(value) => setConfigValue("title", value)} />
        <TextAreaConfigField label="Motivo e mensagem" value={String(config.description ?? "")} onChange={(value) => setConfigValue("description", value)} />
      </ConfigGroup>
    );
  }

  if (nodeType === "delay") {
    const delayFor = isRecord(config.delayFor) ? config.delayFor : {};
    return (
      <ConfigGroup title="Tempo">
        <TextConfigField label="Quantidade" value={String(delayFor.amount ?? "1")} onChange={(value) => setConfigValue("delayFor", { ...delayFor, amount: Number(value) || 1 })} />
        <SelectField label="Unidade" value={String(delayFor.unit ?? "days")} onChange={(value) => setConfigValue("delayFor", { ...delayFor, unit: value })} options={[{ value: "minutes", label: "Minutos" }, { value: "hours", label: "Horas" }, { value: "days", label: "Dias" }, { value: "weeks", label: "Semanas" }]} />
      </ConfigGroup>
    );
  }

  if (nodeType === "communication_send") {
    return (
      <ConfigGroup title="Comunicacao">
        <SelectField label="Canal" value={String(config.channel ?? "email")} onChange={(value) => setConfigValue("channel", value)} options={[{ value: "email", label: "E-mail" }, { value: "whatsapp", label: "WhatsApp" }]} />
        <TextConfigField label="Destinatario" value={String(config.to ?? "{{fields.contactEmail}}")} onChange={(value) => setConfigValue("to", value)} />
        <TextConfigField label="Template" value={String(config.templateKey ?? "")} onChange={(value) => setConfigValue("templateKey", value)} />
        <TextAreaConfigField label="Mensagem" value={String(config.body ?? "")} onChange={(value) => setConfigValue("body", value)} />
      </ConfigGroup>
    );
  }

  return (
    <ConfigGroup title="Configuracao">
      <p className="ast__inspector-muted">Use o painel avancado para configurar este no.</p>
    </ConfigGroup>
  );
}

function ConfigGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="ast__config-group">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function TextConfigField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="ast__inspector-label">
      <span>{label}</span>
      <TextInput value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function TextAreaConfigField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="ast__inspector-label">
      <span>{label}</span>
      <textarea className="ast__inspector-textarea ast__inspector-textarea--compact" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="ast__inspector-label">
      <span>{label}</span>
      <select className="ast__inspector-select" value={value} onChange={(event) => onChange(event.target.value)}>
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options.filter((option) => option.value).map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function CheckboxConfigField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="ast__checkbox-label">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function PanelHeader({ title, onRefresh }: { title: string; onRefresh: () => Promise<void> }) {
  return (
    <div className="automation-studio__panel-header">
      <h2>{title}</h2>
      <Button size="sm" variant="outline" onClick={() => void onRefresh()}>
        <AppIcon name="refresh" size={14} />
        Atualizar
      </Button>
    </div>
  );
}

function DataList<T>({ items, empty, render }: { items: T[]; empty: string; render: (item: T) => ReactNode }) {
  if (items.length === 0) {
    return <EmptyState className="automation-studio__empty-panel" size="compact">{empty}</EmptyState>;
  }

  return <div className="automation-studio__list">{items.map(render)}</div>;
}

export function WorkflowPreviewPanel({
  preview
}: {
  preview: ReturnType<typeof buildWorkflowPreview>;
}) {
  return (
    <section className="ast__preview">
      <div className="ast__preview-head">
        <h3>Preview de publicacao</h3>
        <StatusBadge size="sm" tone={preview.errors.length > 0 ? "danger" : preview.warnings.length > 0 ? "warning" : "success"}>
          {preview.errors.length > 0 ? "Bloqueado" : preview.warnings.length > 0 ? "Com avisos" : "Publicavel"}
        </StatusBadge>
      </div>
      {preview.errors.length > 0 ? (
        <ul className="ast__preview-list ast__preview-list--danger">
          {preview.errors.slice(0, 5).map((error) => <li key={error}>{error}</li>)}
        </ul>
      ) : null}
      {preview.warnings.length > 0 ? (
        <ul className="ast__preview-list">
          {preview.warnings.slice(0, 4).map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      ) : null}
      <ol className="ast__preview-steps">
        {preview.steps.map((step) => (
          <li key={step.id}>
            <span>{step.index}</span>
            <div>
              <strong>{step.label}</strong>
              <small>{step.description}</small>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
