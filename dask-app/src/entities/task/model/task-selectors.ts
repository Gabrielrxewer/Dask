import { isDateWithinNextDays } from "@/shared/lib/date/format-date";
import type { BoardMetrics, Task, TaskStatus, TaskStatusId, TaskTypeMetaItem } from "@/entities/task/model/types";

const canonicalTaskTypePalette: Record<string, Pick<TaskTypeMetaItem, "background" | "border" | "text">> = {
  bug: { background: "var(--danger-bg)", border: "var(--danger-border)", text: "var(--danger)" },
  task: { background: "var(--surface-blue-muted)", border: "var(--info-border)", text: "var(--primary-active)" },
  "user-story": { background: "var(--surface-tint)", border: "var(--success-border)", text: "var(--success)" },
  epic: { background: "var(--danger-bg)", border: "var(--danger-border)", text: "var(--danger)" },
  spike: { background: "var(--warning-bg)", border: "var(--warning-border)", text: "var(--warning)" },
  improvement: { background: "var(--info-bg)", border: "var(--info-border)", text: "var(--brand-cyan-strong)" },
  incident: { background: "var(--surface-tint)", border: "var(--danger-border)", text: "var(--danger)" },
  hotfix: { background: "var(--danger-bg)", border: "var(--danger-border)", text: "var(--danger)" },
  chore: { background: "var(--secondary)", border: "var(--border-default)", text: "var(--text-secondary)" },
  research: { background: "var(--surface-tint)", border: "var(--info-border)", text: "var(--brand-indigo)" }
};

function resolveCanonicalTaskTypePalette(taskType: string): Pick<TaskTypeMetaItem, "background" | "border" | "text"> | null {
  return canonicalTaskTypePalette[taskType] ?? null;
}

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
    statusTasks.sort((left, right) => (left.position ?? 0) - (right.position ?? 0));
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
  const configured = typeMap[taskType];
  const canonical = resolveCanonicalTaskTypePalette(taskType);

  if (configured && canonical) {
    return {
      ...configured,
      ...canonical
    };
  }

  if (configured) {
    return configured;
  }

  return (
    (canonical
      ? {
          id: taskType,
          label: taskType,
          ...canonical
        }
      : {
      id: taskType,
      label: taskType,
      background: "var(--info-bg)",
      border: "var(--info-border)",
      text: "var(--text-primary)"
        })
  );
}
