import type { TaskStatus, TaskStatusId } from "@/entities/task";
import { AppIcon, AppSelect, Button } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";

interface WorkItemStatusSelectProps {
  value: TaskStatusId;
  statuses: TaskStatus[];
  disabled?: boolean;
  pending?: boolean;
  failed?: boolean;
  onChange: (statusId: TaskStatusId) => void;
  onRetry?: () => void;
}

export function WorkItemStatusSelect({
  value,
  statuses,
  disabled,
  pending = false,
  failed = false,
  onChange,
  onRetry
}: WorkItemStatusSelectProps) {
  return (
    <span className={cn("work-item-status-select", pending && "is-pending", failed && "is-failed")}>
      <AppSelect
        className="work-item-status-select__control"
        value={value}
        items={statuses.map((status) => ({ value: status.id, label: status.label }))}
        onValueChange={onChange}
        disabled={disabled || pending}
        aria-label="Alterar status"
      />
      {pending ? (
        <span className="work-item-status-select__state" aria-live="polite">
          <AppIcon name="refresh" size={13} />
        </span>
      ) : null}
      {failed && onRetry ? (
        <Button
          type="button"
          className="work-item-status-select__retry"
          variant="ghost"
          size="sm"
          onClick={onRetry}
        >
          Retry
        </Button>
      ) : null}
    </span>
  );
}
