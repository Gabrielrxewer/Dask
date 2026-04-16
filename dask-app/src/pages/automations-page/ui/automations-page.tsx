import { useCallback, useEffect, useMemo, useState } from "react";
import { buildBoardMetrics } from "@/entities/task";
import { useWorkspace } from "@/modules/workspace";
import type {
  ApiBoardColumn,
  AutomationExecution,
  AutomationRule,
  AutomationView,
  CreateAutomationRuleInput
} from "@/modules/workspace/model";
import {
  Button,
  Card,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHeader,
  DataTableRow,
  EmptyState,
  FormField,
  LoadingState,
  ModalShell,
  Section,
  Select,
  StatusBadge,
  TextInput
} from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { BoardMetrics } from "@/widgets/board-metrics";
import "./automations-page.css";

const TRIGGER_LABELS: Record<string, string> = {
  "item.created": "Ao criar item",
  "item.updated": "Ao atualizar item",
  "item.moved": "Ao mover item",
  "item.state.changed": "Ao mudar estado",
  "manual": "Execucao manual"
};

const ACTION_LABELS: Record<string, string> = {
  "set_work_item_state": "Alterar estado do item",
  "set_view_column": "Mostrar tambem em outra coluna/perspectiva",
  "remove_from_view": "Remover da visao"
};

const EXECUTION_STATUS_TONE: Record<string, "success" | "warning" | "default"> = {
  completed: "success",
  failed: "warning",
  running: "default",
  pending: "default"
};

function labelTrigger(type: string) {
  return TRIGGER_LABELS[type] ?? type;
}

function labelAction(type: string) {
  return ACTION_LABELS[type] ?? type;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function extractActions(rule: AutomationRule): string {
  const actions = rule.actions;
  if (!Array.isArray(actions)) return "-";
  return actions
    .map((a) => {
      if (typeof a === "object" && a !== null && "type" in a) {
        return labelAction(String((a as Record<string, unknown>).type));
      }
      return "-";
    })
    .join(", ");
}

function formatDatePt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildFallbackColumnsFromPerspectiveStatus(
  perspective: unknown
): Array<{ id: string; key: string; name: string }> {
  if (!perspective || typeof perspective !== "object" || Array.isArray(perspective)) {
    return [];
  }

  const rawPerspective = perspective as Record<string, unknown>;
  const rawStatuses = Array.isArray(rawPerspective.statuses) ? rawPerspective.statuses : [];
  const perspectiveId =
    typeof rawPerspective.id === "string" && rawPerspective.id.trim().length > 0
      ? rawPerspective.id
      : "view";

  return rawStatuses
    .map((status, index) => {
      if (!status || typeof status !== "object" || Array.isArray(status)) {
        return null;
      }

      const entry = status as Record<string, unknown>;
      const id = typeof entry.id === "string" ? entry.id : "";
      const label = typeof entry.label === "string" ? entry.label : id;
      const key = normalizeKey(id);

      if (!key || !label) {
        return null;
      }

      return {
        id: `fallback-${perspectiveId}-${key}-${index}`,
        key,
        name: label
      };
    })
    .filter((column): column is { id: string; key: string; name: string } => column !== null);
}

interface CreateDialogProps {
  mode: "create" | "edit";
  initialRule?: AutomationRule;
  views: AutomationView[];
  stateOptions: Array<{ value: string; label: string }>;
  onClose: () => void;
  onSubmit: (input: CreateAutomationRuleInput) => Promise<void>;
  onDelete?: () => Promise<void>;
}

function CreateAutomationDialog({
  mode,
  initialRule,
  views,
  stateOptions,
  onClose,
  onSubmit,
  onDelete
}: CreateDialogProps) {
  const trigger = asRecord(initialRule?.trigger);
  const actions = Array.isArray(initialRule?.actions) ? initialRule.actions : [];
  const firstAction = asRecord(actions[0]);

  const initialTriggerType = asString(trigger.type) || initialRule?.triggerType || "item.moved";
  const initialActionType = asString(firstAction.type) || "set_view_column";

  const [name, setName] = useState(initialRule?.name ?? "");
  const [triggerType, setTriggerType] = useState(initialTriggerType);
  const [actionType, setActionType] = useState(initialActionType);
  const [sourceViewKey, setSourceViewKey] = useState(asString(trigger.toViewKey));
  const [sourceColumnKey, setSourceColumnKey] = useState(asString(trigger.toColumnKey));
  const [stateSlug, setStateSlug] = useState(
    asString(firstAction.stateSlug) || asString(firstAction.status) || stateOptions[0]?.value || ""
  );
  const [viewKey, setViewKey] = useState(asString(firstAction.targetViewKey));
  const [columnKey, setColumnKey] = useState(asString(firstAction.targetColumnKey));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceColumns = views.find((view) => view.key === sourceViewKey)?.columns ?? [];
  const targetColumns = views.find((view) => view.key === viewKey)?.columns ?? [];

  useEffect(() => {
    const firstView = views[0]?.key ?? "";
    if (!sourceViewKey && firstView) {
      setSourceViewKey(firstView);
    }
    if (!viewKey && firstView) {
      setViewKey(firstView);
    }
  }, [views, sourceViewKey, viewKey]);

  useEffect(() => {
    const firstSourceColumn = sourceColumns[0]?.key ?? "";
    if (firstSourceColumn && !sourceColumns.some((column) => column.key === sourceColumnKey)) {
      setSourceColumnKey(firstSourceColumn);
    }
  }, [sourceColumns, sourceColumnKey]);

  useEffect(() => {
    const firstTargetColumn = targetColumns[0]?.key ?? "";
    if (firstTargetColumn && !targetColumns.some((column) => column.key === columnKey)) {
      setColumnKey(firstTargetColumn);
    }
  }, [targetColumns, columnKey]);

  useEffect(() => {
    if (stateOptions.length === 0) {
      return;
    }

    if (!stateOptions.some((state) => state.value === stateSlug)) {
      setStateSlug(stateOptions[0].value);
    }
  }, [stateOptions, stateSlug]);

  function buildAction(): { type: string; [key: string]: unknown } {
    if (actionType === "set_work_item_state") {
      return { type: "set_work_item_state", stateSlug };
    }
    if (actionType === "set_view_column") {
      return { type: "set_view_column", targetViewKey: viewKey, targetColumnKey: columnKey };
    }
    return { type: "remove_from_view", targetViewKey: viewKey };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError("O nome deve ter ao menos 2 caracteres.");
      return;
    }
    if (triggerType === "item.moved" && (!sourceViewKey || !sourceColumnKey)) {
      setError("Escolha a perspectiva e a coluna de origem para o gatilho.");
      return;
    }
    if ((actionType === "set_view_column" || actionType === "remove_from_view") && views.length === 0) {
      setError("Nenhuma perspectiva disponivel para configurar essa acao.");
      return;
    }
    if (actionType === "set_work_item_state" && !stateSlug.trim()) {
      setError("Escolha o estado de destino.");
      return;
    }
    if ((actionType === "set_view_column" || actionType === "remove_from_view") && !viewKey.trim()) {
      setError("Escolha a perspectiva de destino.");
      return;
    }
    if (actionType === "set_view_column" && !columnKey.trim()) {
      setError("Escolha a coluna de destino.");
      return;
    }

    setSaving(true);
    try {
      const conditions =
        triggerType === "item.moved" && sourceColumnKey
          ? { toColumnKeys: [sourceColumnKey] }
          : undefined;

      await onSubmit({
        name: name.trim(),
        trigger:
          triggerType === "item.moved"
            ? { type: triggerType, toViewKey: sourceViewKey, toColumnKey: sourceColumnKey }
            : { type: triggerType },
        conditions,
        actions: [buildAction()],
        enabled: initialRule?.enabled ?? true
      });
    } catch {
      setError(
        mode === "create"
          ? "Erro ao criar automacao. Verifique os dados e tente novamente."
          : "Erro ao atualizar automacao. Verifique os dados e tente novamente."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete || !initialRule) {
      return;
    }

    const confirmed = window.confirm(`Remover a automacao "${initialRule.name}"?`);
    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setError(null);
    try {
      await onDelete();
    } catch {
      setError("Nao foi possivel remover a automacao.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <ModalShell titleId="create-automation-title" onClose={onClose} className="automations-create-modal">
      <header className="automations-create-modal__header">
        <h2 id="create-automation-title">{mode === "create" ? "Nova automacao" : "Editar automacao"}</h2>
        <button type="button" aria-label="Fechar" onClick={onClose}>x</button>
      </header>

      <form className="automations-create-modal__form" onSubmit={(e) => void handleSubmit(e)}>
        <FormField label="Nome da automacao">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Ao entrar em Done, mostrar em Teste"
            required
          />
        </FormField>

        <FormField label="Quando isso acontecer">
          <Select value={triggerType} onChange={(e) => setTriggerType(e.target.value)}>
            {Object.entries(TRIGGER_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </Select>
        </FormField>

        {triggerType === "item.moved" && (
          <>
            <FormField label="Perspectiva de origem">
              <Select value={sourceViewKey} onChange={(e) => setSourceViewKey(e.target.value)}>
                {views.map((view) => (
                  <option key={view.id} value={view.key}>
                    {view.name}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Coluna de origem">
              <Select value={sourceColumnKey} onChange={(e) => setSourceColumnKey(e.target.value)}>
                {sourceColumns.map((column) => (
                  <option key={column.id} value={column.key}>
                    {column.name}
                  </option>
                ))}
              </Select>
            </FormField>
          </>
        )}

        <FormField label="Entao executar">
          <Select value={actionType} onChange={(e) => setActionType(e.target.value)}>
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </Select>
        </FormField>

        {actionType === "set_work_item_state" && (
          <FormField label="Estado do card">
            <Select value={stateSlug} onChange={(e) => setStateSlug(e.target.value)}>
              {stateOptions.map((state) => (
                <option key={state.value} value={state.value}>
                  {state.label}
                </option>
              ))}
            </Select>
          </FormField>
        )}

        {(actionType === "set_view_column" || actionType === "remove_from_view") && (
          <FormField label="Perspectiva de destino">
            <Select value={viewKey} onChange={(e) => setViewKey(e.target.value)}>
              {views.map((view) => (
                <option key={view.id} value={view.key}>
                  {view.name}
                </option>
              ))}
            </Select>
          </FormField>
        )}

        {actionType === "set_view_column" && (
          <FormField label="Coluna de destino">
            <Select value={columnKey} onChange={(e) => setColumnKey(e.target.value)}>
              {targetColumns.map((column) => (
                <option key={column.id} value={column.key}>
                  {column.name}
                </option>
              ))}
            </Select>
          </FormField>
        )}

        {actionType === "set_view_column" && sourceViewKey && sourceColumnKey && viewKey && columnKey && (
          <p className="automations-create-modal__hint">
            Quando um card entrar em <strong>{sourceColumns.find((column) => column.key === sourceColumnKey)?.name ?? sourceColumnKey}</strong> da perspectiva <strong>{views.find((view) => view.key === sourceViewKey)?.name ?? sourceViewKey}</strong>, ele tambem sera colocado em <strong>{targetColumns.find((column) => column.key === columnKey)?.name ?? columnKey}</strong> na perspectiva <strong>{views.find((view) => view.key === viewKey)?.name ?? viewKey}</strong>.
          </p>
        )}

        {error && <p className="automations-create-modal__error">{error}</p>}

        <footer className="automations-create-modal__footer">
          {mode === "edit" && onDelete && (
            <Button type="button" variant="outline" onClick={() => void handleDelete()} disabled={saving || deleting}>
              {deleting ? "Removendo..." : "Remover"}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose} disabled={saving || deleting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving || deleting}>
            {saving ? (mode === "create" ? "Criando..." : "Salvando...") : (mode === "create" ? "Criar automacao" : "Salvar alteracoes")}
          </Button>
        </footer>
      </form>
    </ModalShell>
  );
}

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
  const [runningId, setRunningId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);

  const loadRules = useCallback(() => {
    setRulesLoading(true);
    listAutomationRules({ includeDisabled: true })
      .then(setRules)
      .catch(() => {})
      .finally(() => setRulesLoading(false));
  }, [listAutomationRules]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  useEffect(() => {
    listAutomationExecutions({ limit: 500 })
      .then(setExecutions)
      .catch(() => {})
      .finally(() => setExecutionsLoading(false));
  }, [listAutomationExecutions]);

  useEffect(() => {
    listAutomationViews()
      .then(setViews)
      .catch(() => {
        setViews([]);
      })
      .finally(() => setViewsLoading(false));
  }, [listAutomationViews]);

  useEffect(() => {
    fetchBoardColumns()
      .then((columns) => {
        setBoardColumns(columns.filter((column) => column.isActive).sort((left, right) => left.order - right.order));
      })
      .catch(() => {
        setBoardColumns([]);
      });
  }, [fetchBoardColumns]);

  const availableViews = useMemo<AutomationView[]>(() => {
    const activeViews = views.filter((view) => view.isActive);
    const byKey = new Map<string, AutomationView>();

    for (const view of activeViews) {
      const normalized = normalizeKey(view.key || view.name);
      if (!normalized) {
        continue;
      }

      const previous = byKey.get(normalized);
      if (!previous || previous.columns.length < view.columns.length) {
        byKey.set(normalized, view);
      }
    }

    const boardColumnById = new Map(boardColumns.map((column) => [column.id, column]));
    const perspectives = Array.isArray(snapshot?.boardConfig.perspectives)
      ? snapshot.boardConfig.perspectives
      : [];
    const boardColumnsByPerspectiveKey = new Map<string, Array<{ id: string; key: string; name: string }>>();
    const fallbackColumnsByPerspectiveKey = new Map<string, Array<{ id: string; key: string; name: string }>>();

    for (const perspective of perspectives) {
      if (!perspective || typeof perspective !== "object") {
        continue;
      }

      const entry = perspective as unknown as Record<string, unknown>;
      const perspectiveKey =
        (typeof entry.id === "string" && entry.id) ||
        (typeof entry.label === "string" && entry.label) ||
        "";

      const normalized = normalizeKey(perspectiveKey);
      if (!normalized) {
        continue;
      }

      const visibleBoardColumnIds = Array.isArray(entry.visibleBoardColumnIds)
        ? entry.visibleBoardColumnIds.filter((id): id is string => typeof id === "string")
        : [];
      const visibleColumnsFromBoard = visibleBoardColumnIds
        .map((columnId) => boardColumnById.get(columnId))
        .filter((column): column is ApiBoardColumn => Boolean(column))
        .map((column) => ({
          id: column.id,
          key: normalizeKey(column.slug || column.name),
          name: column.name
        }))
        .filter((column) => column.key.length > 0);

      if (visibleColumnsFromBoard.length > 0) {
        boardColumnsByPerspectiveKey.set(normalized, visibleColumnsFromBoard);
      }

      const fallbackColumns = buildFallbackColumnsFromPerspectiveStatus(entry);
      if (fallbackColumns.length > 0) {
        fallbackColumnsByPerspectiveKey.set(normalized, fallbackColumns);
      }
    }

    return Array.from(byKey.values())
      .map((view) => {
        const normalizedViewKey = normalizeKey(view.key || view.name);
        const boardColumnsForView = boardColumnsByPerspectiveKey.get(normalizedViewKey);
        if (boardColumnsForView && boardColumnsForView.length > 0) {
          return {
            ...view,
            columns: boardColumnsForView.map((column, index) => ({
              id: column.id,
              workspaceId: view.workspaceId,
              viewId: view.id,
              key: column.key,
              name: column.name,
              description: null,
              color: "#64748b",
              position: index,
              isActive: true,
              isTerminal: index === boardColumnsForView.length - 1,
              settings: null,
              createdAt: view.createdAt,
              updatedAt: view.updatedAt
            }))
          };
        }

        if (view.columns.length > 0) {
          return view;
        }

        const fallbackColumns = fallbackColumnsByPerspectiveKey.get(normalizedViewKey);
        if (!fallbackColumns || fallbackColumns.length === 0) {
          return view;
        }

        return {
          ...view,
          columns: fallbackColumns.map((column, index) => ({
            id: column.id,
            workspaceId: view.workspaceId,
            viewId: view.id,
            key: column.key,
            name: column.name,
            description: null,
            color: "#64748b",
            position: index,
            isActive: true,
            isTerminal: index === fallbackColumns.length - 1,
            settings: null,
            createdAt: view.createdAt,
            updatedAt: view.updatedAt
          }))
        };
      })
      .sort((left, right) => left.position - right.position);
  }, [views, snapshot?.boardConfig.perspectives, boardColumns]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const executionsToday = executions.filter((e) => new Date(e.createdAt) >= today).length;
  const failuresToday = executions.filter(
    (e) => new Date(e.createdAt) >= today && e.status === "failed"
  ).length;

  const metrics = buildBoardMetrics(snapshot?.tasks ?? []);
  const activeCount = rules.filter((r) => r.enabled).length;
  const pausedCount = rules.filter((r) => !r.enabled).length;

  async function handleToggle(rule: AutomationRule) {
    const next = rule.enabled ? "paused" : "active";
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: !rule.enabled } : r)));
    try {
      await setAutomationStatus(rule.id, next);
    } catch {
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: rule.enabled } : r)));
    }
  }

  async function handleRunTest(ruleId: string) {
    setRunningId(ruleId);
    try {
      await runAutomationRule(ruleId);
    } finally {
      setRunningId(null);
    }
  }

  async function handleCreate(input: CreateAutomationRuleInput) {
    const rule = await createAutomationRule(input);
    setRules((prev) => [rule, ...prev]);
    setCreateOpen(false);
  }

  async function handleUpdate(input: CreateAutomationRuleInput) {
    if (!editingRule) {
      return;
    }

    const updated = await updateAutomationRule(editingRule.id, {
      name: input.name,
      description: input.description,
      trigger: input.trigger,
      conditions: input.conditions,
      actions: input.actions,
      enabled: editingRule.enabled,
      priority: editingRule.priority
    });

    setRules((prev) => prev.map((rule) => (rule.id === editingRule.id ? updated : rule)));
    setEditingRule(null);
  }

  async function handleDelete(rule: AutomationRule) {
    await deleteAutomationRule(rule.id);
    setRules((prev) => prev.filter((entry) => entry.id !== rule.id));
    if (editingRule?.id === rule.id) {
      setEditingRule(null);
    }
  }

  const pageLoading = isLoading || rulesLoading || viewsLoading;
  const recentExecutions = executions.slice(0, 20);
  const stateOptions =
    snapshot?.boardConfig.statuses.map((status) => ({
      value: status.id,
      label: status.label
    })) ?? [];

  return (
    <AppShell
      metrics={metrics}
      noPageScroll
      hideSidebarBrandMark
      pageTitle="Automacoes"
      pageLabel="Automation Hub"
    >
      <div className="automations-view">
        <BoardMetrics
          metrics={metrics}
          cards={[
            { label: "Automacoes ativas", value: activeCount },
            { label: "Automacoes pausadas", value: pausedCount },
            { label: "Execucoes hoje", value: executionsLoading ? "-" : executionsToday },
            { label: "Falhas hoje", value: executionsLoading ? "-" : failuresToday }
          ]}
        />

        <Section
          title="Catalogo de automacoes"
          subtitle="Gerencie rotinas ativas, pause fluxos e valide execucoes em teste."
          className="automations-view__section"
          actions={
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              Nova automacao
            </Button>
          }
        >
          {pageLoading ? (
            <LoadingState text="Carregando automacoes..." />
          ) : rules.length === 0 ? (
            <EmptyState>Nenhuma automacao configurada.</EmptyState>
          ) : (
            <div className="automations-view__grid">
              {rules.map((rule) => {
                const isRunning = runningId === rule.id;

                return (
                  <Card key={rule.id} className="automations-view__card" variant="interactive">
                    <header>
                      <h3>{rule.name}</h3>
                      <StatusBadge tone={rule.enabled ? "success" : "warning"}>
                        {rule.enabled ? "Ativa" : "Pausada"}
                      </StatusBadge>
                    </header>
                    <p>
                      <strong>Gatilho:</strong> {labelTrigger(rule.triggerType)}
                    </p>
                    <p>
                      <strong>Acao:</strong> {extractActions(rule)}
                    </p>
                    {rule.description && (
                      <p className="automations-view__card-desc">{rule.description}</p>
                    )}
                    <footer>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingRule(rule)}
                      >
                        Editar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void handleToggle(rule)}
                      >
                        {rule.enabled ? "Pausar" : "Ativar"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isRunning}
                        onClick={() => void handleRunTest(rule.id)}
                      >
                        {isRunning ? "Executando..." : "Executar teste"}
                      </Button>
                    </footer>
                  </Card>
                );
              })}
            </div>
          )}
        </Section>

        {!executionsLoading && recentExecutions.length > 0 && (
          <Section
            title="Execucoes recentes"
            subtitle="Ultimas 20 execucoes registradas para este workspace."
            className="automations-view__section"
          >
            <DataTable columns="2fr 2fr 1fr 2fr">
              <DataTableHeader>
                <DataTableRow>
                  <DataTableCell>Regra</DataTableCell>
                  <DataTableCell>Gatilho</DataTableCell>
                  <DataTableCell>Status</DataTableCell>
                  <DataTableCell>Data</DataTableCell>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {recentExecutions.map((exec) => {
                  const tone = EXECUTION_STATUS_TONE[exec.status] ?? "default";
                  const ruleName = exec.rule?.name ?? "(Regra removida)";
                  const triggerType = exec.rule?.triggerType ?? exec.eventName ?? "manual";
                  return (
                    <DataTableRow key={exec.id}>
                      <DataTableCell>{ruleName}</DataTableCell>
                      <DataTableCell>{labelTrigger(triggerType)}</DataTableCell>
                      <DataTableCell>
                        <StatusBadge tone={tone}>{exec.status}</StatusBadge>
                      </DataTableCell>
                      <DataTableCell>{formatDatePt(exec.createdAt)}</DataTableCell>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </DataTable>
          </Section>
        )}
      </div>

      {createOpen && (
        <CreateAutomationDialog
          mode="create"
          views={availableViews}
          stateOptions={stateOptions}
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreate}
        />
      )}

      {editingRule && (
        <CreateAutomationDialog
          mode="edit"
          initialRule={editingRule}
          views={availableViews}
          stateOptions={stateOptions}
          onClose={() => setEditingRule(null)}
          onSubmit={handleUpdate}
          onDelete={() => handleDelete(editingRule)}
        />
      )}
    </AppShell>
  );
}
