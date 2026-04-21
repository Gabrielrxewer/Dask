import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyFieldCapabilityOverrides,
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
  { value: "multi_select", label: "Selecao multipla" },
  { value: "user", label: "Usuario" },
  { value: "checklist", label: "Checklist" }
];

const FIELD_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  FIELD_TYPE_OPTIONS.map(o => [o.value, o.label])
);

function getFieldTypeLabel(type: string): string {
  return FIELD_TYPE_LABEL[type] ?? type;
}

function getUnifiedFieldTypeLabel(type: string, allowAiGeneration: boolean): string {
  if (allowAiGeneration && canToggleAiByType(type)) {
    return "Texto IA";
  }

  const labels: Record<string, string> = {
    text: "Texto curto",
    long_text: "Texto longo",
    number: "Numero",
    date: "Data",
    datetime: "Data e hora",
    boolean: "Sim / Nao",
    select: "Selecao unica",
    multi_select: "Selecao multipla",
    user: "Usuario",
    checklist: "Checklist"
  };

  return labels[type] ?? type;
}

interface EditState {
  id: string;
  name: string;
  type: CustomFieldType;
  required: boolean;
  allowAiGeneration: boolean;
  options: FieldOptionDraft[];
}

interface SettingsFieldRow {
  id: string;
  label: string;
  type: string;
  required: boolean;
  optionsCount: number;
  allowAiGeneration: boolean;
}

interface FieldOptionDraft {
  id: string;
  label: string;
  value: string;
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
  return type === "text" || type === "long_text";
}

const KNOWN_TEMPLATE_FIELD_SLUGS = new Set(["story-points", "severity", "confidence", "impact", "sla-hours"]);

function isTemplateField(field: ApiCustomField | undefined, fallbackSlug?: string): boolean {
  if (!field) {
    return fallbackSlug ? KNOWN_TEMPLATE_FIELD_SLUGS.has(fallbackSlug) : false;
  }

  if (KNOWN_TEMPLATE_FIELD_SLUGS.has(field.slug)) {
    return true;
  }

  if (!field.settings || typeof field.settings !== "object" || Array.isArray(field.settings)) {
    return false;
  }

  const source = (field.settings as { source?: unknown }).source;
  if (typeof source === "string" && source.trim().toLowerCase().startsWith("seed.")) {
    return true;
  }

  return false;
}

function supportsSelectableOptions(type: CustomFieldType): boolean {
  return type === "select" || type === "multi_select";
}

function sanitizeOptionValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function mapApiOptionsToDraft(options: ApiCustomField["options"]): FieldOptionDraft[] {
  if (!Array.isArray(options) || options.length === 0) {
    return [];
  }

  return options.map(option => ({
    id: option.id,
    label: option.label,
    value: option.value
  }));
}

function normalizeOptionInputs(options: FieldOptionDraft[]): Array<{ label: string; value: string }> {
  const seen = new Set<string>();
  const normalized: Array<{ label: string; value: string }> = [];

  for (const [index, option] of options.entries()) {
    const label = option.label.trim();
    if (!label) {
      continue;
    }

    const baseValue = sanitizeOptionValue(option.value) || sanitizeOptionValue(label) || `opcao_${index + 1}`;
    let value = baseValue;
    let suffix = 2;
    while (seen.has(value)) {
      value = `${baseValue}_${suffix}`;
      suffix += 1;
    }

    seen.add(value);
    normalized.push({ label, value });
  }

  return normalized;
}

function createEmptyOptionDraft(index: number): FieldOptionDraft {
  return {
    id: `new-${Date.now()}-${index}`,
    label: "",
    value: ""
  };
}

interface SelectOptionsEditorProps {
  type: CustomFieldType;
  options: FieldOptionDraft[];
  onChange: (options: FieldOptionDraft[]) => void;
}

function SelectOptionsEditor({ type, options, onChange }: SelectOptionsEditorProps) {
  if (!supportsSelectableOptions(type)) {
    return null;
  }

  const normalizedPreview = normalizeOptionInputs(options);

  return (
    <div className="custom-fields-settings__options-editor">
      <div className="custom-fields-settings__options-header">
        <p>Opcoes do campo</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange([...options, createEmptyOptionDraft(options.length + 1)])}
        >
          Adicionar opcao
        </Button>
      </div>

      {options.length === 0 ? (
        <p className="custom-fields-settings__options-empty">
          Adicione ao menos uma opcao para esse campo.
        </p>
      ) : (
        <div className="custom-fields-settings__options-grid">
          {options.map((option, index) => (
            <div className="custom-fields-settings__option-row" key={option.id}>
              <FormField label={`Opcao ${index + 1}`}>
                <TextInput
                  value={option.label}
                  placeholder="Label visivel"
                  onChange={event => {
                    const next = [...options];
                    next[index] = { ...next[index], label: event.target.value };
                    onChange(next);
                  }}
                />
              </FormField>
              <FormField label="Valor">
                <TextInput
                  value={option.value}
                  placeholder="valor_interno (opcional)"
                  onChange={event => {
                    const next = [...options];
                    next[index] = { ...next[index], value: event.target.value };
                    onChange(next);
                  }}
                />
              </FormField>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onChange(options.filter((_, optionIndex) => optionIndex !== index))}
              >
                Remover
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="custom-fields-settings__options-preview">
        <p>Visualizacao das opcoes</p>
        <Select value="" disabled>
          <option value="">Selecione...</option>
          {normalizedPreview.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        {type === "multi_select" && normalizedPreview.length > 0 ? (
          <div className="custom-fields-settings__options-tags" aria-label="Preview multi selecao">
            {normalizedPreview.map(option => (
              <span key={`tag-${option.value}`}>{option.label}</span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
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
    deleteCustomField
  } = useWorkspace();

  const [fields, setFields] = useState<ApiCustomField[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [newField, setNewField] = useState<{
    name: string;
    type: CustomFieldType;
    required: boolean;
    allowAiGeneration: boolean;
    options: FieldOptionDraft[];
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");

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
        const customDefinition = customFieldBySlug[field.id];
        const explicitSystemCapability = fieldCapabilitiesById[field.id]?.aiEnhance;
        const allowAiGeneration =
          typeof explicitSystemCapability === "boolean"
            ? explicitSystemCapability
            : field.capabilities?.aiEnhance === true;

        return {
          id: field.id,
          label: field.label,
          type: field.type,
          required: customDefinition?.required ?? false,
          optionsCount: customDefinition?.options.length ?? field.options?.length ?? 0,
          allowAiGeneration
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
    setFormError("");
    setEditing({
      id: field.id,
      name: field.name,
      type: field.type as CustomFieldType,
      required: field.required,
      allowAiGeneration: readAllowAiGeneration(field.settings),
      options: mapApiOptionsToDraft(field.options)
    });
    setNewField(null);
  };

  const handleCancelEdit = () => {
    setEditing(null);
    setFormError("");
  };

  const handleSaveEdit = async () => {
    if (!editing || !editing.name.trim()) return;
    const normalizedOptions = normalizeOptionInputs(editing.options);
    if (supportsSelectableOptions(editing.type) && normalizedOptions.length === 0) {
      setFormError("Campos de selecao precisam de ao menos uma opcao.");
      return;
    }

    setFormError("");
    setSaving(true);
    try {
      await updateCustomField(editing.id, {
        name: editing.name.trim(),
        type: editing.type,
        required: editing.required,
        settings: {
          allowAiGeneration: supportsAiGeneration(editing.type) ? editing.allowAiGeneration : false
        },
        options: supportsSelectableOptions(editing.type) ? normalizedOptions : []
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
    const normalizedOptions = normalizeOptionInputs(newField.options);
    if (supportsSelectableOptions(newField.type) && normalizedOptions.length === 0) {
      setFormError("Campos de selecao precisam de ao menos uma opcao.");
      return;
    }

    setFormError("");
    setSaving(true);
    try {
      await createCustomField({
        name: newField.name.trim(),
        type: newField.type,
        required: newField.required,
        settings: {
          allowAiGeneration: supportsAiGeneration(newField.type) ? newField.allowAiGeneration : false
        },
        options: supportsSelectableOptions(newField.type) ? normalizedOptions : []
      });
      setNewField(null);
      await loadFields();
    } finally {
      setSaving(false);
    }
  };

  const activeCustomFields = fields.filter(field => field.isActive !== false);
  const editableTemplateAndCustomFields = fields;
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
                <small>Campo</small>
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
                  setNewField({ name: "", type: "text", required: false, allowAiGeneration: false, options: [] });
                  setEditing(null);
                  setFormError("");
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
              <SelectOptionsEditor
                type={newField.type}
                options={newField.options}
                onChange={options => setNewField({ ...newField, options })}
              />
              {formError ? <p className="custom-fields-settings__form-error">{formError}</p> : null}
              <div className="custom-fields-settings__form-actions">
                <Button type="button" size="sm" onClick={() => void handleCreate()} disabled={saving || !newField.name.trim()}>
                  {saving ? "Criando..." : "Criar"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setNewField(null);
                    setFormError("");
                  }}
                >
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
              Todos os campos (template + customizados)
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
                    {row.required ? <span className="custom-fields-settings__required">obrigatorio</span> : null}
                    {row.optionsCount > 0 ? (
                      <span className="custom-fields-settings__options-hint">{row.optionsCount} opcoes</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {loadingList && <p className="custom-fields-settings__empty">Carregando...</p>}

          {!loadingList && editableTemplateAndCustomFields.length === 0 && !newField && (
            <p className="custom-fields-settings__empty">Nenhum campo customizado configurado.</p>
          )}

          {editableTemplateAndCustomFields.map(field => (
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
                  <SelectOptionsEditor
                    type={editing.type}
                    options={editing.options}
                    onChange={options => setEditing({ ...editing, options })}
                  />
                  {formError ? <p className="custom-fields-settings__form-error">{formError}</p> : null}
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
