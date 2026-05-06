import type { DragEvent } from "react";
import { getTaskFieldTypeLabel } from "@/entities/task";
import type { CustomFieldType } from "@/modules/workspace/model";
import { EmptyState, PanelMenu, PanelMenuGroup, PanelMenuItem } from "@/shared/ui";
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
  const renderFieldChip = (field: FieldLibraryItem) => {
    const inCard = cardFieldSet.has(field.id);
    const inDetail = detailFieldSet.has(field.id);
    const isSelected = selectedFieldId === field.id;

    let usageLabel = "";
    if (inCard && inDetail) usageLabel = "card + form";
    else if (inCard) usageLabel = "card";
    else if (inDetail) usageLabel = "form";

    return (
      <PanelMenuItem
        key={field.id}
        variant="chip"
        selected={isSelected}
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          onDragStartField(e as DragEvent<HTMLElement>, field.id, "library");
        }}
        onDragEnd={onDragEnd}
        onClick={() => onSelectField(field.id)}
        label={field.label}
        trailing={usageLabel ? <span className="wie__lib-usage">{usageLabel}</span> : undefined}
      />
    );
  };

  return (
    <aside className="wie__library">
      <PanelMenu
        eyebrow="Biblioteca"
        title="Campos"
        search={librarySearch}
        onSearchChange={onSearchChange}
        searchPlaceholder="Buscar campo..."
      >
        {libraryFieldsInCardOnly.length > 0 && (
          <PanelMenuGroup label="No card" tone="card">
            {libraryFieldsInCardOnly.map(renderFieldChip)}
          </PanelMenuGroup>
        )}
        {libraryFieldsInBoth.length > 0 && (
          <PanelMenuGroup label="Card + formulario" tone="both">
            {libraryFieldsInBoth.map(renderFieldChip)}
          </PanelMenuGroup>
        )}
        {libraryFieldsInDetailOnly.length > 0 && (
          <PanelMenuGroup label="No formulario" tone="detail">
            {libraryFieldsInDetailOnly.map(renderFieldChip)}
          </PanelMenuGroup>
        )}

        <PanelMenuGroup label="Disponiveis">
          {libraryFieldsUnused.length === 0 ? (
            <EmptyState size="compact">Todos os campos estao no layout.</EmptyState>
          ) : (
            libraryFieldsUnused.map(renderFieldChip)
          )}
        </PanelMenuGroup>

        {activeCanvasTab === "field" ? (
          <PanelMenuGroup label="Novo campo" tone="new">
            <div className="panel-menu-tile-grid">
              {FIELD_TYPE_OPTIONS.map((opt) => (
                <div
                  key={opt.value}
                  className="panel-menu-tile"
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
          </PanelMenuGroup>
        ) : null}
      </PanelMenu>
    </aside>
  );
}
