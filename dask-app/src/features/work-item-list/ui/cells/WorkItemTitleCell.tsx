import type { Task } from "@/entities/task";

interface WorkItemTitleCellProps {
  task: Task;
  onOpen: (task: Task) => void;
}

export function WorkItemTitleCell({ task, onOpen }: WorkItemTitleCellProps) {
  return (
    <button type="button" className="work-item-cell-title" onClick={() => onOpen(task)}>
      {task.title}
    </button>
  );
}
