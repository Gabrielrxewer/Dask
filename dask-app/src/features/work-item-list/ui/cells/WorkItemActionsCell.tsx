import type { Task } from "@/entities/task";
import { Button } from "@/shared/ui";

interface WorkItemActionsCellProps {
  task: Task;
  onOpen: (task: Task) => void;
}

export function WorkItemActionsCell({ task, onOpen }: WorkItemActionsCellProps) {
  return (
    <div className="work-item-cell-actions">
      <Button type="button" className="work-item-cell-actions__button" variant="ghost" size="sm" onClick={() => onOpen(task)}>
        Abrir
      </Button>
    </div>
  );
}
