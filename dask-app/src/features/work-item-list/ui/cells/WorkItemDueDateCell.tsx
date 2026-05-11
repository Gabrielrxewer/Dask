import type { Task } from "@/entities/task";
import { cn } from "@/shared/lib/cn";

function formatDueDate(due: string): { label: string; overdue: boolean; isToday: boolean } {
  if (!due) return { label: "-", overdue: false, isToday: false };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${due}T00:00:00`);
  const diff = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return { label: "Hoje", overdue: false, isToday: true };
  if (diff === 1) return { label: "Amanha", overdue: false, isToday: false };
  if (diff === -1) return { label: "Ontem", overdue: true, isToday: false };
  if (diff < 0) return { label: `${Math.abs(diff)}d atraso`, overdue: true, isToday: false };
  const [, month, day] = due.split("-");
  return { label: `${day}/${month}`, overdue: false, isToday: false };
}

interface WorkItemDueDateCellProps {
  task: Task;
}

export function WorkItemDueDateCell({ task }: WorkItemDueDateCellProps) {
  if (!task.due) {
    return <span className="work-item-cell-empty">-</span>;
  }

  const due = formatDueDate(task.due);

  return (
    <span
      className={cn(
        "work-item-cell-due",
        due.overdue && "work-item-cell-due--overdue",
        due.isToday && "work-item-cell-due--today"
      )}
    >
      {due.label}
    </span>
  );
}
