import { useCallback, useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import {
  useCurrentWorkspace,
  useSaveWorkflowStateMutation,
  useWorkspaceSettingsPermissions,
  useWorkflowStatesQuery
} from "@/modules/workspace";
import type { ApiWorkflowState } from "@/modules/workspace/model";
import { AppForm, AppFormField, Button, EmptyState, LoadingState, PanelMenu, PanelMenuGroup, PanelMenuItem, TextInput } from "@/shared/ui";
import { resolveCssColorForInput, withCssColorAlpha } from "@/shared/lib/color/css-color";
import {
  DEFAULT_WORKFLOW_STATE_COLOR,
  toWorkflowStateSlug,
  workflowStateFormSchema,
  type WorkflowStateFormInput,
  type WorkflowStateFormValues
} from "./workflow-states-settings.model";
import "./workflow-states-settings.css";

type WorkflowStateDraft = WorkflowStateFormInput;

const STATE_PRESETS = [
  { key: "backlog", label: "Backlog", slug: "backlog", color: "var(--text-secondary)", category: "Planejamento", isTerminal: false },
  { key: "doing", label: "Em progresso", slug: "em-progresso", color: "var(--text-secondary)", category: "Execucao", isTerminal: false },
  { key: "review", label: "Em revisao", slug: "em-revisao", color: "var(--warning)", category: "Qualidade", isTerminal: false },
  { key: "done", label: "Concluido", slug: "concluido", color: "var(--success)", category: "Entrega", isTerminal: true },
  { key: "blocked", label: "Bloqueado", slug: "bloqueado", color: "var(--danger)", category: "Risco", isTerminal: false }
] as const;

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
    color: state.color || DEFAULT_WORKFLOW_STATE_COLOR,
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
    color: DEFAULT_WORKFLOW_STATE_COLOR,
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

export function WorkflowStatesSettings() {
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const { snapshot } = useCurrentWorkspace();
  const permissions = useWorkspaceSettingsPermissions(workspaceSlug, snapshot);
  const workflowStatesQuery = useWorkflowStatesQuery(workspaceSlug);
  const saveWorkflowStateMutation = useSaveWorkflowStateMutation(workspaceSlug);

  const form = useForm<WorkflowStateFormInput, unknown, WorkflowStateFormValues>({
    resolver: zodResolver(workflowStateFormSchema),
    defaultValues: createEmptyDraft(0),
    mode: "onChange"
  });
  const [activeView, setActiveView] = useState<"board" | "detail" | "badge">("board");
  const [selectedStateId, setSelectedStateId] = useState<string | "new" | null>(null);
  const [error, setError] = useState("");

  const draft = form.watch();
  const states = useMemo(() => sortStates(workflowStatesQuery.data ?? []), [workflowStatesQuery.data]);
  const loading = workflowStatesQuery.isLoading;
  const saving = saveWorkflowStateMutation.isPending;
  const canManageWorkflowStates = permissions.canManageWorkflowStates;

  useEffect(() => {
    if (loading) {
      return;
    }

    setSelectedStateId(current => {
      if (current === "new") {
        return current;
      }
      if (current && states.some(state => state.id === current)) {
        return current;
      }
      return states[0]?.id ?? "new";
    });
  }, [loading, states]);

  useEffect(() => {
    if (workflowStatesQuery.isError) {
      setError("Nao foi possivel carregar os estados do workflow.");
    }
  }, [workflowStatesQuery.isError]);

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
      form.reset(empty);
      return;
    }

    if (!selectedState) {
      return;
    }

    const nextDraft = createDraftFromState(selectedState, states.length);
    form.reset(nextDraft);
  }, [form, selectedState, selectedStateId, states.length]);

  const hasUnsavedChanges = form.formState.isDirty;

  const previewName = draft.name.trim() || "Novo estado";
  const previewSlug = draft.slug.trim() || toWorkflowStateSlug(draft.name) || "novo-estado";
  const previewCategory = draft.category.trim() || "Fluxo geral";
  const previewColor = draft.color || DEFAULT_WORKFLOW_STATE_COLOR;
  const isExistingState = Boolean(draft.id);

  const stateTabs = useMemo(
    () => [...activeStates, ...archivedStates],
    [activeStates, archivedStates]
  );

  const openNewDraft = useCallback((preset?: (typeof STATE_PRESETS)[number]) => {
    if (!canManageWorkflowStates) {
      return;
    }

    const nextDraft = preset ? createDraftFromPreset(states.length, preset) : createEmptyDraft(states.length);
    setSelectedStateId("new");
    form.reset(nextDraft);
    setError("");
  }, [canManageWorkflowStates, form, states.length]);

  const resetDraft = () => {
    form.reset();
    setError("");
  };

  const applySavedState = (savedState: ApiWorkflowState) => {
    const nextDraft = createDraftFromState(savedState, states.length);
    setSelectedStateId(savedState.id);
    form.reset(nextDraft);
  };

  const handleSave = async (values: WorkflowStateFormValues) => {
    if (!canManageWorkflowStates) {
      setError("Apenas proprietarios e admins podem alterar estados.");
      return;
    }

    const orderValue = Number(values.order);
    const payload = {
      name: values.name,
      slug: values.slug,
      color: values.color,
      category: values.category || null,
      order: Number.isFinite(orderValue) && orderValue >= 0 ? orderValue : states.length,
      isTerminal: values.isTerminal,
      isEditable: values.isEditable,
      isActive: values.isActive
    };

    setError("");

    try {
      const snapshot = await saveWorkflowStateMutation.mutateAsync(
        values.id
          ? { action: "update", stateId: values.id, input: payload, successMessage: "Estado atualizado." }
          : { action: "create", input: payload, successMessage: "Estado criado." }
      );
      const savedState = sortStates(snapshot.workflowStates ?? []).find(state =>
        values.id ? state.id === values.id : state.slug === values.slug
      );

      if (savedState) {
        applySavedState(savedState);
        return;
      }

      const refreshed = await workflowStatesQuery.refetch();
      const refreshedState = sortStates(refreshed.data ?? []).find(state =>
        values.id ? state.id === values.id : state.slug === values.slug
      );
      if (refreshedState) {
        applySavedState(refreshedState);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nao foi possivel salvar o estado.");
    }
  };

  const handleArchiveToggle = async () => {
    if (!draft.id) {
      return;
    }
    if (!canManageWorkflowStates) {
      setError("Apenas proprietarios e admins podem alterar estados.");
      return;
    }

    setError("");

    try {
      const snapshot = await saveWorkflowStateMutation.mutateAsync({
        action: "update",
        stateId: draft.id,
        input: { isActive: !draft.isActive },
        successMessage: draft.isActive ? "Estado arquivado." : "Estado reativado."
      });
      const savedState = sortStates(snapshot.workflowStates ?? []).find(state => state.id === draft.id);

      if (savedState) {
        applySavedState(savedState);
        return;
      }

      const refreshed = await workflowStatesQuery.refetch();
      const refreshedState = sortStates(refreshed.data ?? []).find(state => state.id === draft.id);
      if (refreshedState) {
        applySavedState(refreshedState);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Nao foi possivel atualizar o estado.");
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
                  setError("");
                }}
              >
                <span className="wse__tab-dot" style={{ background: state.color || DEFAULT_WORKFLOW_STATE_COLOR }} />
                <span>{state.name}</span>
              </button>
            </div>
          ))}

          <button
            type="button"
            className="wse__add-tab"
            onClick={() => openNewDraft()}
            disabled={!canManageWorkflowStates || saving}
          >
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
          <PanelMenu
            eyebrow="Biblioteca"
            title="Estados e presets"
          >
            <PanelMenuGroup label="Estados do workspace">
              {stateTabs.length === 0 ? (
                <EmptyState size="compact">Nenhum estado configurado ainda.</EmptyState>
              ) : (
                stateTabs.map(state => (
                  <PanelMenuItem
                    key={state.id}
                    variant="chip"
                    selected={selectedStateId === state.id}
                    onClick={() => setSelectedStateId(state.id)}
                    leading={<i className="wse__state-dot" style={{ background: state.color || DEFAULT_WORKFLOW_STATE_COLOR }} />}
                    label={state.name}
                    meta={`/${state.slug}${!state.isActive ? " · arquivado" : ""}`}
                  />
                ))
              )}
            </PanelMenuGroup>

            <PanelMenuGroup label="Presets rapidos" tone="new">
              {STATE_PRESETS.map(preset => (
                <PanelMenuItem
                  key={preset.key}
                  variant="chip"
                  onClick={() => openNewDraft(preset)}
                  disabled={!canManageWorkflowStates || saving}
                  leading={<i className="wse__state-dot" style={{ background: preset.color }} />}
                  label={preset.label}
                  meta={preset.category}
                />
              ))}
            </PanelMenuGroup>
          </PanelMenu>
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
                        background: withCssColorAlpha(previewColor, 10),
                        color: previewColor,
                        borderColor: withCssColorAlpha(previewColor, 33)
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
                      background: withCssColorAlpha(previewColor, 10),
                      color: previewColor,
                      borderColor: withCssColorAlpha(previewColor, 33)
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
                    <strong>{draft.isTerminal ? "Finaliza o fluxo" : "Segue no fluxo"}</strong>
                  </div>
                  <div className="wse__detail-field">
                    <span>Edicao</span>
                    <strong>{draft.isEditable ? "Permitida" : "Bloqueada"}</strong>
                  </div>
                </div>
              </div>
            ) : null}

            {activeView === "badge" ? (
              <div className="wse__badge-preview">
                <span
                  className="wse__status-pill wse__status-pill--lg"
                  style={{
                    background: withCssColorAlpha(previewColor, 10),
                    color: previewColor,
                    borderColor: withCssColorAlpha(previewColor, 33)
                  }}
                >
                  <i style={{ background: previewColor }} />
                  {previewName}
                </span>
                <div className="wse__badge-meta">
                  <span>{draft.isActive ? "Ativo no workspace" : "Arquivado"}</span>
                  <span>{draft.isTerminal ? "Estado terminal" : "Estado intermediario"}</span>
                  <span>{draft.isEditable ? "Pode ser editado" : "Bloqueado para edicao"}</span>
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
            {!canManageWorkflowStates && permissions.readOnlyReason ? (
              <p className="wse__error">{permissions.readOnlyReason}</p>
            ) : null}
          </div>

          <div className="wse__panel-scroll">
            {draft ? (
              <AppForm
                form={form}
                onSubmit={handleSave}
                className="wse__form"
                disabled={!canManageWorkflowStates}
                loading={saving}
              >
                <Controller
                  control={form.control}
                  name="name"
                  render={({ field, fieldState }) => (
                    <AppFormField label="Nome" error={fieldState.error?.message}>
                      <TextInput
                        ref={field.ref}
                        name={field.name}
                        value={field.value}
                        placeholder="Ex: Em validacao"
                        disabled={!canManageWorkflowStates || saving}
                        aria-invalid={fieldState.invalid || undefined}
                        onBlur={field.onBlur}
                        onChange={event => {
                          const nextName = event.target.value;
                          const previousAutoSlug = toWorkflowStateSlug(form.getValues("name"));
                          const currentSlug = form.getValues("slug");
                          field.onChange(nextName);
                          if (!currentSlug.trim() || currentSlug.trim() === previousAutoSlug) {
                            form.setValue("slug", toWorkflowStateSlug(nextName), { shouldDirty: true, shouldValidate: true });
                          }
                          setError("");
                        }}
                      />
                    </AppFormField>
                  )}
                />

                <AppFormField label="Slug" error={form.formState.errors.slug?.message}>
                  <TextInput
                    {...form.register("slug", {
                      onChange: event => {
                        event.target.value = toWorkflowStateSlug(event.target.value);
                        setError("");
                      }
                    })}
                    placeholder="em-validacao"
                    disabled={!canManageWorkflowStates || saving}
                    aria-invalid={form.formState.errors.slug ? true : undefined}
                  />
                </AppFormField>

                <AppFormField label="Categoria" error={form.formState.errors.category?.message}>
                  <TextInput
                    {...form.register("category", { onChange: () => setError("") })}
                    placeholder="Execucao, Revisao, Risco..."
                    disabled={!canManageWorkflowStates || saving}
                  />
                </AppFormField>

                <AppFormField label="Ordem" error={form.formState.errors.order?.message}>
                  <TextInput
                    {...form.register("order", {
                      onChange: event => {
                        event.target.value = event.target.value.replace(/[^\d]/g, "");
                        setError("");
                      }
                    })}
                    inputMode="numeric"
                    placeholder="0"
                    disabled={!canManageWorkflowStates || saving}
                    aria-invalid={form.formState.errors.order ? true : undefined}
                  />
                </AppFormField>

                <Controller
                  control={form.control}
                  name="color"
                  render={({ field, fieldState }) => (
                    <AppFormField label="Cor" error={fieldState.error?.message}>
                      <div className="wse__color-row">
                        <input
                          type="color"
                          className="wse__color-picker"
                          value={resolveCssColorForInput(field.value)}
                          disabled={!canManageWorkflowStates || saving}
                          onChange={event => {
                            field.onChange(event.target.value);
                            setError("");
                          }}
                        />
                        <TextInput
                          ref={field.ref}
                          name={field.name}
                          value={field.value}
                          placeholder="var(--text-secondary)"
                          disabled={!canManageWorkflowStates || saving}
                          aria-invalid={fieldState.invalid || undefined}
                          onBlur={field.onBlur}
                          onChange={event => {
                            field.onChange(event.target.value);
                            setError("");
                          }}
                        />
                      </div>
                    </AppFormField>
                  )}
                />

                <Controller
                  control={form.control}
                  name="isTerminal"
                  render={({ field }) => (
                    <label className="wse__toggle">
                      <input
                        type="checkbox"
                        checked={field.value}
                        disabled={!canManageWorkflowStates || saving}
                        onChange={event => field.onChange(event.target.checked)}
                      />
                      <span>
                        <strong>Estado terminal</strong>
                        <small>Esse estado representa o fim do fluxo.</small>
                      </span>
                    </label>
                  )}
                />

                <Controller
                  control={form.control}
                  name="isEditable"
                  render={({ field }) => (
                    <label className="wse__toggle">
                      <input
                        type="checkbox"
                        checked={field.value}
                        disabled={!canManageWorkflowStates || saving}
                        onChange={event => field.onChange(event.target.checked)}
                      />
                      <span>
                        <strong>Permitir edicao</strong>
                        <small>Define se o estado continua ajustavel depois.</small>
                      </span>
                    </label>
                  )}
                />

                <Controller
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <label className="wse__toggle">
                      <input
                        type="checkbox"
                        checked={field.value}
                        disabled={!canManageWorkflowStates || saving}
                        onChange={event => field.onChange(event.target.checked)}
                      />
                      <span>
                        <strong>Estado ativo</strong>
                        <small>Estados inativos saem do fluxo e ficam arquivados.</small>
                      </span>
                    </label>
                  )}
                />

                {error ? <p className="wse__error">{error}</p> : null}

                <div className="wse__actions">
                  <Button type="submit" size="sm" disabled={!canManageWorkflowStates || saving}>
                    {saving ? "Salvando..." : isExistingState ? "Salvar alteracoes" : "Criar estado"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={resetDraft} disabled={!canManageWorkflowStates || saving || !hasUnsavedChanges}>
                    Descartar
                  </Button>
                  {isExistingState ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => void handleArchiveToggle()} disabled={!canManageWorkflowStates || saving}>
                      {draft.isActive ? "Arquivar" : "Reativar"}
                    </Button>
                  ) : null}
                </div>
              </AppForm>
            ) : (
              <EmptyState className="wse__empty" size="compact">Selecione um estado para editar.</EmptyState>
            )}
          </div>
        </aside>
      </section>

      {loading ? <LoadingState className="wse__footer-note" text="Carregando estados" animation="settings" /> : null}
    </div>
  );
}
