import type { MembersById } from "@/entities/member";
import type { TaskStatus, TaskStatusId } from "@/entities/task";
import type { WorkItemListConfig } from "@/modules/work-item-list";
import { WorkItemDataGridBulkActions } from "@/features/work-item-list/ui/WorkItemDataGridBulkActions";
import { WorkItemDataGridColumnMenu } from "@/features/work-item-list/ui/WorkItemDataGridColumnMenu";

interface WorkItemDataGridToolbarProps {
  config: WorkItemListConfig;
  totalCount: number;
  selectedCount: number;
  statuses: TaskStatus[];
  membersById: MembersById;
  bulkActionPending?: boolean;
  onClearSelection: () => void;
  onBulkStatusChange?: (statusId: TaskStatusId) => void;
  onBulkAssigneeChange?: (assigneeId: string) => void;
  onBulkArchive?: () => void;
  onConfigChange?: (config: WorkItemListConfig) => void;
}

export function WorkItemDataGridToolbar({
  config,
  totalCount,
  selectedCount,
  statuses,
  membersById,
  bulkActionPending,
  onClearSelection,
  onBulkStatusChange,
  onBulkAssigneeChange,
  onBulkArchive,
  onConfigChange
}: WorkItemDataGridToolbarProps) {
  return (
    <div className="work-item-data-grid__toolbar">
      <span className="work-item-data-grid__summary">
        {totalCount} {totalCount === 1 ? "item" : "itens"}
      </span>
      <WorkItemDataGridBulkActions
        selectedCount={selectedCount}
        statuses={statuses}
        membersById={membersById}
        pending={bulkActionPending}
        onClearSelection={onClearSelection}
        onStatusChange={onBulkStatusChange}
        onAssigneeChange={onBulkAssigneeChange}
        onArchive={onBulkArchive}
      />
      <WorkItemDataGridColumnMenu config={config} onConfigChange={onConfigChange} />
    </div>
  );
}
