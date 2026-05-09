import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyFieldCapabilityOverrides,
  applyFieldDefinitionOverrides,
  type BoardConfig,
  buildBoardMetrics,
  injectCatalogOptionsIntoBoardConfig,
  mergeCardFieldDefinitions,
  type TaskFieldOption
} from "@/entities/task";
import { applyDashboardFilter, useDashboardFilter } from "@/features/dashboard-filter";
import { billingService } from "@/modules/billing";
import { useWorkspace } from "@/modules/workspace/providers";

type WorkspaceTaskPageUser = {
  id?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
};

interface UseWorkspaceTaskPageOptions {
  currentUser?: WorkspaceTaskPageUser | null;
}

function mapCatalogItemsToFieldOptions(
  items: Awaited<ReturnType<typeof billingService.listConnectCatalogItems>>["items"]
): TaskFieldOption[] {
  return items
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
    }));
}

function resolveBoardPerspectives(rawBoardConfig: BoardConfig | null | undefined): BoardConfig["perspectives"] {
  if (!rawBoardConfig) {
    return [];
  }

  const rawConfig = rawBoardConfig as BoardConfig & { views?: unknown };

  if (Array.isArray(rawConfig.perspectives)) {
    return rawConfig.perspectives;
  }

  if (Array.isArray(rawConfig.views)) {
    return rawConfig.views as BoardConfig["perspectives"];
  }

  return [];
}

export function useWorkspaceTaskPage(options: UseWorkspaceTaskPageOptions = {}) {
  const workspace = useWorkspace();
  const { filter, setQuery, toggleMineOnly } = useDashboardFilter();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [catalogFieldOptions, setCatalogFieldOptions] = useState<TaskFieldOption[]>([]);

  const tasks = workspace.snapshot?.tasks ?? [];
  const rawBoardConfig = workspace.snapshot?.boardConfig;
  const boardConfigWithTypes = useMemo(
    (): BoardConfig => ({
      statuses: Array.isArray(rawBoardConfig?.statuses) ? rawBoardConfig.statuses : [],
      taskTypes: Array.isArray(rawBoardConfig?.taskTypes) ? rawBoardConfig.taskTypes : [],
      fieldDefinitions: applyFieldCapabilityOverrides(
        applyFieldDefinitionOverrides(
          mergeCardFieldDefinitions(
            Array.isArray(rawBoardConfig?.fieldDefinitions)
              ? rawBoardConfig.fieldDefinitions
              : []
          ),
          workspace.snapshot?.preferences.settings
        ),
        workspace.snapshot?.preferences.settings
      ),
      fieldBindings: Array.isArray(rawBoardConfig?.fieldBindings) ? rawBoardConfig.fieldBindings : [],
      cardLayout: rawBoardConfig?.cardLayout ?? { visibleFieldIds: [] },
      perspectives: resolveBoardPerspectives(rawBoardConfig),
      operationalMetadata: rawBoardConfig?.operationalMetadata
    }),
    [rawBoardConfig, workspace.snapshot?.preferences.settings]
  );
  const boardConfig = useMemo(
    () => injectCatalogOptionsIntoBoardConfig(boardConfigWithTypes, catalogFieldOptions),
    [boardConfigWithTypes, catalogFieldOptions]
  );

  const activeUser = workspace.snapshot?.currentUserId ?? options.currentUser?.id ?? "";
  const activeMembers = useMemo(() => {
    const sourceMembers = workspace.snapshot?.membersById ?? {};
    const userAvatarUrl = options.currentUser?.avatarUrl ?? null;

    if (!userAvatarUrl) {
      return sourceMembers;
    }

    const authMemberId = options.currentUser?.id ?? "";
    const memberId = authMemberId && sourceMembers[authMemberId] ? authMemberId : activeUser;
    const member = sourceMembers[memberId];

    if (!member) {
      return sourceMembers;
    }

    return {
      ...sourceMembers,
      [memberId]: {
        ...member,
        name: options.currentUser?.name ?? member.name,
        avatarUrl: userAvatarUrl
      }
    };
  }, [activeUser, options.currentUser?.avatarUrl, options.currentUser?.id, options.currentUser?.name, workspace.snapshot?.membersById]);

  useEffect(() => {
    const workspaceId = workspace.snapshot?.id;
    if (!workspaceId) {
      setCatalogFieldOptions([]);
      return;
    }

    const hasCatalogField = boardConfigWithTypes.fieldDefinitions.some(
      f => f.type === "catalog_select" || f.config?.entityType === "billing_catalog_item"
    );
    if (!hasCatalogField) {
      setCatalogFieldOptions([]);
      return;
    }

    let mounted = true;
    void billingService.listConnectCatalogItems(workspaceId, false).then(({ items }) => {
      if (mounted) {
        setCatalogFieldOptions(mapCatalogItemsToFieldOptions(items));
      }
    }).catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, [workspace.snapshot?.id, boardConfigWithTypes.fieldDefinitions]);

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
