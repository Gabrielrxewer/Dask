import type { Task, TaskStatus, TaskStatusId } from "@/entities/task";
import { WorkItemStatusSelect } from "@/features/work-item-list/ui/WorkItemStatusSelect";

interface WorkItemStatusCellProps {
  task: Task;
  statuses: TaskStatus[];
  pendingStatus?: TaskStatusId;
  failedStatus?: TaskStatusId;
  onChange: (task: Task, statusId: TaskStatusId) => void;
  onRetry: (task: Task, statusId: TaskStatusId) => void;
}

export function WorkItemStatusCell({
  task,
  statuses,
  pendingStatus,
  failedStatus,
  onChange,
  onRetry
}: WorkItemStatusCellProps) {
  return (
    <WorkItemStatusSelect
      value={pendingStatus ?? task.status}
      statuses={statuses}
      pending={Boolean(pendingStatus)}
      failed={Boolean(failedStatus)}
      onChange={(statusId) => onChange(task, statusId)}
      onRetry={failedStatus ? () => onRetry(task, failedStatus) : undefined}
    />
  );
}
