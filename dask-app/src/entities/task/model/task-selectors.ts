import { isDateWithinNextDays } from "@/shared/lib/date/format-date";
import type { BoardMetrics, Task, TaskStatus, TaskStatusId, TaskTypeMetaItem } from "@/entities/task/model/types";

export function groupTasksByStatus(
  tasks: Task[],
  statuses: TaskStatus[]
): Record<TaskStatusId, Task[]> {
  const grouped = statuses.reduce(
    (acc, status) => {
      acc[status.id] = [];
      return acc;
    },
    {} as Record<TaskStatusId, Task[]>
  );

  tasks.forEach(task => {
    if (!grouped[task.status]) {
      grouped[task.status] = [];
    }
    grouped[task.status].push(task);
  });

  Object.values(grouped).forEach(statusTasks => {
    statusTasks.sort((left, right) => left.position - right.position);
  });

  return grouped;
}

export function buildBoardMetrics(tasks: Task[]): BoardMetrics {
  const total = tasks.length;
  const doing = tasks.filter(task => task.status === "doing").length;
  const review = tasks.filter(task => task.status === "review").length;
  const done = tasks.filter(task => task.status === "done").length;
  const dueThisWeek = tasks.filter(task => isDateWithinNextDays(task.due, 7)).length;
  const donePercent = total === 0 ? 0 : Math.round((done / total) * 100);

  return {
    total,
    doing,
    review,
    done,
    dueThisWeek,
    donePercent,
    active: doing + review
  };
}

export function buildTaskChecklistSummary(task: Task): { done: number; total: number; percent: number } {
  const total = task.checklist.items.length;
  const done = task.checklist.items.filter(item => item.done).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);

  return { done, total, percent };
}

export function getTaskTypeDisplayMeta(
  typeMap: Record<string, TaskTypeMetaItem>,
  taskType: string
): TaskTypeMetaItem {
  return (
    typeMap[taskType] ?? {
      id: taskType,
      label: taskType,
      background: "#edf5ff",
      border: "#cfe2ff",
      text: "#1d4e85"
    }
  );
}
