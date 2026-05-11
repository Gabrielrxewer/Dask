import { describe, expect, it } from "vitest";
import type { Task } from "@/entities/task";
import {
  buildAgendaHourSlots,
  buildAgendaWeekRange,
  buildAvailabilityRows,
  buildAvailabilitySnapshots,
  buildPlannedTasks,
  buildTasksOutsideAgenda,
  buildWeeklyAgendaByDay
} from "@/pages/agenda-page/model/agenda-view-model";
import { buildAgendaRescheduleInput } from "@/pages/agenda-page/ui/use-agenda-drag-reschedule";
import { AGENDA_START_HOUR, DAY_MS } from "@/pages/agenda-page/ui/agenda-page.model";

function makeTask(patch: Partial<Task>): Task {
  return {
    id: patch.id ?? "task-1",
    title: patch.title ?? "Task",
    text: patch.text ?? "",
    type: patch.type ?? "task",
    status: patch.status ?? "todo",
    priority: patch.priority ?? 2,
    tags: patch.tags ?? [],
    assignee: patch.assignee ?? "member-1",
    checklist: patch.checklist ?? { items: [] },
    due: patch.due ?? "",
    plannedStartAt: patch.plannedStartAt ?? null,
    plannedEndAt: patch.plannedEndAt ?? null,
    customFields: patch.customFields ?? {}
  };
}

describe("agenda view model", () => {
  it("calcula a semana a partir da segunda-feira", () => {
    const anchor = new Date(2026, 4, 6, 12).getTime();
    const monday = new Date(2026, 4, 4).getTime();
    const range = buildAgendaWeekRange(anchor, anchor);

    expect(range.weekStart).toBe(monday);
    expect(range.weekEnd).toBe(monday + 7 * DAY_MS);
    expect(range.weekDays).toHaveLength(7);
    expect(range.weekViewDirection).toBe("current");
  });

  it("mapeia WorkItems planejados e ignora itens sem janela", () => {
    const tasks = [
      makeTask({
        id: "a",
        plannedStartAt: "2026-05-04T09:00:00.000Z",
        plannedEndAt: "2026-05-04T10:00:00.000Z"
      }),
      makeTask({ id: "b" })
    ];

    const planned = buildPlannedTasks(tasks);

    expect(planned).toHaveLength(1);
    expect(planned[0].task.id).toBe("a");
  });

  it("marca conflitos quando mais de um WorkItem ocupa o mesmo slot", () => {
    const dayStart = new Date("2026-05-04T00:00:00.000Z").getTime();
    const tasks = buildPlannedTasks([
      makeTask({
        id: "a",
        plannedStartAt: "2026-05-04T09:00:00.000Z",
        plannedEndAt: "2026-05-04T10:00:00.000Z"
      }),
      makeTask({
        id: "b",
        title: "Other",
        plannedStartAt: "2026-05-04T09:15:00.000Z",
        plannedEndAt: "2026-05-04T09:45:00.000Z"
      })
    ]);
    const hourSlots = buildAgendaHourSlots(dayStart);
    const rows = buildAvailabilityRows({
      availabilityMode: "people",
      weekPlannedTasks: tasks,
      activeMembers: { "member-1": { name: "Ana" } }
    });

    const snapshots = buildAvailabilitySnapshots({ rows, hourSlots, selectedDayStart: dayStart });
    const conflictSlot = snapshots[0].slots.find(slot => slot.state === "conflict");

    expect(conflictSlot?.tasks.map(entry => entry.task.id).sort()).toEqual(["a", "b"]);
  });

  it("calcula lanes para eventos sobrepostos", () => {
    const dayStart = new Date("2026-05-04T00:00:00.000Z").getTime();
    const tasks = buildPlannedTasks([
      makeTask({
        id: "a",
        plannedStartAt: "2026-05-04T09:00:00.000Z",
        plannedEndAt: "2026-05-04T10:00:00.000Z"
      }),
      makeTask({
        id: "b",
        plannedStartAt: "2026-05-04T09:30:00.000Z",
        plannedEndAt: "2026-05-04T10:30:00.000Z"
      })
    ]);

    const [segments] = buildWeeklyAgendaByDay({
      weekDays: [dayStart],
      agendaStartOffset: AGENDA_START_HOUR * 60 * 60 * 1000,
      agendaEndOffset: 22 * 60 * 60 * 1000,
      selectedDetailTarget: { id: "member-1", label: "Ana", kind: "person" },
      selectedDetailTasks: tasks,
      activeMembers: { "member-1": { name: "Ana" } },
      calendarFeed: null,
      typeMap: {}
    });

    expect(segments.map(segment => segment.lane).sort()).toEqual([0, 1]);
    expect(segments.every(segment => segment.laneCount === 2)).toBe(true);
  });

  it("identifica itens planejados fora da janela visivel", () => {
    const tasks = buildPlannedTasks([
      makeTask({
        id: "early",
        plannedStartAt: "2026-05-04T04:00:00.000Z",
        plannedEndAt: "2026-05-04T05:00:00.000Z"
      })
    ]);

    expect(buildTasksOutsideAgenda({ weekPlannedTasks: tasks }).map(entry => entry.task.id)).toEqual(["early"]);
  });

  it("preserva duracao ao montar payload de reagendamento", () => {
    const payload = buildAgendaRescheduleInput({
      workspaceId: "workspace-slug",
      agendaEvent: {
        id: "task-1-1",
        kind: "work-item",
        taskId: "task-1",
        title: "Task",
        subtitle: "Tipo",
        start: Date.parse("2026-05-04T09:00:00.000Z"),
        end: Date.parse("2026-05-04T10:30:00.000Z"),
        plannedStart: Date.parse("2026-05-04T09:00:00.000Z"),
        plannedEnd: Date.parse("2026-05-04T10:30:00.000Z"),
        lane: 0,
        laneCount: 1,
        tone: { background: "white", border: "gray", text: "black" }
      },
      dropSlot: {
        id: "slot",
        dayStart: Date.parse("2026-05-05T00:00:00.000Z"),
        slotStart: Date.parse("2026-05-05T13:00:00.000Z"),
        slotEnd: Date.parse("2026-05-05T13:30:00.000Z")
      }
    });

    expect(payload).toMatchObject({
      workspaceId: "workspace-slug",
      workItemId: "task-1",
      plannedStartAt: "2026-05-05T13:00:00.000Z",
      plannedEndAt: "2026-05-05T14:30:00.000Z",
      reason: "agenda_drag_reschedule"
    });
  });

  it("ignora drop no mesmo horario original", () => {
    const payload = buildAgendaRescheduleInput({
      workspaceId: "workspace-slug",
      agendaEvent: {
        id: "task-1-1",
        kind: "work-item",
        taskId: "task-1",
        title: "Task",
        subtitle: "Tipo",
        start: Date.parse("2026-05-04T09:00:00.000Z"),
        end: Date.parse("2026-05-04T10:00:00.000Z"),
        plannedStart: Date.parse("2026-05-04T09:00:00.000Z"),
        plannedEnd: Date.parse("2026-05-04T10:00:00.000Z"),
        lane: 0,
        laneCount: 1,
        tone: { background: "white", border: "gray", text: "black" }
      },
      dropSlot: {
        id: "slot",
        dayStart: Date.parse("2026-05-04T00:00:00.000Z"),
        slotStart: Date.parse("2026-05-04T09:00:00.000Z"),
        slotEnd: Date.parse("2026-05-04T09:30:00.000Z")
      }
    });

    expect(payload).toBeNull();
  });
});
