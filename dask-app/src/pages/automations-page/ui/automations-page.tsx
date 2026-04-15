import { useCallback, useEffect, useState } from "react";
import { buildBoardMetrics } from "@/entities/task";
import { useWorkspace } from "@/modules/workspace";
import type { AutomationExecution, AutomationRule, CreateAutomationRuleInput } from "@/modules/workspace/model";
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<string, string> = {
  "item.created": "Ao criar item",
  "item.updated": "Ao atualizar item",
  "item.moved": "Ao mover item",
  "item.state.changed": "Ao mudar estado",
  "manual": "Execucao manual"
};

const ACTION_LABELS: Record<string, string> = {
  "set_work_item_state": "Alterar estado do item",
  "set_view_column": "Mover para coluna de visao",
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

function extractActions(rule: AutomationRule): string {
  const actions = rule.actions;
  if (!Array.isArray(actions)) return "—";
  return actions
    .map((a) => {
      if (typeof a === "object" && a !== null && "type" in a) {
        return labelAction(String((a as Record<string, unknown>).type));
      }
      return "—";
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

// ─── Create dialog ────────────────────────────────────────────────────────────

interface CreateDialogProps {
  onClose: () => void;
  onSubmit: (input: CreateAutomationRuleInput) => Promise<void>;
}

function CreateAutomationDialog({ onClose, onSubmit }: CreateDialogProps) {
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("item.created");
  const [actionType, setActionType] = useState("set_work_item_state");
  const [stateSlug, setStateSlug] = useState("");
  const [viewKey, setViewKey] = useState("");
  const [columnKey, setColumnKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (actionType === "set_work_item_state" && !stateSlug.trim()) {
      setError("Informe o slug do estado.");
      return;
    }
    if ((actionType === "set_view_column" || actionType === "remove_from_view") && !viewKey.trim()) {
      setError("Informe a chave da visao.");
      return;
    }
    if (actionType === "set_view_column" && !columnKey.trim()) {
      setError("Informe a chave da coluna.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        trigger: { type: triggerType },
        actions: [buildAction()],
        enabled: true
      });
    } catch {
      setError("Erro ao criar automacao. Verifique os dados e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell titleId="create-automation-title" onClose={onClose} className="automations-create-modal">
      <header className="automations-create-modal__header">
        <h2 id="create-automation-title">Nova automacao</h2>
        <button type="button" aria-label="Fechar" onClick={onClose}>✕</button>
      </header>

      <form className="automations-create-modal__form" onSubmit={(e) => void handleSubmit(e)}>
        <FormField label="Nome da automacao">
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Mover para revisao ao criar"
            required
          />
        </FormField>

        <FormField label="Gatilho">
          <Select value={triggerType} onChange={(e) => setTriggerType(e.target.value)}>
            {Object.entries(TRIGGER_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </Select>
        </FormField>

        <FormField label="Acao">
          <Select value={actionType} onChange={(e) => setActionType(e.target.value)}>
            {Object.entries(ACTION_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </Select>
        </FormField>

        {actionType === "set_work_item_state" && (
          <FormField label="Slug do estado (ex.: done, in-progress)">
            <TextInput
              value={stateSlug}
              onChange={(e) => setStateSlug(e.target.value)}
              placeholder="done"
              required
            />
          </FormField>
        )}

        {(actionType === "set_view_column" || actionType === "remove_from_view") && (
          <FormField label="Chave da visao">
            <TextInput
              value={viewKey}
              onChange={(e) => setViewKey(e.target.value)}
              placeholder="my-view"
              required
            />
          </FormField>
        )}

        {actionType === "set_view_column" && (
          <FormField label="Chave da coluna">
            <TextInput
              value={columnKey}
              onChange={(e) => setColumnKey(e.target.value)}
              placeholder="my-column"
              required
            />
          </FormField>
        )}

        {error && <p className="automations-create-modal__error">{error}</p>}

        <footer className="automations-create-modal__footer">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Criando..." : "Criar automacao"}
          </Button>
        </footer>
      </form>
    </ModalShell>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function AutomationsPage() {
  const {
    snapshot,
    isLoading,
    setAutomationStatus,
    listAutomationRules,
    listAutomationExecutions,
    runAutomationRule,
    createAutomationRule
  } = useWorkspace();

  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [executions, setExecutions] = useState<AutomationExecution[]>([]);
  const [executionsLoading, setExecutionsLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

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
    // Optimistic update
    setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled: !rule.enabled } : r)));
    try {
      await setAutomationStatus(rule.id, next);
    } catch {
      // Revert
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

  const pageLoading = isLoading || rulesLoading;

  const recentExecutions = executions.slice(0, 20);

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
            { label: "Execucoes hoje", value: executionsLoading ? "—" : executionsToday },
            { label: "Falhas hoje", value: executionsLoading ? "—" : failuresToday }
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
                  return (
                    <DataTableRow key={exec.id}>
                      <DataTableCell>{exec.rule.name}</DataTableCell>
                      <DataTableCell>{labelTrigger(exec.rule.triggerType)}</DataTableCell>
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
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreate}
        />
      )}
    </AppShell>
  );
}
