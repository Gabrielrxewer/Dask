import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/modules/workspace";
import { Button, FormField, Section, TextInput } from "@/shared/ui";
import { apiClient } from "@/shared/api/http-client";
import { workspaceService } from "@/modules/workspace/api";
import { useParams } from "react-router-dom";
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
  const { createBoardColumn } = useWorkspace(); // reutiliza snapshot refresh via updateBoardColumn

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

  return (
    <div className="workflow-states-settings">
      <Section
        title="Workflow States"
        subtitle="Estados que aparecem como colunas no board. Cada tarefa avanca entre esses estados."
        actions={
          !newState ? (
            <Button type="button" size="sm" onClick={() => { setNewState({ name: "", color: DEFAULT_COLOR }); setEditing(null); }}>
              Novo estado
            </Button>
          ) : undefined
        }
      >
        <div className="workflow-states-settings__list">
          {newState !== null && (
            <div className="workflow-states-settings__form-row">
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
          )}

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
      </Section>
    </div>
  );
}
