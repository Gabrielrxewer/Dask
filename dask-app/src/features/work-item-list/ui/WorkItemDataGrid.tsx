import { useCallback, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  flexRender,
  functionalUpdate,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type RowSelectionState,
  type SortingState
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { MembersById } from "@/entities/member";
import type { BoardConfig, Task, TaskStatus, TaskStatusId } from "@/entities/task";
import type { WorkItemListColumnConfig, WorkItemListConfig, WorkItemListParams } from "@/modules/work-item-list";
import {
  AppCheckbox,
  DataTable,
  DataTableBody,
  DataTableCell,
  EmptyState,
  LoadingState
} from "@/shared/ui";
import { WorkItemDataGridHeader } from "@/features/work-item-list/ui/WorkItemDataGridHeader";
import { WorkItemDataGridPagination } from "@/features/work-item-list/ui/WorkItemDataGridPagination";
import { WorkItemDataGridRow } from "@/features/work-item-list/ui/WorkItemDataGridRow";
import { WorkItemDataGridCell } from "@/features/work-item-list/ui/WorkItemDataGridCell";
import { WorkItemDataGridToolbar } from "@/features/work-item-list/ui/WorkItemDataGridToolbar";
import { renderWorkItemListCell } from "@/features/work-item-list/ui/WorkItemListCells";

type SortBy = NonNullable<WorkItemListParams["sortBy"]>;

const SORT_BY_COLUMN_ID: Record<SortBy, string> = {
  position: "title",
  title: "title",
  type: "type",
  status: "status",
  assignee: "assignee",
  dueDate: "dueDate",
  createdAt: "title",
  updatedAt: "title",
  plannedStartAt: "title"
};

const SORT_BY_BY_COLUMN_ID: Partial<Record<string, SortBy>> = {
  title: "title",
  type: "type",
  status: "status",
  assignee: "assignee",
  dueDate: "dueDate"
};

const FALLBACK_ROW_STYLE: CSSProperties = {
  gridTemplateColumns: "minmax(0, 1fr)"
};

export interface WorkItemDataGridProps {
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
  sortBy?: SortBy;
  sortDirection?: "asc" | "desc";
  onOpenTask: (task: Task) => void;
  onStatusChange: (taskId: string, statusId: TaskStatusId) => Promise<void>;
  onBulkStatusChange?: (taskIds: string[], statusId: TaskStatusId) => Promise<void>;
  onBulkAssigneeChange?: (taskIds: string[], assigneeId: string) => Promise<void>;
  onBulkArchive?: (taskIds: string[]) => Promise<void>;
  onPaginationChange: (input: { pageIndex: number; pageSize: number }) => void;
  onSortChange: (input: { sortBy?: SortBy; sortDirection?: "asc" | "desc" }) => void;
  onConfigChange?: (config: WorkItemListConfig) => void;
}

function getGridWidth(column: WorkItemListColumnConfig): string {
  const defaultSizingByType: Record<string, { minWidth: number; width: number }> = {
    title: { minWidth: 260, width: 300 },
    type: { minWidth: 120, width: 136 },
    status: { minWidth: 210, width: 230 },
    assignee: { minWidth: 180, width: 200 },
    dueDate: { minWidth: 120, width: 128 },
    progress: { minWidth: 120, width: 128 },
    customer: { minWidth: 190, width: 220 },
    email: { minWidth: 240, width: 280 },
    phone: { minWidth: 160, width: 180 },
    actions: { minWidth: 96, width: 104 }
  };
  const fallback = defaultSizingByType[column.type] ?? { minWidth: 160, width: 190 };
  const minWidth = Math.max(column.minWidth ?? 0, fallback.minWidth);
  const width = Math.max(column.width ?? 0, fallback.width, minWidth);

  return `minmax(${minWidth}px, ${width}px)`;
}

export function WorkItemDataGrid({
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
  sortBy,
  sortDirection,
  onOpenTask,
  onStatusChange,
  onBulkStatusChange,
  onBulkAssigneeChange,
  onBulkArchive,
  onPaginationChange,
  onSortChange,
  onConfigChange
}: WorkItemDataGridProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pendingStatuses, setPendingStatuses] = useState<Record<string, TaskStatusId>>({});
  const [failedStatuses, setFailedStatuses] = useState<Record<string, TaskStatusId>>({});
  const [bulkActionPending, setBulkActionPending] = useState(false);

  const visibleConfigColumns = useMemo(
    () => config.columns.filter((column) => column.visible).sort((left, right) => left.order - right.order),
    [config.columns]
  );
  const gridColumns = useMemo(
    () => ["44px", ...visibleConfigColumns.map(getGridWidth)].join(" "),
    [visibleConfigColumns]
  );
  const sorting = useMemo<SortingState>(
    () => sortBy ? [{ id: SORT_BY_COLUMN_ID[sortBy], desc: sortDirection === "desc" }] : [],
    [sortBy, sortDirection]
  );

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

  const columns = useMemo<Array<ColumnDef<Task>>>(() => {
    const selectionColumn: ColumnDef<Task> = {
      id: "__select",
      header: ({ table }) => (
        <AppCheckbox
          checked={table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false}
          onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked === true)}
          aria-label="Selecionar itens da pagina"
        />
      ),
      cell: ({ row }) => (
        <AppCheckbox
          checked={row.getIsSelected()}
          onCheckedChange={(checked) => row.toggleSelected(checked === true)}
          aria-label="Selecionar item"
        />
      ),
      enableSorting: false
    };

    return [
      selectionColumn,
      ...visibleConfigColumns.map<ColumnDef<Task>>((column) => ({
        id: column.id,
        header: column.label,
        enableSorting: Boolean(column.sortable && SORT_BY_BY_COLUMN_ID[column.id]),
        cell: ({ row }) => renderWorkItemListCell({
          column,
          task: row.original,
          boardConfig,
          statuses,
          membersById,
          pendingStatus: pendingStatuses[row.original.id],
          failedStatus: failedStatuses[row.original.id],
          onOpenTask,
          onStatusChange: (task, statusId) => void persistStatusChange(task, statusId),
          onStatusRetry: (task, statusId) => void persistStatusChange(task, statusId)
        })
      }))
    ];
  }, [boardConfig, failedStatuses, membersById, onOpenTask, pendingStatuses, persistStatusChange, statuses, visibleConfigColumns]);

  const handleSortingChange = useCallback<OnChangeFn<SortingState>>(
    (updater) => {
      const nextSorting = functionalUpdate(updater, sorting);
      const firstSort = nextSorting[0];
      if (!firstSort) {
        onSortChange({});
        return;
      }

      onSortChange({
        sortBy: SORT_BY_BY_COLUMN_ID[firstSort.id] ?? "position",
        sortDirection: firstSort.desc ? "desc" : "asc"
      });
    },
    [onSortChange, sorting]
  );

  const table = useReactTable({
    data: items,
    columns,
    state: {
      rowSelection,
      sorting
    },
    manualPagination: true,
    manualSorting: true,
    pageCount,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection,
    onSortingChange: handleSortingChange
  });

  const rows = table.getRowModel().rows;
  const shouldVirtualize = rows.length > 80;
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () =>
      rootRef.current?.querySelector<HTMLDivElement>(".shared-data-table__scroll") ?? null,
    estimateSize: () => (config.density === "compact" ? 46 : 52),
    overscan: 8,
    enabled: shouldVirtualize
  });
  const virtualRows = shouldVirtualize ? rowVirtualizer.getVirtualItems() : [];
  const selectedCount = table.getSelectedRowModel().rows.length;
  const selectedTaskIds = useMemo(
    () => table.getSelectedRowModel().rows.map((row) => row.original.id),
    [rowSelection, table]
  );

  const runBulkAction = useCallback(
    async (action: (taskIds: string[]) => Promise<void>) => {
      if (selectedTaskIds.length === 0) {
        return;
      }

      setBulkActionPending(true);
      try {
        await action(selectedTaskIds);
        table.resetRowSelection();
      } finally {
        setBulkActionPending(false);
      }
    },
    [selectedTaskIds, table]
  );

  const handleBulkStatusChange = useCallback(
    async (statusId: TaskStatusId) => {
      if (!onBulkStatusChange) {
        return;
      }

      await runBulkAction((taskIds) => onBulkStatusChange(taskIds, statusId));
    },
    [onBulkStatusChange, runBulkAction]
  );

  const handleBulkAssigneeChange = useCallback(
    async (assigneeId: string) => {
      if (!onBulkAssigneeChange) {
        return;
      }

      await runBulkAction((taskIds) => onBulkAssigneeChange(taskIds, assigneeId));
    },
    [onBulkAssigneeChange, runBulkAction]
  );

  const handleBulkArchive = useCallback(
    async () => {
      if (!onBulkArchive) {
        return;
      }

      await runBulkAction((taskIds) => onBulkArchive(taskIds));
    },
    [onBulkArchive, runBulkAction]
  );

  const renderFallback = () => {
    if (loading && items.length === 0) {
      return (
        <div className="shared-data-table__row shared-data-table__row--empty" style={FALLBACK_ROW_STYLE}>
          <DataTableCell className="shared-data-table__cell--full">
            <LoadingState text="Carregando lista..." animation="list" variant="frame" visible />
          </DataTableCell>
        </div>
      );
    }

    if (error) {
      return (
        <div className="shared-data-table__row shared-data-table__row--empty" style={FALLBACK_ROW_STYLE}>
          <DataTableCell className="shared-data-table__cell--full">
            <EmptyState
              variant="table"
              title="Nao foi possivel carregar a lista."
              description="Confira os filtros atuais e tente novamente."
            />
          </DataTableCell>
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="shared-data-table__row shared-data-table__row--empty" style={FALLBACK_ROW_STYLE}>
          <DataTableCell className="shared-data-table__cell--full">
            <EmptyState
              variant="table"
              title="Nenhum item encontrado."
              description="Ajuste o filtro atual ou crie um novo item para alimentar esta lista."
            />
          </DataTableCell>
        </div>
      );
    }

    return null;
  };

  const fallback = renderFallback();

  return (
    <div ref={rootRef} className="work-item-data-grid">
      <WorkItemDataGridToolbar
        config={config}
        totalCount={totalCount}
        selectedCount={selectedCount}
        statuses={statuses}
        membersById={membersById}
        bulkActionPending={bulkActionPending}
        onClearSelection={() => table.resetRowSelection()}
        onBulkStatusChange={(statusId) => void handleBulkStatusChange(statusId)}
        onBulkAssigneeChange={(assigneeId) => void handleBulkAssigneeChange(assigneeId)}
        onBulkArchive={() => void handleBulkArchive()}
        onConfigChange={onConfigChange}
      />
      <DataTable
        columns={gridColumns}
        className="list-view__table work-item-data-grid__table"
        responsiveMinWidth="920px"
        responsiveMinWidthMobile="760px"
      >
        <WorkItemDataGridHeader table={table} />
        <DataTableBody
          className={shouldVirtualize ? "work-item-data-grid__body work-item-data-grid__body--virtual" : "work-item-data-grid__body"}
          style={shouldVirtualize ? { height: `${rowVirtualizer.getTotalSize()}px` } : undefined}
        >
          {fallback ?? (
            shouldVirtualize
              ? virtualRows.map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  return row ? (
                    <WorkItemDataGridRow
                      key={row.id}
                      selected={row.getIsSelected()}
                      virtualStyle={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "max-content",
                        minWidth: "100%",
                        transform: `translateY(${virtualRow.start}px)`
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <WorkItemDataGridCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </WorkItemDataGridCell>
                      ))}
                    </WorkItemDataGridRow>
                  ) : null;
                })
              : rows.map((row) => (
                  <WorkItemDataGridRow key={row.id} selected={row.getIsSelected()}>
                    {row.getVisibleCells().map((cell) => (
                      <WorkItemDataGridCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </WorkItemDataGridCell>
                    ))}
                  </WorkItemDataGridRow>
                ))
          )}
        </DataTableBody>
      </DataTable>
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
