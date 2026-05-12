import { describe, expect, it } from "vitest";
import type { InfiniteData } from "@tanstack/react-query";
import type { Task } from "@/entities/task";
import type { WorkItemsPage } from "@/modules/workspace/model";
import { agendaQueryKeys } from "@/modules/agenda/query/agenda-query-keys";
import { applyScheduleToAgendaCache } from "@/modules/agenda/query/use-reschedule-work-item-mutation";
import {
  buildAgendaWorkItemsPageRequest,
  flattenAgendaWorkItemsPages,
  resolveAgendaPageSize
} from "@/modules/agenda/query/use-agenda-work-items-query";

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

function makePage(items: Task[], nextCursor: string | null): WorkItemsPage {
  return {
    items,
    total: items.length,
    totalCount: items.length,
    nextCursor,
    columnCounts: {},
    workflowStateCounts: {}
  };
}

describe("agenda work item pagination", () => {
  it("keeps an empty agenda as an empty loaded window", () => {
    expect(flattenAgendaWorkItemsPages(undefined)).toEqual([]);
  });

  it("builds a single cursor request for the selected schedule window", () => {
    expect(
      buildAgendaWorkItemsPageRequest({
        search: "  deploy  ",
        assigneeId: "member-1",
        plannedWindowFrom: "2026-05-04T00:00:00.000Z",
        plannedWindowTo: "2026-05-11T00:00:00.000Z",
        pageSize: 500
      }, "cursor-1")
    ).toMatchObject({
      cursor: "cursor-1",
      pageSize: 200,
      search: "deploy",
      assigneeId: "member-1",
      plannedWindowFrom: "2026-05-04T00:00:00.000Z",
      plannedWindowTo: "2026-05-11T00:00:00.000Z",
      sortBy: "plannedStartAt",
      sortDirection: "asc"
    });
    expect(resolveAgendaPageSize(0)).toBe(1);
  });

  it("segments the cache by schedule window, filters and page size", () => {
    expect(agendaQueryKeys.workItems("workspace", {
      search: "deploy",
      assigneeId: "member-1",
      plannedWindowFrom: "2026-05-04T00:00:00.000Z",
      plannedWindowTo: "2026-05-11T00:00:00.000Z",
      pageSize: 80
    })).not.toEqual(agendaQueryKeys.workItems("workspace", {
      search: "deploy",
      assigneeId: "member-1",
      plannedWindowFrom: "2026-05-11T00:00:00.000Z",
      plannedWindowTo: "2026-05-18T00:00:00.000Z",
      pageSize: 80
    }));
  });

  it("flattens only the pages already loaded incrementally", () => {
    const data: InfiniteData<WorkItemsPage> = {
      pageParams: [null, "cursor-1"],
      pages: [
        makePage([makeTask({ id: "a" })], "cursor-1"),
        makePage([makeTask({ id: "b" }), makeTask({ id: "c" })], null)
      ]
    };

    expect(flattenAgendaWorkItemsPages(data).map(task => task.id)).toEqual(["a", "b", "c"]);
  });

  it("updates paginated cache optimistically without mutating rollback data", () => {
    const previous: InfiniteData<WorkItemsPage> = {
      pageParams: [null],
      pages: [
        makePage([
          makeTask({
            id: "task-1",
            plannedStartAt: "2026-05-04T09:00:00.000Z",
            plannedEndAt: "2026-05-04T10:00:00.000Z"
          })
        ], null)
      ]
    };

    const optimistic = applyScheduleToAgendaCache(previous, {
      workItemId: "task-1",
      plannedStartAt: "2026-05-05T13:00:00.000Z",
      plannedEndAt: "2026-05-05T14:00:00.000Z",
      reason: "agenda_drag_reschedule"
    }) as InfiniteData<WorkItemsPage>;

    expect(optimistic.pages[0].items[0]).toMatchObject({
      plannedStartAt: "2026-05-05T13:00:00.000Z",
      plannedEndAt: "2026-05-05T14:00:00.000Z",
      customFields: {
        plannedStartAt: "2026-05-05T13:00:00.000Z",
        plannedEndAt: "2026-05-05T14:00:00.000Z"
      }
    });
    expect(previous.pages[0].items[0].plannedStartAt).toBe("2026-05-04T09:00:00.000Z");
  });
});
