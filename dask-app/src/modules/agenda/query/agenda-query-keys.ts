import { normalizeWorkspaceWorkItemsFilters, type WorkspaceWorkItemsFilters } from "@/modules/workspace/query";

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

export const agendaQueryKeys = {
  all: ["agenda"] as const,
  workspace: (workspaceId: string) => [...agendaQueryKeys.all, workspaceId] as const,
  week: (workspaceId: string, filters?: WorkspaceWorkItemsFilters) =>
    [...agendaQueryKeys.workspace(workspaceId), "week", normalizeWorkspaceWorkItemsFilters(filters)] as const,
  resources: (workspaceId: string) => [...agendaQueryKeys.workspace(workspaceId), "resources"] as const,
  workItemsRoot: (workspaceId: string) => [...agendaQueryKeys.workspace(workspaceId), "work-items"] as const,
  workItems: (workspaceId: string, filters?: WorkspaceWorkItemsFilters) =>
    [...agendaQueryKeys.workItemsRoot(workspaceId), normalizeWorkspaceWorkItemsFilters(filters)] as const,
  calendarFeed: (workspaceId: string, filters?: AgendaCalendarFeedFilters) =>
    [...agendaQueryKeys.workspace(workspaceId), "calendar-feed", cleanFeedFilters(filters)] as const
};
