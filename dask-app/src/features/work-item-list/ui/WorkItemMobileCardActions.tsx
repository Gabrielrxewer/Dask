import type { Task } from "@/entities/task";
import { AppIcon, Button } from "@/shared/ui";

interface WorkItemMobileCardActionsProps {
  task: Task;
  onOpen: (task: Task) => void;
}

export function WorkItemMobileCardActions({ task, onOpen }: WorkItemMobileCardActionsProps) {
  return (
    <div className="work-item-mobile-card__actions">
      <Button
        type="button"
        className="work-item-mobile-card__open"
        variant="outline"
        size="sm"
        onClick={() => onOpen(task)}
      >
        <AppIcon name="eye" size={14} />
        Abrir
      </Button>
    </div>
  );
}
