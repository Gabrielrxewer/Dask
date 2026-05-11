import type { Task } from "@/entities/task";

interface WorkItemProgressCellProps {
  task: Task;
}

export function WorkItemProgressCell({ task }: WorkItemProgressCellProps) {
  const total = task.checklist.items.length;
  const done = task.checklist.items.filter((item) => item.done).length;
  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;

  if (total === 0) {
    return <span className="work-item-cell-empty">-</span>;
  }

  return (
    <span className="work-item-cell-progress">
      <span className="work-item-cell-progress__bar">
        <span className="work-item-cell-progress__fill" style={{ width: `${progressPct}%` }} />
      </span>
      <span className={done === total ? "work-item-cell-progress__label is-done" : "work-item-cell-progress__label"}>
        {done}/{total}
      </span>
    </span>
  );
}
