import type { ReactNode } from "react";
import type { MembersById } from "@/entities/member";
import type { BoardConfig, Task, TaskStatus, TaskStatusId } from "@/entities/task";
import type { WorkItemListColumnConfig, WorkItemListConfig } from "@/modules/work-item-list";
import { renderWorkItemListCell } from "@/features/work-item-list/ui/WorkItemListCells";
import { WorkItemMobileCardActions } from "@/features/work-item-list/ui/WorkItemMobileCardActions";

interface WorkItemMobileCardProps {
  task: Task;
  config: WorkItemListConfig;
  boardConfig: BoardConfig;
  statuses: TaskStatus[];
  membersById: MembersById;
  pendingStatus?: TaskStatusId;
  failedStatus?: TaskStatusId;
  onOpenTask: (task: Task) => void;
  onStatusChange: (task: Task, statusId: TaskStatusId) => void;
  onStatusRetry: (task: Task, statusId: TaskStatusId) => void;
}

function renderMobileField(input: {
  column: WorkItemListColumnConfig | undefined;
  task: Task;
  boardConfig: BoardConfig;
  statuses: TaskStatus[];
  membersById: MembersById;
  pendingStatus?: TaskStatusId;
  failedStatus?: TaskStatusId;
  onOpenTask: (task: Task) => void;
  onStatusChange: (task: Task, statusId: TaskStatusId) => void;
  onStatusRetry: (task: Task, statusId: TaskStatusId) => void;
}): ReactNode {
  if (!input.column) {
    return null;
  }

  return renderWorkItemListCell({
    column: input.column,
    task: input.task,
    boardConfig: input.boardConfig,
    statuses: input.statuses,
    membersById: input.membersById,
    pendingStatus: input.pendingStatus,
    failedStatus: input.failedStatus,
    onOpenTask: input.onOpenTask,
    onStatusChange: input.onStatusChange,
    onStatusRetry: input.onStatusRetry
  });
}

export function WorkItemMobileCard({
  task,
  config,
  boardConfig,
  statuses,
  membersById,
  pendingStatus,
  failedStatus,
  onOpenTask,
  onStatusChange,
  onStatusRetry
}: WorkItemMobileCardProps) {
  const visibleColumns = config.columns.filter((column) => column.visible || column.required);
  const columnsById = new Map(visibleColumns.map((column) => [column.id, column]));
  const layout = config.mobileCardLayout;
  const titleColumn = columnsById.get(layout.titleField) ?? columnsById.get("title");
  const renderField = (columnId: string) =>
    renderMobileField({
      column: columnsById.get(columnId),
      task,
      boardConfig,
      statuses,
      membersById,
      pendingStatus,
      failedStatus,
      onOpenTask,
      onStatusChange,
      onStatusRetry
    });
  const metaFields = [...layout.primaryMetaFields, ...layout.secondaryMetaFields]
    .filter((columnId, index, source) => source.indexOf(columnId) === index)
    .map((columnId) => ({ column: columnsById.get(columnId), content: renderField(columnId) }))
    .filter((entry) => entry.column && entry.content);

  return (
    <article className="work-item-mobile-card">
      <header className="work-item-mobile-card__header">
        <div className="work-item-mobile-card__title">
          {renderMobileField({
            column: titleColumn,
            task,
            boardConfig,
            statuses,
            membersById,
            pendingStatus,
            failedStatus,
            onOpenTask,
            onStatusChange,
            onStatusRetry
          })}
        </div>
        <div className="work-item-mobile-card__badges">
          {layout.badgeFields.map((columnId) => (
            <span key={columnId} className="work-item-mobile-card__badge">
              {renderField(columnId)}
            </span>
          ))}
        </div>
      </header>

      {layout.subtitleFields.length > 0 ? (
        <div className="work-item-mobile-card__subtitles">
          {layout.subtitleFields.map((columnId) => {
            const column = columnsById.get(columnId);
            const content = renderField(columnId);
            return column && content ? (
              <span key={columnId} className="work-item-mobile-card__subtitle">
                {content}
              </span>
            ) : null;
          })}
        </div>
      ) : null}

      {metaFields.length > 0 ? (
        <dl className="work-item-mobile-card__meta">
          {metaFields.map(({ column, content }) => (
            <div key={column!.id} className="work-item-mobile-card__meta-item">
              <dt>{column!.label}</dt>
              <dd>{content}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <WorkItemMobileCardActions task={task} onOpen={onOpenTask} />
    </article>
  );
}
