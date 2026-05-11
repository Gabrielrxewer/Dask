import { useDraggable } from "@dnd-kit/core";
import { getAgendaSegmentLayout, type AgendaEvent } from "@/pages/agenda-page/model/agenda-view-model";
import { toHourLabel } from "@/pages/agenda-page/ui/agenda-page.model";

interface AgendaEventCardProps {
  segment: AgendaEvent;
  dayStart: number;
  agendaStartOffset: number;
  onSelectTask: (taskId: string) => void;
  draggable?: boolean;
  isOverlay?: boolean;
}

export function AgendaEventCard({
  segment,
  dayStart,
  agendaStartOffset,
  onSelectTask,
  draggable = false,
  isOverlay = false
}: AgendaEventCardProps) {
  const { top, height, width, left } = getAgendaSegmentLayout({
    segment,
    dayStart,
    agendaStartOffset
  });
  const drag = useDraggable({
    id: `agenda-event:${segment.id}`,
    data: { agendaEvent: segment },
    disabled: !draggable || !segment.taskId
  });
  const dragProps = draggable && segment.taskId && !isOverlay
    ? { ...drag.attributes, ...drag.listeners }
    : {};

  return (
    <button
      ref={isOverlay ? undefined : drag.setNodeRef}
      type="button"
      className={`agenda-view__event${drag.isDragging ? " agenda-view__event--dragging" : ""}${draggable ? " agenda-view__event--draggable" : ""}${isOverlay ? " agenda-view__event--overlay" : ""}`}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: `calc(${left}% + 3px)`,
        width: `calc(${width}% - 6px)`,
        background: segment.tone.background,
        borderColor: segment.tone.border,
        color: segment.tone.text
      }}
      onClick={() => {
        if (segment.taskId) {
          onSelectTask(segment.taskId);
        }
      }}
      {...dragProps}
    >
      <strong>{`${toHourLabel(segment.start)} - ${toHourLabel(segment.end)}`}</strong>
      <span>{segment.title}</span>
      <small>{segment.subtitle}</small>
    </button>
  );
}
