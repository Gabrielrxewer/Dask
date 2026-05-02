import type { DragEvent } from "react";
import { getTaskFieldTypeLabel } from "@/entities/task";
import type { CustomFieldType } from "@/modules/workspace/model";
import {
  FIELD_TYPE_OPTIONS,
  type FieldLibraryItem
} from "./work-item-editor-settings.model";

interface WorkItemFieldLibraryProps {
  activeCanvasTab: "card" | "detail" | "field";
  librarySearch: string;
  libraryFieldsInCardOnly: FieldLibraryItem[];
  libraryFieldsInBoth: FieldLibraryItem[];
  libraryFieldsInDetailOnly: FieldLibraryItem[];
  libraryFieldsUnused: FieldLibraryItem[];
  cardFieldSet: Set<string>;
  detailFieldSet: Set<string>;
  selectedFieldId: string | null;
  onSearchChange: (value: string) => void;
  onSelectField: (fieldId: string) => void;
  onDragStartField: (event: DragEvent<HTMLElement>, fieldId: string, origin: "library") => void;
  onDragStartType: (event: DragEvent<HTMLElement>, type: CustomFieldType) => void;
  onDragEnd: () => void;
  onOpenNewFieldPanel: (type: CustomFieldType) => void;
}

export function WorkItemFieldLibrary({
  activeCanvasTab,
  librarySearch,
  libraryFieldsInCardOnly,
  libraryFieldsInBoth,
  libraryFieldsInDetailOnly,
  libraryFieldsUnused,
  cardFieldSet,
  detailFieldSet,
  selectedFieldId,
  onSearchChange,
  onSelectField,
  onDragStartField,
  onDragStartType,
  onDragEnd,
  onOpenNewFieldPanel
}: WorkItemFieldLibraryProps) {
  const renderLibraryChip = (field: FieldLibraryItem) => {
    const inCard = cardFieldSet.has(field.id);
    const inDetail = detailFieldSet.has(field.id);
    const isSelected = selectedFieldId === field.id;

    let usageLabel = "";
    if (inCard && inDetail) usageLabel = "card + form";
    else if (inCard) usageLabel = "card";
    else if (inDetail) usageLabel = "form";

    return (
      <div
        key={field.id}
        className={`wie__lib-chip${isSelected ? " is-selected" : ""}${inCard || inDetail ? " is-used" : ""}`}
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          onDragStartField(e, field.id, "library");
        }}
        onDragEnd={onDragEnd}
        onClick={() => onSelectField(field.id)}
      >
        <div className="wie__lib-chip-info">
          <span className="wie__lib-chip-label">{field.label}</span>
          <span className="wie__lib-chip-type">{getTaskFieldTypeLabel(field)}</span>
        </div>
        {usageLabel ? <span className="wie__lib-chip-badge">{usageLabel}</span> : null}
      </div>
    );
  };

  return (
    <aside className="wie__library">
      <div className="wie__lib-head">
        <div className="wie__lib-title-row">
          <span className="wie__lib-eyebrow">Biblioteca</span>
          <strong className="wie__lib-title">Campos</strong>
        </div>
        <input
          className="wie__lib-search"
          type="search"
          placeholder="Buscar campo..."
          value={librarySearch}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      <div className="wie__lib-scroll">
        {libraryFieldsInCardOnly.length > 0 && (
          <div className="wie__lib-group">
            <p className="wie__lib-group-title is-card">No card</p>
            {libraryFieldsInCardOnly.map(renderLibraryChip)}
          </div>
        )}
        {libraryFieldsInBoth.length > 0 && (
          <div className="wie__lib-group">
            <p className="wie__lib-group-title is-both">Card + formulario</p>
            {libraryFieldsInBoth.map(renderLibraryChip)}
          </div>
        )}
        {libraryFieldsInDetailOnly.length > 0 && (
          <div className="wie__lib-group">
            <p className="wie__lib-group-title is-detail">No formulario</p>
            {libraryFieldsInDetailOnly.map(renderLibraryChip)}
          </div>
        )}
        <div className="wie__lib-group">
          <p className="wie__lib-group-title">Disponiveis</p>
          {libraryFieldsUnused.length === 0 ? (
            <p className="wie__lib-empty">Todos os campos estao no layout.</p>
          ) : (
            libraryFieldsUnused.map(renderLibraryChip)
          )}
        </div>

        {activeCanvasTab === "field" ? (
          <div className="wie__lib-group wie__lib-group--new">
            <p className="wie__lib-group-title">Novo campo</p>
            <p className="wie__lib-hint">Clique para criar um novo campo.</p>
            <div className="wie__type-tiles">
              {FIELD_TYPE_OPTIONS.map((opt) => (
                <div
                  key={opt.value}
                  className="wie__type-tile"
                  draggable
                  onDragStart={(e) => {
                    e.stopPropagation();
                    onDragStartType(e, opt.value);
                  }}
                  onDragEnd={onDragEnd}
                  onClick={() => onOpenNewFieldPanel(opt.value)}
                >
                  <strong>{opt.label}</strong>
                  <span>{opt.caption}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
