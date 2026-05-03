import type { ApiItemType } from "@/modules/workspace/model";
import { Button } from "@/shared/ui";
import { DEFAULT_TYPE_COLOR, type TypeDraft } from "./work-item-editor-settings.model";

interface WorkItemEditorToolbarProps {
  activeItemTypes: ApiItemType[];
  activeType: ApiItemType | null;
  cardFieldsCount: number;
  detailFieldsCount: number;
  hasUnsavedLayout: boolean;
  savingLayout: boolean;
  onSelectType: (slug: string) => void;
  onEditType: (type: ApiItemType) => void;
  onNewType: (draft: TypeDraft) => void;
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
  onSelectType,
  onEditType,
  onNewType,
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
        <Button type="button" size="sm" variant="outline" onClick={onDiscardLayout} disabled={!hasUnsavedLayout || savingLayout}>
          Descartar
        </Button>
        <Button type="button" size="sm" onClick={onSaveLayout} disabled={!hasUnsavedLayout || savingLayout}>
          {savingLayout ? "Salvando..." : "Salvar layout"}
        </Button>
      </div>
    </div>
  );
}
