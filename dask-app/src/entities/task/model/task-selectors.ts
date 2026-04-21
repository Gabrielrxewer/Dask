import { isDateWithinNextDays } from "@/shared/lib/date/format-date";
import type { BoardMetrics, Task, TaskStatus, TaskStatusId, TaskTypeMetaItem } from "@/entities/task/model/types";

const canonicalTaskTypePalette: Record<string, Pick<TaskTypeMetaItem, "background" | "border" | "text">> = {
  bug: { background: "#ffe9e9", border: "#ffc8c8", text: "#b42318" },
  task: { background: "#e7f3ff", border: "#bfdbfe", text: "#1d4ed8" },
  "user-story": { background: "#e9f8ef", border: "#b7e4c7", text: "#15803d" },
  epic: { background: "#fff1e8", border: "#ffd0b2", text: "#c2410c" },
  spike: { background: "#fff9db", border: "#fde68a", text: "#a16207" },
  improvement: { background: "#ecfeff", border: "#a5f3fc", text: "#0f766e" },
  incident: { background: "#ffeef0", border: "#fecdd3", text: "#be123c" },
  hotfix: { background: "#fff0e6", border: "#fdba74", text: "#c2410c" },
  chore: { background: "#f2f5f8", border: "#d7dee7", text: "#475569" },
  research: { background: "#eef2ff", border: "#c7d2fe", text: "#4338ca" }
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
      background: "#edf5ff",
      border: "#cfe2ff",
      text: "#1d4e85"
        })
  );
}
