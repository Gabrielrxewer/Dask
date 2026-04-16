import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyFieldCapabilityOverrides,
  isSystemCardFieldId,
  mergeCardFieldDefinitions
} from "@/entities/task";
import type { ApiCustomField } from "@/modules/workspace/model";
import type { CustomFieldType } from "@/modules/workspace/model";
import { useWorkspace } from "@/modules/workspace";
import { Button, FormField, Select, TextInput } from "@/shared/ui";
import "./general-settings.css";
import "./custom-fields-settings.css";

const FIELD_TYPE_OPTIONS: Array<{ value: CustomFieldType; label: string }> = [
  { value: "text", label: "Texto curto" },
  { value: "long_text", label: "Texto longo" },
  { value: "number", label: "Numero" },
  { value: "date", label: "Data" },
  { value: "datetime", label: "Data e hora" },
  { value: "boolean", label: "Sim / Nao" },
  { value: "select", label: "Selecao unica" },
  { value: "multi_select", label: "Selecao multipla" }
];

const FIELD_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  FIELD_TYPE_OPTIONS.map(o => [o.value, o.label])
);

function getFieldTypeLabel(type: string): string {
  return FIELD_TYPE_LABEL[type] ?? type;
}

function getUnifiedFieldTypeLabel(type: string, allowAiGeneration: boolean): string {
  if (allowAiGeneration && canToggleAiByType(type)) {
    return "Text IA";
  }

  const normalizedType = type === "multi-select" ? "multi_select" : type;

  const labels: Record<string, string> = {
    text: "Texto curto",
    text_ai: "Texto curto",
    long_text: "Texto longo",
    number: "Numero",
    date: "Data",
    datetime: "Data e hora",
    boolean: "Sim / Nao",
    select: "Selecao unica",
    multi_select: "Selecao multipla",
    user: "Usuario"
  };

  return labels[normalizedType] ?? normalizedType;
}

interface EditState {
  id: string;
  name: string;
  type: CustomFieldType;
  required: boolean;
  allowAiGeneration: boolean;
}

interface SettingsFieldRow {
  id: string;
  label: string;
  type: string;
  source: "system" | "custom";
  required: boolean;
  optionsCount: number;
  allowAiGeneration: boolean;
  editableAi: boolean;
}

function supportsAiGeneration(type: CustomFieldType): boolean {
  return type === "text" || type === "long_text";
}

function readAllowAiGeneration(settings: ApiCustomField["settings"]): boolean {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return false;
  }

  return settings.allowAiGeneration === true;
}

function canToggleAiByType(type: string): boolean {
  return type === "text" || type === "text_ai";
}

function readFieldCapabilitiesById(settings?: Record<string, unknown>): Record<string, { aiEnhance?: boolean }> {
  const source = settings?.fieldCapabilitiesById;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return {};
  }

  return Object.entries(source as Record<string, unknown>).reduce<Record<string, { aiEnhance?: boolean }>>(
    (acc, [fieldId, value]) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return acc;
      }

      const aiEnhance = (value as { aiEnhance?: unknown }).aiEnhance;
      if (typeof aiEnhance === "boolean") {
        acc[fieldId] = { aiEnhance };
      }

      return acc;
    },
    {}
  );
}

export function CustomFieldsSettings() {
  const {
    snapshot,
    fetchCustomFields,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    updatePreferences
  } = useWorkspace();

  const [fields, setFields] = useState<ApiCustomField[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [newField, setNewField] = useState<{
    name: string;
    type: CustomFieldType;
    required: boolean;
    allowAiGeneration: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingAiFieldId, setSavingAiFieldId] = useState<string | null>(null);

  const customFieldBySlug = useMemo(
    () =>
      fields.reduce<Record<string, ApiCustomField>>((acc, field) => {
        acc[field.slug] = field;
        return acc;
      }, {}),
    [fields]
  );

  const allFields = useMemo(() => {
    const merged = mergeCardFieldDefinitions(
      Array.isArray(snapshot?.boardConfig.fieldDefinitions) ? snapshot.boardConfig.fieldDefinitions : []
    );

    return applyFieldCapabilityOverrides(merged, snapshot?.preferences.settings);
  }, [snapshot?.boardConfig.fieldDefinitions, snapshot?.preferences.settings]);

  const fieldCapabilitiesById = useMemo(
    () => readFieldCapabilitiesById(snapshot?.preferences.settings),
    [snapshot?.preferences.settings]
  );

  const settingsRows = useMemo<SettingsFieldRow[]>(
    () =>
      allFields.map(field => {
        const isCustom = !isSystemCardFieldId(field.id);
        const customDefinition = isCustom ? customFieldBySlug[field.id] : undefined;
        const explicitSystemCapability = fieldCapabilitiesById[field.id]?.aiEnhance;
        const allowAiGeneration =
          typeof explicitSystemCapability === "boolean"
            ? explicitSystemCapability
            : field.capabilities?.aiEnhance === true || field.type === "text_ai";

        return {
          id: field.id,
          label: field.label,
          type: field.type,
          source: isCustom ? "custom" : "system",
          required: customDefinition?.required ?? false,
          optionsCount: customDefinition?.options.length ?? field.options?.length ?? 0,
          allowAiGeneration,
          editableAi: canToggleAiByType(field.type) && (!isCustom || Boolean(customDefinition))
        };
      }),
    [allFields, customFieldBySlug, fieldCapabilitiesById]
  );

  const loadFields = useCallback(async () => {
    setLoadingList(true);
    try {
      const items = await fetchCustomFields();
      setFields(items);
    } finally {
      setLoadingList(false);
    }
  }, [fetchCustomFields]);

  useEffect(() => {
    void loadFields();
  }, [loadFields]);

  const handleStartEdit = (field: ApiCustomField) => {
    setEditing({
      id: field.id,
      name: field.name,
      type: field.type as CustomFieldType,
      required: field.required,
      allowAiGeneration: readAllowAiGeneration(field.settings)
    });
    setNewField(null);
  };

  const handleCancelEdit = () => setEditing(null);

  const handleSaveEdit = async () => {
    if (!editing || !editing.name.trim()) return;
    setSaving(true);
    try {
      await updateCustomField(editing.id, {
        name: editing.name.trim(),
        type: editing.type,
        required: editing.required,
        settings: {
          allowAiGeneration: supportsAiGeneration(editing.type) ? editing.allowAiGeneration : false
        }
      });
      setEditing(null);
      await loadFields();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (fieldId: string) => {
    setDeletingId(fieldId);
    try {
      await deleteCustomField(fieldId);
      await loadFields();
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreate = async () => {
    if (!newField || !newField.name.trim()) return;
    setSaving(true);
    try {
      await createCustomField({
        name: newField.name.trim(),
        type: newField.type,
        required: newField.required,
        settings: {
          allowAiGeneration: supportsAiGeneration(newField.type) ? newField.allowAiGeneration : false
        }
      });
      setNewField(null);
      await loadFields();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleFieldAi = async (row: SettingsFieldRow, nextValue: boolean) => {
    setSavingAiFieldId(row.id);
    try {
      if (row.source === "custom") {
        const customDefinition = customFieldBySlug[row.id];
        if (!customDefinition) {
          return;
        }

        await updateCustomField(customDefinition.id, {
          settings: {
            allowAiGeneration: nextValue
          }
        });

        await loadFields();
        return;
      }

      const currentMap = readFieldCapabilitiesById(snapshot?.preferences.settings);
      const nextMap = {
        ...currentMap,
        [row.id]: {
          ...(currentMap[row.id] ?? {}),
          aiEnhance: nextValue
        }
      };

      await updatePreferences({
        settings: {
          fieldCapabilitiesById: nextMap
        }
      });
    } finally {
      setSavingAiFieldId(null);
    }
  };

  const activeCustomFields = fields.filter(field => field.isActive !== false);
  const requiredCustomFields = activeCustomFields.filter(field => field.required).length;
  const aiEnabledFields = settingsRows.filter(row => row.allowAiGeneration).length;
  const progressWidth = Math.min(100, Math.max(12, settingsRows.length * 8));

  return (
    <div className="general-settings custom-fields-settings">
      <section className="general-settings__builder-hero custom-fields-settings__hero">
        <div className="general-settings__builder-copy">
          <span>Campos</span>
          <h1>Padronize os dados dos work items.</h1>
          <p>
            Adicione campos extras, marque obrigatoriedade e controle quais inputs textuais podem gerar conteudo com IA.
          </p>
        </div>

        <div className="general-settings__live-preview custom-fields-settings__hero-preview" aria-label="Preview dos campos">
          {settingsRows.slice(0, 6).map(row => (
            <div key={`preview-${row.id}`} className="general-settings__preview-column custom-fields-settings__hero-column">
              <span>
                <i style={{ background: row.allowAiGeneration ? "#12a99e" : "#0a86e8" }} />
                {row.label}
              </span>
              <div className="general-settings__preview-card">
                <strong>{getUnifiedFieldTypeLabel(row.type, row.allowAiGeneration)}</strong>
                <small>{row.source === "system" ? "Sistema" : "Customizado"}</small>
              </div>
            </div>
          ))}

          {settingsRows.length === 0 && !loadingList && (
            <div className="general-settings__preview-column custom-fields-settings__hero-column">
              <span>
                <i style={{ background: "#0a86e8" }} />
                Novo campo
              </span>
              <div className="general-settings__preview-card">
                <strong>Sem campos</strong>
                <small>Crie o primeiro campo</small>
              </div>
            </div>
          )}
        </div>

        <div className="general-settings__progress">
          <div>
            <strong>{settingsRows.length} campos no workspace</strong>
            <small>{aiEnabledFields} com IA habilitada</small>
          </div>
          <span><i style={{ width: `${progressWidth}%` }} /></span>
        </div>
      </section>

      <section className="general-settings__preferences-row custom-fields-settings__top-row">
        <div className="general-settings__preference-card">
          <div className="custom-fields-settings__create-header">
            <div>
              <h2>Novo campo</h2>
              <p>Crie um campo customizado para capturar informacoes especificas do processo.</p>
            </div>
            {!newField ? (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setNewField({ name: "", type: "text", required: false, allowAiGeneration: false });
                  setEditing(null);
                }}
              >
                Novo campo
              </Button>
            ) : null}
          </div>

          {newField !== null ? (
            <div className="custom-fields-settings__form-row custom-fields-settings__form-row--create">
              <div className="custom-fields-settings__form-fields">
                <FormField label="Nome do campo">
                  <TextInput
                    value={newField.name}
                    placeholder="Ex: Link do design, Ambiente..."
                    autoFocus
                    onChange={e => setNewField({ ...newField, name: e.target.value })}
                    onKeyDown={e => {
                      if (e.key === "Enter") void handleCreate();
                      if (e.key === "Escape") setNewField(null);
                    }}
                  />
                </FormField>
                <FormField label="Tipo">
                  <Select
                    value={newField.type}
                    onChange={e => {
                      const nextType = e.target.value as CustomFieldType;
                      setNewField({
                        ...newField,
                        type: nextType,
                        allowAiGeneration: supportsAiGeneration(nextType) ? newField.allowAiGeneration : false
                      });
                    }}
                  >
                    {FIELD_TYPE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Obrigatorio">
                  <label className="custom-fields-settings__checkbox">
                    <input
                      type="checkbox"
                      checked={newField.required}
                      onChange={e => setNewField({ ...newField, required: e.target.checked })}
                    />
                    <span>Campo obrigatorio</span>
                  </label>
                </FormField>
                <FormField label="IA no input">
                  <label className="custom-fields-settings__checkbox">
                    <input
                      type="checkbox"
                      checked={newField.allowAiGeneration}
                      disabled={!supportsAiGeneration(newField.type)}
                      onChange={e => setNewField({ ...newField, allowAiGeneration: e.target.checked })}
                    />
                    <span>
                      {supportsAiGeneration(newField.type)
                        ? "Permitir gerar conteudo com IA"
                        : "Disponivel apenas para campos de texto"}
                    </span>
                  </label>
                </FormField>
              </div>
              <div className="custom-fields-settings__form-actions">
                <Button type="button" size="sm" onClick={() => void handleCreate()} disabled={saving || !newField.name.trim()}>
                  {saving ? "Criando..." : "Criar"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setNewField(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="general-settings__summary-card">
          <h2>Resumo</h2>
          <div className="general-settings__summary-grid">
            <span><strong>{settingsRows.length}</strong> campos</span>
            <span><strong>{activeCustomFields.length}</strong> customizados</span>
            <span><strong>{requiredCustomFields}</strong> obrigatorios</span>
            <span><strong>{aiEnabledFields}</strong> com IA</span>
          </div>
        </div>
      </section>

      <section className="general-settings__templates custom-fields-settings__panel">
        <header>
          <span>Campos</span>
          <h2>Campos do workspace</h2>
        </header>

        <div className="custom-fields-settings__list">
          <div className="custom-fields-settings__all-fields">
            <p className="custom-fields-settings__all-fields-title">
              Todos os campos (sistema + template + customizados)
            </p>
            <p className="custom-fields-settings__all-fields-subtitle">
              Configure por campo se o input textual pode gerar conteudo com IA.
            </p>

            <div className="custom-fields-settings__all-fields-grid">
              {settingsRows.map(row => (
                <div key={row.id} className="custom-fields-settings__all-field-row">
                  <div className="custom-fields-settings__all-field-meta">
                    <span className="custom-fields-settings__type-badge">
                      {getUnifiedFieldTypeLabel(row.type, row.allowAiGeneration)}
                    </span>
                    <span className="custom-fields-settings__row-name">{row.label}</span>
                    <span className={`custom-fields-settings__source custom-fields-settings__source--${row.source}`}>
                      {row.source === "system" ? "Sistema" : "Campo"}
                    </span>
                    {row.required ? <span className="custom-fields-settings__required">obrigatorio</span> : null}
                    {row.optionsCount > 0 ? (
                      <span className="custom-fields-settings__options-hint">{row.optionsCount} opcoes</span>
                    ) : null}
                  </div>
                  <div className="custom-fields-settings__all-field-actions">
                    <label className="custom-fields-settings__checkbox">
                      <input
                        type="checkbox"
                        checked={row.allowAiGeneration}
                        disabled={!row.editableAi || savingAiFieldId === row.id}
                        onChange={event => void handleToggleFieldAi(row, event.target.checked)}
                      />
                      <span>
                        {row.editableAi
                          ? savingAiFieldId === row.id
                            ? "Salvando..."
                            : "Permitir IA"
                          : "Nao se aplica"}
                      </span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {loadingList && <p className="custom-fields-settings__empty">Carregando...</p>}

          {!loadingList && fields.length === 0 && !newField && (
            <p className="custom-fields-settings__empty">Nenhum campo customizado configurado.</p>
          )}

          {fields.map(field => (
            <div key={field.id} className="custom-fields-settings__row">
              {editing?.id === field.id ? (
                <div className="custom-fields-settings__form-row">
                  <div className="custom-fields-settings__form-fields">
                    <FormField label="Nome do campo">
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
                    <FormField label="Tipo">
                      <Select
                        value={editing.type}
                        onChange={e => {
                          const nextType = e.target.value as CustomFieldType;
                          setEditing({
                            ...editing,
                            type: nextType,
                            allowAiGeneration: supportsAiGeneration(nextType) ? editing.allowAiGeneration : false
                          });
                        }}
                      >
                        {FIELD_TYPE_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField label="Obrigatorio">
                      <label className="custom-fields-settings__checkbox">
                        <input
                          type="checkbox"
                          checked={editing.required}
                          onChange={e => setEditing({ ...editing, required: e.target.checked })}
                        />
                        <span>Campo obrigatorio</span>
                      </label>
                    </FormField>
                    <FormField label="IA no input">
                      <label className="custom-fields-settings__checkbox">
                        <input
                          type="checkbox"
                          checked={editing.allowAiGeneration}
                          disabled={!supportsAiGeneration(editing.type)}
                          onChange={e => setEditing({ ...editing, allowAiGeneration: e.target.checked })}
                        />
                        <span>
                          {supportsAiGeneration(editing.type)
                            ? "Permitir gerar conteudo com IA"
                            : "Disponivel apenas para campos de texto"}
                        </span>
                      </label>
                    </FormField>
                  </div>
                  <div className="custom-fields-settings__form-actions">
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
                  <div className="custom-fields-settings__row-info">
                    <span className="custom-fields-settings__type-badge">
                      {getFieldTypeLabel(field.type)}
                    </span>
                    <span className="custom-fields-settings__row-name">{field.name}</span>
                    {field.required && (
                      <span className="custom-fields-settings__required">obrigatorio</span>
                    )}
                    {readAllowAiGeneration(field.settings) && (
                      <span className="custom-fields-settings__ai-enabled">IA habilitada</span>
                    )}
                    {field.options.length > 0 && (
                      <span className="custom-fields-settings__options-hint">
                        {field.options.length} opcoes
                      </span>
                    )}
                  </div>
                  <div className="custom-fields-settings__row-actions">
                    <Button type="button" size="sm" variant="outline" onClick={() => handleStartEdit(field)}>
                      Editar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void handleDelete(field.id)}
                      disabled={deletingId === field.id}
                    >
                      {deletingId === field.id ? "Removendo..." : "Remover"}
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
