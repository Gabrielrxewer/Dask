import { useCallback, useEffect, useState } from "react";
import { Button, FormField, TextInput } from "@/shared/ui";
import { apiClient } from "@/shared/api/http-client";
import { workspaceService } from "@/modules/workspace/api";
import { useParams } from "react-router-dom";
import "./general-settings.css";
import "./workflow-states-settings.css";

interface ApiWorkflowState {
  id: string;
  name: string;
  slug: string;
  color: string;
  category: string | null;
  isTerminal: boolean;
  isEditable: boolean;
  isActive: boolean;
}

interface EditState {
  id: string;
  name: string;
  color: string;
}

const DEFAULT_COLOR = "#64748b";

export function WorkflowStatesSettings() {
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();

  const [states, setStates] = useState<ApiWorkflowState[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [newState, setNewState] = useState<{ name: string; color: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Resolve workspaceId e carrega states diretamente
  const loadStates = useCallback(async () => {
    if (!workspaceSlug) return;
    setLoadingList(true);
    try {
      // Reusa o cache interno do workspaceService para resolver o id
      const workspaces = await workspaceService.listWorkspaces();
      const ws = workspaces.find(w => w.slug === workspaceSlug);
      if (!ws) return;
      const items = await apiClient.get<ApiWorkflowState[]>(
        `/workspaces/${ws.id}/workflow-states`,
        { authMode: "required", retryOnUnauthorized: true }
      );
      setStates(items);
    } finally {
      setLoadingList(false);
    }
  }, [workspaceSlug]);

  const resolveId = useCallback(async (): Promise<string | null> => {
    const workspaces = await workspaceService.listWorkspaces();
    return workspaces.find(w => w.slug === workspaceSlug)?.id ?? null;
  }, [workspaceSlug]);

  useEffect(() => {
    void loadStates();
  }, [loadStates]);

  const handleStartEdit = (state: ApiWorkflowState) => {
    setEditing({ id: state.id, name: state.name, color: state.color || DEFAULT_COLOR });
    setNewState(null);
  };

  const handleCancelEdit = () => setEditing(null);

  const handleSaveEdit = async () => {
    if (!editing || !editing.name.trim()) return;
    setSaving(true);
    try {
      const wsId = await resolveId();
      if (!wsId) return;
      await apiClient.patch(`/workspaces/${wsId}/workflow-states/${editing.id}`, {
        name: editing.name.trim(),
        color: editing.color
      }, { authMode: "required", retryOnUnauthorized: true });
      setEditing(null);
      await loadStates();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (stateId: string) => {
    setDeletingId(stateId);
    try {
      const wsId = await resolveId();
      if (!wsId) return;
      await apiClient.patch(`/workspaces/${wsId}/workflow-states/${stateId}`, { isActive: false }, {
        authMode: "required", retryOnUnauthorized: true
      });
      await loadStates();
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreate = async () => {
    if (!newState || !newState.name.trim()) return;
    setSaving(true);
    try {
      const wsId = await resolveId();
      if (!wsId) return;
      await apiClient.post(`/workspaces/${wsId}/workflow-states`, {
        name: newState.name.trim(),
        color: newState.color
      }, { authMode: "required", retryOnUnauthorized: true });
      setNewState(null);
      await loadStates();
    } finally {
      setSaving(false);
    }
  };

  const activeStates = states.filter(state => state.isActive !== false);
  const terminalStates = activeStates.filter(state => state.isTerminal).length;
  const editableStates = activeStates.filter(state => state.isEditable !== false).length;
  const progressWidth = Math.min(100, Math.max(12, activeStates.length * 22));

  return (
    <div className="general-settings workflow-states-settings">
      <section className="general-settings__builder-hero workflow-states-settings__hero">
        <div className="general-settings__builder-copy">
          <span>Estados</span>
          <h1>Defina o fluxo de trabalho do board.</h1>
          <p>
            Estados aparecem como etapas do processo. Cada tarefa avanca por esse fluxo ate chegar a um estado final.
          </p>
        </div>

        <div className="general-settings__live-preview workflow-states-settings__preview" aria-label="Preview dos estados">
          {(activeStates.length > 0 ? activeStates : states).slice(0, 6).map(state => (
            <div key={state.id} className="general-settings__preview-column workflow-states-settings__preview-column">
              <span>
                <i style={{ background: state.color || DEFAULT_COLOR }} />
                {state.name}
              </span>
              <div className="general-settings__preview-card">
                <strong>{state.isTerminal ? "Final" : "Em fluxo"}</strong>
                <small>/{state.slug}</small>
              </div>
            </div>
          ))}

          {!loadingList && states.length === 0 && (
            <div className="general-settings__preview-column workflow-states-settings__preview-column">
              <span>
                <i style={{ background: DEFAULT_COLOR }} />
                Novo estado
              </span>
              <div className="general-settings__preview-card">
                <strong>Fluxo vazio</strong>
                <small>Crie o primeiro estado</small>
              </div>
            </div>
          )}
        </div>

        <div className="general-settings__progress">
          <div>
            <strong>{activeStates.length} estados ativos</strong>
            <small>{terminalStates} finais no fluxo</small>
          </div>
          <span><i style={{ width: `${progressWidth}%` }} /></span>
        </div>
      </section>

      <section className="general-settings__preferences-row workflow-states-settings__top-row">
        <div className="general-settings__preference-card">
          <div className="workflow-states-settings__create-header">
            <div>
              <h2>Novo estado</h2>
              <p>Adicione uma etapa com nome e cor para identificar o fluxo.</p>
            </div>
            {!newState ? (
              <Button type="button" size="sm" onClick={() => { setNewState({ name: "", color: DEFAULT_COLOR }); setEditing(null); }}>
                Novo estado
              </Button>
            ) : null}
          </div>

          {newState !== null ? (
            <div className="workflow-states-settings__form-row workflow-states-settings__form-row--create">
              <div className="workflow-states-settings__form-fields">
                <FormField label="Nome do estado">
                  <TextInput
                    value={newState.name}
                    placeholder="Ex: Em validacao, Blocked..."
                    autoFocus
                    onChange={e => setNewState({ ...newState, name: e.target.value })}
                    onKeyDown={e => {
                      if (e.key === "Enter") void handleCreate();
                      if (e.key === "Escape") setNewState(null);
                    }}
                  />
                </FormField>
                <FormField label="Cor">
                  <div className="workflow-states-settings__color-row">
                    <input
                      type="color"
                      className="workflow-states-settings__color-picker"
                      value={newState.color}
                      onChange={e => setNewState({ ...newState, color: e.target.value })}
                    />
                    <TextInput
                      value={newState.color}
                      placeholder="#64748b"
                      onChange={e => setNewState({ ...newState, color: e.target.value })}
                    />
                  </div>
                </FormField>
              </div>
              <div className="workflow-states-settings__form-actions">
                <Button type="button" size="sm" onClick={() => void handleCreate()} disabled={saving || !newState.name.trim()}>
                  {saving ? "Criando..." : "Criar"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setNewState(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="general-settings__summary-card">
          <h2>Resumo</h2>
          <div className="general-settings__summary-grid">
            <span><strong>{activeStates.length}</strong> ativos</span>
            <span><strong>{terminalStates}</strong> finais</span>
            <span><strong>{editableStates}</strong> editaveis</span>
            <span><strong>{states.length}</strong> cadastrados</span>
          </div>
        </div>
      </section>

      <section className="general-settings__templates workflow-states-settings__panel">
        <header>
          <span>Fluxo</span>
          <h2>Estados do board</h2>
        </header>

        <div className="workflow-states-settings__list">
          {loadingList && <p className="workflow-states-settings__empty">Carregando...</p>}

          {!loadingList && states.length === 0 && !newState && (
            <p className="workflow-states-settings__empty">Nenhum estado configurado.</p>
          )}

          {states.map(state => (
            <div key={state.id} className="workflow-states-settings__row">
              {editing?.id === state.id ? (
                <div className="workflow-states-settings__form-row">
                  <div className="workflow-states-settings__form-fields">
                    <FormField label="Nome do estado">
                      <TextInput
                        value={editing.name}
                        autoFocus
                        onChange={e => setEditing({ ...editing, name: e.target.value })}
                        onKeyDown={e => {
                          if (e.key === "Enter") void handleSaveEdit();
                          if (e.key === "Escape") handleCancelEdit();
                        }}
                      />
                    </FormField>
                    <FormField label="Cor">
                      <div className="workflow-states-settings__color-row">
                        <input
                          type="color"
                          className="workflow-states-settings__color-picker"
                          value={editing.color}
                          onChange={e => setEditing({ ...editing, color: e.target.value })}
                        />
                        <TextInput
                          value={editing.color}
                          onChange={e => setEditing({ ...editing, color: e.target.value })}
                        />
                      </div>
                    </FormField>
                  </div>
                  <div className="workflow-states-settings__form-actions">
                    <Button type="button" size="sm" onClick={() => void handleSaveEdit()} disabled={saving || !editing.name.trim()}>
                      {saving ? "Salvando..." : "Salvar"}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={handleCancelEdit}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="workflow-states-settings__row-info">
                    <span className="workflow-states-settings__dot" style={{ background: state.color || DEFAULT_COLOR }} />
                    <span className="workflow-states-settings__row-name">{state.name}</span>
                    <span className="workflow-states-settings__row-slug">/{state.slug}</span>
                    {state.isTerminal && <span className="workflow-states-settings__tag">terminal</span>}
                    {state.category && <span className="workflow-states-settings__tag">{state.category}</span>}
                  </div>
                  <div className="workflow-states-settings__row-actions">
                    {state.isEditable !== false && (
                      <Button type="button" size="sm" variant="outline" onClick={() => handleStartEdit(state)}>
                        Renomear
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void handleDelete(state.id)}
                      disabled={deletingId === state.id}
                    >
                      {deletingId === state.id ? "Removendo..." : "Remover"}
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
