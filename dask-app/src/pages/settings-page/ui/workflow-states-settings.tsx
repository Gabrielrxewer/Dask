import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { apiClient } from "@/shared/api/http-client";
import { workspaceService } from "@/modules/workspace/api";
import { Button, FormField, TextInput } from "@/shared/ui";
import "./workflow-states-settings.css";

interface ApiWorkflowState {
  id: string;
  name: string;
  slug: string;
  color: string;
  order?: number;
  category: string | null;
  isTerminal: boolean;
  isEditable: boolean;
  isActive: boolean;
}

interface WorkflowStateDraft {
  id?: string;
  name: string;
  slug: string;
  color: string;
  category: string;
  order: string;
  isTerminal: boolean;
  isEditable: boolean;
  isActive: boolean;
}

const DEFAULT_COLOR = "#64748b";

const STATE_PRESETS = [
  { key: "backlog", label: "Backlog", slug: "backlog", color: "#7c8fa1", category: "Planejamento", isTerminal: false },
  { key: "doing", label: "Em progresso", slug: "em-progresso", color: "#0a86e8", category: "Execucao", isTerminal: false },
  { key: "review", label: "Em revisao", slug: "em-revisao", color: "#f59e0b", category: "Qualidade", isTerminal: false },
  { key: "done", label: "Concluido", slug: "concluido", color: "#22c55e", category: "Entrega", isTerminal: true },
  { key: "blocked", label: "Bloqueado", slug: "bloqueado", color: "#ef4444", category: "Risco", isTerminal: false }
] as const;

function toSlug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sortStates(states: ApiWorkflowState[]): ApiWorkflowState[] {
  return [...states].sort((a, b) => {
    const orderA = typeof a.order === "number" ? a.order : Number.MAX_SAFE_INTEGER;
    const orderB = typeof b.order === "number" ? b.order : Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return a.name.localeCompare(b.name);
  });
}

function createDraftFromState(state: ApiWorkflowState, fallbackOrder: number): WorkflowStateDraft {
  return {
    id: state.id,
    name: state.name,
    slug: state.slug,
    color: state.color || DEFAULT_COLOR,
    category: state.category ?? "",
    order: String(state.order ?? fallbackOrder),
    isTerminal: state.isTerminal,
    isEditable: state.isEditable !== false,
    isActive: state.isActive !== false
  };
}

function createEmptyDraft(order: number): WorkflowStateDraft {
  return {
    name: "",
    slug: "",
    color: DEFAULT_COLOR,
    category: "",
    order: String(order),
    isTerminal: false,
    isEditable: true,
    isActive: true
  };
}

function createDraftFromPreset(index: number, preset: (typeof STATE_PRESETS)[number]): WorkflowStateDraft {
  return {
    name: preset.label,
    slug: preset.slug,
    color: preset.color,
    category: preset.category,
    order: String(index),
    isTerminal: preset.isTerminal,
    isEditable: true,
    isActive: true
  };
}

function areDraftsEqual(a: WorkflowStateDraft | null, b: WorkflowStateDraft | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function WorkflowStatesSettings() {
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();

  const [states, setStates] = useState<ApiWorkflowState[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeView, setActiveView] = useState<"board" | "detail" | "badge">("board");
  const [selectedStateId, setSelectedStateId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<WorkflowStateDraft | null>(null);
  const [persistedDraft, setPersistedDraft] = useState<WorkflowStateDraft | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const resolveWorkspaceId = useCallback(async (): Promise<string | null> => {
    if (!workspaceSlug) {
      return null;
    }

    const workspaces = await workspaceService.listWorkspaces();
    return workspaces.find(workspace => workspace.slug === workspaceSlug)?.id ?? null;
  }, [workspaceSlug]);

  const loadStates = useCallback(async () => {
    if (!workspaceSlug) {
      setStates([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const workspaceId = await resolveWorkspaceId();
      if (!workspaceId) {
        setStates([]);
        return;
      }

      const items = await apiClient.get<ApiWorkflowState[]>(
        `/workspaces/${workspaceId}/workflow-states`,
        { authMode: "required", retryOnUnauthorized: true }
      );

      const sorted = sortStates(items);
      setStates(sorted);
      setSelectedStateId(current => {
        if (current === "new") {
          return current;
        }
        if (current && sorted.some(state => state.id === current)) {
          return current;
        }
        return sorted[0]?.id ?? "new";
      });
    } finally {
      setLoading(false);
    }
  }, [resolveWorkspaceId, workspaceSlug]);

  useEffect(() => {
    void loadStates();
  }, [loadStates]);

  const activeStates = useMemo(
    () => states.filter(state => state.isActive !== false),
    [states]
  );

  const archivedStates = useMemo(
    () => states.filter(state => state.isActive === false),
    [states]
  );

  const terminalCount = useMemo(
    () => activeStates.filter(state => state.isTerminal).length,
    [activeStates]
  );

  const editableCount = useMemo(
    () => activeStates.filter(state => state.isEditable !== false).length,
    [activeStates]
  );

  const selectedState = useMemo(
    () => (selectedStateId && selectedStateId !== "new" ? states.find(state => state.id === selectedStateId) ?? null : null),
    [selectedStateId, states]
  );

  useEffect(() => {
    if (selectedStateId === "new") {
      const empty = createEmptyDraft(states.length);
      setDraft(empty);
      setPersistedDraft(empty);
      return;
    }

    if (!selectedState) {
      return;
    }

    const nextDraft = createDraftFromState(selectedState, states.length);
    setDraft(nextDraft);
    setPersistedDraft(nextDraft);
  }, [selectedState, selectedStateId, states.length]);

  const hasUnsavedChanges = useMemo(
    () => !areDraftsEqual(draft, persistedDraft),
    [draft, persistedDraft]
  );

  const previewName = draft?.name.trim() || "Novo estado";
  const previewSlug = draft?.slug.trim() || toSlug(draft?.name ?? "") || "novo-estado";
  const previewCategory = draft?.category.trim() || "Fluxo geral";
  const previewColor = draft?.color || DEFAULT_COLOR;
  const isExistingState = Boolean(draft?.id);

  const stateTabs = useMemo(
    () => [...activeStates, ...archivedStates],
    [activeStates, archivedStates]
  );

  const updateDraft = <K extends keyof WorkflowStateDraft>(key: K, value: WorkflowStateDraft[K]) => {
    setDraft(current => (current ? { ...current, [key]: value } : current));
    setMessage("");
    setError("");
  };

  const openNewDraft = useCallback((preset?: (typeof STATE_PRESETS)[number]) => {
    const nextDraft = preset ? createDraftFromPreset(states.length, preset) : createEmptyDraft(states.length);
    setSelectedStateId("new");
    setDraft(nextDraft);
    setPersistedDraft(nextDraft);
    setMessage("");
    setError("");
  }, [states.length]);

  const resetDraft = () => {
    setDraft(persistedDraft);
    setMessage("");
    setError("");
  };

  const handleSave = async () => {
    if (!draft) {
      return;
    }

    const name = draft.name.trim();
    if (name.length < 2) {
      setError("Informe um nome com pelo menos 2 caracteres.");
      return;
    }

    const slug = draft.slug.trim() || toSlug(name);
    if (!slug) {
      setError("Nao foi possivel gerar um slug valido para esse estado.");
      return;
    }

    const orderValue = Number(draft.order);
    const payload = {
      name,
      slug,
      color: previewColor,
      category: draft.category.trim() || null,
      order: Number.isFinite(orderValue) && orderValue >= 0 ? orderValue : states.length,
      isTerminal: draft.isTerminal,
      isEditable: draft.isEditable,
      isActive: draft.isActive
    };

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const workspaceId = await resolveWorkspaceId();
      if (!workspaceId) {
        setError("Workspace nao encontrado.");
        return;
      }

      const savedState: ApiWorkflowState = draft.id
        ? await apiClient.patch(
            `/workspaces/${workspaceId}/workflow-states/${draft.id}`,
            payload,
            { authMode: "required", retryOnUnauthorized: true }
          )
        : await apiClient.post(
            `/workspaces/${workspaceId}/workflow-states`,
            payload,
            { authMode: "required", retryOnUnauthorized: true }
          );

      setSelectedStateId(savedState.id);
      setMessage(draft.id ? "Estado atualizado." : "Estado criado.");
      await loadStates();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nao foi possivel salvar o estado.");
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveToggle = async () => {
    if (!draft?.id) {
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const workspaceId = await resolveWorkspaceId();
      if (!workspaceId) {
        setError("Workspace nao encontrado.");
        return;
      }

      const savedState: ApiWorkflowState = await apiClient.patch(
        `/workspaces/${workspaceId}/workflow-states/${draft.id}`,
        { isActive: !draft.isActive },
        { authMode: "required", retryOnUnauthorized: true }
      );

      setSelectedStateId(savedState.id);
      setMessage(savedState.isActive ? "Estado reativado." : "Estado arquivado.");
      await loadStates();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nao foi possivel atualizar o estado.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wse">
      <section className="wse__topbar">
        <div className="wse__tabs" aria-label="Estados configurados">
          {stateTabs.map(state => (
            <div
              key={state.id}
              className={`wse__tab${selectedStateId === state.id ? " is-active" : ""}${state.isActive ? "" : " is-archived"}`}
            >
              <button
                type="button"
                className="wse__tab-btn"
                onClick={() => {
                  setSelectedStateId(state.id);
                  setMessage("");
                  setError("");
                }}
              >
                <span className="wse__tab-dot" style={{ background: state.color || DEFAULT_COLOR }} />
                <span>{state.name}</span>
              </button>
            </div>
          ))}

          <button type="button" className="wse__add-tab" onClick={() => openNewDraft()}>
            Novo estado
          </button>
        </div>

        <div className="wse__topbar-right">
          {hasUnsavedChanges ? <span className="wse__unsaved-indicator">Alteracoes nao salvas</span> : null}
          <div className="wse__summary">
            <span><strong>{activeStates.length}</strong> ativos</span>
            <span><strong>{terminalCount}</strong> finais</span>
            <span><strong>{editableCount}</strong> editaveis</span>
          </div>
        </div>
      </section>

      <section className="wse__body">
        <aside className="wse__library" aria-label="Biblioteca de estados">
          <div className="wse__panel-head">
            <span className="wse__eyebrow">Biblioteca</span>
            <strong>Estados e presets</strong>
            <p>Escolha um estado existente ou comece por um preset visual.</p>
          </div>

          <div className="wse__panel-scroll">
            <section className="wse__group">
              <h3 className="wse__group-title">Estados do workspace</h3>
              {stateTabs.length === 0 ? (
                <p className="wse__empty">Nenhum estado configurado ainda.</p>
              ) : (
                <div className="wse__chip-list">
                  {stateTabs.map(state => (
                    <button
                      key={state.id}
                      type="button"
                      className={`wse__chip${selectedStateId === state.id ? " is-selected" : ""}`}
                      onClick={() => setSelectedStateId(state.id)}
                    >
                      <span className="wse__chip-main">
                        <i style={{ background: state.color || DEFAULT_COLOR }} />
                        <strong>{state.name}</strong>
                      </span>
                      <span className="wse__chip-meta">
                        <span>/{state.slug}</span>
                        {!state.isActive ? <span>arquivado</span> : null}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="wse__group">
              <h3 className="wse__group-title">Presets rapidos</h3>
              <div className="wse__preset-grid">
                {STATE_PRESETS.map(preset => (
                  <button
                    key={preset.key}
                    type="button"
                    className="wse__preset"
                    onClick={() => openNewDraft(preset)}
                  >
                    <span className="wse__preset-head">
                      <i style={{ background: preset.color }} />
                      <strong>{preset.label}</strong>
                    </span>
                    <span>{preset.category}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </aside>

        <main className="wse__canvas">
          <div className="wse__canvas-tabs">
            <button
              type="button"
              className={`wse__canvas-tab${activeView === "board" ? " is-active" : ""}`}
              onClick={() => setActiveView("board")}
            >
              Board
            </button>
            <button
              type="button"
              className={`wse__canvas-tab${activeView === "detail" ? " is-active" : ""}`}
              onClick={() => setActiveView("detail")}
            >
              Detalhe
            </button>
            <button
              type="button"
              className={`wse__canvas-tab${activeView === "badge" ? " is-active" : ""}`}
              onClick={() => setActiveView("badge")}
            >
              Badge
            </button>
          </div>

          <div className="wse__canvas-surface">
            {activeView === "board" ? (
              <div className="wse__board-preview">
                <div className="wse__lane">
                  <div className="wse__lane-head">
                    <span className="wse__lane-title">
                      <i style={{ background: previewColor }} />
                      {previewName}
                    </span>
                    <span className="wse__lane-count">3 itens</span>
                  </div>

                  <div className="wse__card">
                    <span
                      className="wse__status-pill"
                      style={{
                        background: `${previewColor}1A`,
                        color: previewColor,
                        borderColor: `${previewColor}55`
                      }}
                    >
                      <i style={{ background: previewColor }} />
                      {previewName}
                    </span>
                    <strong>Refinar experiencia de aprovacao</strong>
                    <p>Preview do estado aplicado diretamente na coluna do board.</p>
                    <div className="wse__card-foot">
                      <span>/{previewSlug}</span>
                      <span>{previewCategory}</span>
                    </div>
                  </div>

                  <div className="wse__ghost-card" />
                </div>
              </div>
            ) : null}

            {activeView === "detail" ? (
              <div className="wse__detail-preview">
                <div className="wse__detail-header">
                  <div>
                    <span className="wse__eyebrow">Detalhes do item</span>
                    <h3>Refinar experiencia de aprovacao</h3>
                  </div>
                  <span
                    className="wse__status-pill"
                    style={{
                      background: `${previewColor}1A`,
                      color: previewColor,
                      borderColor: `${previewColor}55`
                    }}
                  >
                    <i style={{ background: previewColor }} />
                    {previewName}
                  </span>
                </div>

                <div className="wse__detail-grid">
                  <div className="wse__detail-field">
                    <span>Categoria</span>
                    <strong>{previewCategory}</strong>
                  </div>
                  <div className="wse__detail-field">
                    <span>Slug</span>
                    <strong>/{previewSlug}</strong>
                  </div>
                  <div className="wse__detail-field">
                    <span>Comportamento</span>
                    <strong>{draft?.isTerminal ? "Finaliza o fluxo" : "Segue no fluxo"}</strong>
                  </div>
                  <div className="wse__detail-field">
                    <span>Edicao</span>
                    <strong>{draft?.isEditable ? "Permitida" : "Bloqueada"}</strong>
                  </div>
                </div>
              </div>
            ) : null}

            {activeView === "badge" ? (
              <div className="wse__badge-preview">
                <span
                  className="wse__status-pill wse__status-pill--lg"
                  style={{
                    background: `${previewColor}1A`,
                    color: previewColor,
                    borderColor: `${previewColor}55`
                  }}
                >
                  <i style={{ background: previewColor }} />
                  {previewName}
                </span>
                <div className="wse__badge-meta">
                  <span>{draft?.isActive ? "Ativo no workspace" : "Arquivado"}</span>
                  <span>{draft?.isTerminal ? "Estado terminal" : "Estado intermediario"}</span>
                  <span>{draft?.isEditable ? "Pode ser editado" : "Bloqueado para edicao"}</span>
                </div>
              </div>
            ) : null}
          </div>
        </main>

        <aside className="wse__inspector" aria-label="Inspector do estado">
          <div className="wse__panel-head">
            <span className="wse__eyebrow">Inspector</span>
            <strong>{isExistingState ? "Editar estado" : "Criar estado"}</strong>
            <p>Mesmo fluxo de builder: selecione, ajuste e salve.</p>
          </div>

          <div className="wse__panel-scroll">
            {draft ? (
              <div className="wse__form">
                <FormField label="Nome">
                  <TextInput
                    value={draft.name}
                    placeholder="Ex: Em validacao"
                    onChange={event => {
                      const nextName = event.target.value;
                      const previousAutoSlug = toSlug(draft.name);
                      updateDraft("name", nextName);
                      if (!draft.slug.trim() || draft.slug.trim() === previousAutoSlug) {
                        setDraft(current => (current ? { ...current, slug: toSlug(nextName) } : current));
                      }
                    }}
                  />
                </FormField>

                <FormField label="Slug">
                  <TextInput
                    value={draft.slug}
                    placeholder="em-validacao"
                    onChange={event => updateDraft("slug", toSlug(event.target.value))}
                  />
                </FormField>

                <FormField label="Categoria">
                  <TextInput
                    value={draft.category}
                    placeholder="Execucao, Revisao, Risco..."
                    onChange={event => updateDraft("category", event.target.value)}
                  />
                </FormField>

                <FormField label="Ordem">
                  <TextInput
                    value={draft.order}
                    inputMode="numeric"
                    placeholder="0"
                    onChange={event => updateDraft("order", event.target.value.replace(/[^\d]/g, ""))}
                  />
                </FormField>

                <FormField label="Cor">
                  <div className="wse__color-row">
                    <input
                      type="color"
                      className="wse__color-picker"
                      value={draft.color}
                      onChange={event => updateDraft("color", event.target.value)}
                    />
                    <TextInput
                      value={draft.color}
                      placeholder="#64748b"
                      onChange={event => updateDraft("color", event.target.value)}
                    />
                  </div>
                </FormField>

                <label className="wse__toggle">
                  <input
                    type="checkbox"
                    checked={draft.isTerminal}
                    onChange={event => updateDraft("isTerminal", event.target.checked)}
                  />
                  <span>
                    <strong>Estado terminal</strong>
                    <small>Esse estado representa o fim do fluxo.</small>
                  </span>
                </label>

                <label className="wse__toggle">
                  <input
                    type="checkbox"
                    checked={draft.isEditable}
                    onChange={event => updateDraft("isEditable", event.target.checked)}
                  />
                  <span>
                    <strong>Permitir edicao</strong>
                    <small>Define se o estado continua ajustavel depois.</small>
                  </span>
                </label>

                <label className="wse__toggle">
                  <input
                    type="checkbox"
                    checked={draft.isActive}
                    onChange={event => updateDraft("isActive", event.target.checked)}
                  />
                  <span>
                    <strong>Estado ativo</strong>
                    <small>Estados inativos saem do fluxo e ficam arquivados.</small>
                  </span>
                </label>

                {message ? <p className="wse__message">{message}</p> : null}
                {error ? <p className="wse__error">{error}</p> : null}

                <div className="wse__actions">
                  <Button type="button" size="sm" onClick={() => void handleSave()} disabled={saving}>
                    {saving ? "Salvando..." : isExistingState ? "Salvar alteracoes" : "Criar estado"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={resetDraft} disabled={saving || !hasUnsavedChanges}>
                    Descartar
                  </Button>
                  {isExistingState ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => void handleArchiveToggle()} disabled={saving}>
                      {draft.isActive ? "Arquivar" : "Reativar"}
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="wse__empty">Selecione um estado para editar.</p>
            )}
          </div>
        </aside>
      </section>

      {loading ? <p className="wse__footer-note">Carregando estados...</p> : null}
    </div>
  );
}
