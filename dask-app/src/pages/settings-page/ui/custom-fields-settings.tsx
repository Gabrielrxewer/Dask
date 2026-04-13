import { useCallback, useEffect, useState } from "react";
import type { ApiCustomField } from "@/modules/workspace/model";
import type { CustomFieldType } from "@/modules/workspace/model";
import { useWorkspace } from "@/modules/workspace";
import { Button, FormField, Section, Select, TextInput } from "@/shared/ui";
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

interface EditState {
  id: string;
  name: string;
  type: CustomFieldType;
  required: boolean;
}

export function CustomFieldsSettings() {
  const { fetchCustomFields, createCustomField, updateCustomField, deleteCustomField } = useWorkspace();

  const [fields, setFields] = useState<ApiCustomField[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [newField, setNewField] = useState<{ name: string; type: CustomFieldType; required: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    setEditing({ id: field.id, name: field.name, type: field.type as CustomFieldType, required: field.required });
    setNewField(null);
  };

  const handleCancelEdit = () => setEditing(null);

  const handleSaveEdit = async () => {
    if (!editing || !editing.name.trim()) return;
    setSaving(true);
    try {
      await updateCustomField(editing.id, { name: editing.name.trim(), type: editing.type, required: editing.required });
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
      await createCustomField({ name: newField.name.trim(), type: newField.type, required: newField.required });
      setNewField(null);
      await loadFields();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="custom-fields-settings">
      <Section
        title="Campos customizados"
        subtitle="Adicione campos extras aos work items para capturar informacoes especificas do seu processo."
        actions={
          !newField ? (
            <Button type="button" size="sm" onClick={() => { setNewField({ name: "", type: "text", required: false }); setEditing(null); }}>
              Novo campo
            </Button>
          ) : undefined
        }
      >
        <div className="custom-fields-settings__list">
          {newField !== null && (
            <div className="custom-fields-settings__form-row">
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
                    onChange={e => setNewField({ ...newField, type: e.target.value as CustomFieldType })}
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
          )}

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
                        onChange={e => setEditing({ ...editing, type: e.target.value as CustomFieldType })}
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
      </Section>
    </div>
  );
}
