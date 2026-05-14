import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { ComponentProps, ReactNode } from "react";
import {
  FieldShell,
  getTaskFieldTypeLabel,
  resolveFieldShellStyle,
  resolveTaskFieldValue,
  WorkItemFieldRenderer
} from "@/entities/task";
import type { BoardConfig, Task } from "@/entities/task";
import type { DetailZone, EditorDropTarget } from "@/pages/settings-page/model/work-item-layout-editor";
import {
  resolveDetailPreviewLayoutClass,
  type DragPayload,
  type FieldLibraryItem
} from "./work-item-editor-settings.model";

interface WorkItemDetailFieldCardProps {
  field: FieldLibraryItem;
  zone: DetailZone;
  index: number;
  selectedFieldId: string | null;
  isDragging: boolean;
  previewTask: Task;
  previewBoardConfig: BoardConfig;
  previewRuntimeStatuses: ComponentProps<typeof WorkItemFieldRenderer>["statuses"];
  previewMembersById: ComponentProps<typeof WorkItemFieldRenderer>["membersById"];
  dropTarget: EditorDropTarget | null;
  dragPayload: DragPayload | null;
  renderDetailInsertTarget: (zone: DetailZone, index: number) => ReactNode;
  onUpdateDropTarget: (target: EditorDropTarget | null) => void;
  onSelectField: (fieldId: string) => void;
}

export function WorkItemDetailFieldCard({
  field,
  zone,
  index,
  selectedFieldId,
  isDragging,
  previewTask,
  previewBoardConfig,
  previewRuntimeStatuses,
  previewMembersById,
  dropTarget,
  dragPayload,
  renderDetailInsertTarget,
  onUpdateDropTarget,
  onSelectField
}: WorkItemDetailFieldCardProps) {
  const isSelected = selectedFieldId === field.id;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: isFieldDragging
  } = useDraggable({
    id: `work-item-detail-field:${field.id}`,
    data: {
      payload: { kind: "field", fieldId: field.id, origin: "detail" }
    }
  });
  const previewValue = resolveTaskFieldValue(previewTask, field);
  const replaceTarget: EditorDropTarget = {
    surface: "detail",
    kind: "replace-field",
    targetFieldId: field.id,
    zone
  };
  const {
    setNodeRef: setDropNodeRef,
    isOver
  } = useDroppable({
    id: `work-item-detail-replace:${field.id}`,
    disabled: !dragPayload || (dragPayload.kind === "field" && dragPayload.fieldId === field.id),
    data: { target: replaceTarget }
  });
  const isReplaceTarget =
    dropTarget?.surface === "detail" &&
    dropTarget.kind === "replace-field" &&
    dropTarget.targetFieldId === field.id;
  const shellStyle = resolveFieldShellStyle({
    field,
    mode: "edit",
    context: "detail",
    readonly: false
  });
  const layoutClass = resolveDetailPreviewLayoutClass(field, zone);

  return (
    <div key={`detail-${zone}-${field.id}`} className={`wie__detail-slot-wrap ${layoutClass}`}>
      {isDragging ? renderDetailInsertTarget(zone, index) : null}
      <section
        ref={(node) => {
          setNodeRef(node);
          setDropNodeRef(node);
        }}
        className={`wie__detail-field-card wie__detail-field-card--${shellStyle.kind} ${layoutClass}${zone === "side" ? " is-side" : ""}${isSelected ? " is-selected" : ""}${isReplaceTarget || isOver ? " is-replace-target" : ""}`}
        style={{ transform: CSS.Translate.toString(transform) }}
        data-workitem-slot="detail"
        data-detail-zone={zone}
        data-field-type={field.type}
        data-field-id={field.id}
        data-drop-intent={isReplaceTarget || isOver ? "replace" : undefined}
        onClick={(e) => {
          e.stopPropagation();
          onSelectField(field.id);
        }}
        onPointerEnter={() => {
          if (!dragPayload || (dragPayload.kind === "field" && dragPayload.fieldId === field.id)) return;
          onUpdateDropTarget(replaceTarget);
        }}
        {...attributes}
        {...listeners}
        aria-label={`Mover campo ${field.label}`}
      >
        <div
          className="wie__detail-field-card-dragbar"
        >
          <span className="wie__detail-field-card-type">{getTaskFieldTypeLabel(field)}</span>
          <span className="wie__detail-field-card-handle">{isFieldDragging ? "Movendo" : "Arrastar"}</span>
        </div>
        <FieldShell
          label={field.label}
          hint={field.description}
          required={field.required}
          kind={shellStyle.kind}
          helpMode={shellStyle.helpMode}
        >
          <div className="wie__detail-field-card-body">
            <WorkItemFieldRenderer
              field={field}
              value={previewValue}
              mode="edit"
              context="detail"
              boardConfig={previewBoardConfig}
              statuses={previewRuntimeStatuses}
              membersById={previewMembersById}
              task={previewTask}
              disabled
              onChange={() => undefined}
            />
          </div>
        </FieldShell>
        <div
          className="wie__detail-field-card-drag-surface"
          aria-label={`Mover campo ${field.label}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelectField(field.id);
          }}
        />
      </section>
    </div>
  );
}
