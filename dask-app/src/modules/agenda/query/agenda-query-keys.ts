import { normalizeWorkspaceWorkItemsFilters, type WorkspaceWorkItemsFilters } from "@/modules/workspace/query";

export type AgendaWorkItemsFilters = {
  workflowStateId?: string;
  assigneeId?: string;
  search?: string;
  plannedWindowFrom?: string;
  plannedWindowTo?: string;
  pageSize?: number;
  sortBy?: "position" | "title" | "type" | "status" | "assignee" | "dueDate" | "createdAt" | "updatedAt" | "plannedStartAt";
  sortDirection?: "asc" | "desc";
};

export type AgendaCalendarFeedFilters = {
  startAt?: string;
  endAt?: string;
};

function cleanFeedFilters(filters?: AgendaCalendarFeedFilters) {
  return {
    ...(filters?.startAt ? { startAt: filters.startAt } : {}),
    ...(filters?.endAt ? { endAt: filters.endAt } : {})
  };
}

export function normalizeAgendaWorkItemsFilters(filters?: AgendaWorkItemsFilters) {
  return {
    ...(filters?.workflowStateId ? { workflowStateId: filters.workflowStateId } : {}),
    ...(filters?.assigneeId ? { assigneeId: filters.assigneeId } : {}),
    ...(filters?.search?.trim() ? { search: filters.search.trim() } : {}),
    ...(filters?.plannedWindowFrom ? { plannedWindowFrom: filters.plannedWindowFrom } : {}),
    ...(filters?.plannedWindowTo ? { plannedWindowTo: filters.plannedWindowTo } : {}),
    ...(filters?.pageSize ? { pageSize: filters.pageSize } : {}),
    ...(filters?.sortBy ? { sortBy: filters.sortBy } : {}),
    ...(filters?.sortDirection ? { sortDirection: filters.sortDirection } : {})
  };
}

export const agendaQueryKeys = {
  all: ["agenda"] as const,
  workspace: (workspaceId: string) => [...agendaQueryKeys.all, workspaceId] as const,
  week: (workspaceId: string, filters?: WorkspaceWorkItemsFilters) =>
    [...agendaQueryKeys.workspace(workspaceId), "week", normalizeWorkspaceWorkItemsFilters(filters)] as const,
  resources: (workspaceId: string) => [...agendaQueryKeys.workspace(workspaceId), "resources"] as const,
  workItemsRoot: (workspaceId: string) => [...agendaQueryKeys.workspace(workspaceId), "work-items"] as const,
  workItems: (workspaceId: string, filters?: AgendaWorkItemsFilters) =>
    [...agendaQueryKeys.workItemsRoot(workspaceId), normalizeAgendaWorkItemsFilters(filters)] as const,
  calendarFeed: (workspaceId: string, filters?: AgendaCalendarFeedFilters) =>
    [...agendaQueryKeys.workspace(workspaceId), "calendar-feed", cleanFeedFilters(filters)] as const
};
