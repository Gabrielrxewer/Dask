import { DndContext, DragOverlay, pointerWithin } from "@dnd-kit/core";
import type { AgendaEvent, AgendaSlot } from "@/pages/agenda-page/model/agenda-view-model";
import { startOfDay, toAgendaDayLabel } from "@/pages/agenda-page/ui/agenda-page.model";
import { AgendaEventCard } from "@/pages/agenda-page/ui/components/agenda-event-card";
import { AgendaSlotCell } from "@/pages/agenda-page/ui/components/agenda-slot-cell";
import { makeAgendaDropSlotId, useAgendaDragReschedule } from "@/pages/agenda-page/ui/use-agenda-drag-reschedule";

interface WeeklyDetailGridProps {
  workspaceId: string;
  canReschedule: boolean;
  weekDays: number[];
  hourSlots: AgendaSlot[];
  weeklyAgendaByDay: AgendaEvent[][];
  agendaStartOffset: number;
  agendaHeight: number;
  onSelectTask: (taskId: string) => void;
}

export function WeeklyDetailGrid({
  workspaceId,
  canReschedule,
  weekDays,
  hourSlots,
  weeklyAgendaByDay,
  agendaStartOffset,
  agendaHeight,
  onSelectTask
}: WeeklyDetailGridProps) {
  const drag = useAgendaDragReschedule({ workspaceId, canReschedule });

  return (
    <DndContext
      sensors={drag.sensors}
      collisionDetection={pointerWithin}
      onDragStart={drag.handleDragStart}
      onDragOver={drag.handleDragOver}
      onDragEnd={drag.handleDragEnd}
      onDragCancel={drag.handleDragCancel}
    >
      <div className="agenda-view__grid-scroller">
        <div className="agenda-view__grid">
          <div className="agenda-view__time-head" />
          {weekDays.map(day => (
            <div key={day} className="agenda-view__day-head">
              {toAgendaDayLabel(day)}
            </div>
          ))}

          <div className="agenda-view__time-column">
            {hourSlots.map(slot => (
              <span key={`slot-${slot.key}`}>{slot.label}</span>
            ))}
          </div>

          {weekDays.map((day, dayIndex) => (
            <div key={`day-${day}`} className="agenda-view__day">
              <div className="agenda-view__canvas" style={{ height: `${agendaHeight}px` }}>
                {hourSlots.map(slot => (
                  <AgendaSlotCell
                    key={`${day}-${slot.key}`}
                    dayStart={day}
                    slot={slot}
                    agendaStartOffset={agendaStartOffset}
                    disabled={drag.isDragDisabled}
                    isHighlighted={drag.overSlotId === makeAgendaDropSlotId(day, slot.key)}
                  />
                ))}
                {weeklyAgendaByDay[dayIndex]?.map((segment) => (
                  <AgendaEventCard
                    key={segment.id}
                    segment={segment}
                    dayStart={day}
                    agendaStartOffset={agendaStartOffset}
                    onSelectTask={onSelectTask}
                    draggable={!drag.isDragDisabled && segment.kind === "work-item"}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <DragOverlay>
        {drag.activeEvent ? (
          <AgendaEventCard
            segment={drag.activeEvent}
            dayStart={startOfDay(drag.activeEvent.start)}
            agendaStartOffset={agendaStartOffset}
            onSelectTask={() => undefined}
            isOverlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
