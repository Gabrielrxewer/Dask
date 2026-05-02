import type { DragEvent } from "react";
import type { TaskCardSlotArea } from "@/entities/task";
import type { EditorDropTarget } from "@/pages/settings-page/model/work-item-layout-editor";
import type { DragPayload } from "./work-item-editor-settings.model";

interface WorkItemCardEmptySlotProps {
  area: TaskCardSlotArea;
  index: number;
  occupiedCount: number;
  slotLimit: number;
  dropTarget: EditorDropTarget | null;
  dragPayload: DragPayload | null;
  onUpdateDropTarget: (target: EditorDropTarget | null) => void;
  onDropOnTarget: (event: DragEvent<HTMLElement>, target: EditorDropTarget) => void;
}

export function WorkItemCardEmptySlot({
  area,
  index,
  occupiedCount,
  slotLimit,
  dropTarget,
  dragPayload,
  onUpdateDropTarget,
  onDropOnTarget
}: WorkItemCardEmptySlotProps) {
  const target: EditorDropTarget = {
    surface: "card",
    kind: "empty-slot",
    area,
    index
  };
  const isTarget =
    dropTarget?.surface === "card" &&
    dropTarget.kind === "empty-slot" &&
    dropTarget.area === area &&
    dropTarget.index === index;
  const SlotTag = area === "badge" || area === "summary" || area === "meta" ? "span" : "div";

  return (
    <SlotTag
      className={`wie__card-empty-slot wie__card-empty-slot--${area}${isTarget ? " is-target" : ""}`}
      data-slot-area={area}
      data-drop-intent={isTarget ? "vacancy" : undefined}
      onDragOver={(event) => {
        if (!dragPayload) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = dragPayload.kind === "type" ? "copy" : "move";
        onUpdateDropTarget(target);
      }}
      onDrop={(event) => onDropOnTarget(event, target)}
    >
      <span className="wie__card-empty-slot-label">+ campo</span>
      <span className="wie__card-empty-slot-count">{`${occupiedCount}/${slotLimit}`}</span>
    </SlotTag>
  );
}
