import { useCallback, useEffect, useState } from "react";
import type { ApiItemType } from "@/modules/workspace/model";
import { factoryBoardConfig } from "@/entities/task";
import { useWorkspace } from "@/modules/workspace";
import { Button, FormField, Section, TextInput } from "@/shared/ui";
import "./item-types-settings.css";

const DEFAULT_COLOR = "#0369a1";

interface EditState {
  id: string;
  name: string;
  color: string;
}

export function ItemTypesSettings() {
  const {
    snapshot,
    fetchItemTypes,
    createItemType,
    updateItemType,
    deleteItemType,
    setTypeFieldVisibility
  } = useWorkspace();

  const boardConfig = snapshot?.boardConfig ?? factoryBoardConfig;
  const allFields = Array.isArray(boardConfig.fieldDefinitions) ? boardConfig.fieldDefinitions : [];
  const visibleFieldsByType = snapshot?.preferences.visibleFieldsByType ?? {};

  const [itemTypes, setItemTypes] = useState<ApiItemType[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [expandedFieldsFor, setExpandedFieldsFor] = useState<string | null>(null);
  const [newType, setNewType] = useState<{ name: string; color: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadTypes = useCallback(async () => {
    setLoadingList(true);
    try {
      const items = await fetchItemTypes();
      setItemTypes(items);
    } finally {
      setLoadingList(false);
    }
  }, [fetchItemTypes]);

  useEffect(() => {
    void loadTypes();
  }, [loadTypes]);

  const handleStartEdit = (type: ApiItemType) => {
    setEditing({ id: type.id, name: type.name, color: type.color || DEFAULT_COLOR });
    setNewType(null);
    setExpandedFieldsFor(null);
  };

  const handleCancelEdit = () => setEditing(null);

  const handleSaveEdit = async () => {
    if (!editing || !editing.name.trim()) return;
    setSaving(true);
    try {
      await updateItemType(editing.id, { name: editing.name.trim(), color: editing.color });
      setEditing(null);
      await loadTypes();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (typeId: string) => {
    setDeletingId(typeId);
    try {
      await deleteItemType(typeId);
      if (expandedFieldsFor === typeId) setExpandedFieldsFor(null);
      await loadTypes();
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreate = async () => {
    if (!newType || !newType.name.trim()) return;
    setSaving(true);
    try {
      await createItemType({ name: newType.name.trim(), color: newType.color });
      setNewType(null);
      await loadTypes();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFieldVisibility = (typeId: string, fieldId: string, currentlyVisible: boolean) => {
    void setTypeFieldVisibility(typeId, fieldId, !currentlyVisible);
  };

  return (
    <div className="item-types-settings">
      <Section
        title="Tipos de work item"
        subtitle="Defina os tipos de tarefa e quais campos aparecem no card do board para cada tipo."
        actions={
          !newType ? (
            <Button type="button" size="sm" onClick={() => { setNewType({ name: "", color: DEFAULT_COLOR }); setEditing(null); setExpandedFieldsFor(null); }}>
              Novo tipo
            </Button>
          ) : undefined
        }
      >
        <div className="item-types-settings__list">
          {newType !== null && (
            <div className="item-types-settings__form-row">
              <div className="item-types-settings__form-fields">
                <FormField label="Nome do tipo">
                  <TextInput
                    value={newType.name}
                    placeholder="Ex: Bug, Epic, Spike..."
                    autoFocus
                    onChange={e => setNewType({ ...newType, name: e.target.value })}
                    onKeyDown={e => {
                      if (e.key === "Enter") void handleCreate();
                      if (e.key === "Escape") setNewType(null);
                    }}
                  />
                </FormField>
                <FormField label="Cor (hex)">
                  <div className="item-types-settings__color-row">
                    <input
                      type="color"
                      className="item-types-settings__color-picker"
                      value={newType.color}
                      onChange={e => setNewType({ ...newType, color: e.target.value })}
                    />
                    <TextInput
                      value={newType.color}
                      placeholder="#0369a1"
                      onChange={e => setNewType({ ...newType, color: e.target.value })}
                    />
                  </div>
                </FormField>
              </div>
              <div className="item-types-settings__form-actions">
                <Button type="button" size="sm" onClick={() => void handleCreate()} disabled={saving || !newType.name.trim()}>
                  {saving ? "Criando..." : "Criar"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setNewType(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {loadingList && <p className="item-types-settings__empty">Carregando...</p>}

          {!loadingList && itemTypes.length === 0 && !newType && (
            <p className="item-types-settings__empty">Nenhum tipo de item configurado.</p>
          )}

          {itemTypes.map(type => {
            const typeVisibleFields = new Set<string>(visibleFieldsByType[type.id] ?? []);
            const isExpandedFields = expandedFieldsFor === type.id;

            return (
              <div key={type.id} className="item-types-settings__item">
                {editing?.id === type.id ? (
                  <div className="item-types-settings__form-row">
                    <div className="item-types-settings__form-fields">
                      <FormField label="Nome do tipo">
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
                      <FormField label="Cor (hex)">
                        <div className="item-types-settings__color-row">
                          <input
                            type="color"
                            className="item-types-settings__color-picker"
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
                    <div className="item-types-settings__form-actions">
                      <Button type="button" size="sm" onClick={() => void handleSaveEdit()} disabled={saving || !editing.name.trim()}>
                        {saving ? "Salvando..." : "Salvar"}
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={handleCancelEdit}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="item-types-settings__row">
                    <div className="item-types-settings__row-info">
                      <span
                        className="item-types-settings__badge"
                        style={{ background: `${type.color}22`, borderColor: `${type.color}66`, color: type.color }}
                      >
                        {type.name}
                      </span>
                      {typeVisibleFields.size > 0 && (
                        <span className="item-types-settings__fields-hint">
                          {typeVisibleFields.size} {typeVisibleFields.size === 1 ? "campo visivel" : "campos visiveis"}
                        </span>
                      )}
                    </div>
                    <div className="item-types-settings__row-actions">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setExpandedFieldsFor(isExpandedFields ? null : type.id)}
                      >
                        {isExpandedFields ? "Fechar campos" : "Campos visiveis"}
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => handleStartEdit(type)}>
                        Editar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void handleDelete(type.id)}
                        disabled={deletingId === type.id}
                      >
                        {deletingId === type.id ? "Removendo..." : "Remover"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Painel de campos visíveis por tipo */}
                {isExpandedFields && !editing && (
                  <div className="item-types-settings__fields-panel">
                    <p className="item-types-settings__fields-title">
                      Campos visíveis no card para <strong>{type.name}</strong>
                    </p>
                    {allFields.length === 0 ? (
                      <p className="item-types-settings__fields-empty">
                        Nenhum campo customizado definido. Crie campos em "Campos customizados".
                      </p>
                    ) : (
                      <div className="item-types-settings__fields-grid">
                        {allFields.map(field => {
                          const isVisible = typeVisibleFields.has(field.id);
                          return (
                            <label key={field.id} className="item-types-settings__field-row">
                              <input
                                type="checkbox"
                                checked={isVisible}
                                onChange={() => handleToggleFieldVisibility(type.id, field.id, isVisible)}
                              />
                              <span className="item-types-settings__field-label">{field.label}</span>
                              <span className="item-types-settings__field-type">{field.type}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
