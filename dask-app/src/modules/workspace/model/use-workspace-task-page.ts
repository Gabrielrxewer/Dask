import { useCallback, useMemo, useState } from "react";
import { buildBoardMetrics } from "@/entities/task";
import { applyDashboardFilter, useDashboardFilter } from "@/features/dashboard-filter";
import {
  getSelectedTask,
  getSelectedTaskStatus,
  getWorkspaceBoardConfig,
  getWorkspaceCurrentUserId,
  getWorkspaceMembers,
  getWorkspaceTasks
} from "@/modules/workspace/model/selectors";
import { useWorkspace } from "@/modules/workspace/providers";

export function useWorkspaceTaskPage() {
  const workspace = useWorkspace();
  const { filter, setQuery, toggleMineOnly } = useDashboardFilter();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const tasks = getWorkspaceTasks(workspace.snapshot);
  const boardConfig = getWorkspaceBoardConfig(workspace.snapshot);
  const activeMembers = getWorkspaceMembers(workspace.snapshot);
  const activeUser = getWorkspaceCurrentUserId(workspace.snapshot);

  const filteredTasks = useMemo(
    () => applyDashboardFilter(tasks, filter, activeMembers, activeUser),
    [tasks, filter, activeMembers, activeUser]
  );

  const metrics = useMemo(() => buildBoardMetrics(filteredTasks), [filteredTasks]);

  const selectedTask = useMemo(
    () => getSelectedTask(filteredTasks, selectedTaskId),
    [filteredTasks, selectedTaskId]
  );

  const selectedStatus = useMemo(
    () => getSelectedTaskStatus(boardConfig, selectedTask),
    [boardConfig, selectedTask]
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
