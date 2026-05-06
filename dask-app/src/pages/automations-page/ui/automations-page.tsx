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
import { AppIcon, Button, FlowCanvas, FlowNodeCard, LoadingState, StatusBadge, TextInput, WorkspaceFrame } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import "./automations-page.css";

type StudioTab = "flows" | "runs" | "approvals" | "inbox" | "templates" | "contacts" | "settings";
type AutomationNodeType =
  | "trigger"
  | "condition"
  | "delay"
  | "noop"
  | "end"
  | "communication_send"
  | "human_approval"
  | "ai_summarize_context"
  | "ai_classify_reply"
  | "ai_extract_intent"
  | "ai_generate_message_draft"
  | "ai_recommend_next_action"
  | "ai_fill_template_variables";

type AutomationCanvasData = Record<string, unknown> & {
  nodeType: AutomationNodeType;
  label: string;
  summary: string;
  config: Record<string, unknown>;
};

type AutomationCanvasNode = Node<AutomationCanvasData, AutomationNodeType>;

const studioTabs: Array<{ id: StudioTab; label: string; icon: Parameters<typeof AppIcon>[0]["name"] }> = [
  { id: "flows", label: "Fluxos", icon: "automation" },
  { id: "runs", label: "Execucoes", icon: "list-ordered" },
  { id: "approvals", label: "Aprovacoes", icon: "square-check" },
  { id: "inbox", label: "Inbox", icon: "message" },
  { id: "templates", label: "Templates", icon: "template" },
  { id: "contacts", label: "Contatos", icon: "users" },
  { id: "settings", label: "Configuracoes", icon: "settings" }
];

const nodeCatalog: Array<{
  type: AutomationNodeType;
  label: string;
  description: string;
  color: string;
  icon: Parameters<typeof AppIcon>[0]["name"];
}> = [
  { type: "trigger", label: "Gatilho", description: "Entrada do workflow", color: "#2563eb", icon: "zap" },
  { type: "condition", label: "Condicao", description: "Roteamento por regra", color: "#ca8a04", icon: "list-checks" },
  { type: "delay", label: "Delay", description: "Espera duravel", color: "#7c3aed", icon: "calendar-check" },
  { type: "communication_send", label: "Enviar mensagem", description: "E-mail ou WhatsApp", color: "#059669", icon: "send" },
  { type: "human_approval", label: "Aprovacao humana", description: "Aprovar antes do efeito", color: "#dc2626", icon: "square-check" },
  { type: "ai_classify_reply", label: "IA: classificar", description: "Classifica resposta", color: "#4f46e5", icon: "bot" },
  { type: "ai_generate_message_draft", label: "IA: rascunho", description: "Gera rascunho", color: "#0891b2", icon: "bot" },
  { type: "noop", label: "Sem operacao", description: "Passo tecnico", color: "#64748b", icon: "code" },
  { type: "end", label: "Fim", description: "Finaliza o caminho", color: "#475569", icon: "check" }
];

const nodeMeta = new Map(nodeCatalog.map((node) => [node.type, node]));

const defaultGraph: AutomationWorkflowGraph = {
  version: 1,
  nodes: [
    {
      id: "trigger-manual",
      type: "trigger",
      label: "Execucao manual",
      config: { triggerType: "manual" },
      position: { x: 120, y: 120 }
    },
    {
      id: "end",
      type: "end",
      label: "Fim",
      config: {},
      position: { x: 120, y: 320 }
    }
  ],
  edges: [{ id: "edge-trigger-end", source: "trigger-manual", target: "end" }],
  metadata: {}
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

function readVersionGraph(version: AutomationWorkflowVersion | null): AutomationWorkflowGraph {
  if (!version) return defaultGraph;
  const definitionGraph = isRecord(version.definitionJson.graph) ? version.definitionJson.graph : null;
  const nodes = Array.isArray(definitionGraph?.nodes) ? definitionGraph.nodes : version.graphNodesJson;
  const edges = Array.isArray(definitionGraph?.edges) ? definitionGraph.edges : version.graphEdgesJson;
  return {
    version: 1,
    nodes: (Array.isArray(nodes) ? nodes : []).map((node, index) => normalizeGraphNode(node, index)),
    edges: (Array.isArray(edges) ? edges : []).map((edge, index) => normalizeGraphEdge(edge, index)),
    metadata: isRecord(definitionGraph?.metadata) ? definitionGraph.metadata : {}
  };
}

function normalizeGraphNode(value: unknown, index: number): AutomationWorkflowGraphNode {
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

function graphToCanvas(graph: AutomationWorkflowGraph): { nodes: AutomationCanvasNode[]; edges: Edge[] } {
  return {
    nodes: graph.nodes.map((node, index) => {
      const type = node.type as AutomationNodeType;
      const meta = nodeMeta.get(type) ?? nodeMeta.get("noop")!;
      return {
        id: node.id,
        type,
        position: node.position ?? { x: 120 + index * 220, y: 120 },
        data: {
          nodeType: type,
          label: node.label ?? meta.label,
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

function AutomationNode({ data, selected }: NodeProps) {
  const nodeData = data as AutomationCanvasData;
  const meta = nodeMeta.get(nodeData.nodeType) ?? nodeMeta.get("noop")!;
  return (
    <FlowNodeCard
      kind={nodeData.nodeType}
      typeLabel={meta.label}
      label={nodeData.label}
      meta={nodeData.summary}
      icon={<AppIcon name={meta.icon} size={14} />}
      selected={selected}
      target={nodeData.nodeType !== "trigger"}
      source={nodeData.nodeType !== "end"}
      branches={nodeData.nodeType === "condition" ? [
        { id: "true", label: "Sim", tone: "true" },
        { id: "false", label: "Nao", tone: "false" }
      ] : undefined}
    />
  );
}

const automationNodeTypes = nodeCatalog.reduce<Record<string, typeof AutomationNode>>((acc, node) => {
  acc[node.type] = AutomationNode;
  return acc;
}, {});

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

  const selectedWorkflow = workflows.find((workflow) => workflow.id === selectedWorkflowId) ?? null;
  const selectedVersion = versions.find((version) => version.id === selectedVersionId) ?? null;
  const selectedNode = canvasNodes.find((node) => node.id === selectedNodeId) ?? null;
  const hasDraft = versions.some((version) => version.status === "draft");
  const currentVersion = versions.find((version) => version.id === selectedWorkflow?.currentVersionId) ?? null;

  const loadWorkflows = useCallback(async () => {
    const result = await listAutomationWorkflows({ limit: 200 });
    setWorkflows(result.items);
    setSelectedWorkflowId((current) => current ?? result.items[0]?.id ?? null);
  }, [listAutomationWorkflows]);

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
    const graph = readVersionGraph(selectedVersion);
    const next = graphToCanvas(graph);
    setCanvasNodes(next.nodes);
    setCanvasEdges(next.edges);
    setSelectedNodeId(null);
    setFitViewKey((value) => value + 1);
  }, [selectedVersion]);

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
    setBusy(true);
    setFeedback(null);
    try {
      const workflow = await createAutomationWorkflow({
        name: `Novo fluxo ${workflows.length + 1}`,
        status: "draft"
      });
      await createAutomationWorkflowDraftVersion(workflow.id, {
        graph: defaultGraph,
        definition: { graph: defaultGraph }
      });
      await loadWorkflows();
      setSelectedWorkflowId(workflow.id);
      setFeedback("Fluxo criado.");
    } finally {
      setBusy(false);
    }
  }, [createAutomationWorkflow, createAutomationWorkflowDraftVersion, loadWorkflows, workflows.length]);

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
  }, [handleSaveWorkflow, loadVersions, loadWorkflows, publishAutomationWorkflowVersion, selectedVersion, selectedWorkflow]);

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
    setCanvasNodes((nodes) => nodes.map((node) => {
      if (node.id !== selectedNode.id) return node;
      return {
        ...node,
        data: {
          ...node.data,
          config: parsed,
          summary: summarizeConfig(parsed)
        }
      };
    }));
  }, [configText, selectedNode]);

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

  if (isLoading) {
    return <LoadingState text="Carregando Automation Studio" animation="automation" />;
  }

  return (
    <AppShell
      metrics={metrics}
      pageLabel="Automation Studio"
      pageTitle="Automacoes"
      noPageScroll
      hidePageHeader
    >
      <WorkspaceFrame className="automation-studio">
        <header className="automation-studio__header">
          <div>
            <span>Automation Studio</span>
            <strong>Workflow versionado</strong>
          </div>
          <nav className="automation-studio__tabs" aria-label="Automation Studio">
            {studioTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={activeTab === tab.id ? "is-active" : ""}
                onClick={() => setActiveTab(tab.id)}
              >
                <AppIcon name={tab.icon} size={15} />
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </header>

        {activeTab === "flows" ? (
          <section className="automation-studio__flows">
            <aside className="automation-studio__sidebar">
              <button className="automation-studio__create" type="button" onClick={handleCreateWorkflow} disabled={busy}>
                <AppIcon name="plus" size={16} />
                <span>Novo fluxo</span>
              </button>
              <div className="automation-studio__workflow-list">
                {workflows.map((workflow) => (
                  <button
                    key={workflow.id}
                    type="button"
                    className={workflow.id === selectedWorkflowId ? "is-active" : ""}
                    onClick={() => setSelectedWorkflowId(workflow.id)}
                  >
                    <span>{workflow.name}</span>
                    <StatusBadge size="sm" tone={statusTone(workflow.status)}>{workflow.status}</StatusBadge>
                  </button>
                ))}
              </div>
            </aside>

            <main className="automation-studio__editor">
              {selectedWorkflow ? (
                <>
                  <div className="automation-studio__toolbar">
                    <div className="automation-studio__fields">
                      <TextInput value={workflowName} onChange={(event) => setWorkflowName(event.target.value)} />
                      <TextInput value={workflowDescription} onChange={(event) => setWorkflowDescription(event.target.value)} placeholder="Descricao" />
                    </div>
                    <div className="automation-studio__actions">
                      <StatusBadge tone={statusTone(selectedWorkflow.status)}>{selectedWorkflow.status}</StatusBadge>
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange("active")} disabled={busy || !currentVersion}>Ativar</Button>
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange("paused")} disabled={busy}>Pausar</Button>
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange("archived")} disabled={busy}>Arquivar</Button>
                      <Button size="sm" variant="outline" onClick={handleCloneVersion} disabled={busy || !selectedVersion}>Clonar</Button>
                      <Button size="sm" variant="outline" onClick={handleRun} disabled={busy || selectedWorkflow.status !== "active" || !currentVersion}>Executar teste</Button>
                      <Button size="sm" variant="outline" onClick={handleSaveWorkflow} disabled={busy || selectedVersion?.status !== "draft"}>Salvar draft</Button>
                      <Button size="sm" variant="primary" onClick={handlePublish} disabled={busy || selectedVersion?.status !== "draft"}>Publicar</Button>
                    </div>
                  </div>

                  <div className="automation-studio__version-bar">
                    {versions.map((version) => (
                      <button
                        key={version.id}
                        type="button"
                        className={version.id === selectedVersionId ? "is-active" : ""}
                        onClick={() => setSelectedVersionId(version.id)}
                      >
                        <span>v{version.version}</span>
                        <StatusBadge size="sm" tone={statusTone(version.status)}>{version.status}</StatusBadge>
                      </button>
                    ))}
                    {!hasDraft ? (
                      <button type="button" onClick={() => void (async () => {
                        const draft = await createAutomationWorkflowDraftVersion(selectedWorkflow.id, { graph: defaultGraph, definition: { graph: defaultGraph } });
                        await loadVersions(selectedWorkflow.id);
                        setSelectedVersionId(draft.id);
                      })()}>
                        <AppIcon name="plus" size={14} />
                        <span>Draft</span>
                      </button>
                    ) : null}
                    {feedback ? <span className="automation-studio__feedback">{feedback}</span> : null}
                  </div>

                  <div className="automation-studio__canvas-row">
                    <FlowCanvas<AutomationCanvasData, AutomationNodeType>
                      nodes={canvasNodes}
                      edges={canvasEdges}
                      nodeTypes={automationNodeTypes}
                      paletteItems={nodeCatalog.map((node) => ({
                        kind: node.type,
                        label: node.label,
                        description: node.description,
                        color: node.color,
                        buildData: () => ({
                          nodeType: node.type,
                          label: node.label,
                          summary: "Sem configuracao",
                          config: {}
                        })
                      }))}
                      onNodesChange={onNodesChange}
                      onEdgesChange={onEdgesChange}
                      onEdgesAdd={setCanvasEdges}
                      onNodesAdd={(nodes) => setCanvasNodes((current) => [...current, ...nodes])}
                      onNodeSelect={setSelectedNodeId}
                      fitViewKey={fitViewKey}
                      paletteTitle="Adicionar no"
                      paletteEyebrow="Workflow"
                      sidebarDefaultOpen
                    />

                    <aside className="automation-studio__inspector">
                      {selectedNode ? (
                        <>
                          <label>
                            <span>Rotulo</span>
                            <TextInput
                              value={selectedNode.data.label}
                              onChange={(event) => setCanvasNodes((nodes) => nodes.map((node) => (
                                node.id === selectedNode.id
                                  ? { ...node, data: { ...node.data, label: event.target.value } }
                                  : node
                              )))}
                            />
                          </label>
                          <label>
                            <span>Config JSON</span>
                            <textarea value={configText} onChange={(event) => setConfigText(event.target.value)} />
                          </label>
                          <Button size="sm" variant="outline" onClick={handleApplyConfig}>Aplicar</Button>
                        </>
                      ) : (
                        <div className="automation-studio__empty-panel">Selecione um no.</div>
                      )}
                    </aside>
                  </div>
                </>
              ) : (
                <div className="automation-studio__empty-panel">Nenhum fluxo criado.</div>
              )}
            </main>
          </section>
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
                  <div className="automation-studio__empty-panel">Abra uma execucao.</div>
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
                  <div className="automation-studio__empty-panel">Abra uma conversa.</div>
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
    return <div className="automation-studio__empty-panel">{empty}</div>;
  }

  return <div className="automation-studio__list">{items.map(render)}</div>;
}
