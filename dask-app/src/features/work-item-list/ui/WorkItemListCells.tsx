import type { MembersById } from "@/entities/member";
import type { BoardConfig, Task, TaskStatus, TaskStatusId } from "@/entities/task";
import type { WorkItemListColumnConfig } from "@/modules/work-item-list";
import {
  WorkItemActionsCell,
  WorkItemAssigneeCell,
  WorkItemCustomerCell,
  WorkItemDueDateCell,
  WorkItemFieldCell,
  WorkItemProgressCell,
  WorkItemStatusCell,
  WorkItemTitleCell,
  WorkItemTypeCell
} from "@/features/work-item-list/ui/cells";

export function resolveWorkItemListField(boardConfig: BoardConfig, column: WorkItemListColumnConfig) {
  return boardConfig.fieldDefinitions.find((field) => {
    const fieldKey = field.variableKey ?? field.slug ?? field.id;
    return field.id === column.fieldId || field.definitionId === column.fieldId || fieldKey === column.fieldKey;
  });
}

export function renderWorkItemListCell(input: {
  column: WorkItemListColumnConfig;
  task: Task;
  boardConfig: BoardConfig;
  statuses: TaskStatus[];
  membersById: MembersById;
  pendingStatus?: TaskStatusId;
  failedStatus?: TaskStatusId;
  onOpenTask: (task: Task) => void;
  onStatusChange: (task: Task, statusId: TaskStatusId) => void;
  onStatusRetry: (task: Task, statusId: TaskStatusId) => void;
}) {
  switch (input.column.id) {
    case "title":
      return <WorkItemTitleCell task={input.task} onOpen={input.onOpenTask} />;
    case "type":
      return <WorkItemTypeCell task={input.task} boardConfig={input.boardConfig} />;
    case "status":
      return (
        <WorkItemStatusCell
          task={input.task}
          statuses={input.statuses}
          pendingStatus={input.pendingStatus}
          failedStatus={input.failedStatus}
          onChange={input.onStatusChange}
          onRetry={input.onStatusRetry}
        />
      );
    case "assignee":
      return <WorkItemAssigneeCell task={input.task} membersById={input.membersById} />;
    case "dueDate":
      return <WorkItemDueDateCell task={input.task} />;
    case "progress":
      return <WorkItemProgressCell task={input.task} />;
    case "actions":
      return <WorkItemActionsCell task={input.task} onOpen={input.onOpenTask} />;
    default: {
      const field = resolveWorkItemListField(input.boardConfig, input.column);
      if (!field) {
        return <span className="work-item-cell-empty">-</span>;
      }
      if (input.column.type === "customer") {
        return <WorkItemCustomerCell task={input.task} field={field} />;
      }
      return (
        <WorkItemFieldCell
          task={input.task}
          field={field}
          boardConfig={input.boardConfig}
          statuses={input.statuses}
          membersById={input.membersById}
        />
      );
    }
  }
}
