import { useCallback, useState } from "react";
import type { MembersById } from "@/entities/member";
import type { BoardConfig, Task, TaskStatus, TaskStatusId } from "@/entities/task";
import type { WorkItemListConfig } from "@/modules/work-item-list";
import { EmptyState, LoadingState } from "@/shared/ui";
import { WorkItemDataGridPagination } from "@/features/work-item-list/ui/WorkItemDataGridPagination";
import { WorkItemMobileCard } from "@/features/work-item-list/ui/WorkItemMobileCard";

interface WorkItemMobileListProps {
  items: Task[];
  config: WorkItemListConfig;
  boardConfig: BoardConfig;
  statuses: TaskStatus[];
  membersById: MembersById;
  loading?: boolean;
  error?: unknown;
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  onOpenTask: (task: Task) => void;
  onStatusChange: (taskId: string, statusId: TaskStatusId) => Promise<void>;
  onPaginationChange: (input: { pageIndex: number; pageSize: number }) => void;
}

export function WorkItemMobileList({
  items,
  config,
  boardConfig,
  statuses,
  membersById,
  loading = false,
  error,
  totalCount,
  pageIndex,
  pageSize,
  pageCount,
  onOpenTask,
  onStatusChange,
  onPaginationChange
}: WorkItemMobileListProps) {
  const [pendingStatuses, setPendingStatuses] = useState<Record<string, TaskStatusId>>({});
  const [failedStatuses, setFailedStatuses] = useState<Record<string, TaskStatusId>>({});

  const persistStatusChange = useCallback(
    async (task: Task, statusId: TaskStatusId) => {
      setPendingStatuses((current) => ({ ...current, [task.id]: statusId }));
      setFailedStatuses((current) => {
        const next = { ...current };
        delete next[task.id];
        return next;
      });

      try {
        await onStatusChange(task.id, statusId);
      } catch {
        setFailedStatuses((current) => ({ ...current, [task.id]: statusId }));
      } finally {
        setPendingStatuses((current) => {
          const next = { ...current };
          delete next[task.id];
          return next;
        });
      }
    },
    [onStatusChange]
  );

  if (loading && items.length === 0) {
    return (
      <div className="work-item-mobile-list">
        <LoadingState text="Carregando lista..." animation="list" variant="frame" visible />
      </div>
    );
  }

  if (error) {
    return (
      <div className="work-item-mobile-list">
        <EmptyState
          variant="table"
          title="Nao foi possivel carregar a lista."
          description="Confira os filtros atuais e tente novamente."
        />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="work-item-mobile-list">
        <EmptyState
          variant="table"
          title="Nenhum item encontrado."
          description="Ajuste o filtro atual ou crie um novo item para alimentar esta lista."
        />
      </div>
    );
  }

  return (
    <div className="work-item-mobile-list">
      <div className="work-item-mobile-list__cards">
        {items.map((task) => (
          <WorkItemMobileCard
            key={task.id}
            task={task}
            config={config}
            boardConfig={boardConfig}
            statuses={statuses}
            membersById={membersById}
            pendingStatus={pendingStatuses[task.id]}
            failedStatus={failedStatuses[task.id]}
            onOpenTask={onOpenTask}
            onStatusChange={(targetTask, statusId) => void persistStatusChange(targetTask, statusId)}
            onStatusRetry={(targetTask, statusId) => void persistStatusChange(targetTask, statusId)}
          />
        ))}
      </div>
      <WorkItemDataGridPagination
        pageIndex={pageIndex}
        pageSize={pageSize}
        totalCount={totalCount}
        pageCount={pageCount}
        canPreviousPage={pageIndex > 0}
        canNextPage={pageIndex + 1 < pageCount}
        onPageChange={(nextPageIndex) => onPaginationChange({ pageIndex: nextPageIndex, pageSize })}
        onPageSizeChange={(nextPageSize) => onPaginationChange({ pageIndex: 0, pageSize: nextPageSize })}
      />
    </div>
  );
}
