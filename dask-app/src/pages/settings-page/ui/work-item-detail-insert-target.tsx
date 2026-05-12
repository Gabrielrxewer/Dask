import { useDroppable } from "@dnd-kit/core";
import type { DetailZone, EditorDropTarget } from "@/pages/settings-page/model/work-item-layout-editor";
import type { DragPayload } from "./work-item-editor-settings.model";

interface WorkItemDetailInsertTargetProps {
  zone: DetailZone;
  index: number;
  dropTarget: EditorDropTarget | null;
  dragPayload: DragPayload | null;
  onUpdateDropTarget: (target: EditorDropTarget | null) => void;
}

export function WorkItemDetailInsertTarget({
  zone,
  index,
  dropTarget,
  dragPayload,
  onUpdateDropTarget
}: WorkItemDetailInsertTargetProps) {
  const target: EditorDropTarget = {
    surface: "detail",
    kind: "insert",
    zone,
    index
  };
  const isTarget =
    dropTarget?.surface === "detail" &&
    dropTarget.kind === "insert" &&
    dropTarget.zone === zone &&
    dropTarget.index === index;
  const { setNodeRef, isOver } = useDroppable({
    id: `work-item-detail-insert:${zone}:${index}`,
    disabled: !dragPayload,
    data: { target }
  });

  return (
    <div
      ref={setNodeRef}
      key={`detail-insert-${zone}-${index}`}
      className={`wie__detail-insert-target${zone === "side" ? " is-side" : ""}${isTarget || isOver ? " is-target" : ""}`}
      data-detail-zone={zone}
      data-drop-intent={isTarget || isOver ? "vacancy" : undefined}
      onPointerEnter={() => {
        if (!dragPayload) return;
        onUpdateDropTarget(target);
      }}
    >
      <span>Solte aqui</span>
    </div>
  );
}
