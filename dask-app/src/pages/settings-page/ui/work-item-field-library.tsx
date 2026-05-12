import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";
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
  onOpenNewFieldPanel: (type: CustomFieldType) => void;
}

function DraggableLibraryFieldChip({
  field,
  selected,
  trailing,
  onSelectField
}: {
  field: FieldLibraryItem;
  selected: boolean;
  trailing?: ReactNode;
  onSelectField: (fieldId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `work-item-field-library:${field.id}`,
    data: {
      payload: { kind: "field", fieldId: field.id, origin: "library" }
    }
  });

  return (
    <div
      ref={setNodeRef}
      className={isDragging ? "wie__dnd-source is-dragging" : "wie__dnd-source"}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...attributes}
      {...listeners}
      aria-label={`Mover campo ${field.label}`}
    >
      <PanelMenuItem
        variant="chip"
        selected={selected}
        onClick={() => onSelectField(field.id)}
        label={field.label}
        trailing={trailing}
      />
    </div>
  );
}

function DraggableFieldTypeTile({
  option,
  onOpenNewFieldPanel
}: {
  option: (typeof FIELD_TYPE_OPTIONS)[number];
  onOpenNewFieldPanel: (type: CustomFieldType) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `work-item-field-type:${option.value}`,
    data: {
      payload: { kind: "type", type: option.value }
    }
  });

  return (
    <div
      ref={setNodeRef}
      className={`panel-menu-tile${isDragging ? " is-dragging" : ""}`}
      style={{ transform: CSS.Translate.toString(transform) }}
      onClick={() => onOpenNewFieldPanel(option.value)}
      {...attributes}
      {...listeners}
      aria-label={`Criar campo ${option.label}`}
    >
      <strong>{option.label}</strong>
      <span>{option.caption}</span>
    </div>
  );
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
      <DraggableLibraryFieldChip
        key={field.id}
        field={field}
        selected={isSelected}
        onSelectField={onSelectField}
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
                <DraggableFieldTypeTile
                  key={opt.value}
                  option={opt}
                  onOpenNewFieldPanel={onOpenNewFieldPanel}
                />
              ))}
            </div>
          </PanelMenuGroup>
        ) : null}
      </PanelMenu>
    </aside>
  );
}
