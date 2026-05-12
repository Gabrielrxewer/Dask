import { useMemo } from "react";
import { useInfiniteQuery, type InfiniteData } from "@tanstack/react-query";
import type { Task } from "@/entities/task";
import { workspaceService } from "@/modules/workspace/api";
import type { ListWorkItemsInput, WorkItemsPage } from "@/modules/workspace/model";
import { agendaQueryKeys, type AgendaWorkItemsFilters } from "@/modules/agenda/query/agenda-query-keys";

export const AGENDA_WORK_ITEMS_PAGE_SIZE = 80;

function hasWorkspace(workspaceId: string | null | undefined): workspaceId is string {
  return Boolean(workspaceId?.trim());
}

function requireWorkspace(workspaceId: string | null | undefined): string {
  if (!hasWorkspace(workspaceId)) {
    throw new Error("No workspace selected.");
  }
  return workspaceId;
}

export function resolveAgendaPageSize(pageSize?: number): number {
  return Math.max(1, Math.min(pageSize ?? AGENDA_WORK_ITEMS_PAGE_SIZE, 200));
}

export function flattenAgendaWorkItemsPages(data: InfiniteData<WorkItemsPage> | undefined): Task[] {
  return data?.pages.flatMap((page) => page.items) ?? [];
}

export function buildAgendaWorkItemsPageRequest(
  filters: AgendaWorkItemsFilters | undefined,
  cursor: unknown
): ListWorkItemsInput {
  return {
    pageSize: resolveAgendaPageSize(filters?.pageSize),
    cursor: typeof cursor === "string" ? cursor : null,
    workflowStateId: filters?.workflowStateId,
    assigneeId: filters?.assigneeId,
    search: filters?.search?.trim() || undefined,
    plannedWindowFrom: filters?.plannedWindowFrom,
    plannedWindowTo: filters?.plannedWindowTo,
    sortBy: filters?.sortBy ?? "plannedStartAt",
    sortDirection: filters?.sortDirection ?? "asc"
  };
}

export function useAgendaWorkItemsQuery(
  workspaceId: string | null | undefined,
  filters?: AgendaWorkItemsFilters
) {
  const pageSize = resolveAgendaPageSize(filters?.pageSize);
  const query = useInfiniteQuery<WorkItemsPage>({
    queryKey: agendaQueryKeys.workItems(workspaceId ?? "__missing_workspace__", {
      ...filters,
      pageSize
    }),
    queryFn: ({ pageParam }) =>
      workspaceService.listWorkItemsPage(
        requireWorkspace(workspaceId),
        buildAgendaWorkItemsPageRequest({ ...filters, pageSize }, pageParam)
      ),
    enabled: hasWorkspace(workspaceId),
    initialPageParam: null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined
  });
  const items = useMemo(() => flattenAgendaWorkItemsPages(query.data), [query.data]);
  const pages = query.data?.pages ?? [];
  const lastPage = pages.at(-1);

  return {
    ...query,
    rawData: query.data,
    data: items,
    pages,
    loadedCount: items.length,
    total: pages[0]?.totalCount ?? pages[0]?.total ?? items.length,
    nextCursor: lastPage?.nextCursor ?? null
  };
}
