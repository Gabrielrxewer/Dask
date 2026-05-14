import type { ApiItemType } from "@/modules/workspace/model";
import { Button } from "@/shared/ui";
import { AppIcon } from "@/shared/ui/icon";
import { DEFAULT_TYPE_COLOR, type TypeDraft } from "./work-item-editor-settings.model";

interface WorkItemEditorToolbarProps {
  activeItemTypes: ApiItemType[];
  activeType: ApiItemType | null;
  cardFieldsCount: number;
  detailFieldsCount: number;
  hasUnsavedLayout: boolean;
  savingLayout: boolean;
  canChangeFieldType: boolean;
  onSelectType: (slug: string) => void;
  onEditType: (type: ApiItemType) => void;
  onNewType: (draft: TypeDraft) => void;
  onOpenNewFieldPicker: () => void;
  onRequestFieldTypeChange: () => void;
  onDiscardLayout: () => void;
  onSaveLayout: () => void;
}

export function WorkItemEditorToolbar({
  activeItemTypes,
  activeType,
  cardFieldsCount,
  detailFieldsCount,
  hasUnsavedLayout,
  savingLayout,
  canChangeFieldType,
  onSelectType,
  onEditType,
  onNewType,
  onOpenNewFieldPicker,
  onRequestFieldTypeChange,
  onDiscardLayout,
  onSaveLayout
}: WorkItemEditorToolbarProps) {
  return (
    <div className="wie__topbar">
      <div className="wie__tabs">
        {activeItemTypes.map((type) => (
          <div key={type.id} className={`wie__tab${activeType?.slug === type.slug ? " is-active" : ""}`}>
            <button type="button" className="wie__tab-btn" onClick={() => onSelectType(type.slug)}>
              <i className="wie__tab-dot" style={{ background: type.color || DEFAULT_TYPE_COLOR }} />
              {type.name}
            </button>
            <button
              type="button"
              className="wie__tab-edit"
              title={`Editar tipo ${type.name}`}
              onClick={() => onEditType(type)}
            >
              ✎
            </button>
          </div>
        ))}
        <button
          type="button"
          className="wie__add-tab"
          onClick={() => onNewType({ name: "", color: DEFAULT_TYPE_COLOR })}
        >
          + Novo tipo
        </button>
      </div>

      <div className="wie__topbar-right">
        {hasUnsavedLayout ? <span className="wie__unsaved-indicator">Alteracoes nao salvas</span> : null}
        <div className="wie__summary">
          <span><strong>{cardFieldsCount}</strong> no card</span>
          <span><strong>{detailFieldsCount}</strong> no form</span>
        </div>
        <div className="wie__topbar-actions" aria-label="Acoes do editor de work items">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="wie__topbar-action"
            title="Novo campo"
            aria-label="Criar novo campo"
            onClick={onOpenNewFieldPicker}
          >
            <AppIcon name="plus" size={16} strokeWidth={2.3} />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="wie__topbar-action"
            title="Trocar tipo do campo"
            aria-label="Trocar tipo do campo"
            onClick={onRequestFieldTypeChange}
            disabled={!canChangeFieldType}
          >
            <AppIcon name="refresh" size={15} strokeWidth={2.2} />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="wie__topbar-action"
            title="Descartar alteracoes"
            aria-label="Descartar alteracoes"
            onClick={onDiscardLayout}
            disabled={!hasUnsavedLayout || savingLayout}
          >
            <AppIcon name="x" size={16} strokeWidth={2.2} />
          </Button>
          <Button
            type="button"
            size="icon"
            className="wie__topbar-action"
            title={savingLayout ? "Salvando layout" : "Salvar layout"}
            aria-label={savingLayout ? "Salvando layout" : "Salvar layout"}
            onClick={onSaveLayout}
            disabled={!hasUnsavedLayout || savingLayout}
          >
            <AppIcon name="save" size={16} strokeWidth={2.1} />
          </Button>
        </div>
      </div>
    </div>
  );
}
