import { useCallback, useEffect, useMemo, useState } from "react";
import { applyEdgeChanges, type OnEdgesChange, type OnNodesChange, type XYPosition } from "@xyflow/react";
import { useWorkspace } from "@/modules/workspace";
import type {
  ApiBoardColumn,
  AutomationExecution,
  AutomationRule,
  AutomationView
} from "@/modules/workspace/model";
import { Button, FlowCanvas, LoadingState, StatusBadge, TextInput, WorkspaceFrame } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { buildBoardMetrics } from "@/entities/task";
import {
  ACTION_LABELS,
  AUTOMATION_NODE_TYPES,
  AUTOMATION_PALETTE,
  ActionConfig,
  AutomationIcon,
  CloseIcon,
  ConfirmDialog,
  PlusIcon,
  RecentExecutions,
  TRIGGER_LABELS,
  TrashIcon,
  TriggerConfig,
  asString,
  buildFallbackColumnsFromPerspectiveStatus,
  draftToRuleInput,
  emptyFlowDraft,
  normalizeColumnKeyFromSlug,
  normalizeKey,
  ruleToFlowDraft,
  summarizeAction,
  summarizeTrigger,
  type AutomationCanvasEdge,
  type AutomationCanvasNode,
  type AutomationCanvasNodeData,
  type AutomationCanvasNodeKind,
  type FlowDraft,
  type SelectedNode
} from "./automations-page.local";
import "./automations-page.css";

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AutomationsPage() {
  const {
    snapshot,
    isLoading,
    setAutomationStatus,
    fetchBoardColumns,
    listAutomationRules,
    listAutomationExecutions,
    listAutomationViews,
    runAutomationRule,
    createAutomationRule,
    updateAutomationRule,
    deleteAutomationRule
  } = useWorkspace();

  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [executions, setExecutions] = useState<AutomationExecution[]>([]);
  const [executionsLoading, setExecutionsLoading] = useState(true);
  const [views, setViews] = useState<AutomationView[]>([]);
  const [viewsLoading, setViewsLoading] = useState(true);
  const [boardColumns, setBoardColumns] = useState<ApiBoardColumn[]>([]);

  // Editor state
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [draft, setDraft] = useState<FlowDraft | null>(null);
  const [originalDraft, setOriginalDraft] = useState<FlowDraft | null>(null);
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [nodePositions, setNodePositions] = useState<Record<string, XYPosition>>({});

  // Action states
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Dialog state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingNavigate, setPendingNavigate] = useState<(() => void) | null>(null);

  // ─── Data loading ───────────────────────────────────────────────────────────

  const loadRules = useCallback(() => {
    setRulesLoading(true);
    listAutomationRules({ includeDisabled: true })
      .then(setRules)
      .catch(() => {})
      .finally(() => setRulesLoading(false));
  }, [listAutomationRules]);

  useEffect(() => { loadRules(); }, [loadRules]);

  useEffect(() => {
    listAutomationExecutions({ limit: 500 })
      .then(setExecutions)
      .catch(() => {})
      .finally(() => setExecutionsLoading(false));
  }, [listAutomationExecutions]);

  useEffect(() => {
    listAutomationViews()
      .then(setViews)
      .catch(() => setViews([]))
      .finally(() => setViewsLoading(false));
  }, [listAutomationViews]);

  useEffect(() => {
    fetchBoardColumns()
      .then((cols) => setBoardColumns(cols.filter((c) => c.isActive).sort((a, b) => a.order - b.order)))
      .catch(() => setBoardColumns([]));
  }, [fetchBoardColumns]);

  // ─── Views enrichment ───────────────────────────────────────────────────────

  const availableViews = useMemo<AutomationView[]>(() => {
    const activeViews = views.filter((v) => v.isActive);
    const byKey = new Map<string, AutomationView>();
    for (const view of activeViews) {
      const normalized = normalizeKey(view.key || view.name);
      if (!normalized) continue;
      const prev = byKey.get(normalized);
      if (!prev || prev.columns.length < view.columns.length) byKey.set(normalized, view);
    }

    const boardColumnById = new Map(boardColumns.map((c) => [c.id, c]));
    const perspectives = Array.isArray(snapshot?.boardConfig.perspectives)
      ? snapshot.boardConfig.perspectives
      : [];
    const boardColsByPerspKey = new Map<string, Array<{ id: string; key: string; name: string }>>();
    const fallbackColsByPerspKey = new Map<string, Array<{ id: string; key: string; name: string }>>();

    for (const perspective of perspectives) {
      if (!perspective || typeof perspective !== "object") continue;
      const entry = perspective as unknown as Record<string, unknown>;
      const perspKey = (typeof entry.id === "string" && entry.id) || (typeof entry.label === "string" && entry.label) || "";
      const normalized = normalizeKey(perspKey);
      if (!normalized) continue;

      const visibleIds = Array.isArray(entry.visibleBoardColumnIds)
        ? entry.visibleBoardColumnIds.filter((id): id is string => typeof id === "string")
        : [];
      const visibleCols = visibleIds
        .map((id) => boardColumnById.get(id))
        .filter((c): c is ApiBoardColumn => Boolean(c))
        .map((c) => ({ id: c.id, key: normalizeColumnKeyFromSlug(c.slug, c.name), name: c.name }))
        .filter((c) => c.key.length > 0);

      if (visibleCols.length > 0) boardColsByPerspKey.set(normalized, visibleCols);
      const fallback = buildFallbackColumnsFromPerspectiveStatus(entry);
      if (fallback.length > 0) fallbackColsByPerspKey.set(normalized, fallback);
    }

    return Array.from(byKey.values())
      .map((view) => {
        const nk = normalizeKey(view.key || view.name);
        const boardCols = boardColsByPerspKey.get(nk);
        if (boardCols && boardCols.length > 0) {
          return {
            ...view,
            columns: boardCols.map((c, i) => ({
              id: c.id, workspaceId: view.workspaceId, viewId: view.id, key: c.key,
              name: c.name, description: null, color: "var(--text-secondary)", position: i,
              isActive: true, isTerminal: i === boardCols.length - 1, settings: null,
              createdAt: view.createdAt, updatedAt: view.updatedAt
            }))
          };
        }
        if (view.columns.length > 0) return view;
        const fallback = fallbackColsByPerspKey.get(nk);
        if (!fallback || fallback.length === 0) return view;
        return {
          ...view,
          columns: fallback.map((c, i) => ({
            id: c.id, workspaceId: view.workspaceId, viewId: view.id, key: c.key,
            name: c.name, description: null, color: "var(--text-secondary)", position: i,
            isActive: true, isTerminal: i === fallback.length - 1, settings: null,
            createdAt: view.createdAt, updatedAt: view.updatedAt
          }))
        };
      })
      .sort((a, b) => a.position - b.position);
  }, [views, snapshot?.boardConfig.perspectives, boardColumns]);

  // ─── State options ──────────────────────────────────────────────────────────

  const stateOptions = useMemo(
    () => snapshot?.boardConfig.statuses.map((s) => ({ value: s.id, label: s.label })) ?? [],
    [snapshot]
  );

  // ─── Editor helpers ──────────────────────────────────────────────────────────

  const isDirty = useMemo(() => {
    if (!draft || !originalDraft) return false;
    return JSON.stringify(draft) !== JSON.stringify(originalDraft);
  }, [draft, originalDraft]);

  function doOpenRule(rule: AutomationRule) {
    const d = ruleToFlowDraft(rule);
    if (d.triggerType === "item.moved" && !d.triggerConfig.toViewKey && availableViews[0]) {
      const currentColumnKey = asString(d.triggerConfig.toColumnKey);
      const matchingView = availableViews.find((view) =>
        view.columns.some((column) => column.key === currentColumnKey)
      );
      const fallbackView = matchingView ?? availableViews[0];
      d.triggerConfig = {
        ...d.triggerConfig,
        toViewKey: fallbackView.key,
        toColumnKey: currentColumnKey || (fallbackView.columns[0]?.key ?? "")
      };
    }
    setDraft(d);
    setOriginalDraft(JSON.parse(JSON.stringify(d)) as FlowDraft);
    setSelectedRuleId(rule.id);
    setIsCreating(false);
    setSelectedNode(null);
    setSaveError(null);
  }

  function openRule(rule: AutomationRule) {
    if (isDirty) {
      setPendingNavigate(() => () => doOpenRule(rule));
      return;
    }
    doOpenRule(rule);
  }

  function startCreate() {
    const d = emptyFlowDraft();
    if (availableViews[0]) {
      d.triggerConfig = {
        type: d.triggerType,
        toViewKey: availableViews[0].key,
        toColumnKey: availableViews[0].columns[0]?.key ?? ""
      };
      const firstAction = d.actions[0];
      if (firstAction) {
        d.actions = [{
          ...firstAction,
          targetViewKey: availableViews[0].key,
          targetColumnKey: availableViews[0].columns[0]?.key ?? ""
        }];
      }
    }
    if (stateOptions[0] && d.actions[0]?.type === "set_work_item_state") {
      d.actions[0] = { ...d.actions[0], stateSlug: stateOptions[0].value };
    }
    setDraft(d);
    setOriginalDraft(null);
    setSelectedRuleId(null);
    setIsCreating(true);
    setSelectedNode({ kind: "trigger" });
    setSaveError(null);
  }

  function updateDraft(updates: Partial<FlowDraft>) {
    setDraft((prev) => prev ? { ...prev, ...updates } : prev);
  }

  function updateAction(index: number, updated: { type: string; [key: string]: unknown }) {
    setDraft((prev) => {
      if (!prev) return prev;
      const actions = [...prev.actions];
      actions[index] = updated;
      return { ...prev, actions };
    });
  }

  function addAction(position?: XYPosition) {
    const defaultAction: { type: string; [key: string]: unknown } = { type: "set_view_column" };
    if (availableViews[0]) {
      defaultAction.targetViewKey = availableViews[0].key;
      defaultAction.targetColumnKey = availableViews[0].columns[0]?.key ?? "";
    }
    const nextIndex = draft?.actions.length ?? 0;
    if (position) {
      setNodePositions((prev) => ({ ...prev, [`action-${nextIndex}`]: position }));
    }
    setDraft((prev) => prev ? { ...prev, actions: [...prev.actions, defaultAction] } : prev);
    setSelectedNode({ kind: "action", index: nextIndex });
  }

  function removeAction(index: number) {
    setDraft((prev) => {
      if (!prev || prev.actions.length <= 1) return prev;
      const actions = prev.actions.filter((_, i) => i !== index);
      return { ...prev, actions };
    });
    setNodePositions((prev) => {
      const next: Record<string, XYPosition> = {};
      Object.entries(prev).forEach(([id, position]) => {
        if (!id.startsWith("action-")) {
          next[id] = position;
          return;
        }
        const currentIndex = Number(id.slice("action-".length));
        if (Number.isNaN(currentIndex) || currentIndex === index) return;
        const nextIndex = currentIndex > index ? currentIndex - 1 : currentIndex;
        next[`action-${nextIndex}`] = position;
      });
      return next;
    });
    setSelectedNode(null);
  }

  // ─── Save / Delete / Toggle / Run ──────────────────────────────────────────

  async function handleSave() {
    if (!draft) return;
    if (draft.name.trim().length < 2) {
      setSaveError("O nome deve ter ao menos 2 caracteres.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const input = draftToRuleInput(draft);
      if (isCreating) {
        const created = await createAutomationRule(input);
        setRules((prev) => [created, ...prev]);
        setSelectedRuleId(created.id);
        setIsCreating(false);
        setOriginalDraft(JSON.parse(JSON.stringify(draft)) as FlowDraft);
      } else if (selectedRuleId) {
        const rule = rules.find((r) => r.id === selectedRuleId);
        const updated = await updateAutomationRule(selectedRuleId, {
          ...input,
          enabled: draft.enabled,
          priority: rule?.priority ?? draft.priority
        });
        setRules((prev) => prev.map((r) => (r.id === selectedRuleId ? updated : r)));
        setOriginalDraft(JSON.parse(JSON.stringify(draft)) as FlowDraft);
      }
    } catch {
      setSaveError("Erro ao salvar. Verifique os dados e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle() {
    if (!draft || !selectedRuleId) return;
    const next = draft.enabled ? "paused" : "active";
    const nextEnabled = !draft.enabled;
    setDraft((prev) => prev ? { ...prev, enabled: nextEnabled } : prev);
    setOriginalDraft((prev) => prev ? { ...prev, enabled: nextEnabled } : prev);
    setRules((prev) => prev.map((r) => r.id === selectedRuleId ? { ...r, enabled: nextEnabled } : r));
    try {
      await setAutomationStatus(selectedRuleId, next);
    } catch {
      setDraft((prev) => prev ? { ...prev, enabled: !nextEnabled } : prev);
      setRules((prev) => prev.map((r) => r.id === selectedRuleId ? { ...r, enabled: !nextEnabled } : r));
    }
  }

  async function confirmDelete() {
    if (!selectedRuleId) return;
    setDeleting(true);
    try {
      await deleteAutomationRule(selectedRuleId);
      setRules((prev) => prev.filter((r) => r.id !== selectedRuleId));
      setSelectedRuleId(null);
      setIsCreating(false);
      setDraft(null);
      setOriginalDraft(null);
      setSelectedNode(null);
      setShowDeleteConfirm(false);
    } catch {
      setSaveError("Não foi possível remover a automação.");
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  }

  async function handleRunTest() {
    if (!selectedRuleId) return;
    setRunningId(selectedRuleId);
    try {
      await runAutomationRule(selectedRuleId);
    } finally {
      setRunningId(null);
    }
  }

  async function handleSidebarToggle(rule: AutomationRule, e: React.MouseEvent) {
    e.stopPropagation();
    const next = rule.enabled ? "paused" : "active";
    setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, enabled: !rule.enabled } : r));
    if (selectedRuleId === rule.id && draft) {
      setDraft((prev) => prev ? { ...prev, enabled: !rule.enabled } : prev);
      setOriginalDraft((prev) => prev ? { ...prev, enabled: !rule.enabled } : prev);
    }
    try {
      await setAutomationStatus(rule.id, next);
    } catch {
      setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, enabled: rule.enabled } : r));
    }
  }

  // ─── Derived ────────────────────────────────────────────────────────────────

  const metrics = buildBoardMetrics(snapshot?.tasks ?? []);
  const pageLoading = isLoading || rulesLoading || viewsLoading;
  const selectedRule = rules.find((r) => r.id === selectedRuleId) ?? null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const executionsToday = executions.filter((e) => new Date(e.createdAt) >= today).length;
  const failuresToday = executions.filter((e) => new Date(e.createdAt) >= today && e.status === "failed").length;

  const isNodeConfigured = (node: SelectedNode): boolean => {
    if (!draft) return false;
    if (node.kind === "trigger") {
      if (draft.triggerType === "item.moved") {
        return !!(draft.triggerConfig.toViewKey && draft.triggerConfig.toColumnKey);
      }
      return true;
    }
    const action = draft.actions[node.index];
    if (!action) return false;
    const type = asString(action.type);
    if (type === "set_work_item_state") return !!(asString(action.stateSlug) || asString(action.status));
    if (type === "set_view_column") return !!(asString(action.targetViewKey) && asString(action.targetColumnKey));
    if (type === "remove_from_view") return !!asString(action.targetViewKey);
    if (type === "create_document") return !!asString(action.kind);
    if (type === "update_document_status") return !!(asString(action.kind) && asString(action.status));
    if (type === "create_billing_order") return true;
    return false;
  };

  const selectedNodeId =
    selectedNode?.kind === "trigger"
      ? "trigger"
      : selectedNode?.kind === "action"
        ? `action-${selectedNode.index}`
        : null;

  const automationNodes = useMemo<AutomationCanvasNode[]>(() => {
    if (!draft) return [];

    const triggerSelected = selectedNodeId === "trigger";
    const nodes: AutomationCanvasNode[] = [
      {
        id: "trigger",
        type: "trigger",
        position: nodePositions.trigger ?? { x: 180, y: 40 },
        data: {
          kind: "trigger",
          label: TRIGGER_LABELS[draft.triggerType] ?? "Gatilho",
          summary: summarizeTrigger(draft, availableViews),
          configured: isNodeConfigured({ kind: "trigger" })
        },
        selected: triggerSelected,
        deletable: false
      }
    ];

    draft.actions.forEach((action, index) => {
      const id = `action-${index}`;
      nodes.push({
        id,
        type: "action",
        position: nodePositions[id] ?? { x: 180, y: 220 + index * 180 },
        data: {
          kind: "action",
          index,
          label: ACTION_LABELS[asString(action.type)] ?? "Acao",
          summary: summarizeAction(action, availableViews, stateOptions),
          configured: isNodeConfigured({ kind: "action", index })
        },
        selected: selectedNodeId === id,
        deletable: draft.actions.length > 1
      });
    });

    return nodes;
  }, [availableViews, draft, nodePositions, selectedNodeId, stateOptions]);

  const automationEdges = useMemo<AutomationCanvasEdge[]>(() => {
    if (!draft) return [];
    return draft.actions.map((_, index) => {
      const source = index === 0 ? "trigger" : `action-${index - 1}`;
      const target = `action-${index}`;
      return {
        id: `edge-${source}-${target}`,
        source,
        target,
        type: "smoothstep",
        animated: true,
        markerEnd: { type: "arrowclosed" as const, width: 14, height: 14 }
      };
    });
  }, [draft]);

  const handleAutomationNodesChange: OnNodesChange<AutomationCanvasNode> = useCallback((changes) => {
    setNodePositions((prev) => {
      let next = prev;
      for (const change of changes) {
        if (change.type !== "position" || !change.position) continue;
        if (next === prev) next = { ...prev };
        next[change.id] = change.position;
      }
      return next;
    });
  }, []);

  const handleAutomationEdgesChange: OnEdgesChange<AutomationCanvasEdge> = useCallback((changes) => {
    applyEdgeChanges(changes, automationEdges);
  }, [automationEdges]);

  const handleAutomationNodesAdd = useCallback((nodes: AutomationCanvasNode[]) => {
    const actionNode = nodes.find((node) => node.type === "action");
    if (actionNode) addAction(actionNode.position);
  }, [addAction]);

  const handleAutomationNodeSelect = useCallback((nodeId: string | null) => {
    if (!nodeId) {
      setSelectedNode(null);
      return;
    }
    if (nodeId === "trigger") {
      setSelectedNode({ kind: "trigger" });
      return;
    }
    if (nodeId.startsWith("action-")) {
      const index = Number(nodeId.slice("action-".length));
      if (!Number.isNaN(index)) setSelectedNode({ kind: "action", index });
    }
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <AppShell
      metrics={metrics}
      noPageScroll
      hideSidebarBrandMark
      hidePageHeader
    >
      <WorkspaceFrame className="flow-editor">
        <LoadingState
          text="Carregando automações..."
          animation="automation"
          variant="frame"
          visible={pageLoading}
        />
        {/* ── Sidebar ── */}
        <aside className="flow-sidebar">
          <div className="flow-sidebar__header">
            <span className="flow-sidebar__title">
              <AutomationIcon size={14} />
              Automações
            </span>
            <div className="flow-sidebar__meta">
              <span className="flow-sidebar__stat">
                {rules.filter((r) => r.enabled).length} ativas
              </span>
            </div>
          </div>

          <button
            className="flow-sidebar__create-btn"
            type="button"
            onClick={startCreate}
          >
            <PlusIcon size={14} />
            Nova automação
          </button>

          <div className="flow-sidebar__list">
            {rules.length === 0 ? (
              <div className="flow-sidebar__empty">
                Nenhuma automação. Crie a primeira!
              </div>
            ) : (
              rules.map((rule) => {
                const isActive = rule.id === selectedRuleId || (isCreating && !rule.id);
                return (
                  <div
                    key={rule.id}
                    className={`flow-sidebar__item${isActive ? " flow-sidebar__item--active" : ""}`}
                    onClick={() => openRule(rule)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === "Enter" && openRule(rule)}
                  >
                    <div className="flow-sidebar__item-main">
                      <span className="flow-sidebar__item-name">{rule.name}</span>
                      <span className="flow-sidebar__item-trigger">
                        {TRIGGER_LABELS[rule.triggerType] ?? rule.triggerType}
                      </span>
                    </div>
                    <button
                      className={`flow-sidebar__toggle${rule.enabled ? " flow-sidebar__toggle--on" : ""}`}
                      type="button"
                      onClick={(e) => void handleSidebarToggle(rule, e)}
                      aria-label={rule.enabled ? "Pausar" : "Ativar"}
                      title={rule.enabled ? "Pausar" : "Ativar"}
                    >
                      <span className="flow-sidebar__toggle-knob" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {!executionsLoading && (
            <RecentExecutions executions={executions} rules={rules} />
          )}

          <div className="flow-sidebar__stats">
            <div className="flow-sidebar__stat-row">
              <span>Execuções hoje</span>
              <strong>{executionsLoading ? "—" : executionsToday}</strong>
            </div>
            <div className="flow-sidebar__stat-row">
              <span>Falhas hoje</span>
              <strong className={failuresToday > 0 ? "flow-sidebar__stat--warn" : ""}>{executionsLoading ? "—" : failuresToday}</strong>
            </div>
          </div>
        </aside>

        {/* ── Canvas ── */}
        <div className="flow-canvas">
          {!draft ? (
            <div className="flow-canvas__empty">
              <div className="flow-canvas__empty-icon">
                <AutomationIcon size={40} />
              </div>
              <h2 className="flow-canvas__empty-title">Editor de fluxo</h2>
              <p className="flow-canvas__empty-desc">
                Selecione uma automação na lista ou crie uma nova para começar.
              </p>
              <Button type="button" onClick={startCreate}>
                <PlusIcon size={14} />
                Nova automação
              </Button>
            </div>
          ) : (
            <>
              {/* Canvas header */}
              <div className="flow-canvas__header">
                <div className="flow-canvas__header-left">
                  {isCreating ? (
                    <TextInput
                      className="flow-canvas__name-input"
                      value={draft.name}
                      onChange={(e) => updateDraft({ name: e.target.value })}
                      placeholder="Nome da automação..."
                    />
                  ) : (
                    <h2 className="flow-canvas__name">{draft.name}</h2>
                  )}
                  {!isCreating && (
                    <StatusBadge tone={draft.enabled ? "success" : "warning"}>
                      {draft.enabled ? "Ativa" : "Pausada"}
                    </StatusBadge>
                  )}
                </div>
                <div className="flow-canvas__header-actions">
                  {saveError && <span className="flow-canvas__error">{saveError}</span>}
                  {!isCreating && selectedRuleId && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => void handleToggle()}
                        disabled={saving || deleting}
                      >
                        {draft.enabled ? "Pausar" : "Ativar"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={runningId === selectedRuleId}
                        onClick={() => void handleRunTest()}
                      >
                        {runningId === selectedRuleId ? "Executando..." : "Testar"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={saving || deleting}
                      >
                        <TrashIcon size={14} />
                      </Button>
                    </>
                  )}
                  {(isCreating || isDirty) && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void handleSave()}
                      disabled={saving || deleting}
                    >
                      {saving ? "Salvando..." : isCreating ? "Criar automação" : "Salvar"}
                    </Button>
                  )}
                </div>
              </div>

              {/* Flow nodes */}
              <div className="flow-canvas__body">
                <FlowCanvas<AutomationCanvasNodeData, AutomationCanvasNodeKind>
                  nodes={automationNodes}
                  edges={automationEdges}
                  nodeTypes={AUTOMATION_NODE_TYPES}
                  paletteItems={AUTOMATION_PALETTE}
                  onNodesChange={handleAutomationNodesChange}
                  onEdgesChange={handleAutomationEdgesChange}
                  onEdgesAdd={() => undefined}
                  onNodesAdd={handleAutomationNodesAdd}
                  onNodeSelect={handleAutomationNodeSelect}
                  fitViewKey={draft.actions.length}
                  emptyHint="Use o painel a esquerda para adicionar etapas na automacao"
                  paletteTitle="Adicionar etapa"
                />
              </div>
            </>
          )}
        </div>

        {/* ── Config Panel ── */}
        {draft && selectedNode && (
          <div className="flow-config-panel">
            <div className="config-panel__header">
              <span className="config-panel__title">
                {selectedNode.kind === "trigger" ? "Configurar gatilho" : "Configurar ação"}
              </span>
              <div className="config-panel__actions">
                {selectedNode.kind === "action" && draft.actions.length > 1 && (
                  <button
                    type="button"
                    className="config-panel__close config-panel__close--danger"
                    onClick={() => removeAction(selectedNode.index)}
                    aria-label="Remover acao"
                    title="Remover acao"
                  >
                    <TrashIcon size={14} />
                  </button>
                )}
                <button
                  type="button"
                  className="config-panel__close"
                  onClick={() => setSelectedNode(null)}
                  aria-label="Fechar painel"
                >
                  <CloseIcon size={15} />
                </button>
              </div>
            </div>

            <div className="config-panel__section">
              {selectedNode.kind === "trigger" ? (
                <TriggerConfig
                  draft={draft}
                  views={availableViews}
                  onChange={updateDraft}
                />
              ) : (
                <ActionConfig
                  action={draft.actions[selectedNode.index] ?? { type: "set_view_column" }}
                  views={availableViews}
                  stateOptions={stateOptions}
                  onChange={(updated) => updateAction(selectedNode.index, updated)}
                />
              )}
            </div>
          </div>
        )}
      </WorkspaceFrame>

      {/* ── Delete confirmation dialog ── */}
      {showDeleteConfirm && draft && (
        <ConfirmDialog
          variant="danger"
          title="Remover automação"
          description={`"${draft.name}" será removida permanentemente. Esta ação não pode ser desfeita.`}
          confirmLabel="Remover automação"
          loading={deleting}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {/* ── Unsaved changes dialog ── */}
      {pendingNavigate && (
        <ConfirmDialog
          variant="warning"
          title="Alterações não salvas"
          description="Você tem mudanças que ainda não foram salvas. Deseja descartá-las e continuar?"
          confirmLabel="Descartar e continuar"
          cancelLabel="Ficar e salvar"
          onConfirm={() => {
            const navigate = pendingNavigate;
            setPendingNavigate(null);
            navigate();
          }}
          onCancel={() => setPendingNavigate(null)}
        />
      )}
    </AppShell>
  );
}
