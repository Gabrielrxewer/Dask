import { useDroppable } from "@dnd-kit/core";
import type { AgendaSlot } from "@/pages/agenda-page/model/agenda-view-model";
import {
  AGENDA_ROW_HEIGHT,
  MINUTE_MS,
  SLOT_MINUTES
} from "@/pages/agenda-page/ui/agenda-page.model";
import { makeAgendaDropSlotId } from "@/pages/agenda-page/ui/use-agenda-drag-reschedule";

interface AgendaSlotCellProps {
  dayStart: number;
  slot: AgendaSlot;
  agendaStartOffset: number;
  isHighlighted: boolean;
  disabled: boolean;
}

export function AgendaSlotCell({
  dayStart,
  slot,
  agendaStartOffset,
  isHighlighted,
  disabled
}: AgendaSlotCellProps) {
  const id = makeAgendaDropSlotId(dayStart, slot.key);
  const { setNodeRef, isOver } = useDroppable({
    id,
    disabled,
    data: {
      agendaDropSlot: {
        id,
        dayStart,
        slotStart: dayStart + slot.startOffset,
        slotEnd: dayStart + slot.endOffset
      }
    }
  });
  const top = ((slot.startOffset - agendaStartOffset) / MINUTE_MS / SLOT_MINUTES) * AGENDA_ROW_HEIGHT;

  return (
    <div
      ref={setNodeRef}
      className={`agenda-view__drop-slot${isOver || isHighlighted ? " agenda-view__drop-slot--active" : ""}`}
      style={{
        top: `${top}px`,
        height: `${AGENDA_ROW_HEIGHT}px`
      }}
    />
  );
}
