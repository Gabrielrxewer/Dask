import { useCallback, useMemo, useState } from "react";
import { currentUserId, membersById } from "@/entities/member";
import { buildBoardMetrics, factoryBoardConfig } from "@/entities/task";
import { applyDashboardFilter, useDashboardFilter } from "@/features/dashboard-filter";
import { useWorkspace } from "@/modules/workspace/providers";

export function useWorkspaceTaskPage() {
  const workspace = useWorkspace();
  const { filter, setQuery, toggleMineOnly } = useDashboardFilter();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const tasks = workspace.snapshot?.tasks ?? [];
  const boardConfig = workspace.snapshot?.boardConfig ?? factoryBoardConfig;
  const activeMembers = workspace.snapshot?.membersById ?? membersById;
  const activeUser = workspace.snapshot?.currentUserId ?? currentUserId;

  const filteredTasks = useMemo(
    () => applyDashboardFilter(tasks, filter, activeMembers, activeUser),
    [tasks, filter, activeMembers, activeUser]
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
