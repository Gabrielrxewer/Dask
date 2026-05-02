import { useState } from "react";
import type { Edge, Node, NodeProps } from "@xyflow/react";
import type {
  AutomationExecution,
  AutomationRule,
  AutomationView,
  CreateAutomationRuleInput
} from "@/modules/workspace/model";
import { AppIcon, Button, FlowNodeCard, ModalShell, Select, StatusBadge, TextInput, type FlowCanvasPaletteItem } from "@/shared/ui";

// ─── Labels ──────────────────────────────────────────────────────────────────

export const TRIGGER_LABELS: Record<string, string> = {
  "item.created": "Ao criar item",
  "item.updated": "Ao atualizar item",
  "item.moved": "Ao mover item",
  "item.state.changed": "Ao mudar estado",
  "proposal.created": "Ao criar proposta",
  "proposal.sent": "Ao enviar proposta",
  "proposal.approved": "Ao aprovar proposta",
  "contract.created": "Ao criar contrato",
  "contract.accepted": "Ao aceitar contrato",
  "billing.requested": "Ao solicitar cobranca",
  "billing.payment.confirmed": "Ao confirmar pagamento",
  "manual": "Execução manual"
};

export const TRIGGER_DESCRIPTIONS: Record<string, string> = {
  "item.created": "Dispara sempre que um novo item e criado no workspace",
  "item.updated": "Dispara quando qualquer campo de um item e alterado",
  "item.moved": "Dispara quando um item e movido para uma coluna especifica",
  "item.state.changed": "Dispara quando o estado de um item muda",
  "proposal.created": "Dispara quando uma proposta vinculada e criada",
  "proposal.sent": "Dispara quando uma proposta vinculada e marcada como enviada",
  "proposal.approved": "Dispara quando uma proposta vinculada e aprovada",
  "contract.created": "Dispara quando um contrato vinculado e criado",
  "contract.accepted": "Dispara quando um contrato vinculado e aceito ou assinado",
  "billing.requested": "Dispara quando uma cobranca e solicitada",
  "billing.payment.confirmed": "Dispara quando o pagamento e confirmado",
  "manual": "Executado apenas via chamada manual de API"
};

export const ACTION_LABELS: Record<string, string> = {
  "set_work_item_state": "Alterar estado do item",
  "set_view_column": "Mover para coluna em perspectiva",
  "remove_from_view": "Remover da perspectiva",
  "create_document": "Criar documento vinculado",
  "update_document_status": "Atualizar status do documento",
  "create_billing_order": "Preparar cobranca"
};

export const EXECUTION_STATUS_TONE: Record<string, "success" | "warning" | "default"> = {
  completed: "success",
  failed: "warning",
  running: "default",
  pending: "default"
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function firstString(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  const found = value.find((entry) => typeof entry === "string" && entry.trim().length > 0);
  return typeof found === "string" ? found : "";
}

export function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeColumnKeyFromSlug(slug: string | null | undefined, name: string): string {
  const rawSlug = typeof slug === "string" ? slug.trim() : "";
  return rawSlug || normalizeKey(name);
}

export function formatDatePt(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function buildFallbackColumnsFromPerspectiveStatus(
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
      const key = id.trim() || normalizeKey(label);
      if (!key || !label) return null;
      return { id: `fallback-${perspectiveId}-${key}-${index}`, key, name: label };
    })
    .filter((c): c is { id: string; key: string; name: string } => c !== null);
}

// ─── Icons (inline SVG) ───────────────────────────────────────────────────────

export function BoltIcon({ size = 16 }: { size?: number }) {
  return <AppIcon name="zap" size={size} />;
}

export function PlayIcon({ size = 16 }: { size?: number }) {
  return <AppIcon name="send" size={size} />;
}

export function PlusIcon({ size = 16 }: { size?: number }) {
  return <AppIcon name="plus" size={size} strokeWidth={2.5} />;
}

export function TrashIcon({ size = 15 }: { size?: number }) {
  return <AppIcon name="trash" size={size} strokeWidth={2} />;
}

export function CloseIcon({ size = 16 }: { size?: number }) {
  return <AppIcon name="x" size={size} strokeWidth={2.5} />;
}

export function InfoIcon({ size = 13 }: { size?: number }) {
  return <AppIcon name="info" size={size} strokeWidth={2} />;
}

// ─── Field with info tooltip ──────────────────────────────────────────────────

export function InfoTip({ text }: { text: string }) {
  return (
    <span className="info-tip" data-tip={text}>
      <InfoIcon size={13} />
    </span>
  );
}

export function FieldLabel({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="field-label">
      <span>{label}</span>
      <InfoTip text={hint} />
    </div>
  );
}

export function AutomationIcon({ size = 14 }: { size?: number }) {
  return <AppIcon name="automation" size={size} strokeWidth={2} />;
}

// ─── Draft model ─────────────────────────────────────────────────────────────

export interface FlowDraft {
  name: string;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  conditions: Record<string, unknown>;
  actions: Array<{ type: string; [key: string]: unknown }>;
  enabled: boolean;
  priority: number;
}

export type SelectedNode = { kind: "trigger" } | { kind: "action"; index: number };

export type AutomationCanvasNodeKind = "trigger" | "action";

export interface AutomationCanvasNodeData extends Record<string, unknown> {
  kind: AutomationCanvasNodeKind;
  label: string;
  summary: string;
  configured: boolean;
  index?: number;
}

export type AutomationCanvasNode = Node<AutomationCanvasNodeData, AutomationCanvasNodeKind>;
export type AutomationCanvasEdge = Edge;

export function ruleToFlowDraft(rule: AutomationRule): FlowDraft {
  const trigger = asRecord(rule.trigger);
  const triggerSettings = asRecord(trigger.settings);
  const templateTrigger = asRecord(triggerSettings.templateTrigger);
  const conditions = asRecord(rule.conditions);
  return {
    name: rule.name,
    triggerType: rule.triggerType || asString(trigger.type) || "item.moved",
    triggerConfig: {
      ...trigger,
      ...triggerSettings,
      toViewKey: asString(trigger.toViewKey) || asString(triggerSettings.toViewKey),
      toColumnKey:
        asString(trigger.toColumnKey) ||
        asString(triggerSettings.toColumnKey) ||
        asString(templateTrigger.column) ||
        firstString(conditions.toColumnKeys)
    },
    conditions,
    actions: Array.isArray(rule.actions)
      ? (rule.actions as Array<{ type: string; [key: string]: unknown }>)
      : [{ type: "set_view_column" }],
    enabled: rule.enabled,
    priority: rule.priority
  };
}

export function emptyFlowDraft(): FlowDraft {
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

export function draftToRuleInput(draft: FlowDraft): CreateAutomationRuleInput {
  const trigger: { type: string; [key: string]: unknown } =
    draft.triggerType === "item.moved"
      ? {
          type: draft.triggerType,
          settings: {
            toViewKey: asString(draft.triggerConfig.toViewKey),
            toColumnKey: asString(draft.triggerConfig.toColumnKey)
          }
        }
      : { type: draft.triggerType };

  const nextConditions =
    draft.triggerType === "item.moved" && draft.triggerConfig.toColumnKey
      ? { ...draft.conditions, toColumnKeys: [asString(draft.triggerConfig.toColumnKey)] }
      : draft.conditions;
  const conditions = Object.keys(nextConditions).length > 0 ? nextConditions : undefined;

  return {
    name: draft.name.trim(),
    trigger,
    conditions,
    actions: draft.actions,
    enabled: draft.enabled
  };
}

export function summarizeTrigger(draft: FlowDraft, views: AutomationView[]): string {
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

export function summarizeAction(action: { type: string; [key: string]: unknown }, views: AutomationView[], stateOptions: Array<{ value: string; label: string }>): string {
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
  if (type === "create_document") {
    const kind = asString(action.kind);
    if (kind === "proposal") return "Criar proposta vinculada";
    if (kind === "contract") return "Criar contrato vinculado";
    if (kind === "wiki") return "Criar wiki vinculada";
    return "Criar documento vinculado";
  }
  if (type === "update_document_status") {
    const kind = asString(action.kind) || "documento";
    const status = asString(action.status) || "status";
    return `Atualizar ${kind} -> ${status}`;
  }
  if (type === "create_billing_order") {
    return "Preparar cobranca";
  }
  return ACTION_LABELS[type] ?? type;
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────

export type ConfirmVariant = "danger" | "warning";

export interface ConfirmDialogProps {
  variant: ConfirmVariant;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function WarningTriangleIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  );
}

export function TrashLargeIcon({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}

export function ConfirmDialog({
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

export interface FlowNodeProps {
  kind: "trigger" | "action";
  index?: number;
  label: string;
  summary: string;
  isSelected: boolean;
  isConfigured: boolean;
  onSelect: () => void;
  onRemove?: () => void;
}

export function FlowNode({ kind, label, summary, isSelected, isConfigured, onSelect, onRemove }: FlowNodeProps) {
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

export function FlowConnector() {
  return (
    <div className="flow-connector" aria-hidden>
      <div className="flow-connector__line" />
      <div className="flow-connector__arrow" />
    </div>
  );
}

export function AutomationTriggerNode({ data, selected }: NodeProps) {
  const d = data as AutomationCanvasNodeData;
  return (
    <FlowNodeCard
      kind="trigger"
      typeLabel="Gatilho"
      label={d.label}
      meta={d.summary}
      emptyText={d.configured ? undefined : "Configure o gatilho"}
      icon={<BoltIcon size={14} />}
      selected={selected}
      target={false}
    />
  );
}

export function AutomationActionNode({ data, selected }: NodeProps) {
  const d = data as AutomationCanvasNodeData;
  return (
    <FlowNodeCard
      kind="action"
      typeLabel={typeof d.index === "number" ? `Acao ${d.index + 1}` : "Acao"}
      label={d.label}
      meta={d.summary}
      emptyText={d.configured ? undefined : "Configure a acao"}
      icon={<PlayIcon size={14} />}
      selected={selected}
    />
  );
}

export const AUTOMATION_NODE_TYPES = {
  trigger: AutomationTriggerNode,
  action: AutomationActionNode
};

export const AUTOMATION_PALETTE: FlowCanvasPaletteItem<AutomationCanvasNodeKind, AutomationCanvasNodeData>[] = [
  {
    kind: "action",
    label: "Acao",
    description: "Adiciona uma nova etapa executada pela automacao",
    color: "var(--text-secondary)",
    buildData: () => ({
      kind: "action",
      label: "Nova acao",
      summary: "Configure a acao",
      configured: false
    })
  }
];

// ─── Trigger Config Panel ─────────────────────────────────────────────────────

export interface TriggerConfigProps {
  draft: FlowDraft;
  views: AutomationView[];
  onChange: (updates: Partial<FlowDraft>) => void;
}

export function TriggerConfig({ draft, views, onChange }: TriggerConfigProps) {
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

export interface ActionConfigProps {
  action: { type: string; [key: string]: unknown };
  views: AutomationView[];
  stateOptions: Array<{ value: string; label: string }>;
  onChange: (updated: { type: string; [key: string]: unknown }) => void;
}

export function ActionConfig({ action, views, stateOptions, onChange }: ActionConfigProps) {
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
    if (newType === "create_document") {
      base.kind = "proposal";
      base.status = "draft";
    }
    if (newType === "update_document_status") {
      base.kind = "proposal";
      base.status = "sent";
    }
    if (newType === "create_billing_order") {
      base.targetFieldSlug = "billingOrderId";
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

      {(type === "create_document" || type === "update_document_status") && (
        <div className="config-panel__field">
          <FieldLabel
            label="Tipo de documento"
            hint="Documento comercial vinculado ao WorkItem que sera criado ou atualizado pela automacao."
          />
          <Select
            value={asString(action.kind) || "proposal"}
            onChange={(e) => onChange({ ...action, type, kind: e.target.value })}
          >
            <option value="proposal">Proposta</option>
            <option value="contract">Contrato</option>
            <option value="wiki">Wiki</option>
          </Select>
        </div>
      )}

      {(type === "create_document" || type === "update_document_status") && (
        <div className="config-panel__field">
          <FieldLabel
            label="Status"
            hint="Status comercial gravado nos metadados do documento ao executar a automacao."
          />
          <TextInput
            value={asString(action.status) || (type === "create_document" ? "draft" : "")}
            onChange={(e) => onChange({ ...action, type, status: e.target.value })}
            placeholder="draft, sent, approved, accepted"
          />
        </div>
      )}

      {type === "create_billing_order" && (
        <div className="config-panel__field">
          <FieldLabel
            label="Campo de cobranca"
            hint="Campo configuravel do WorkItem que recebera a referencia da cobranca preparada."
          />
          <TextInput
            value={asString(action.targetFieldSlug) || "billingOrderId"}
            onChange={(e) => onChange({ ...action, type, targetFieldSlug: e.target.value })}
            placeholder="billingOrderId"
          />
        </div>
      )}
    </div>
  );
}

// ─── Recent Executions ────────────────────────────────────────────────────────

export interface RecentExecutionsProps {
  executions: AutomationExecution[];
  rules: AutomationRule[];
}

export function RecentExecutions({ executions, rules }: RecentExecutionsProps) {
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
