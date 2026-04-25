import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWorkspace } from "@/modules/workspace";
import type {
  ApiBoardColumn,
  AutomationExecution,
  AutomationRule,
  AutomationView,
  CreateAutomationRuleInput
} from "@/modules/workspace/model";
import { Button, LoadingState, ModalShell, Select, StatusBadge, TextInput, WorkspaceFrame } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { buildBoardMetrics } from "@/entities/task";
import "./automations-page.css";

// ─── Labels ──────────────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<string, string> = {
  "item.created": "Ao criar item",
  "item.updated": "Ao atualizar item",
  "item.moved": "Ao mover item",
  "item.state.changed": "Ao mudar estado",
  "manual": "Execução manual"
};

const TRIGGER_DESCRIPTIONS: Record<string, string> = {
  "item.created": "Dispara sempre que um novo item é criado no workspace",
  "item.updated": "Dispara quando qualquer campo de um item é alterado",
  "item.moved": "Dispara quando um item é movido para uma coluna específica",
  "item.state.changed": "Dispara quando o estado de um item muda",
  "manual": "Executado apenas via chamada manual de API"
};

const ACTION_LABELS: Record<string, string> = {
  "set_work_item_state": "Alterar estado do item",
  "set_view_column": "Mover para coluna em perspectiva",
  "remove_from_view": "Remover da perspectiva"
};

const EXECUTION_STATUS_TONE: Record<string, "success" | "warning" | "default"> = {
  completed: "success",
  failed: "warning",
  running: "default",
  pending: "default"
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
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

function formatDatePt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function buildFallbackColumnsFromPerspectiveStatus(
  perspective: unknown
): Array<{ id: string; key: string; name: string }> {
  if (!perspective || typeof perspective !== "object" || Array.isArray(perspective)) return [];
  const raw = perspective as Record<string, unknown>;
  const rawStatuses = Array.isArray(raw.statuses) ? raw.statuses : [];
  const perspectiveId = typeof raw.id === "string" && raw.id.trim() ? raw.id : "view";

  return rawStatuses
    .map((status, index) => {
      if (!status || typeof status !== "object" || Array.isArray(status)) return null;
      const entry = status as Record<string, unknown>;
      const id = typeof entry.id === "string" ? entry.id : "";
      const label = typeof entry.label === "string" ? entry.label : id;
      const key = normalizeKey(id);
      if (!key || !label) return null;
      return { id: `fallback-${perspectiveId}-${key}-${index}`, key, name: label };
    })
    .filter((c): c is { id: string; key: string; name: string } => c !== null);
}

// ─── Icons (inline SVG) ───────────────────────────────────────────────────────

function BoltIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function PlayIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function PlusIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function TrashIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}

function CloseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function InfoIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="12" r="10" opacity="0.15" />
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="12" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="12" y1="12" x2="12" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ─── Field with info tooltip ──────────────────────────────────────────────────

function InfoTip({ text }: { text: string }) {
  return (
    <span className="info-tip" data-tip={text}>
      <InfoIcon size={13} />
    </span>
  );
}

function FieldLabel({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="field-label">
      <span>{label}</span>
      <InfoTip text={hint} />
    </div>
  );
}

function AutomationIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

// ─── Draft model ─────────────────────────────────────────────────────────────

interface FlowDraft {
  name: string;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  conditions: Record<string, unknown>;
  actions: Array<{ type: string; [key: string]: unknown }>;
  enabled: boolean;
  priority: number;
}

type SelectedNode = { kind: "trigger" } | { kind: "action"; index: number };

function ruleToFlowDraft(rule: AutomationRule): FlowDraft {
  const trigger = asRecord(rule.trigger);
  return {
    name: rule.name,
    triggerType: rule.triggerType || asString(trigger.type) || "item.moved",
    triggerConfig: trigger,
    conditions: asRecord(rule.conditions),
    actions: Array.isArray(rule.actions)
      ? (rule.actions as Array<{ type: string; [key: string]: unknown }>)
      : [{ type: "set_view_column" }],
    enabled: rule.enabled,
    priority: rule.priority
  };
}

function emptyFlowDraft(): FlowDraft {
  return {
    name: "",
    triggerType: "item.moved",
    triggerConfig: {},
    conditions: {},
    actions: [{ type: "set_view_column" }],
    enabled: true,
    priority: 100
  };
}

function draftToRuleInput(draft: FlowDraft): CreateAutomationRuleInput {
  const trigger: { type: string; [key: string]: unknown } =
    draft.triggerType === "item.moved"
      ? {
          type: draft.triggerType,
          toViewKey: asString(draft.triggerConfig.toViewKey),
          toColumnKey: asString(draft.triggerConfig.toColumnKey)
        }
      : { type: draft.triggerType };

  const conditions =
    draft.triggerType === "item.moved" && draft.triggerConfig.toColumnKey
      ? { toColumnKeys: [asString(draft.triggerConfig.toColumnKey)] }
      : undefined;

  return {
    name: draft.name.trim(),
    trigger,
    conditions,
    actions: draft.actions,
    enabled: draft.enabled
  };
}

function summarizeTrigger(draft: FlowDraft, views: AutomationView[]): string {
  const label = TRIGGER_LABELS[draft.triggerType] ?? draft.triggerType;
  if (draft.triggerType === "item.moved") {
    const viewKey = asString(draft.triggerConfig.toViewKey);
    const colKey = asString(draft.triggerConfig.toColumnKey);
    const view = views.find((v) => v.key === viewKey);
    const col = view?.columns.find((c) => c.key === colKey);
    if (view && col) return `${label} → ${view.name} / ${col.name}`;
    if (view) return `${label} → ${view.name}`;
  }
  return label;
}

function summarizeAction(action: { type: string; [key: string]: unknown }, views: AutomationView[], stateOptions: Array<{ value: string; label: string }>): string {
  const type = asString(action.type);
  if (type === "set_work_item_state") {
    const slug = asString(action.stateSlug) || asString(action.status);
    const state = stateOptions.find((s) => s.value === slug);
    return `Alterar estado → ${state?.label ?? slug ?? "—"}`;
  }
  if (type === "set_view_column") {
    const viewKey = asString(action.targetViewKey);
    const colKey = asString(action.targetColumnKey);
    const view = views.find((v) => v.key === viewKey);
    const col = view?.columns.find((c) => c.key === colKey);
    if (view && col) return `Mover para ${view.name} / ${col.name}`;
    if (view) return `Mover para ${view.name}`;
    return "Mover para perspectiva";
  }
  if (type === "remove_from_view") {
    const viewKey = asString(action.targetViewKey);
    const view = views.find((v) => v.key === viewKey);
    return `Remover de ${view?.name ?? viewKey ?? "perspectiva"}`;
  }
  return ACTION_LABELS[type] ?? type;
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

type ConfirmVariant = "danger" | "warning";

interface ConfirmDialogProps {
  variant: ConfirmVariant;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function WarningTriangleIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  );
}

function TrashLargeIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}

function ConfirmDialog({
  variant,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  loading = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const isDanger = variant === "danger";
  return (
    <ModalShell titleId="confirm-dialog-title" onClose={onCancel} className="confirm-dialog">
      <div className={`confirm-dialog__icon confirm-dialog__icon--${variant}`}>
        {isDanger ? <TrashLargeIcon size={28} /> : <WarningTriangleIcon size={28} />}
      </div>
      <div className="confirm-dialog__body">
        <h2 id="confirm-dialog-title" className="confirm-dialog__title">{title}</h2>
        <p className="confirm-dialog__desc">{description}</p>
      </div>
      <div className="confirm-dialog__footer">
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <button
          type="button"
          className={`confirm-dialog__confirm-btn confirm-dialog__confirm-btn--${variant}`}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? "Aguarde..." : confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}

// ─── Flow Node ────────────────────────────────────────────────────────────────

interface FlowNodeProps {
  kind: "trigger" | "action";
  index?: number;
  label: string;
  summary: string;
  isSelected: boolean;
  isConfigured: boolean;
  onSelect: () => void;
  onRemove?: () => void;
}

function FlowNode({ kind, label, summary, isSelected, isConfigured, onSelect, onRemove }: FlowNodeProps) {
  return (
    <div
      className={`flow-node flow-node--${kind}${isSelected ? " flow-node--selected" : ""}${!isConfigured ? " flow-node--empty" : ""}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
    >
      <div className="flow-node__header">
        <div className="flow-node__icon">
          {kind === "trigger" ? <BoltIcon size={14} /> : <PlayIcon size={14} />}
        </div>
        <span className="flow-node__kind">{label}</span>
        {onRemove && (
          <button
            className="flow-node__remove"
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            aria-label="Remover ação"
            title="Remover ação"
          >
            <TrashIcon size={13} />
          </button>
        )}
      </div>
      <div className="flow-node__body">
        {isConfigured ? (
          <span className="flow-node__summary">{summary}</span>
        ) : (
          <span className="flow-node__placeholder">Clique para configurar</span>
        )}
      </div>
    </div>
  );
}

function FlowConnector() {
  return (
    <div className="flow-connector" aria-hidden>
      <div className="flow-connector__line" />
      <div className="flow-connector__arrow" />
    </div>
  );
}

// ─── Trigger Config Panel ─────────────────────────────────────────────────────

interface TriggerConfigProps {
  draft: FlowDraft;
  views: AutomationView[];
  onChange: (updates: Partial<FlowDraft>) => void;
}

function TriggerConfig({ draft, views, onChange }: TriggerConfigProps) {
  const triggerViewKey = asString(draft.triggerConfig.toViewKey);
  const triggerColKey = asString(draft.triggerConfig.toColumnKey);
  const sourceColumns = views.find((v) => v.key === triggerViewKey)?.columns ?? [];

  function setTriggerType(type: string) {
    onChange({ triggerType: type, triggerConfig: { ...draft.triggerConfig, type } });
  }

  function setTriggerView(viewKey: string) {
    const columns = views.find((v) => v.key === viewKey)?.columns ?? [];
    const firstColKey = columns[0]?.key ?? "";
    onChange({
      triggerConfig: { ...draft.triggerConfig, toViewKey: viewKey, toColumnKey: firstColKey }
    });
  }

  function setTriggerColumn(colKey: string) {
    onChange({ triggerConfig: { ...draft.triggerConfig, toColumnKey: colKey } });
  }

  return (
    <div className="config-panel__fields">
      <div className="config-panel__field">
        <FieldLabel
          label="Evento disparador"
          hint="Define quando esta automação é acionada. O fluxo executa sempre que este evento ocorrer no workspace."
        />
        <Select value={draft.triggerType} onChange={(e) => setTriggerType(e.target.value)}>
          {Object.entries(TRIGGER_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </Select>
        <p className="config-panel__hint">{TRIGGER_DESCRIPTIONS[draft.triggerType]}</p>
      </div>

      {draft.triggerType === "item.moved" && (
        <>
          <div className="config-panel__field">
            <FieldLabel
              label="Perspectiva de chegada"
              hint="A automação dispara quando o item for movido para esta perspectiva. Ex.: 'Sprint', 'QA', 'Dev'."
            />
            <Select
              value={triggerViewKey}
              onChange={(e) => setTriggerView(e.target.value)}
            >
              {views.length === 0 && <option value="">Nenhuma perspectiva disponível</option>}
              {views.map((view) => (
                <option key={view.id} value={view.key}>{view.name}</option>
              ))}
            </Select>
          </div>

          <div className="config-panel__field">
            <FieldLabel
              label="Coluna de chegada"
              hint="Filtra por coluna específica. A automação só dispara se o item entrar exatamente nesta coluna da perspectiva escolhida."
            />
            <Select
              value={triggerColKey}
              onChange={(e) => setTriggerColumn(e.target.value)}
            >
              {sourceColumns.length === 0 && <option value="">Nenhuma coluna disponível</option>}
              {sourceColumns.map((col) => (
                <option key={col.id} value={col.key}>{col.name}</option>
              ))}
            </Select>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Action Config Panel ──────────────────────────────────────────────────────

interface ActionConfigProps {
  action: { type: string; [key: string]: unknown };
  views: AutomationView[];
  stateOptions: Array<{ value: string; label: string }>;
  onChange: (updated: { type: string; [key: string]: unknown }) => void;
}

function ActionConfig({ action, views, stateOptions, onChange }: ActionConfigProps) {
  const type = asString(action.type) || "set_view_column";
  const targetViewKey = asString(action.targetViewKey);
  const targetColKey = asString(action.targetColumnKey);
  const stateSlug = asString(action.stateSlug) || asString(action.status);
  const targetColumns = views.find((v) => v.key === targetViewKey)?.columns ?? [];

  function setType(newType: string) {
    const base: { type: string; [key: string]: unknown } = { type: newType };
    if ((newType === "set_view_column" || newType === "remove_from_view") && views[0]) {
      base.targetViewKey = views[0].key;
      if (newType === "set_view_column") {
        base.targetColumnKey = views[0].columns[0]?.key ?? "";
      }
    }
    if (newType === "set_work_item_state" && stateOptions[0]) {
      base.stateSlug = stateOptions[0].value;
    }
    onChange(base);
  }

  function setView(viewKey: string) {
    const columns = views.find((v) => v.key === viewKey)?.columns ?? [];
    onChange({ ...action, type, targetViewKey: viewKey, targetColumnKey: columns[0]?.key ?? "" });
  }

  return (
    <div className="config-panel__fields">
      <div className="config-panel__field">
        <FieldLabel
          label="Tipo de ação"
          hint="O que acontecerá com o item quando a automação executar. Cada ação pode ser encadeada com outras."
        />
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          {Object.entries(ACTION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </Select>
      </div>

      {type === "set_work_item_state" && (
        <div className="config-panel__field">
          <FieldLabel
            label="Estado de destino"
            hint="O novo estado que será atribuído ao item automaticamente ao executar esta ação."
          />
          <Select
            value={stateSlug}
            onChange={(e) => onChange({ ...action, type, stateSlug: e.target.value })}
          >
            {stateOptions.length === 0 && <option value="">Nenhum estado disponível</option>}
            {stateOptions.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
        </div>
      )}

      {(type === "set_view_column" || type === "remove_from_view") && (
        <div className="config-panel__field">
          <FieldLabel
            label="Perspectiva de destino"
            hint={type === "set_view_column"
              ? "A perspectiva onde o item será adicionado ou movido ao executar esta ação."
              : "O item será removido desta perspectiva ao executar a ação."}
          />
          <Select value={targetViewKey} onChange={(e) => setView(e.target.value)}>
            {views.length === 0 && <option value="">Nenhuma perspectiva disponível</option>}
            {views.map((v) => (
              <option key={v.id} value={v.key}>{v.name}</option>
            ))}
          </Select>
        </div>
      )}

      {type === "set_view_column" && (
        <div className="config-panel__field">
          <FieldLabel
            label="Coluna de destino"
            hint="A coluna específica dentro da perspectiva onde o item será posicionado."
          />
          <Select
            value={targetColKey}
            onChange={(e) => onChange({ ...action, type, targetViewKey, targetColumnKey: e.target.value })}
          >
            {targetColumns.length === 0 && <option value="">Nenhuma coluna disponível</option>}
            {targetColumns.map((col) => (
              <option key={col.id} value={col.key}>{col.name}</option>
            ))}
          </Select>
        </div>
      )}
    </div>
  );
}

// ─── Recent Executions ────────────────────────────────────────────────────────

interface RecentExecutionsProps {
  executions: AutomationExecution[];
  rules: AutomationRule[];
}

function RecentExecutions({ executions, rules }: RecentExecutionsProps) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? executions : executions.slice(0, 8);

  if (executions.length === 0) return null;

  return (
    <div className="executions-panel">
      <div className="executions-panel__header">
        <span className="executions-panel__title">Execuções recentes</span>
        <span className="executions-panel__count">{executions.length}</span>
      </div>
      <div className="executions-panel__list">
        {shown.map((exec) => {
          const tone = EXECUTION_STATUS_TONE[exec.status] ?? "default";
          const rule = rules.find((r) => r.id === exec.ruleId) ?? exec.rule;
          const ruleName = rule?.name ?? "(Removida)";
          return (
            <div key={exec.id} className="executions-panel__row">
              <StatusBadge tone={tone}>{exec.status}</StatusBadge>
              <span className="executions-panel__rule">{ruleName}</span>
              <span className="executions-panel__date">{formatDatePt(exec.createdAt)}</span>
            </div>
          );
        })}
      </div>
      {executions.length > 8 && (
        <button
          type="button"
          className="executions-panel__toggle"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Ver menos" : `Ver mais ${executions.length - 8} execuções`}
        </button>
      )}
    </div>
  );
}

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

  // Action states
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Dialog state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingNavigate, setPendingNavigate] = useState<(() => void) | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

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
        .map((c) => ({ id: c.id, key: normalizeKey(c.slug || c.name), name: c.name }))
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
              name: c.name, description: null, color: "#64748b", position: i,
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
            name: c.name, description: null, color: "#64748b", position: i,
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
      d.triggerConfig = {
        ...d.triggerConfig,
        toViewKey: availableViews[0].key,
        toColumnKey: availableViews[0].columns[0]?.key ?? ""
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

  function addAction() {
    const defaultAction: { type: string; [key: string]: unknown } = { type: "set_view_column" };
    if (availableViews[0]) {
      defaultAction.targetViewKey = availableViews[0].key;
      defaultAction.targetColumnKey = availableViews[0].columns[0]?.key ?? "";
    }
    setDraft((prev) => prev ? { ...prev, actions: [...prev.actions, defaultAction] } : prev);
    setSelectedNode({ kind: "action", index: (draft?.actions.length ?? 0) });
  }

  function removeAction(index: number) {
    setDraft((prev) => {
      if (!prev || prev.actions.length <= 1) return prev;
      const actions = prev.actions.filter((_, i) => i !== index);
      return { ...prev, actions };
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
    return false;
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <AppShell
      metrics={metrics}
      noPageScroll
      hideSidebarBrandMark
      pageTitle="Automações"
      pageLabel="Flow Editor"
    >
      <WorkspaceFrame className="flow-editor">
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
            {pageLoading ? (
              <div className="flow-sidebar__loading">
                <LoadingState text="Carregando..." />
              </div>
            ) : rules.length === 0 ? (
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
        <div className="flow-canvas" ref={canvasRef}>
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
                <div className="flow-nodes">
                  {/* Trigger */}
                  <FlowNode
                    kind="trigger"
                    label="GATILHO"
                    summary={summarizeTrigger(draft, availableViews)}
                    isSelected={selectedNode?.kind === "trigger"}
                    isConfigured={isNodeConfigured({ kind: "trigger" })}
                    onSelect={() => setSelectedNode(selectedNode?.kind === "trigger" ? null : { kind: "trigger" })}
                  />

                  {/* Actions */}
                  {draft.actions.map((action, index) => (
                    <div key={index} className="flow-action-slot">
                      <FlowConnector />
                      <FlowNode
                        kind="action"
                        index={index}
                        label={`AÇÃO ${draft.actions.length > 1 ? index + 1 : ""}`}
                        summary={summarizeAction(action, availableViews, stateOptions)}
                        isSelected={selectedNode?.kind === "action" && selectedNode.index === index}
                        isConfigured={isNodeConfigured({ kind: "action", index })}
                        onSelect={() =>
                          setSelectedNode(
                            selectedNode?.kind === "action" && selectedNode.index === index
                              ? null
                              : { kind: "action", index }
                          )
                        }
                        onRemove={draft.actions.length > 1 ? () => removeAction(index) : undefined}
                      />
                    </div>
                  ))}

                  {/* Add action */}
                  <div className="flow-add-action">
                    <FlowConnector />
                    <button
                      type="button"
                      className="flow-add-action__btn"
                      onClick={addAction}
                    >
                      <PlusIcon size={14} />
                      Adicionar ação
                    </button>
                  </div>
                </div>
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
              <button
                type="button"
                className="config-panel__close"
                onClick={() => setSelectedNode(null)}
                aria-label="Fechar painel"
              >
                <CloseIcon size={15} />
              </button>
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
