import type { BoardConfig, Task, TaskStatus } from "@/entities/task";
import type { ApiBoardColumn, ApiWorkflowState } from "@/modules/workspace/model";

export function mapTasksForBoardPerspective(
  tasks: Task[],
  perspective: BoardConfig["perspectives"][number] | null | undefined
): Task[] {
  if (!perspective) {
    return tasks;
  }

  const filteredByType =
    perspective.allowedTaskTypes && perspective.allowedTaskTypes.length > 0
      ? tasks.filter(task => perspective.allowedTaskTypes?.includes(task.type))
      : tasks;

  return filteredByType.map(task => {
    if (perspective.statusSource.kind === "workflow_state") {
      return task;
    }

    const rawValue = task.customFields[perspective.statusSource.fieldId];
    if (typeof rawValue === "string" && rawValue.trim().length > 0) {
      return { ...task, status: rawValue };
    }

    const fallback =
      perspective.statusSource.fallbackByStatus?.[task.status] ??
      perspective.statuses[0]?.id ??
      task.status;

    return { ...task, status: fallback };
  });
}

export function buildBoardColumnsRuntimeView(
  tasks: Task[],
  boardColumns: ApiBoardColumn[],
  workflowStates: ApiWorkflowState[],
  visibleBoardColumnIds?: string[]
): { statuses: TaskStatus[]; tasks: Task[] } | null {
  if (boardColumns.length === 0) {
    return null;
  }

  const scopedColumns =
    Array.isArray(visibleBoardColumnIds) && visibleBoardColumnIds.length > 0
      ? visibleBoardColumnIds
          .map(columnId => boardColumns.find(column => column.id === columnId))
          .filter((column): column is ApiBoardColumn => Boolean(column))
      : boardColumns;

  if (scopedColumns.length === 0) {
    return null;
  }

  const slugToWorkflowStateId = new Map(workflowStates.map(state => [state.slug, state.id]));
  const workflowStateToColumn = new Map<string, ApiBoardColumn>();

  for (const column of scopedColumns) {
    for (const stateId of column.stateIds) {
      workflowStateToColumn.set(stateId, column);
    }
  }

  const statuses: TaskStatus[] = scopedColumns.map(column => {
    const firstState = workflowStates.find(state => state.id === column.stateIds[0]);
    return {
      id: column.id,
      label: column.name,
      dot: firstState?.color ?? "#64748b"
    };
  });

  const remappedTasks = tasks.map(task => {
    const workflowStateId = slugToWorkflowStateId.get(task.status);
    if (!workflowStateId) {
      return task;
    }

    const column = workflowStateToColumn.get(workflowStateId);
    if (!column) {
      return task;
    }

    return { ...task, status: column.id };
  });

  return { statuses, tasks: remappedTasks };
}
