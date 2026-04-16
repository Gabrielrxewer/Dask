import { useCallback, useEffect, useState } from "react";
import type { ApiItemType } from "@/modules/workspace/model";
import {
  applyFieldCapabilityOverrides,
  CARD_FIELDS_SCHEMA_VERSION,
  factoryBoardConfig,
  getTaskFieldTypeLabel,
  mergeCardFieldDefinitions,
  resolveFieldIdsForTaskType
} from "@/entities/task";
import { useWorkspace } from "@/modules/workspace";
import { Button, FormField, TextInput } from "@/shared/ui";
import "./general-settings.css";
import "./item-types-settings.css";

const DEFAULT_COLOR = "#0369a1";

interface EditState {
  id: string;
  name: string;
  color: string;
}

interface FieldDraft {
  card: string[];
  detail: string[];
}

function sanitizeFieldIds(values: string[], allowedFieldIds?: Set<string>): string[] {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map(value => value.trim())
        .filter(value => value.length > 0 && (!allowedFieldIds || allowedFieldIds.has(value)))
    )
  );
}

function sanitizeFieldMapByType(
  input: Record<string, string[]>,
  allowedFieldIds?: Set<string>
): Record<string, string[]> {
  return Object.entries(input).reduce<Record<string, string[]>>((acc, [typeSlug, fieldIds]) => {
    const normalizedSlug = typeSlug.trim();
    if (normalizedSlug.length === 0) {
      return acc;
    }

    acc[normalizedSlug] = sanitizeFieldIds(Array.isArray(fieldIds) ? fieldIds : [], allowedFieldIds);
    return acc;
  }, {});
}

function areSameIdSets(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every(value => rightSet.has(value));
}

function getPreviewValue(fieldId: string): string {
  const values: Record<string, string> = {
    "sys:type": "Tipo selecionado",
    "sys:priority": "Media",
    "sys:status": "Em progresso",
    "sys:title": "Ajustar experiencia do cliente",
    "sys:description": "Resumo claro do trabalho e do resultado esperado.",
    "sys:created-by": "Debora",
    "sys:assignee": "Equipe Dask",
    "sys:tags": "produto, melhoria",
    "sys:checklist": "2 de 4 itens",
    "sys:schedule": "23/04/2026 09:00 - 24/04/2026 16:30",
    "sys:due-date": "24/04/2026"
  };

  return values[fieldId] ?? "Valor de exemplo";
}

export function ItemTypesSettings() {
  const {
    snapshot,
    fetchItemTypes,
    createItemType,
    updateItemType,
    deleteItemType,
    updatePreferences
  } = useWorkspace();

  const boardConfig = snapshot?.boardConfig ?? factoryBoardConfig;
  const allFields = applyFieldCapabilityOverrides(
    mergeCardFieldDefinitions(
      Array.isArray(boardConfig.fieldDefinitions) ? boardConfig.fieldDefinitions : []
    ),
    snapshot?.preferences.settings
  );
  const allowedFieldIds = new Set(allFields.map(field => field.id));
  const visibleFieldsByType = Object.entries(snapshot?.preferences.visibleFieldsByType ?? {}).reduce<
    Record<string, string[]>
  >((acc, [typeSlug, fieldIds]) => {
    acc[typeSlug] = sanitizeFieldIds(fieldIds, allowedFieldIds);
    return acc;
  }, {});
  const detailVisibleFieldsByType = Object.entries(snapshot?.preferences.detailVisibleFieldsByType ?? {}).reduce<
    Record<string, string[]>
  >((acc, [typeSlug, fieldIds]) => {
    acc[typeSlug] = sanitizeFieldIds(fieldIds, allowedFieldIds);
    return acc;
  }, {});

  const [itemTypes, setItemTypes] = useState<ApiItemType[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [expandedFieldsFor, setExpandedFieldsFor] = useState<string | null>(null);
  const [newType, setNewType] = useState<{ name: string; color: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingFieldsTypeSlug, setSavingFieldsTypeSlug] = useState<string | null>(null);
  const [fieldDraftsByTypeSlug, setFieldDraftsByTypeSlug] = useState<Record<string, FieldDraft>>({});
  const [fieldErrorsByTypeSlug, setFieldErrorsByTypeSlug] = useState<Record<string, string>>({});

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

  const resolveEffectiveCardFields = useCallback(
    (typeSlug: string): string[] =>
      resolveFieldIdsForTaskType(typeSlug, visibleFieldsByType, boardConfig.cardLayout.visibleFieldIds),
    [visibleFieldsByType, boardConfig.cardLayout.visibleFieldIds]
  );

  const resolveEffectiveDetailFields = useCallback(
    (typeSlug: string): string[] =>
      resolveFieldIdsForTaskType(typeSlug, detailVisibleFieldsByType, resolveEffectiveCardFields(typeSlug)),
    [detailVisibleFieldsByType, resolveEffectiveCardFields]
  );

  const resolveDraft = useCallback(
    (typeSlug: string): FieldDraft =>
      fieldDraftsByTypeSlug[typeSlug] ?? {
        card: [...resolveEffectiveCardFields(typeSlug)],
        detail: [...resolveEffectiveDetailFields(typeSlug)]
      },
    [fieldDraftsByTypeSlug, resolveEffectiveCardFields, resolveEffectiveDetailFields]
  );

  const ensureTypeDraft = useCallback(
    (typeSlug: string) => {
      setFieldErrorsByTypeSlug(current => ({ ...current, [typeSlug]: "" }));
      setFieldDraftsByTypeSlug(current => {
        if (current[typeSlug]) return current;
        return {
          ...current,
          [typeSlug]: {
            card: [...resolveEffectiveCardFields(typeSlug)],
            detail: [...resolveEffectiveDetailFields(typeSlug)]
          }
        };
      });
    },
    [resolveEffectiveCardFields, resolveEffectiveDetailFields]
  );

  const updateTypeDraft = useCallback((typeSlug: string, nextDraft: FieldDraft) => {
    setFieldDraftsByTypeSlug(current => ({
      ...current,
      [typeSlug]: {
        card: sanitizeFieldIds(nextDraft.card, allowedFieldIds),
        detail: sanitizeFieldIds(nextDraft.detail, allowedFieldIds)
      }
    }));
  }, [allowedFieldIds]);

  const toggleDraftField = useCallback(
    (typeSlug: string, scope: "card" | "detail", fieldId: string, checked: boolean) => {
      const draft = resolveDraft(typeSlug);
      const currentSet = new Set(draft[scope]);

      if (checked) {
        currentSet.add(fieldId);
      } else {
        currentSet.delete(fieldId);
      }

      updateTypeDraft(typeSlug, { ...draft, [scope]: Array.from(currentSet) });
    },
    [resolveDraft, updateTypeDraft]
  );

  const setDraftFields = useCallback(
    (typeSlug: string, scope: "card" | "detail", fieldIds: string[]) => {
      const draft = resolveDraft(typeSlug);
      updateTypeDraft(typeSlug, { ...draft, [scope]: sanitizeFieldIds(fieldIds, allowedFieldIds) });
    },
    [allowedFieldIds, resolveDraft, updateTypeDraft]
  );

  const handleDiscardTypeChanges = useCallback(
    (typeSlug: string) => {
      setFieldErrorsByTypeSlug(current => ({ ...current, [typeSlug]: "" }));
      updateTypeDraft(typeSlug, {
        card: [...resolveEffectiveCardFields(typeSlug)],
        detail: [...resolveEffectiveDetailFields(typeSlug)]
      });
    },
    [resolveEffectiveCardFields, resolveEffectiveDetailFields, updateTypeDraft]
  );

  const handleUseDefaultForType = useCallback(
    async (typeSlug: string) => {
      if (!snapshot) return;
      setSavingFieldsTypeSlug(typeSlug);
      setFieldErrorsByTypeSlug(current => ({ ...current, [typeSlug]: "" }));

      try {
        const nextVisibleByType = sanitizeFieldMapByType(
          { ...(snapshot.preferences.visibleFieldsByType ?? {}) },
          allowedFieldIds
        );
        const nextDetailByType = sanitizeFieldMapByType(
          { ...(snapshot.preferences.detailVisibleFieldsByType ?? {}) },
          allowedFieldIds
        );
        delete nextVisibleByType[typeSlug];
        delete nextDetailByType[typeSlug];

        await updatePreferences({
          visibleFieldsByType: nextVisibleByType,
          detailVisibleFieldsByType: nextDetailByType,
          settings: {
            cardFieldSchemaVersion: CARD_FIELDS_SCHEMA_VERSION
          }
        });

        setFieldDraftsByTypeSlug(current => {
          const { [typeSlug]: _removed, ...rest } = current;
          return rest;
        });
      } catch {
        setFieldErrorsByTypeSlug(current => ({
          ...current,
          [typeSlug]: "Nao foi possivel aplicar o padrao. Tente novamente."
        }));
      } finally {
        setSavingFieldsTypeSlug(null);
      }
    },
    [allowedFieldIds, snapshot, updatePreferences]
  );

  const handleSaveTypeFields = useCallback(
    async (typeSlug: string) => {
      if (!snapshot) return;
      const draft = resolveDraft(typeSlug);
      setSavingFieldsTypeSlug(typeSlug);
      setFieldErrorsByTypeSlug(current => ({ ...current, [typeSlug]: "" }));

      try {
        const currentVisibleByType = sanitizeFieldMapByType(
          { ...(snapshot.preferences.visibleFieldsByType ?? {}) },
          allowedFieldIds
        );
        const currentDetailByType = sanitizeFieldMapByType(
          { ...(snapshot.preferences.detailVisibleFieldsByType ?? {}) },
          allowedFieldIds
        );

        await updatePreferences({
          visibleFieldsByType: {
            ...currentVisibleByType,
            [typeSlug]: sanitizeFieldIds(draft.card, allowedFieldIds)
          },
          detailVisibleFieldsByType: {
            ...currentDetailByType,
            [typeSlug]: sanitizeFieldIds(draft.detail, allowedFieldIds)
          },
          settings: {
            cardFieldSchemaVersion: CARD_FIELDS_SCHEMA_VERSION
          }
        });

        setFieldDraftsByTypeSlug(current => {
          const { [typeSlug]: _removed, ...rest } = current;
          return rest;
        });
      } catch {
        setFieldErrorsByTypeSlug(current => ({
          ...current,
          [typeSlug]: "Nao foi possivel salvar as alteracoes. Verifique os dados e tente novamente."
        }));
      } finally {
        setSavingFieldsTypeSlug(null);
      }
    },
    [allowedFieldIds, resolveDraft, snapshot, updatePreferences]
  );

  const handleToggleCardFieldVisibility = (typeSlug: string, fieldId: string, checked: boolean) => {
    toggleDraftField(typeSlug, "card", fieldId, checked);
  };

  const handleToggleDetailFieldVisibility = (typeSlug: string, fieldId: string, checked: boolean) => {
    toggleDraftField(typeSlug, "detail", fieldId, checked);
  };

  const activeItemTypes = itemTypes.filter(type => type.isActive !== false);
  const configuredCardTypes = activeItemTypes.filter(type => resolveEffectiveCardFields(type.slug).length > 0).length;
  const configuredDetailTypes = activeItemTypes.filter(type => resolveEffectiveDetailFields(type.slug).length > 0).length;
  const progressWidth = Math.min(100, Math.max(12, activeItemTypes.length * 22));

  return (
    <div className="general-settings item-types-settings">
      <section className="general-settings__builder-hero item-types-settings__hero">
        <div className="general-settings__builder-copy">
          <span>Work items</span>
          <h1>Defina os tipos e campos de cada item.</h1>
          <p>
            Configure como cada tipo aparece no card fechado e no work item expandido, mantendo a leitura do board consistente.
          </p>
        </div>

        <div className="general-settings__live-preview item-types-settings__hero-preview" aria-label="Preview dos tipos de work item">
          {activeItemTypes.slice(0, 6).map(type => (
            <div key={`preview-${type.id}`} className="general-settings__preview-column item-types-settings__hero-column">
              <span>
                <i style={{ background: type.color || DEFAULT_COLOR }} />
                {type.name}
              </span>
              <div className="general-settings__preview-card">
                <strong>{resolveEffectiveCardFields(type.slug).length} campos no card</strong>
                <small>{resolveEffectiveDetailFields(type.slug).length} no expandido</small>
              </div>
            </div>
          ))}

          {activeItemTypes.length === 0 && !loadingList && (
            <div className="general-settings__preview-column item-types-settings__hero-column">
              <span>
                <i style={{ background: DEFAULT_COLOR }} />
                Novo tipo
              </span>
              <div className="general-settings__preview-card">
                <strong>Sem tipos</strong>
                <small>Crie o primeiro work item</small>
              </div>
            </div>
          )}
        </div>

        <div className="general-settings__progress">
          <div>
            <strong>{activeItemTypes.length} tipos ativos</strong>
            <small>{configuredCardTypes} com campos no card</small>
          </div>
          <span><i style={{ width: `${progressWidth}%` }} /></span>
        </div>
      </section>

      <section className="general-settings__preferences-row item-types-settings__top-row">
        <div className="general-settings__preference-card">
          <div className="item-types-settings__create-header">
            <div>
              <h2>Novo tipo</h2>
              <p>Crie uma categoria de work item e escolha a cor usada nos cards.</p>
            </div>
            {!newType ? (
              <Button type="button" size="sm" onClick={() => { setNewType({ name: "", color: DEFAULT_COLOR }); setEditing(null); setExpandedFieldsFor(null); }}>
                Novo tipo
              </Button>
            ) : null}
          </div>

          {newType !== null ? (
            <div className="item-types-settings__form-row item-types-settings__form-row--create">
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
          ) : null}
        </div>

        <div className="general-settings__summary-card">
          <h2>Resumo</h2>
          <div className="general-settings__summary-grid">
            <span><strong>{activeItemTypes.length}</strong> tipos ativos</span>
            <span><strong>{allFields.length}</strong> campos</span>
            <span><strong>{configuredCardTypes}</strong> com card</span>
            <span><strong>{configuredDetailTypes}</strong> expandidos</span>
          </div>
        </div>
      </section>

      <section className="general-settings__templates item-types-settings__panel">
        <header>
          <span>Tipos</span>
          <h2>Tipos de work item</h2>
        </header>

        <div className="item-types-settings__list">
          {loadingList && <p className="item-types-settings__empty">Carregando...</p>}

          {!loadingList && itemTypes.length === 0 && !newType && (
            <p className="item-types-settings__empty">Nenhum tipo de item configurado.</p>
          )}

          {itemTypes.map(type => {
            const draft = resolveDraft(type.slug);
            const typeCardFields = new Set<string>(draft.card);
            const typeDetailFields = new Set<string>(draft.detail);
            const effectiveCardFields = resolveEffectiveCardFields(type.slug);
            const effectiveDetailFields = resolveEffectiveDetailFields(type.slug);
            const hasUnsavedChanges =
              !areSameIdSets(draft.card, effectiveCardFields) ||
              !areSameIdSets(draft.detail, effectiveDetailFields);
            const hasCardOverride = Object.prototype.hasOwnProperty.call(visibleFieldsByType, type.slug);
            const hasDetailOverride = Object.prototype.hasOwnProperty.call(detailVisibleFieldsByType, type.slug);
            const isExpandedFields = expandedFieldsFor === type.id;
            const isSavingTypeFields = savingFieldsTypeSlug === type.slug;
            const typeFieldsError = fieldErrorsByTypeSlug[type.slug] ?? "";

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
                      <span className="item-types-settings__fields-hint">
                        Card: {typeCardFields.size} | Expandido: {typeDetailFields.size}
                      </span>
                    </div>
                    <div className="item-types-settings__row-actions">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (!isExpandedFields) {
                            ensureTypeDraft(type.slug);
                          }
                          setExpandedFieldsFor(isExpandedFields ? null : type.id);
                        }}
                      >
                        {isExpandedFields ? "Fechar campos" : "Configurar campos"}
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

                {isExpandedFields && !editing && (
                  <div className="item-types-settings__fields-panel">
                    <p className="item-types-settings__fields-title">
                      Campos para <strong>{type.name}</strong>
                    </p>

                    {allFields.length === 0 ? (
                      <p className="item-types-settings__fields-empty">
                        Nenhum campo customizado definido. Crie campos em "Campos customizados".
                      </p>
                    ) : (
                      <>
                        <p className="item-types-settings__fields-title">
                          Card fechado
                          <span className="item-types-settings__fields-meta">
                            {hasCardOverride ? "Configuracao propria" : "Usando padrao do workspace"}
                          </span>
                        </p>
                        <div className="item-types-settings__fields-actions">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setDraftFields(type.slug, "card", allFields.map(field => field.id))}
                          >
                            Selecionar todos
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setDraftFields(type.slug, "card", [])}
                          >
                            Limpar
                          </Button>
                        </div>
                        <div className="item-types-settings__fields-grid">
                          {allFields.map(field => {
                            const isVisible = typeCardFields.has(field.id);
                            return (
                              <label key={`card-${type.slug}-${field.id}`} className="item-types-settings__field-row">
                                <input
                                  type="checkbox"
                                  checked={isVisible}
                                  onChange={event => handleToggleCardFieldVisibility(type.slug, field.id, event.target.checked)}
                                />
                                <span className="item-types-settings__field-label">{field.label}</span>
                                <span className="item-types-settings__field-type">{getTaskFieldTypeLabel(field)}</span>
                              </label>
                            );
                          })}
                        </div>

                        <p className="item-types-settings__fields-title">
                          Workitem expandido
                          <span className="item-types-settings__fields-meta">
                            {hasDetailOverride ? "Configuracao propria" : "Usando padrao do card"}
                          </span>
                        </p>
                        <div className="item-types-settings__fields-actions">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setDraftFields(type.slug, "detail", allFields.map(field => field.id))}
                          >
                            Selecionar todos
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setDraftFields(type.slug, "detail", draft.card)}
                          >
                            Copiar do card
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => setDraftFields(type.slug, "detail", [])}
                          >
                            Limpar
                          </Button>
                        </div>
                        <div className="item-types-settings__fields-grid">
                          {allFields.map(field => {
                            const isVisible = typeDetailFields.has(field.id);
                            return (
                              <label key={`detail-${type.slug}-${field.id}`} className="item-types-settings__field-row">
                                <input
                                  type="checkbox"
                                  checked={isVisible}
                                  onChange={event =>
                                    handleToggleDetailFieldVisibility(type.slug, field.id, event.target.checked)
                                  }
                                />
                                <span className="item-types-settings__field-label">{field.label}</span>
                                <span className="item-types-settings__field-type">{getTaskFieldTypeLabel(field)}</span>
                              </label>
                            );
                          })}
                        </div>

                        <div className="item-types-settings__visual-editor">
                          <div className="item-types-settings__preview-card">
                            <div className="item-types-settings__preview-topline">
                              <span
                                className="item-types-settings__badge"
                                style={{ background: `${type.color}22`, borderColor: `${type.color}66`, color: type.color }}
                              >
                                {type.name}
                              </span>
                              <span>Preview do card</span>
                            </div>
                            <strong>Ajustar experiencia do cliente</strong>
                            <p>Veja como o card fechado aparece no board.</p>
                            <div className="item-types-settings__preview-fields">
                              {allFields
                                .filter(field => typeCardFields.has(field.id))
                                .slice(0, 6)
                                .map(field => (
                                  <span key={`preview-card-${type.slug}-${field.id}`}>
                                    <small>{field.label}</small>
                                    {getPreviewValue(field.id)}
                                  </span>
                                ))}
                              {typeCardFields.size === 0 ? (
                                <em>Nenhum campo selecionado para o card.</em>
                              ) : null}
                            </div>
                          </div>

                          <div className="item-types-settings__preview-detail">
                            <div className="item-types-settings__preview-topline">
                              <span>Work item expandido</span>
                              <small>{typeDetailFields.size} campos</small>
                            </div>
                            <div className="item-types-settings__detail-grid">
                              {allFields
                                .filter(field => typeDetailFields.has(field.id))
                                .slice(0, 10)
                                .map(field => (
                                  <span key={`preview-detail-${type.slug}-${field.id}`}>
                                    <small>{field.label}</small>
                                    {getPreviewValue(field.id)}
                                  </span>
                                ))}
                              {typeDetailFields.size === 0 ? (
                                <em>Nenhum campo selecionado para o item expandido.</em>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="item-types-settings__panel-footer">
                          {typeFieldsError ? (
                            <span className="item-types-settings__error">{typeFieldsError}</span>
                          ) : hasUnsavedChanges ? (
                            <span className="item-types-settings__pending">Alteracoes nao salvas.</span>
                          ) : (
                            <span className="item-types-settings__saved">Sem alteracoes pendentes.</span>
                          )}

                          <div className="item-types-settings__panel-footer-actions">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleDiscardTypeChanges(type.slug)}
                              disabled={isSavingTypeFields || !hasUnsavedChanges}
                            >
                              Reverter
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void handleUseDefaultForType(type.slug)}
                              disabled={isSavingTypeFields}
                            >
                              Usar padrao
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => void handleSaveTypeFields(type.slug)}
                              disabled={isSavingTypeFields || !hasUnsavedChanges}
                            >
                              {isSavingTypeFields ? "Salvando..." : "Salvar alteracoes"}
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
