import type { DragEvent, MouseEvent } from "react";
import type { DetailZone, EditorDropTarget } from "@/pages/settings-page/model/work-item-layout-editor";
import type { DragPayload } from "./work-item-editor-settings.model";

interface WorkItemDetailInsertTargetProps {
  zone: DetailZone;
  index: number;
  dropTarget: EditorDropTarget | null;
  dragPayload: DragPayload | null;
  onUpdateDropTarget: (target: EditorDropTarget | null) => void;
  onDropOnTarget: (event: DragEvent<HTMLElement>, target: EditorDropTarget) => void;
}

export function WorkItemDetailInsertTarget({
  zone,
  index,
  dropTarget,
  dragPayload,
  onUpdateDropTarget,
  onDropOnTarget
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

  const handleMove = (event: DragEvent<HTMLElement> | MouseEvent<HTMLElement>) => {
    if (!dragPayload) return;
    event.preventDefault();
    event.stopPropagation();
    onUpdateDropTarget(target);
  };

  return (
    <div
      key={`detail-insert-${zone}-${index}`}
      className={`wie__detail-insert-target${zone === "side" ? " is-side" : ""}${isTarget ? " is-target" : ""}`}
      data-detail-zone={zone}
      data-drop-intent={isTarget ? "vacancy" : undefined}
      onDragOver={(event) => {
        if (!dragPayload) return;
        event.dataTransfer.dropEffect = dragPayload.kind === "type" ? "copy" : "move";
        handleMove(event);
      }}
      onMouseMove={handleMove}
      onDrop={(event) => onDropOnTarget(event, target)}
    >
      <span>Solte aqui</span>
    </div>
  );
}
