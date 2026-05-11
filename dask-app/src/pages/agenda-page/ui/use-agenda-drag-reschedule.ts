import { useState } from "react";
import {
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import type { AgendaEvent } from "@/pages/agenda-page/model/agenda-view-model";
import { MINUTE_MS, SLOT_MINUTES } from "@/pages/agenda-page/ui/agenda-page.model";
import { useRescheduleWorkItemMutation } from "@/modules/agenda";
import type { RescheduleWorkItemMutationInput } from "@/modules/agenda";

export type AgendaDropSlot = {
  id: string;
  dayStart: number;
  slotStart: number;
  slotEnd: number;
};

type AgendaDragData = {
  agendaEvent?: AgendaEvent;
};

type AgendaDropData = {
  agendaDropSlot?: AgendaDropSlot;
};

interface UseAgendaDragRescheduleInput {
  workspaceId: string;
  canReschedule: boolean;
}

export function makeAgendaDropSlotId(dayStart: number, slotKey: string): string {
  return `agenda-slot:${dayStart}:${slotKey}`;
}

function readAgendaEvent(event: DragStartEvent | DragEndEvent): AgendaEvent | null {
  const data = event.active.data.current as AgendaDragData | undefined;
  return data?.agendaEvent ?? null;
}

function readAgendaDropSlot(event: DragOverEvent | DragEndEvent): AgendaDropSlot | null {
  const data = event.over?.data.current as AgendaDropData | undefined;
  return data?.agendaDropSlot ?? null;
}

export function buildAgendaRescheduleInput(input: {
  workspaceId: string;
  agendaEvent: AgendaEvent;
  dropSlot: AgendaDropSlot;
}): RescheduleWorkItemMutationInput | null {
  if (!input.agendaEvent.taskId) {
    return null;
  }

  const originalStart = input.agendaEvent.plannedStart ?? input.agendaEvent.start;
  const originalEnd = input.agendaEvent.plannedEnd ?? input.agendaEvent.end;
  const duration = Math.max(originalEnd - originalStart, SLOT_MINUTES * MINUTE_MS);
  const nextStart = input.dropSlot.slotStart;

  if (Math.abs(nextStart - originalStart) < 1000) {
    return null;
  }

  return {
    workspaceId: input.workspaceId,
    workItemId: input.agendaEvent.taskId,
    plannedStartAt: new Date(nextStart).toISOString(),
    plannedEndAt: new Date(nextStart + duration).toISOString(),
    reason: "agenda_drag_reschedule"
  };
}

export function useAgendaDragReschedule({
  workspaceId,
  canReschedule
}: UseAgendaDragRescheduleInput) {
  const rescheduleMutation = useRescheduleWorkItemMutation(workspaceId);
  const [activeEvent, setActiveEvent] = useState<AgendaEvent | null>(null);
  const [overSlotId, setOverSlotId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 }
    }),
    useSensor(KeyboardSensor)
  );
  const isDragDisabled = !canReschedule || rescheduleMutation.isPending;

  function clearDragState() {
    setActiveEvent(null);
    setOverSlotId(null);
  }

  function handleDragStart(event: DragStartEvent) {
    if (isDragDisabled) {
      return;
    }
    setActiveEvent(readAgendaEvent(event));
  }

  function handleDragOver(event: DragOverEvent) {
    setOverSlotId(readAgendaDropSlot(event)?.id ?? null);
  }

  function handleDragCancel(_event: DragCancelEvent) {
    clearDragState();
  }

  function handleDragEnd(event: DragEndEvent) {
    const agendaEvent = readAgendaEvent(event);
    const dropSlot = readAgendaDropSlot(event);
    clearDragState();

    if (isDragDisabled || !agendaEvent?.taskId || !dropSlot) {
      return;
    }

    const payload = buildAgendaRescheduleInput({
      workspaceId,
      agendaEvent,
      dropSlot
    });

    if (!payload) {
      return;
    }

    rescheduleMutation.mutate(payload);
  }

  return {
    activeEvent,
    overSlotId,
    sensors,
    isDragDisabled,
    isRescheduling: rescheduleMutation.isPending,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel
  };
}
