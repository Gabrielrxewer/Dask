import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildBoardMetrics,
  factoryBoardConfig,
  injectCatalogOptionsIntoBoardConfig,
  mergeCardFieldDefinitions,
  type TaskFieldOption
} from "@/entities/task";
import { applyDashboardFilter, useDashboardFilter } from "@/features/dashboard-filter";
import { billingService } from "@/modules/billing";
import { useWorkspace } from "@/modules/workspace/providers";

export function useWorkspaceTaskPage() {
  const workspace = useWorkspace();
  const { filter, setQuery, toggleMineOnly } = useDashboardFilter();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [catalogFieldOptions, setCatalogFieldOptions] = useState<TaskFieldOption[]>([]);

  const tasks = workspace.snapshot?.tasks ?? [];
  const rawBoardConfig = workspace.snapshot?.boardConfig ?? factoryBoardConfig;
  const boardConfigWithTypes = useMemo(
    () => ({
      ...rawBoardConfig,
      fieldDefinitions: mergeCardFieldDefinitions(
        rawBoardConfig.fieldDefinitions ?? factoryBoardConfig.fieldDefinitions
      )
    }),
    [rawBoardConfig]
  );
  const boardConfig = useMemo(
    () => injectCatalogOptionsIntoBoardConfig(boardConfigWithTypes, catalogFieldOptions),
    [boardConfigWithTypes, catalogFieldOptions]
  );
  const activeMembers = workspace.snapshot?.membersById ?? {};

  useEffect(() => {
    const workspaceId = workspace.snapshot?.id;
    if (!workspaceId) {
      return;
    }

    const hasCatalogField = (rawBoardConfig.fieldDefinitions ?? []).some(
      f => f.config?.entityType === "billing_catalog_item"
    );
    if (!hasCatalogField) {
      return;
    }

    void billingService.listConnectCatalogItems(workspaceId, false).then(({ items }) => {
      setCatalogFieldOptions(
        items
          .filter(item => item.isActive)
          .map(item => ({
            id: item.id,
            label: item.name,
            value: item.id,
            color: null,
            order: 0,
            isActive: true,
            catalogItem: {
              id: item.id,
              kind: item.kind,
              billingType: item.billingType,
              recurringInterval: item.recurringInterval,
              recurringIntervalCount: item.recurringIntervalCount,
              name: item.name,
              description: item.description,
              amount: item.amount,
              currency: item.currency,
              metadata: item.metadata
            }
          }))
      );
    }).catch(() => undefined);
  }, [workspace.snapshot?.id, rawBoardConfig.fieldDefinitions]);
  const activeUser = workspace.snapshot?.currentUserId ?? "";

  const filteredTasks = useMemo(
    () => applyDashboardFilter(tasks, filter, boardConfig, activeMembers, activeUser),
    [tasks, filter, boardConfig, activeMembers, activeUser]
  );

  const metrics = useMemo(() => buildBoardMetrics(filteredTasks), [filteredTasks]);

  const selectedTask = useMemo(
    () => filteredTasks.find(task => task.id === selectedTaskId) ?? null,
    [filteredTasks, selectedTaskId]
  );

  const selectedStatus = useMemo(
    () => (selectedTask ? boardConfig.statuses.find(status => status.id === selectedTask.status) ?? null : null),
    [selectedTask, boardConfig.statuses]
  );

  const selectTask = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
  }, []);

  const clearSelectedTask = useCallback(() => {
    setSelectedTaskId(null);
  }, []);

  return {
    ...workspace,
    filter,
    setFilterQuery: setQuery,
    toggleMineFilter: toggleMineOnly,
    tasks,
    boardConfig,
    activeMembers,
    activeUser,
    filteredTasks,
    metrics,
    selectedTask,
    selectedStatus,
    selectTask,
    clearSelectedTask
  };
}
