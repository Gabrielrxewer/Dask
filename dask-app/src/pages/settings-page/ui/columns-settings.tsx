import { useCallback, useEffect, useState } from "react";
import type { ApiBoardColumn } from "@/modules/workspace/model";
import { useWorkspace } from "@/modules/workspace";
import { Button, FormField, Section, TextInput } from "@/shared/ui";
import "./columns-settings.css";

interface EditState {
  id: string;
  name: string;
}

export function ColumnsSettings() {
  const { fetchBoardColumns, createBoardColumn, updateBoardColumn, deleteBoardColumn } = useWorkspace();

  const [columns, setColumns] = useState<ApiBoardColumn[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [newName, setNewName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadColumns = useCallback(async () => {
    setLoadingList(true);
    try {
      const items = await fetchBoardColumns();
      setColumns(items);
    } finally {
      setLoadingList(false);
    }
  }, [fetchBoardColumns]);

  useEffect(() => {
    void loadColumns();
  }, [loadColumns]);

  const handleStartEdit = (col: ApiBoardColumn) => {
    setEditing({ id: col.id, name: col.name });
    setNewName(null);
  };

  const handleCancelEdit = () => setEditing(null);

  const handleSaveEdit = async () => {
    if (!editing || !editing.name.trim()) return;
    setSaving(true);
    try {
      await updateBoardColumn(editing.id, { name: editing.name.trim() });
      setEditing(null);
      await loadColumns();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (colId: string) => {
    setDeletingId(colId);
    try {
      await deleteBoardColumn(colId);
      await loadColumns();
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreate = async () => {
    if (newName === null || !newName.trim()) return;
    setSaving(true);
    try {
      await createBoardColumn({ name: newName.trim() });
      setNewName(null);
      await loadColumns();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="columns-settings">
      <Section
        title="Colunas do board"
        subtitle="Gerencie as colunas que aparecem no board. Remover uma coluna nao apaga os itens nela."
        actions={
          newName === null ? (
            <Button type="button" size="sm" onClick={() => { setNewName(""); setEditing(null); }}>
              Nova coluna
            </Button>
          ) : undefined
        }
      >
        <div className="columns-settings__list">
          {newName !== null && (
            <div className="columns-settings__form-row">
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
              <div className="columns-settings__form-actions">
                <Button type="button" size="sm" onClick={() => void handleCreate()} disabled={saving || !newName.trim()}>
                  {saving ? "Criando..." : "Criar"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setNewName(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {loadingList && <p className="columns-settings__empty">Carregando...</p>}

          {!loadingList && columns.length === 0 && newName === null && (
            <p className="columns-settings__empty">Nenhuma coluna configurada ainda.</p>
          )}

          {columns.map(col => (
            <div key={col.id} className="columns-settings__row">
              {editing?.id === col.id ? (
                <div className="columns-settings__form-row">
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
                  </div>
                  <div className="columns-settings__row-actions">
                    <Button type="button" size="sm" variant="outline" onClick={() => handleStartEdit(col)}>
                      Renomear
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
      </Section>
    </div>
  );
}
