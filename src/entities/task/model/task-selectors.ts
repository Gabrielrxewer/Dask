import { isDateWithinNextDays } from "@/shared/lib/date/format-date";
import type { BoardMetrics, Task, TaskStatus, TaskStatusId } from "@/entities/task/model/types";

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
    grouped[task.status].push(task);
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
