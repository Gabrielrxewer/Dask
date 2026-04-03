import { useMemo, useState } from "react";
import { AppShell } from "@/widgets/app-shell";
import { BoardMetrics } from "@/widgets/board-metrics";
import { BoardColumns } from "@/widgets/board-columns";
import {
  initialTasks,
  taskStatuses,
  buildBoardMetrics,
  type Task,
  type TaskStatusId
} from "@/entities/task";
import { currentUserId, membersById } from "@/entities/member";
import {
  applyDashboardFilter,
  initialDashboardFilter,
  type DashboardFilterState
} from "@/features/dashboard-filter";
import { createMockTask } from "@/features/create-task";
import { moveTaskToStatus } from "@/features/change-status";

export function BoardPage() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [filter, setFilter] = useState<DashboardFilterState>(initialDashboardFilter);
  const [createdCount, setCreatedCount] = useState(0);

  const filteredTasks = useMemo(
    () => applyDashboardFilter(tasks, filter, membersById, currentUserId),
    [tasks, filter]
  );

  const metrics = useMemo(() => buildBoardMetrics(filteredTasks), [filteredTasks]);

  const handleCreateTask = () => {
    setTasks(prevTasks => [createMockTask(createdCount), ...prevTasks]);
    setCreatedCount(prev => prev + 1);
  };

  const handleMoveTask = (taskId: string, statusId: TaskStatusId) => {
    setTasks(prevTasks => moveTaskToStatus(prevTasks, taskId, statusId));
  };

  return (
    <AppShell
      metrics={metrics}
      filter={filter}
      onFilterQueryChange={query => setFilter(prev => ({ ...prev, query }))}
      onMineToggle={() => setFilter(prev => ({ ...prev, mineOnly: !prev.mineOnly }))}
      onCreateTask={handleCreateTask}
    >
      <BoardMetrics metrics={metrics} />
      <BoardColumns
        statuses={taskStatuses}
        tasks={filteredTasks}
        membersById={membersById}
        onMoveTask={handleMoveTask}
      />
    </AppShell>
  );
}
