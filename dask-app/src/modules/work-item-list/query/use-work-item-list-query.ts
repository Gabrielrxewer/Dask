import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { BoardConfig } from "@/entities/task";
import { workspaceService } from "@/modules/workspace/api";
import type { WorkspacePreferences } from "@/modules/workspace";
import { buildDefaultWorkItemListConfig } from "@/modules/work-item-list/model/work-item-list-config";
import type { WorkItemListConfig, WorkItemListParams, WorkItemListPage } from "@/modules/work-item-list/model/types";
import { normalizeWorkItemListParams, workItemListQueryKeys } from "@/modules/work-item-list/query/work-item-list-query-keys";

function hasWorkspace(workspaceId: string | null | undefined): workspaceId is string {
  return Boolean(workspaceId?.trim());
}

function requireWorkspace(workspaceId: string | null | undefined): string {
  if (!hasWorkspace(workspaceId)) {
    throw new Error("No workspace selected.");
  }
  return workspaceId;
}

function useDebouncedValue<TValue>(value: TValue, delayMs: number): TValue {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return debouncedValue;
}

export function useWorkItemListQuery(
  workspaceId: string | null | undefined,
  params: Partial<WorkItemListParams>
) {
  const debouncedSearch = useDebouncedValue(params.search ?? "", 280);
  const normalizedParams = useMemo(
    () => ({
      ...params,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 50,
      search: debouncedSearch.trim() || undefined
    }),
    [debouncedSearch, params]
  );

  return useQuery<WorkItemListPage>({
    queryKey: workItemListQueryKeys.list(workspaceId ?? "__missing_workspace__", normalizedParams),
    queryFn: () => workspaceService.listWorkItemsPage(requireWorkspace(workspaceId), normalizedParams),
    enabled: hasWorkspace(workspaceId),
    placeholderData: (previousData) => previousData
  });
}

export function useWorkItemListConfigQuery(
  workspaceId: string | null | undefined,
  input: {
    workItemTypeId: string | null | undefined;
    boardConfig: BoardConfig | null | undefined;
    settings?: WorkspacePreferences["settings"];
  }
) {
  const normalizedTypeId = input.workItemTypeId?.trim() || input.boardConfig?.taskTypes[0]?.id || "task";

  return useQuery<WorkItemListConfig>({
    queryKey: workItemListQueryKeys.config(workspaceId ?? "__missing_workspace__", normalizedTypeId),
    queryFn: async () => {
      if (!input.boardConfig) {
        throw new Error("Board config is not available.");
      }

      return buildDefaultWorkItemListConfig({
        workspaceId: requireWorkspace(workspaceId),
        workItemTypeId: normalizedTypeId,
        boardConfig: input.boardConfig,
        settings: input.settings
      });
    },
    enabled: hasWorkspace(workspaceId) && Boolean(input.boardConfig),
    staleTime: 30_000
  });
}

export function useWorkItemListColumnsQuery(
  workspaceId: string | null | undefined,
  input: {
    workItemTypeId: string | null | undefined;
    boardConfig: BoardConfig | null | undefined;
    settings?: WorkspacePreferences["settings"];
  }
) {
  const configQuery = useWorkItemListConfigQuery(workspaceId, input);

  return useQuery({
    queryKey: workItemListQueryKeys.columns(
      workspaceId ?? "__missing_workspace__",
      input.workItemTypeId ?? input.boardConfig?.taskTypes[0]?.id ?? "task"
    ),
    queryFn: async () => configQuery.data?.columns ?? [],
    enabled: configQuery.isSuccess,
    initialData: configQuery.data?.columns
  });
}

export { normalizeWorkItemListParams };
