import { useQuery } from "@tanstack/react-query";
import { calendarFeedService } from "@/modules/workspace/api";
import type { CalendarFeedSnapshot } from "@/modules/workspace";
import { agendaQueryKeys, type AgendaCalendarFeedFilters } from "@/modules/agenda/query/agenda-query-keys";

function hasWorkspace(workspaceId: string | null | undefined): workspaceId is string {
  return Boolean(workspaceId?.trim());
}

function requireWorkspace(workspaceId: string | null | undefined): string {
  if (!hasWorkspace(workspaceId)) {
    throw new Error("No workspace selected.");
  }
  return workspaceId;
}

export function useCalendarFeedQuery(
  workspaceId: string | null | undefined,
  filters?: AgendaCalendarFeedFilters
) {
  return useQuery<CalendarFeedSnapshot>({
    queryKey: agendaQueryKeys.calendarFeed(workspaceId ?? "__missing_workspace__", filters),
    queryFn: () =>
      calendarFeedService.listFeed(requireWorkspace(workspaceId), {
        startAt: filters?.startAt ?? new Date().toISOString(),
        endAt: filters?.endAt ?? new Date().toISOString()
      }),
    enabled: hasWorkspace(workspaceId) && Boolean(filters?.startAt && filters?.endAt)
  });
}
