import { useDroppable } from "@dnd-kit/core";
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
}

export function WorkItemCardEmptySlot({
  area,
  index,
  occupiedCount,
  slotLimit,
  dropTarget,
  dragPayload,
  onUpdateDropTarget
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
  const { setNodeRef, isOver } = useDroppable({
    id: `work-item-card-empty:${area}:${index}`,
    disabled: !dragPayload,
    data: { target }
  });
  const SlotTag = area === "badge" || area === "summary" || area === "meta" ? "span" : "div";

  return (
    <SlotTag
      ref={setNodeRef}
      className={`wie__card-empty-slot wie__card-empty-slot--${area}${isTarget || isOver ? " is-target" : ""}`}
      data-slot-area={area}
      data-drop-intent={isTarget || isOver ? "vacancy" : undefined}
      onPointerEnter={() => {
        if (!dragPayload) return;
        onUpdateDropTarget(target);
      }}
    >
      <span className="wie__card-empty-slot-label">+ campo</span>
      <span className="wie__card-empty-slot-count">{`${occupiedCount}/${slotLimit}`}</span>
    </SlotTag>
  );
}
