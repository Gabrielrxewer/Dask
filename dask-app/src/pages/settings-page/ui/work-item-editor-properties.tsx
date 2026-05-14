import type { Dispatch, SetStateAction } from "react";
import { getTaskFieldTypeLabel } from "@/entities/task";
import type { TaskCardDebugSnapshot, TaskFieldCardArea } from "@/entities/task";
import type { DetailZone, LayoutDraft, LayoutScope } from "@/pages/settings-page/model/work-item-layout-editor";
import { resolveCssColorForInput } from "@/shared/lib/color/css-color";
import { AppSelect, Button, FormField, TextInput } from "@/shared/ui";
import { AppIcon } from "@/shared/ui/icon";
import { CatalogSourceField } from "./work-item-catalog-source-field";
import {
  CARD_SLOT_AREA_META,
  createEmptyOptionDraft,
  FIELD_TYPE_OPTIONS,
  isCatalogSelectType,
  supportsAiGeneration,
  supportsSelectableOptions,
  type FieldDraft,
  type FieldLibraryItem,
  type PendingFieldSetup,
  type TypeDraft
} from "./work-item-editor-settings.model";

const billingAggregationItems = [
  { value: "sum", label: "Somar valores" },
  { value: "average", label: "Media" },
  { value: "count", label: "Contagem" },
  { value: "manual", label: "Manual" }
];

const billingDisplayFormatItems = [
  { value: "currency", label: "Moeda" },
  { value: "number", label: "Numero" },
  { value: "compact", label: "Compacto" }
];

interface WorkItemEditorPropertiesProps {
  pendingFieldSetup: PendingFieldSetup | null;
  setPendingFieldSetup: Dispatch<SetStateAction<PendingFieldSetup | null>>;
  activePendingTypeLabel: string | null;
  pendingFieldTargetLabel: string;
  fieldDraft: FieldDraft | null;
  setFieldDraft: Dispatch<SetStateAction<FieldDraft | null>>;
  fieldSaving: boolean;
  fieldDeletingId: string | null;
  fieldError: string;
  setFieldError: Dispatch<SetStateAction<string>>;
  selectedField: FieldLibraryItem | null;
  selectedFieldId: string | null;
  setSelectedFieldId: Dispatch<SetStateAction<string | null>>;
  selectedInCard: boolean;
  selectedInDetail: boolean;
  selectedDetailZone: DetailZone;
  activeCanvasTab: "card" | "detail" | "field";
  activeLayout: LayoutDraft;
  activeCardAreaDrafts: Record<string, TaskFieldCardArea>;
  previewCardDebug: TaskCardDebugSnapshot | null;
  typeComposer: TypeDraft | null;
  setTypeComposer: Dispatch<SetStateAction<TypeDraft | null>>;
  editingTypeId: string | null;
  setEditingTypeId: Dispatch<SetStateAction<string | null>>;
  typeSaving: boolean;
  typeDeletingId: string | null;
  onConfirmFieldSetup: () => void;
  onSaveField: () => void;
  onDeleteField: (fieldId: string) => void;
  onSaveType: () => void;
  onDeleteType: (typeId: string) => void;
  onAddFieldToLayout: (fieldId: string, scope: LayoutScope) => void;
  onRemoveFromLayout: (fieldId: string, scope: LayoutScope) => void;
  onSetDetailZoneForField: (fieldId: string, zone: DetailZone) => void;
  onSetCardAreaForField: (fieldId: string, area: TaskFieldCardArea) => void;
}

export function WorkItemEditorProperties({
  pendingFieldSetup,
  setPendingFieldSetup,
  activePendingTypeLabel,
  pendingFieldTargetLabel,
  fieldDraft,
  setFieldDraft,
  fieldSaving,
  fieldDeletingId,
  fieldError,
  setFieldError,
  selectedField,
  selectedFieldId,
  setSelectedFieldId,
  selectedInCard,
  selectedInDetail,
  selectedDetailZone,
  activeCanvasTab,
  activeLayout,
  activeCardAreaDrafts,
  previewCardDebug,
  typeComposer,
  setTypeComposer,
  editingTypeId,
  setEditingTypeId,
  typeSaving,
  typeDeletingId,
  onConfirmFieldSetup,
  onSaveField,
  onDeleteField,
  onSaveType,
  onDeleteType,
  onAddFieldToLayout,
  onRemoveFromLayout,
  onSetDetailZoneForField,
  onSetCardAreaForField
}: WorkItemEditorPropertiesProps) {
  const getFieldTypeLabel = (type: FieldDraft["type"] | PendingFieldSetup["type"]) =>
    FIELD_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? String(type);

  const renderFieldTypeSummary = (type: FieldDraft["type"] | PendingFieldSetup["type"]) => (
    <div className="wie__props-type-summary">
      <div>
        <span>Tipo do campo</span>
        <strong>{getFieldTypeLabel(type)}</strong>
      </div>
    </div>
  );

  const renderFieldDefinitionEditor = (draft: FieldDraft, options?: { showHeader?: boolean; showDelete?: boolean }) => {
    const showHeader = options?.showHeader ?? false;
    const showDelete = options?.showDelete ?? true;

    return (
      <>
        {showHeader ? (
          <div className="wie__props-head">
            <div className="wie__props-head-main">
              <span className="wie__props-eyebrow">Campo</span>
              <h3 className="wie__props-title">Editar definicao</h3>
            </div>
            <div className="wie__props-head-actions">
              <button
                type="button"
                className="wie__props-icon-btn"
                title={fieldSaving ? "Salvando..." : "Salvar campo"}
                aria-label={fieldSaving ? "Salvando campo" : "Salvar campo"}
                onClick={() => onSaveField()}
                disabled={fieldSaving || !draft.name.trim()}
              >
                {fieldSaving ? "..." : <AppIcon name="check" size={15} strokeWidth={2.3} />}
              </button>
              {showDelete ? (
                <button
                  type="button"
                  className="wie__props-icon-btn is-danger"
                  title={fieldDeletingId === draft.id ? "Removendo..." : "Excluir campo"}
                  aria-label={fieldDeletingId === draft.id ? "Removendo campo" : "Excluir campo"}
                  onClick={() => onDeleteField(draft.id)}
                  disabled={fieldDeletingId === draft.id}
                >
                  {fieldDeletingId === draft.id ? "..." : <AppIcon name="trash" size={15} strokeWidth={2.2} />}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className={showHeader ? "wie__props-scroll" : "wie__props-definition-editor"}>
          {!showHeader ? (
            <>
              <span className="wie__props-section-label">Definicao do campo</span>
              <p className="wie__props-section-hint">
                Alteracoes aqui afetam todos os tipos que utilizam este campo.
              </p>
            </>
          ) : null}
          <FormField label="Label do campo">
            <TextInput value={draft.name} placeholder="Ex: Impacto esperado"
              onChange={(e) => setFieldDraft({ ...draft, name: e.target.value })} />
          </FormField>
          {renderFieldTypeSummary(draft.type)}
          {isCatalogSelectType(draft.type) ? <CatalogSourceField /> : null}
          <div className="wie__props-toggles">
            <label>
              <input type="checkbox" checked={draft.required}
                onChange={(e) => setFieldDraft({ ...draft, required: e.target.checked })} />
              Obrigatorio
            </label>
            <label>
              <input type="checkbox" checked={draft.allowAiGeneration}
                disabled={!supportsAiGeneration(draft.type)}
                onChange={(e) => setFieldDraft({ ...draft, allowAiGeneration: e.target.checked })} />
              IA no campo
            </label>
          </div>
          {draft.type === "checklist" ? (
            <div className="wie__props-checklist-display">
              <FormField label="Icone do display">
                <TextInput
                  value={draft.checklistIcon}
                  placeholder="checklist, bug, user..."
                  onChange={(e) => setFieldDraft({ ...draft, checklistIcon: e.target.value })}
                />
              </FormField>
              <FormField label="Cor do display">
                <div className="wie__props-color-row">
                  <input
                    type="color"
                    value={resolveCssColorForInput(draft.checklistColor)}
                    onChange={(e) => setFieldDraft({ ...draft, checklistColor: e.target.value })}
                  />
                  <TextInput
                    value={draft.checklistColor}
                    onChange={(e) => setFieldDraft({ ...draft, checklistColor: e.target.value })}
                  />
                </div>
              </FormField>
            </div>
          ) : null}
          {draft.type === "billing_summary" ? (
            <div className="wie__props-billing-settings">
              <FormField label="Moeda">
                <TextInput
                  value={draft.billingCurrency}
                  placeholder="BRL"
                  onChange={(e) => setFieldDraft({ ...draft, billingCurrency: e.target.value.toUpperCase().slice(0, 3) })}
                />
              </FormField>
              <FormField label="Campos fonte">
                <TextInput
                  value={draft.billingSourceFields}
                  placeholder="amount, fee, discount"
                  onChange={(e) => setFieldDraft({ ...draft, billingSourceFields: e.target.value })}
                />
              </FormField>
              <FormField label="Agregacao">
                <AppSelect
                  className="wie__props-select"
                  value={draft.billingAggregationMode}
                  onValueChange={(value) => setFieldDraft({ ...draft, billingAggregationMode: value as FieldDraft["billingAggregationMode"] })}
                  aria-label="Agregacao"
                  items={billingAggregationItems}
                />
              </FormField>
              <FormField label="Formato">
                <AppSelect
                  className="wie__props-select"
                  value={draft.billingDisplayFormat}
                  onValueChange={(value) => setFieldDraft({ ...draft, billingDisplayFormat: value as FieldDraft["billingDisplayFormat"] })}
                  aria-label="Formato"
                  items={billingDisplayFormatItems}
                />
              </FormField>
              <label className="wie__props-billing-toggle">
                <input
                  type="checkbox"
                  checked={draft.billingReadOnly}
                  onChange={(e) => setFieldDraft({ ...draft, billingReadOnly: e.target.checked })}
                />
                Campo calculado/read-only
              </label>
            </div>
          ) : null}
          {supportsSelectableOptions(draft.type) ? (
            <div className="wie__props-options">
              <div className="wie__props-options-head">
                <strong>Opcoes</strong>
                <button type="button" onClick={() =>
                  setFieldDraft({ ...draft, options: [...draft.options, createEmptyOptionDraft(draft.options.length + 1)] })
                }>+ Adicionar</button>
              </div>
              {draft.options.map((opt) => (
                <div key={opt.id} className="wie__props-option-row">
                  <TextInput value={opt.label} placeholder="Label"
                    onChange={(e) => setFieldDraft({ ...draft, options: draft.options.map((o) => o.id === opt.id ? { ...o, label: e.target.value } : o) })} />
                  <button type="button" className="wie__props-option-remove"
                    onClick={() => setFieldDraft({ ...draft, options: draft.options.filter((o) => o.id !== opt.id) })}>x</button>
                </div>
              ))}
            </div>
          ) : null}
          {fieldError ? <p className="wie__props-error">{fieldError}</p> : null}
          {showHeader ? (
            <div className="wie__props-actions">
              <Button type="button" size="sm" variant="outline" onClick={() => { setFieldDraft(null); setFieldError(""); setSelectedFieldId(draft.runtimeFieldId); }}>
                Cancelar
              </Button>
            </div>
          ) : null}
        </div>
      </>
    );
  };

  if (pendingFieldSetup) {
    return (
      <div className="wie__props-panel">
        <div className="wie__props-head">
          <span className="wie__props-eyebrow">Novo campo — {activePendingTypeLabel}</span>
          <h3 className="wie__props-title">Configurar campo</h3>
        </div>
        <div className="wie__props-scroll">
          <FormField label="Label do campo">
            <TextInput
              value={pendingFieldSetup.name}
              placeholder="Ex: Titulo, Impacto, Prazo..."
              autoFocus
              onChange={(e) => setPendingFieldSetup({ ...pendingFieldSetup, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !supportsSelectableOptions(pendingFieldSetup.type)) onConfirmFieldSetup();
                if (e.key === "Escape") setPendingFieldSetup(null);
              }}
            />
          </FormField>
          {pendingFieldSetup.addToLayout ? (
            <div className="wie__props-target-info">
              <span>Posicao:</span>
              <strong>{pendingFieldTargetLabel}</strong>
            </div>
          ) : null}
          {renderFieldTypeSummary(pendingFieldSetup.type)}
          {isCatalogSelectType(pendingFieldSetup.type) ? <CatalogSourceField /> : null}
          <div className="wie__props-toggles">
            <label>
              <input type="checkbox" checked={pendingFieldSetup.required}
                onChange={(e) => setPendingFieldSetup({ ...pendingFieldSetup, required: e.target.checked })} />
              Obrigatorio
            </label>
            <label>
              <input type="checkbox" checked={pendingFieldSetup.allowAiGeneration}
                disabled={!supportsAiGeneration(pendingFieldSetup.type)}
                onChange={(e) => setPendingFieldSetup({ ...pendingFieldSetup, allowAiGeneration: e.target.checked })} />
              IA no campo
            </label>
          </div>
          {pendingFieldSetup.type === "checklist" ? (
            <div className="wie__props-checklist-display">
              <FormField label="Icone do display">
                <TextInput
                  value={pendingFieldSetup.checklistIcon}
                  placeholder="checklist, bug, user..."
                  onChange={(e) => setPendingFieldSetup({ ...pendingFieldSetup, checklistIcon: e.target.value })}
                />
              </FormField>
              <FormField label="Cor do display">
                <div className="wie__props-color-row">
                  <input
                    type="color"
                    value={resolveCssColorForInput(pendingFieldSetup.checklistColor)}
                    onChange={(e) => setPendingFieldSetup({ ...pendingFieldSetup, checklistColor: e.target.value })}
                  />
                  <TextInput
                    value={pendingFieldSetup.checklistColor}
                    onChange={(e) => setPendingFieldSetup({ ...pendingFieldSetup, checklistColor: e.target.value })}
                  />
                </div>
              </FormField>
            </div>
          ) : null}
          {pendingFieldSetup.type === "billing_summary" ? (
            <div className="wie__props-billing-settings">
              <FormField label="Moeda">
                <TextInput
                  value={pendingFieldSetup.billingCurrency}
                  placeholder="BRL"
                  onChange={(e) => setPendingFieldSetup({ ...pendingFieldSetup, billingCurrency: e.target.value.toUpperCase().slice(0, 3) })}
                />
              </FormField>
              <FormField label="Campos fonte">
                <TextInput
                  value={pendingFieldSetup.billingSourceFields}
                  placeholder="amount, fee, discount"
                  onChange={(e) => setPendingFieldSetup({ ...pendingFieldSetup, billingSourceFields: e.target.value })}
                />
              </FormField>
              <FormField label="Agregacao">
                <AppSelect
                  className="wie__props-select"
                  value={pendingFieldSetup.billingAggregationMode}
                  onValueChange={(value) => setPendingFieldSetup({
                    ...pendingFieldSetup,
                    billingAggregationMode: value as PendingFieldSetup["billingAggregationMode"]
                  })}
                  aria-label="Agregacao"
                  items={billingAggregationItems}
                />
              </FormField>
              <FormField label="Formato">
                <AppSelect
                  className="wie__props-select"
                  value={pendingFieldSetup.billingDisplayFormat}
                  onValueChange={(value) => setPendingFieldSetup({
                    ...pendingFieldSetup,
                    billingDisplayFormat: value as PendingFieldSetup["billingDisplayFormat"]
                  })}
                  aria-label="Formato"
                  items={billingDisplayFormatItems}
                />
              </FormField>
              <label className="wie__props-billing-toggle">
                <input
                  type="checkbox"
                  checked={pendingFieldSetup.billingReadOnly}
                  onChange={(e) => setPendingFieldSetup({ ...pendingFieldSetup, billingReadOnly: e.target.checked })}
                />
                Campo calculado/read-only
              </label>
            </div>
          ) : null}
          {supportsSelectableOptions(pendingFieldSetup.type) ? (
            <div className="wie__props-options">
              <div className="wie__props-options-head">
                <strong>Opcoes</strong>
                <button type="button" onClick={() =>
                  setPendingFieldSetup({ ...pendingFieldSetup, options: [...pendingFieldSetup.options, createEmptyOptionDraft(pendingFieldSetup.options.length + 1)] })
                }>+ Adicionar</button>
              </div>
              {pendingFieldSetup.options.map((opt) => (
                <div key={opt.id} className="wie__props-option-row">
                  <TextInput value={opt.label} placeholder="Label"
                    onChange={(e) => setPendingFieldSetup({ ...pendingFieldSetup, options: pendingFieldSetup.options.map((o) => o.id === opt.id ? { ...o, label: e.target.value } : o) })} />
                  <button type="button" className="wie__props-option-remove"
                    onClick={() => setPendingFieldSetup({ ...pendingFieldSetup, options: pendingFieldSetup.options.filter((o) => o.id !== opt.id) })}>x</button>
                </div>
              ))}
            </div>
          ) : null}
          {fieldError ? <p className="wie__props-error">{fieldError}</p> : null}
          <div className="wie__props-actions">
            <Button type="button" size="sm" onClick={() => onConfirmFieldSetup()} disabled={fieldSaving || !pendingFieldSetup.name.trim()}>
              {fieldSaving ? "Criando..." : pendingFieldSetup.addToLayout ? "Criar e adicionar" : "Criar campo"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { setPendingFieldSetup(null); setFieldError(""); }}>
              Cancelar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (fieldDraft && (!selectedFieldId || fieldDraft.runtimeFieldId !== selectedFieldId)) {
    return (
      <div className="wie__props-panel">
        {renderFieldDefinitionEditor(fieldDraft, { showHeader: true })}
      </div>
    );
  }

  if (typeComposer) {
    return (
      <div className="wie__props-panel">
        <div className="wie__props-head">
          <span className="wie__props-eyebrow">Tipo de item</span>
          <h3 className="wie__props-title">{editingTypeId ? "Editar tipo" : "Novo tipo"}</h3>
        </div>
        <div className="wie__props-scroll">
          <FormField label="Nome do tipo">
            <TextInput
              value={typeComposer.name}
              placeholder="Ex: Growth, Operacao, Bug..."
              autoFocus
              onChange={(e) => setTypeComposer({ ...typeComposer, name: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter") onSaveType(); if (e.key === "Escape") { setTypeComposer(null); setEditingTypeId(null); } }}
            />
          </FormField>
          <FormField label="Cor">
            <div className="wie__props-color-row">
              <input type="color" value={resolveCssColorForInput(typeComposer.color)}
                onChange={(e) => setTypeComposer({ ...typeComposer, color: e.target.value })} />
              <TextInput value={typeComposer.color}
                onChange={(e) => setTypeComposer({ ...typeComposer, color: e.target.value })} />
            </div>
          </FormField>
          <div className="wie__props-actions">
            <Button type="button" size="sm" onClick={() => onSaveType()} disabled={typeSaving || !typeComposer.name.trim()}>
              {typeSaving ? "Salvando..." : "Salvar tipo"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { setTypeComposer(null); setEditingTypeId(null); }}>
              Cancelar
            </Button>
          </div>
          {editingTypeId ? (
            <div className="wie__props-danger-zone">
              <Button type="button" size="sm" variant="outline"
                onClick={() => onDeleteType(editingTypeId)}
                disabled={typeDeletingId === editingTypeId}>
                {typeDeletingId === editingTypeId ? "Removendo..." : "Excluir tipo"}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (selectedField) {
    const showFieldProps = activeCanvasTab === "field";

    return (
      <div className="wie__props-panel">
        <div className="wie__props-head">
          <div className="wie__props-head-main">
            <span className="wie__props-eyebrow">Campo</span>
            <h3 className="wie__props-title">{selectedField.label}</h3>
            <span className="wie__props-type-badge">{getTaskFieldTypeLabel(selectedField)}</span>
          </div>
          {showFieldProps && fieldDraft ? (
            <div className="wie__props-head-actions">
              <button
                type="button"
                className="wie__props-icon-btn"
                title={fieldSaving ? "Salvando..." : "Salvar campo"}
                aria-label={fieldSaving ? "Salvando campo" : "Salvar campo"}
                onClick={() => onSaveField()}
                disabled={fieldSaving || !fieldDraft.name.trim()}
              >
                {fieldSaving ? "..." : <AppIcon name="check" size={15} strokeWidth={2.3} />}
              </button>
              {selectedField.hasApiDefinition ? (
                <button
                  type="button"
                  className="wie__props-icon-btn is-danger"
                  title={fieldDeletingId === fieldDraft.id ? "Removendo..." : "Excluir campo"}
                  aria-label={fieldDeletingId === fieldDraft.id ? "Removendo campo" : "Excluir campo"}
                  onClick={() => onDeleteField(fieldDraft.id)}
                  disabled={fieldDeletingId === fieldDraft.id}
                >
                  {fieldDeletingId === fieldDraft.id ? "..." : <AppIcon name="trash" size={15} strokeWidth={2.2} />}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="wie__props-scroll">
          {!showFieldProps ? (
            <>
              <div className="wie__props-usage-section">
                <div className="wie__props-usage-label">
                  <span>Card do board</span>
                  {selectedInCard ? <span className="wie__props-badge is-active">incluido</span> : <span className="wie__props-badge">fora</span>}
                </div>
                {selectedInCard ? (
                  <div className="wie__props-usage-actions">
                    <p className="wie__props-usage-hint">
                      Posicao {activeLayout.card.indexOf(selectedFieldId!) + 1} de {activeLayout.card.length}.
                      Arraste no canvas para reordenar.
                    </p>
                    <div className="wie__props-area-selector">
                      <span className="wie__props-area-label">Slot no card:</span>
                      <div className="wie__props-area-btns">
                        {CARD_SLOT_AREA_META.map(({ area, label }) => {
                          const currentArea =
                            (activeCardAreaDrafts[selectedField.id] as TaskFieldCardArea | undefined) ??
                            (previewCardDebug?.fields.find((f) => f.fieldId === selectedField.id)?.area as TaskFieldCardArea | undefined);
                          const isActive = currentArea === area;
                          return (
                            <button
                              key={area}
                              type="button"
                              className={`wie__props-area-btn${isActive ? " is-active" : ""}`}
                              title={label}
                              onClick={() => onSetCardAreaForField(selectedField.id, area)}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <Button type="button" size="sm" variant="outline"
                      onClick={() => onRemoveFromLayout(selectedField.id, "card")}>
                      Remover do card
                    </Button>
                  </div>
                ) : (
                  <Button type="button" size="sm" variant="outline"
                    onClick={() => onAddFieldToLayout(selectedField.id, "card")}>
                    + Adicionar ao card
                  </Button>
                )}
              </div>

              <div className="wie__props-divider" />

              <div className="wie__props-usage-section">
                <div className="wie__props-usage-label">
                  <span>Formulario expandido</span>
                  {selectedInDetail ? <span className="wie__props-badge is-active">incluido</span> : <span className="wie__props-badge">fora</span>}
                </div>
                {selectedInDetail ? (
                  <div className="wie__props-usage-actions">
                    <div className="wie__props-zone-row">
                      <span>Zona:</span>
                      <div className="wie__props-zone-switcher">
                        <button type="button"
                          className={`wie__props-zone-btn${selectedDetailZone === "main" ? " is-active" : ""}`}
                          onClick={() => onSetDetailZoneForField(selectedField.id, "main")}>
                          Principal
                        </button>
                        <button type="button"
                          className={`wie__props-zone-btn${selectedDetailZone !== "main" ? " is-active" : ""}`}
                          onClick={() => onSetDetailZoneForField(selectedField.id, "side")}>
                          Lateral
                        </button>
                      </div>
                    </div>
                    <p className="wie__props-usage-hint">
                      Posicao {activeLayout.detail.indexOf(selectedFieldId!) + 1} de {activeLayout.detail.length} campos no formulario.
                      Arraste no canvas para reordenar.
                    </p>
                    <Button type="button" size="sm" variant="outline"
                      onClick={() => onRemoveFromLayout(selectedField.id, "detail")}>
                      Remover do formulario
                    </Button>
                  </div>
                ) : (
                  <div className="wie__props-usage-actions">
                    <p className="wie__props-usage-hint">Escolha a zona onde o campo deve aparecer:</p>
                    <div className="wie__props-add-zone-btns">
                      <Button type="button" size="sm" variant="outline"
                        onClick={() => {
                          onAddFieldToLayout(selectedField.id, "detail");
                          onSetDetailZoneForField(selectedField.id, "main");
                        }}>
                        + Coluna principal
                      </Button>
                      <Button type="button" size="sm" variant="outline"
                        onClick={() => onAddFieldToLayout(selectedField.id, "detail")}>
                        + Barra lateral
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {fieldDraft ? renderFieldDefinitionEditor(fieldDraft, { showDelete: selectedField.hasApiDefinition }) : null}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="wie__props-panel is-idle">
      <div className="wie__props-idle">
        <div className="wie__props-idle-icon">⠿</div>
        <strong>Nenhum campo selecionado</strong>
        <p>
          Clique em qualquer campo no canvas ou na biblioteca para ver e editar suas propriedades e posicao no layout.
        </p>
        <div className="wie__props-idle-tips">
          <div className="wie__props-idle-tip">
            <span>Biblioteca</span>
            <p>Clique em um campo para selecionar. Arraste para posicionar no canvas.</p>
          </div>
          <div className="wie__props-idle-tip">
            <span>Canvas</span>
            <p>Clique em um campo para ver suas propriedades. Arraste para reordenar.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
