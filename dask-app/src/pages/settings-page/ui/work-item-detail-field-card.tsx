import type { ComponentProps, DragEvent, MouseEvent, ReactNode } from "react";
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
  dragPayload: DragPayload | null;
  isDragging: boolean;
  previewTask: Task;
  previewBoardConfig: BoardConfig;
  previewRuntimeStatuses: ComponentProps<typeof WorkItemFieldRenderer>["statuses"];
  previewMembersById: ComponentProps<typeof WorkItemFieldRenderer>["membersById"];
  renderDetailInsertTarget: (zone: DetailZone, index: number) => ReactNode;
  onSelectField: (fieldId: string) => void;
  onBeginDetailMouseDrag: (event: MouseEvent<HTMLElement>, fieldId: string) => void;
  onDragStartField: (event: DragEvent<HTMLElement>, fieldId: string, origin: "detail") => void;
  onDragEnd: () => void;
  onUpdateDropTarget: (target: EditorDropTarget | null) => void;
  onDropOnTarget: (event: DragEvent<HTMLElement>, target: EditorDropTarget) => void;
}

export function WorkItemDetailFieldCard({
  field,
  zone,
  index,
  selectedFieldId,
  dragPayload,
  isDragging,
  previewTask,
  previewBoardConfig,
  previewRuntimeStatuses,
  previewMembersById,
  renderDetailInsertTarget,
  onSelectField,
  onBeginDetailMouseDrag,
  onDragStartField,
  onDragEnd,
  onUpdateDropTarget,
  onDropOnTarget
}: WorkItemDetailFieldCardProps) {
  const isSelected = selectedFieldId === field.id;
  const isSelfDrag = dragPayload?.kind === "field" && dragPayload.fieldId === field.id;
  const previewValue = resolveTaskFieldValue(previewTask, field);
  const beforeTarget: EditorDropTarget = { surface: "detail", kind: "insert", zone, index };
  const afterTarget: EditorDropTarget = { surface: "detail", kind: "insert", zone, index: index + 1 };
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
        className={`wie__detail-field-card wie__detail-field-card--${shellStyle.kind} ${layoutClass}${zone === "side" ? " is-side" : ""}${isSelected ? " is-selected" : ""}`}
        data-workitem-slot="detail"
        data-detail-zone={zone}
        data-field-type={field.type}
        data-field-id={field.id}
        draggable
        onClick={(e) => {
          e.stopPropagation();
          onSelectField(field.id);
        }}
        onMouseDown={(e) => onBeginDetailMouseDrag(e, field.id)}
        onDragStart={(e) => {
          e.stopPropagation();
          onDragStartField(e, field.id, "detail");
        }}
        onDragOver={(event) => {
          if (!dragPayload || isSelfDrag) return;
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = dragPayload.kind === "type" ? "copy" : "move";
          const rect = event.currentTarget.getBoundingClientRect();
          onUpdateDropTarget(event.clientY < rect.top + rect.height / 2 ? beforeTarget : afterTarget);
        }}
        onMouseMove={(event) => {
          if (!dragPayload || isSelfDrag) return;
          event.preventDefault();
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          onUpdateDropTarget(event.clientY < rect.top + rect.height / 2 ? beforeTarget : afterTarget);
        }}
        onDrop={(event) => {
          if (isSelfDrag) return;
          const rect = event.currentTarget.getBoundingClientRect();
          onDropOnTarget(event, event.clientY < rect.top + rect.height / 2 ? beforeTarget : afterTarget);
        }}
        onDragEnd={onDragEnd}
      >
        <div
          className="wie__detail-field-card-dragbar"
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            onDragStartField(e, field.id, "detail");
          }}
          onMouseDown={(e) => onBeginDetailMouseDrag(e, field.id)}
          onDragEnd={onDragEnd}
        >
          <span className="wie__detail-field-card-type">{getTaskFieldTypeLabel(field)}</span>
          <span className="wie__detail-field-card-handle">Arrastar</span>
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
          draggable
          onClick={(e) => {
            e.stopPropagation();
            onSelectField(field.id);
          }}
          onDragStart={(e) => {
            e.stopPropagation();
            onDragStartField(e, field.id, "detail");
          }}
          onMouseDown={(e) => onBeginDetailMouseDrag(e, field.id)}
          onDragEnd={onDragEnd}
        />
      </section>
    </div>
  );
}
