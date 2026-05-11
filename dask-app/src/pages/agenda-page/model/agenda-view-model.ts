import { useMemo } from "react";
import { getTaskTypeDisplayMeta, type Task } from "@/entities/task";
import type { CalendarFeedSnapshot } from "@/modules/workspace";
import {
  AGENDA_END_HOUR,
  AGENDA_ROW_HEIGHT,
  AGENDA_START_HOUR,
  MINUTE_MS,
  SLOT_MINUTES,
  addDays,
  extractTaskResources,
  getOverlapDuration,
  overlaps,
  parseDateTime,
  resolvePlannedWindow,
  startOfWeek,
  toHourLabel,
  type AgendaSegment,
  type AvailabilityMode,
  type AvailabilityRow,
  type AvailabilityRowSnapshot,
  type AvailabilityState,
  type DetailTarget,
  type PlannedTask,
  type UnscheduledGroup
} from "@/pages/agenda-page/ui/agenda-page.model";

type AgendaMember = {
  name?: string | null;
};

type AgendaMembersById = Record<string, AgendaMember | undefined>;

export type AgendaViewMode = AvailabilityMode;

export type AgendaEventKind = "work-item" | "external-calendar";

export type AgendaEvent = AgendaSegment & {
  kind: AgendaEventKind;
  plannedStart?: number;
  plannedEnd?: number;
};

export type AgendaSlot = {
  key: string;
  label: string;
  startOffset: number;
  endOffset: number;
};

export type AgendaResource = {
  id: string;
  label: string;
  detailKind: "person" | "resource";
  subtitle?: string;
};

export type AgendaWeekRange = {
  currentWeekStart: number;
  weekStart: number;
  weekEnd: number;
  weekDays: number[];
  weekViewDirection: "previous" | "current" | "next";
};

export type AgendaConflict = {
  slotStart: number;
  slotEnd: number;
  tasks: PlannedTask[];
};

export type AgendaLane = {
  index: number;
  end: number;
};

export type AgendaReschedulePayload = {
  workspaceId: string;
  workItemId: string;
  plannedStartAt: string;
  plannedEndAt: string;
  assigneeId?: string | null;
  resourceId?: string | null;
  reason: "agenda_drag_reschedule";
};

export type AgendaSegmentLayout = {
  top: number;
  height: number;
  width: number;
  left: number;
};

export type AgendaViewModel = {
  plannedTasks: PlannedTask[];
  unscheduledTasks: Task[];
  unscheduledGroups: UnscheduledGroup[];
  weekRange: AgendaWeekRange;
  selectedDayStart: number;
  weekPlannedTasks: PlannedTask[];
  hourSlots: AgendaSlot[];
  agendaStartOffset: number;
  agendaEndOffset: number;
  agendaHeight: number;
  availabilityRows: AvailabilityRow[];
  availabilitySnapshots: AvailabilityRowSnapshot[];
  selectedDetailTasks: PlannedTask[];
  selectedDetailMember: AgendaMember | undefined;
  weeklyAgendaByDay: AgendaEvent[][];
  tasksOutsideAgenda: PlannedTask[];
  plannedTasksOutsideWeek: PlannedTask[];
};

type UseAgendaViewModelInput = {
  tasks: Task[];
  activeMembers: AgendaMembersById;
  availabilityMode: AgendaViewMode;
  weekAnchor: number;
  selectedDayIndex: number;
  selectedDetailTarget: DetailTarget | null;
  calendarFeed: CalendarFeedSnapshot | null;
  typeMap: Parameters<typeof getTaskTypeDisplayMeta>[0];
};

export function buildAgendaWeekRange(weekAnchor: number, now = Date.now()): AgendaWeekRange {
  const currentWeekStart = startOfWeek(now);
  const weekStart = startOfWeek(weekAnchor);
  const weekEnd = addDays(weekStart, 7);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const weekViewDirection = weekStart < currentWeekStart ? "previous" : weekStart > currentWeekStart ? "next" : "current";

  return {
    currentWeekStart,
    weekStart,
    weekEnd,
    weekDays,
    weekViewDirection
  };
}

export function buildAgendaHourSlots(weekStart: number): AgendaSlot[] {
  const slotCount = ((AGENDA_END_HOUR - AGENDA_START_HOUR) * 60) / SLOT_MINUTES;

  return Array.from({ length: slotCount }, (_, rowIndex) => {
    const startOffset = (AGENDA_START_HOUR * 60 + rowIndex * SLOT_MINUTES) * MINUTE_MS;
    return {
      key: `${rowIndex}`,
      label: toHourLabel(weekStart + startOffset),
      startOffset,
      endOffset: startOffset + SLOT_MINUTES * MINUTE_MS
    };
  });
}

export function buildPlannedTasks(tasks: Task[]): PlannedTask[] {
  return tasks
    .map(task => ({ task, window: resolvePlannedWindow(task) }))
    .filter((entry): entry is PlannedTask => Boolean(entry.window))
    .sort((left, right) => left.window.start - right.window.start);
}

export function buildUnscheduledGroups(input: {
  filteredTasks: Task[];
  unscheduledTasks: Task[];
  activeMembers: AgendaMembersById;
}): UnscheduledGroup[] {
  const byAssignee = new Map<string, Task[]>();

  input.unscheduledTasks.forEach((task) => {
    const key = task.assignee || "unassigned";
    const current = byAssignee.get(key) ?? [];
    current.push(task);
    byAssignee.set(key, current);
  });

  return Array.from(byAssignee.entries())
    .map(([assigneeId, tasks]) => {
      const memberTasks = input.filteredTasks.filter((task) => (task.assignee || "unassigned") === assigneeId);
      const plannedCount = memberTasks.filter((task) => resolvePlannedWindow(task) !== null).length;
      const doneCount = memberTasks.filter((task) => task.status === "done").length;

      return {
        assigneeId,
        label: input.activeMembers[assigneeId]?.name ?? "Sem responsavel",
        tasks: tasks.sort((left, right) => left.title.localeCompare(right.title, "pt-BR")),
        totalCount: memberTasks.length,
        plannedCount,
        doneCount,
        unscheduledCount: tasks.length
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
}

export function buildAvailabilityRows(input: {
  availabilityMode: AgendaViewMode;
  weekPlannedTasks: PlannedTask[];
  activeMembers: AgendaMembersById;
}): AvailabilityRow[] {
  if (input.availabilityMode === "people") {
    const byMember = new Map<string, PlannedTask[]>();
    input.weekPlannedTasks.forEach((entry) => {
      const list = byMember.get(entry.task.assignee) ?? [];
      list.push(entry);
      byMember.set(entry.task.assignee, list);
    });

    return Array.from(byMember.entries())
      .map(([memberId, tasks]) => ({
        id: memberId,
        label: input.activeMembers[memberId]?.name ?? memberId,
        subtitle: `${tasks.length} atividades planejadas na semana`,
        tasks,
        detailKind: "person" as const
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }

  const byResource = new Map<string, AvailabilityRow>();
  input.weekPlannedTasks.forEach((entry) => {
    extractTaskResources(entry.task).forEach((resource) => {
      const current = byResource.get(resource.id);
      if (current) {
        current.tasks.push(entry);
        return;
      }
      byResource.set(resource.id, {
        id: resource.id,
        label: resource.label,
        subtitle: "",
        tasks: [entry],
        detailKind: "resource"
      });
    });
  });

  return Array.from(byResource.values())
    .map((row) => ({
      ...row,
      subtitle: `${row.tasks.length} atividades usando o recurso na semana`
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function buildAvailabilitySnapshots(input: {
  rows: AvailabilityRow[];
  hourSlots: AgendaSlot[];
  selectedDayStart: number;
}): AvailabilityRowSnapshot[] {
  return input.rows.map((row) => {
    const slots = input.hourSlots.map((slot) => {
      const slotStart = input.selectedDayStart + slot.startOffset;
      const slotEnd = input.selectedDayStart + slot.endOffset;
      const busyTasks = row.tasks
        .filter(entry => overlaps(entry.window.start, entry.window.end, slotStart, slotEnd))
        .sort((left, right) => left.window.start - right.window.start);

      const maxOverlapDuration = busyTasks.reduce(
        (maxDuration, entry) => Math.max(maxDuration, getOverlapDuration(entry.window.start, entry.window.end, slotStart, slotEnd)),
        0
      );

      let state: AvailabilityState = "free";
      if (busyTasks.length > 1) {
        state = "conflict";
      } else if (busyTasks.length === 1) {
        state = maxOverlapDuration >= slotEnd - slotStart - MINUTE_MS ? "busy" : "partial";
      }

      return {
        key: slot.key,
        startOffset: slot.startOffset,
        endOffset: slot.endOffset,
        state,
        tasks: busyTasks,
        slotStart,
        slotEnd
      };
    });

    return {
      ...row,
      slots,
      occupiedCount: slots.filter(slot => slot.state !== "free").length
    };
  });
}

export function buildSelectedDetailTasks(input: {
  selectedDetailTarget: DetailTarget | null;
  weekPlannedTasks: PlannedTask[];
}): PlannedTask[] {
  if (!input.selectedDetailTarget) {
    return [];
  }

  if (input.selectedDetailTarget.kind === "person") {
    return input.weekPlannedTasks.filter(({ task }) => task.assignee === input.selectedDetailTarget?.id);
  }

  return input.weekPlannedTasks.filter(({ task }) =>
    extractTaskResources(task).some(resource => resource.id === input.selectedDetailTarget?.id)
  );
}

export function assignAgendaLanes<TSegment extends AgendaEvent>(segments: TSegment[]): TSegment[] {
  const laneEndByIndex: number[] = [];
  let laneCount = 1;

  segments.forEach((segment) => {
    const freeLane = laneEndByIndex.findIndex((laneEnd) => segment.start >= laneEnd);
    const lane = freeLane === -1 ? laneEndByIndex.length : freeLane;
    laneEndByIndex[lane] = segment.end;
    laneCount = Math.max(laneCount, lane + 1);
    segment.lane = lane;
  });

  return segments.map((segment) => ({ ...segment, laneCount }));
}

export function buildWeeklyAgendaByDay(input: {
  weekDays: number[];
  agendaStartOffset: number;
  agendaEndOffset: number;
  selectedDetailTarget: DetailTarget | null;
  selectedDetailTasks: PlannedTask[];
  activeMembers: AgendaMembersById;
  calendarFeed: CalendarFeedSnapshot | null;
  typeMap: Parameters<typeof getTaskTypeDisplayMeta>[0];
}): AgendaEvent[][] {
  return input.weekDays.map((dayStart) => {
    const visibleStart = dayStart + input.agendaStartOffset;
    const visibleEnd = dayStart + input.agendaEndOffset;

    const taskSegments: AgendaEvent[] = input.selectedDetailTasks
      .flatMap(({ task, window }) => {
        if (window.end <= visibleStart || window.start >= visibleEnd) {
          return [];
        }
        const segmentStart = Math.max(window.start, visibleStart);
        const segmentEnd = Math.max(Math.min(window.end, visibleEnd), segmentStart + 20 * MINUTE_MS);
        const type = getTaskTypeDisplayMeta(input.typeMap, task.type);
        const assigneeName = input.activeMembers[task.assignee]?.name;

        return [{
          id: `${task.id}-${segmentStart}`,
          kind: "work-item" as const,
          start: segmentStart,
          end: segmentEnd,
          title: task.title,
          subtitle: input.selectedDetailTarget?.kind === "resource" && assigneeName ? assigneeName : type.label,
          tone: { background: type.background, border: type.border, text: type.text },
          taskId: task.id,
          plannedStart: window.start,
          plannedEnd: window.end,
          lane: 0,
          laneCount: 1
        }];
      });

    const meetingSegments: AgendaEvent[] =
      input.selectedDetailTarget?.kind === "person"
        ? (input.calendarFeed?.events ?? []).flatMap((event) => {
            const eventStart = parseDateTime(event.startAt);
            const eventEnd = parseDateTime(event.endAt);
            if (eventStart === null || eventEnd === null) {
              return [];
            }
            if (eventEnd <= visibleStart || eventStart >= visibleEnd) {
              return [];
            }

            const segmentStart = Math.max(eventStart, visibleStart);
            const segmentEnd = Math.max(Math.min(eventEnd, visibleEnd), segmentStart + 20 * MINUTE_MS);

            return [{
              id: `meeting-${event.id}-${segmentStart}`,
              kind: "external-calendar" as const,
              start: segmentStart,
              end: segmentEnd,
              title: event.title,
              subtitle: event.provider === "teams" ? "Reuniao Teams" : "Reuniao externa",
              tone: {
                background: "color-mix(in oklab, var(--primary) 18%, var(--neutral-white))",
                border: "color-mix(in oklab, var(--primary) 42%, transparent)",
                text: "var(--primary)"
              },
              lane: 0,
              laneCount: 1
            }];
          })
        : [];

    return assignAgendaLanes([...taskSegments, ...meetingSegments].sort((left, right) => left.start - right.start));
  });
}

export function buildTasksOutsideAgenda(input: {
  weekPlannedTasks: PlannedTask[];
}): PlannedTask[] {
  return input.weekPlannedTasks.filter((entry) => {
    const startDate = new Date(entry.window.start);
    const endDate = new Date(entry.window.end);
    const startHour = startDate.getHours() + startDate.getMinutes() / 60;
    const endHour = endDate.getHours() + endDate.getMinutes() / 60;
    return startHour < AGENDA_START_HOUR || endHour > AGENDA_END_HOUR;
  });
}

export function getAgendaSegmentLayout(input: {
  segment: AgendaSegment;
  dayStart: number;
  agendaStartOffset: number;
}): AgendaSegmentLayout {
  const top = ((input.segment.start - (input.dayStart + input.agendaStartOffset)) / MINUTE_MS / SLOT_MINUTES) * AGENDA_ROW_HEIGHT;
  const height = Math.max(((input.segment.end - input.segment.start) / MINUTE_MS / SLOT_MINUTES) * AGENDA_ROW_HEIGHT, 24);
  const width = 100 / input.segment.laneCount;
  const left = input.segment.lane * width;

  return { top, height, width, left };
}

export function useAgendaViewModel({
  tasks,
  activeMembers,
  availabilityMode,
  weekAnchor,
  selectedDayIndex,
  selectedDetailTarget,
  calendarFeed,
  typeMap
}: UseAgendaViewModelInput): AgendaViewModel {
  const plannedTasks = useMemo(() => buildPlannedTasks(tasks), [tasks]);
  const unscheduledTasks = useMemo(
    () => tasks.filter(task => resolvePlannedWindow(task) === null),
    [tasks]
  );
  const unscheduledGroups = useMemo(
    () => buildUnscheduledGroups({ filteredTasks: tasks, unscheduledTasks, activeMembers }),
    [activeMembers, tasks, unscheduledTasks]
  );
  const weekRange = useMemo(() => buildAgendaWeekRange(weekAnchor), [weekAnchor]);
  const selectedDayStart = weekRange.weekDays[selectedDayIndex] ?? weekRange.weekStart;
  const weekPlannedTasks = useMemo(
    () => plannedTasks.filter((entry) => overlaps(entry.window.start, entry.window.end, weekRange.weekStart, weekRange.weekEnd)),
    [plannedTasks, weekRange.weekEnd, weekRange.weekStart]
  );
  const hourSlots = useMemo(() => buildAgendaHourSlots(weekRange.weekStart), [weekRange.weekStart]);
  const agendaStartOffset = AGENDA_START_HOUR * 60 * MINUTE_MS;
  const agendaEndOffset = AGENDA_END_HOUR * 60 * MINUTE_MS;
  const agendaHeight = hourSlots.length * AGENDA_ROW_HEIGHT;
  const availabilityRows = useMemo(
    () => buildAvailabilityRows({ availabilityMode, weekPlannedTasks, activeMembers }),
    [activeMembers, availabilityMode, weekPlannedTasks]
  );
  const availabilitySnapshots = useMemo(
    () => buildAvailabilitySnapshots({ rows: availabilityRows, hourSlots, selectedDayStart }),
    [availabilityRows, hourSlots, selectedDayStart]
  );
  const selectedDetailTasks = useMemo(
    () => buildSelectedDetailTasks({ selectedDetailTarget, weekPlannedTasks }),
    [selectedDetailTarget, weekPlannedTasks]
  );
  const weeklyAgendaByDay = useMemo(
    () =>
      buildWeeklyAgendaByDay({
        weekDays: weekRange.weekDays,
        agendaStartOffset,
        agendaEndOffset,
        selectedDetailTarget,
        selectedDetailTasks,
        activeMembers,
        calendarFeed,
        typeMap
      }),
    [
      activeMembers,
      agendaEndOffset,
      agendaStartOffset,
      calendarFeed,
      selectedDetailTarget,
      selectedDetailTasks,
      typeMap,
      weekRange.weekDays
    ]
  );
  const tasksOutsideAgenda = useMemo(
    () => buildTasksOutsideAgenda({ weekPlannedTasks }),
    [weekPlannedTasks]
  );
  const plannedTasksOutsideWeek = useMemo(
    () => plannedTasks.filter((entry) => !overlaps(entry.window.start, entry.window.end, weekRange.weekStart, weekRange.weekEnd)),
    [plannedTasks, weekRange.weekEnd, weekRange.weekStart]
  );

  return {
    plannedTasks,
    unscheduledTasks,
    unscheduledGroups,
    weekRange,
    selectedDayStart,
    weekPlannedTasks,
    hourSlots,
    agendaStartOffset,
    agendaEndOffset,
    agendaHeight,
    availabilityRows,
    availabilitySnapshots,
    selectedDetailTasks,
    selectedDetailMember: selectedDetailTarget?.kind === "person" ? activeMembers[selectedDetailTarget.id] : undefined,
    weeklyAgendaByDay,
    tasksOutsideAgenda,
    plannedTasksOutsideWeek
  };
}
