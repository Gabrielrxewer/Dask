import {
  resolveTaskFieldValue,
  WorkItemFieldRenderer,
  type BoardConfig,
  type Task,
  type TaskFieldDefinition,
  type TaskStatus
} from "@/entities/task";
import type { MembersById } from "@/entities/member";

interface WorkItemFieldCellProps {
  task: Task;
  field: TaskFieldDefinition;
  boardConfig: BoardConfig;
  statuses: TaskStatus[];
  membersById: MembersById;
}

export function WorkItemFieldCell({ task, field, boardConfig, statuses, membersById }: WorkItemFieldCellProps) {
  return (
    <WorkItemFieldRenderer
      field={field}
      value={resolveTaskFieldValue(task, field)}
      mode="display"
      context="table"
      boardConfig={boardConfig}
      statuses={statuses}
      membersById={membersById}
      task={task}
      readonly
    />
  );
}
