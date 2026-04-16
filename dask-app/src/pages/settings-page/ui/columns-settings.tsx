import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApiBoardColumn, ApiWorkflowState } from "@/modules/workspace/model";
import { useWorkspace } from "@/modules/workspace";
import { Button, FormField, Select, TextInput } from "@/shared/ui";
import "./general-settings.css";
import "./columns-settings.css";

interface EditState {
  id: string;
  name: string;
  defaultStateId: string;
}

export function ColumnsSettings() {
  const {
    fetchBoardColumns,
    fetchWorkflowStates,
    createBoardColumn,
    updateBoardColumn,
    deleteBoardColumn
  } = useWorkspace();

  const [columns, setColumns] = useState<ApiBoardColumn[]>([]);
  const [workflowStates, setWorkflowStates] = useState<ApiWorkflowState[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [newName, setNewName] = useState<string | null>(null);
  const [newDefaultStateId, setNewDefaultStateId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeStates = useMemo(
    () => workflowStates.filter(state => state.isActive),
    [workflowStates]
  );

  const loadConfig = useCallback(async () => {
    setLoadingList(true);
    try {
      const [items, states] = await Promise.all([fetchBoardColumns(), fetchWorkflowStates()]);
      setColumns(items);
      setWorkflowStates(states);
      if (!newDefaultStateId && states.length > 0) {
        setNewDefaultStateId(states[0].id);
      }
    } finally {
      setLoadingList(false);
    }
  }, [fetchBoardColumns, fetchWorkflowStates, newDefaultStateId]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const handleStartEdit = (col: ApiBoardColumn) => {
    setEditing({ id: col.id, name: col.name, defaultStateId: col.stateIds[0] ?? (activeStates[0]?.id ?? "") });
    setNewName(null);
  };

  const handleCancelEdit = () => setEditing(null);

  const handleSaveEdit = async () => {
    if (!editing || !editing.name.trim()) return;
    setSaving(true);
    try {
      await updateBoardColumn(editing.id, {
        name: editing.name.trim(),
        stateIds: editing.defaultStateId ? [editing.defaultStateId] : []
      });
      setEditing(null);
      await loadConfig();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (colId: string) => {
    setDeletingId(colId);
    try {
      await deleteBoardColumn(colId);
      await loadConfig();
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreate = async () => {
    if (newName === null || !newName.trim()) return;
    setSaving(true);
    try {
      await createBoardColumn({
        name: newName.trim(),
        stateIds: newDefaultStateId ? [newDefaultStateId] : []
      });
      setNewName(null);
      await loadConfig();
    } finally {
      setSaving(false);
    }
  };

  const activeColumns = columns.filter(column => column.isActive !== false);
  const columnsWithState = activeColumns.filter(column => column.stateIds.length > 0).length;
  const wipColumns = activeColumns.filter(column => column.wipLimit !== null).length;
  const progressWidth = Math.min(100, Math.max(12, activeColumns.length * 22));

  return (
    <div className="general-settings columns-settings">
      <section className="general-settings__builder-hero columns-settings__hero">
        <div className="general-settings__builder-copy">
          <span>Colunas</span>
          <h1>Organize o board como o usuario trabalha.</h1>
          <p>
            Cada coluna pode apontar para um estado automatico. Ao mover um card, o estado muda junto.
          </p>
        </div>

        <div className="general-settings__live-preview columns-settings__preview" aria-label="Preview das colunas">
          {activeColumns.slice(0, 6).map(col => (
            <div key={`preview-${col.id}`} className="general-settings__preview-column columns-settings__preview-column">
              <span>
                <i style={{ background: activeStates.find(state => state.id === col.stateIds[0])?.color ?? "#0a86e8" }} />
                {col.name}
              </span>
              <div className="general-settings__preview-card">
                <strong>{activeStates.find(state => state.id === col.stateIds[0])?.name ?? "Sem estado"}</strong>
                <small>{col.wipLimit !== null ? `WIP ${col.wipLimit}` : `/${col.slug}`}</small>
              </div>
            </div>
          ))}

          {activeColumns.length === 0 && !loadingList && (
            <div className="general-settings__preview-column columns-settings__preview-column">
              <span>
                <i style={{ background: "#0a86e8" }} />
                Nova coluna
              </span>
              <div className="general-settings__preview-card">
                <strong>Board vazio</strong>
                <small>Crie a primeira coluna</small>
              </div>
            </div>
          )}
        </div>

        <div className="general-settings__progress">
          <div>
            <strong>{activeColumns.length} colunas ativas</strong>
            <small>{columnsWithState} com estado automatico</small>
          </div>
          <span><i style={{ width: `${progressWidth}%` }} /></span>
        </div>
      </section>

      <section className="general-settings__preferences-row columns-settings__top-row">
        <div className="general-settings__preference-card">
          <div className="columns-settings__create-header">
            <div>
              <h2>Nova coluna</h2>
              <p>Crie uma coluna e defina qual estado sera aplicado aos cards movidos para ela.</p>
            </div>
            {newName === null ? (
              <Button type="button" size="sm" onClick={() => { setNewName(""); setEditing(null); }}>
                Nova coluna
              </Button>
            ) : null}
          </div>

          {newName !== null ? (
            <div className="columns-settings__form-row columns-settings__form-row--create">
              <div className="columns-settings__form-fields">
                <FormField label="Nome da nova coluna">
                  <TextInput
                    value={newName}
                    placeholder="Ex: Em validacao"
                    autoFocus
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") void handleCreate();
                      if (e.key === "Escape") setNewName(null);
                    }}
                  />
                </FormField>

                <FormField label="State automatico da coluna">
                  <Select value={newDefaultStateId} onChange={e => setNewDefaultStateId(e.target.value)}>
                    {activeStates.map(state => (
                      <option key={state.id} value={state.id}>{state.name}</option>
                    ))}
                  </Select>
                </FormField>
              </div>

              <div className="columns-settings__form-actions">
                <Button type="button" size="sm" onClick={() => void handleCreate()} disabled={saving || !newName.trim()}>
                  {saving ? "Criando..." : "Criar"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setNewName(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="general-settings__summary-card">
          <h2>Resumo</h2>
          <div className="general-settings__summary-grid">
            <span><strong>{activeColumns.length}</strong> ativas</span>
            <span><strong>{columnsWithState}</strong> com estado</span>
            <span><strong>{wipColumns}</strong> com WIP</span>
            <span><strong>{activeStates.length}</strong> estados</span>
          </div>
        </div>
      </section>

      <section className="general-settings__templates columns-settings__panel">
        <header>
          <span>Board</span>
          <h2>Colunas do board</h2>
        </header>

        <div className="columns-settings__list">
          {loadingList && <p className="columns-settings__empty">Carregando...</p>}

          {!loadingList && columns.length === 0 && newName === null && (
            <p className="columns-settings__empty">Nenhuma coluna configurada ainda.</p>
          )}

          {columns.map(col => (
            <div key={col.id} className="columns-settings__row">
              {editing?.id === col.id ? (
                <div className="columns-settings__form-row">
                  <div className="columns-settings__form-fields">
                    <FormField label="Nome da coluna">
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

                    <FormField label="State automatico da coluna">
                      <Select
                        value={editing.defaultStateId}
                        onChange={e => setEditing({ ...editing, defaultStateId: e.target.value })}
                      >
                        {activeStates.map(state => (
                          <option key={state.id} value={state.id}>{state.name}</option>
                        ))}
                      </Select>
                    </FormField>
                  </div>

                  <div className="columns-settings__form-actions">
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
                  <div className="columns-settings__row-info">
                    <span className="columns-settings__row-name">{col.name}</span>
                    <span className="columns-settings__row-id">/{col.slug}</span>
                    {col.wipLimit !== null && (
                      <span className="columns-settings__wip">WIP {col.wipLimit}</span>
                    )}
                    <span className="columns-settings__wip">
                      State automatico: {activeStates.find(state => state.id === col.stateIds[0])?.name ?? "Nao definido"}
                    </span>
                  </div>
                  <div className="columns-settings__row-actions">
                    <Button type="button" size="sm" variant="outline" onClick={() => handleStartEdit(col)}>
                      Editar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void handleDelete(col.id)}
                      disabled={deletingId === col.id}
                    >
                      {deletingId === col.id ? "Removendo..." : "Remover"}
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
