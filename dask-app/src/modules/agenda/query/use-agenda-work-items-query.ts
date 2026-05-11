import { useQuery } from "@tanstack/react-query";
import type { Task } from "@/entities/task";
import { workspaceService } from "@/modules/workspace/api";
import type { WorkspaceWorkItemsFilters } from "@/modules/workspace/query";
import { agendaQueryKeys } from "@/modules/agenda/query/agenda-query-keys";

function hasWorkspace(workspaceId: string | null | undefined): workspaceId is string {
  return Boolean(workspaceId?.trim());
}

function requireWorkspace(workspaceId: string | null | undefined): string {
  if (!hasWorkspace(workspaceId)) {
    throw new Error("No workspace selected.");
  }
  return workspaceId;
}

export function useAgendaWorkItemsQuery(
  workspaceId: string | null | undefined,
  filters?: WorkspaceWorkItemsFilters
) {
  return useQuery<Task[]>({
    queryKey: agendaQueryKeys.workItems(workspaceId ?? "__missing_workspace__", filters),
    queryFn: async () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      const items: Task[] = [];
      let cursor: string | null | undefined = null;
      const seenCursors = new Set<string>();

      do {
        const page = await workspaceService.listWorkItemsPage(resolvedWorkspaceId, {
          pageSize: 200,
          cursor,
          workflowStateId: filters?.workflowStateId,
          assigneeId: filters?.assigneeId,
          search: filters?.search,
          dateFrom: filters?.dateFrom,
          dateTo: filters?.dateTo
        });

        items.push(...page.items);
        cursor = page.nextCursor;
        if (cursor && seenCursors.has(cursor)) {
          break;
        }
        if (cursor) {
          seenCursors.add(cursor);
        }
      } while (cursor);

      return items;
    },
    enabled: hasWorkspace(workspaceId)
  });
}
