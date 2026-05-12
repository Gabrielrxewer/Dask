import { useCallback, useMemo, type Key, type ReactNode } from "react";
import {
  flexRender,
  functionalUpdate,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type SortingState
} from "@tanstack/react-table";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHeader,
  DataTableRow
} from "@/shared/ui/data-table";
import { EmptyState } from "@/shared/ui/empty-state";
import { AppIcon } from "@/shared/ui/icon";
import { AppSelect } from "@/shared/ui/select";

type ResourceTableClassName<T> = string | ((row: T, index: number) => string | undefined);
type ResourceTableFallbackVariant = "loading" | "error" | "empty";

export type ResourceTableSortDirection = "asc" | "desc";

export interface ResourceTableColumn<T> {
  id: string;
  header: ReactNode;
  width?: string;
  accessor?: keyof T | ((row: T, index: number) => ReactNode);
  render?: (row: T, index: number) => ReactNode;
  cellClassName?: ResourceTableClassName<T>;
  headerClassName?: string;
  sortable?: boolean;
  sortKey?: string;
}

export interface ResourceTableActions<T> {
  header?: ReactNode;
  width?: string;
  render: (row: T, index: number) => ReactNode;
  cellClassName?: ResourceTableClassName<T>;
  headerClassName?: string;
}

export interface ResourceTablePagination {
  page: number;
  pageSize?: number;
  pageSizeOptions?: readonly number[];
  hasPrevious: boolean;
  hasNext: boolean;
  isLoading?: boolean;
  label?: string;
  onPrevious: () => void;
  onNext: () => void;
  onPageSizeChange?: (pageSize: number) => void;
}

export interface ResourceTableMobileCard<T> {
  render: (row: T, index: number) => ReactNode;
  className?: ResourceTableClassName<T>;
  listClassName?: string;
}

export interface ResourceTableProps<T> {
  data: readonly T[];
  columns: readonly ResourceTableColumn<T>[];
  rowKey: keyof T | ((row: T, index: number) => Key);
  actions?: ResourceTableActions<T>;
  emptyState?: ReactNode;
  loading?: boolean;
  loadingState?: ReactNode;
  error?: unknown;
  errorState?: ReactNode;
  className?: string;
  rowClassName?: ResourceTableClassName<T>;
  responsiveMinWidth?: string;
  responsiveMinWidthMobile?: string;
  sortBy?: string;
  sortDirection?: ResourceTableSortDirection;
  onSortChange?: (sorting: { sortBy?: string; sortDirection?: ResourceTableSortDirection }) => void;
  pagination?: ResourceTablePagination;
  mobileCard?: ResourceTableMobileCard<T>;
}

function resolveClassName<T>(className: ResourceTableClassName<T> | undefined, row: T, index: number) {
  return typeof className === "function" ? className(row, index) : className;
}

function resolveRowKey<T>(rowKey: ResourceTableProps<T>["rowKey"], row: T, index: number): Key {
  const value = typeof rowKey === "function" ? rowKey(row, index) : row[rowKey];
  return typeof value === "string" || typeof value === "number" ? value : String(value);
}

function renderCell<T>(column: ResourceTableColumn<T>, row: T, index: number): ReactNode {
  if (column.render) {
    return column.render(row, index);
  }

  if (typeof column.accessor === "function") {
    return column.accessor(row, index);
  }

  if (column.accessor) {
    return row[column.accessor] as ReactNode;
  }

  return null;
}

function sortKeyForColumn<T>(column: ResourceTableColumn<T>): string {
  return column.sortKey ?? column.id;
}

function sortAccessor<T>(column: ResourceTableColumn<T>, rowKey: ResourceTableProps<T>["rowKey"]) {
  if (!column.sortable) return undefined;

  return (row: T, index: number) => {
    const value =
      typeof column.accessor === "function"
        ? column.accessor(row, index)
        : column.accessor
          ? row[column.accessor]
          : resolveRowKey(rowKey, row, index);

    return typeof value === "string" || typeof value === "number" || value instanceof Date
      ? value
      : String(value ?? "");
  };
}

function errorContent(error: unknown, errorState: ReactNode | undefined): ReactNode {
  if (errorState !== undefined) return errorState;
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Nao foi possivel carregar os dados.";
}

function fallbackVariantProps(variant: ResourceTableFallbackVariant) {
  if (variant === "loading") {
    return {
      emptyVariant: "loading" as const,
      description: "Os dados serao exibidos assim que o carregamento terminar."
    };
  }

  if (variant === "error") {
    return {
      emptyVariant: "error" as const,
      description: "Tente novamente em instantes."
    };
  }

  return {
    emptyVariant: "table" as const,
    description: undefined
  };
}

export function ResourceTable<T>({
  data,
  columns,
  rowKey,
  actions,
  emptyState = "Nenhum registro encontrado.",
  loading = false,
  loadingState = "Carregando...",
  error,
  errorState,
  className,
  rowClassName,
  responsiveMinWidth,
  responsiveMinWidthMobile,
  sortBy,
  sortDirection = "asc",
  onSortChange,
  pagination,
  mobileCard
}: ResourceTableProps<T>) {
  const visibleColumns = useMemo(
    () =>
      actions
        ? [
            ...columns,
            {
              id: "__actions",
              header: actions.header ?? "Acoes",
              width: actions.width,
              render: actions.render,
              cellClassName: actions.cellClassName,
              headerClassName: actions.headerClassName
            } satisfies ResourceTableColumn<T>
          ]
        : [...columns],
    [actions, columns]
  );

  const tableColumns = useMemo<Array<ColumnDef<T>>>(
    () =>
      visibleColumns.map((column) => ({
        id: column.id,
        accessorFn: sortAccessor(column, rowKey),
        header: () => column.header,
        cell: ({ row }) => renderCell(column, row.original, row.index),
        enableSorting: Boolean(column.sortable && onSortChange)
      })),
    [onSortChange, rowKey, visibleColumns]
  );

  const sorting = useMemo<SortingState>(() => {
    if (!sortBy) return [];
    const column = visibleColumns.find((item) => sortKeyForColumn(item) === sortBy);
    return column ? [{ id: column.id, desc: sortDirection === "desc" }] : [];
  }, [sortBy, sortDirection, visibleColumns]);

  const handleSortingChange = useCallback<OnChangeFn<SortingState>>(
    (updater) => {
      if (!onSortChange) return;
      const nextSorting = functionalUpdate(updater, sorting);
      const next = nextSorting[0];

      if (!next) {
        onSortChange({});
        return;
      }

      const column = visibleColumns.find((item) => item.id === next.id);
      onSortChange({
        sortBy: column ? sortKeyForColumn(column) : next.id,
        sortDirection: next.desc ? "desc" : "asc"
      });
    },
    [onSortChange, sorting, visibleColumns]
  );

  const tableData = useMemo(() => [...data], [data]);
  const table = useReactTable({
    data: tableData,
    columns: tableColumns,
    state: { sorting },
    manualSorting: Boolean(onSortChange),
    enableSortingRemoval: true,
    onSortingChange: handleSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row, index) => String(resolveRowKey(rowKey, row, index))
  });

  const gridColumns = visibleColumns.map((column) => column.width ?? "1fr").join(" ");
  const rows = table.getRowModel().rows;
  const fallback =
    loading
      ? { content: loadingState, variant: "loading" as const }
      : error
        ? { content: errorContent(error, errorState), variant: "error" as const }
        : rows.length === 0
          ? { content: emptyState, variant: "empty" as const }
          : null;

  const renderFallback = (content: ReactNode, variant: ResourceTableFallbackVariant) => {
    const { emptyVariant, description } = fallbackVariantProps(variant);
    return typeof content === "string" ? (
      <EmptyState variant={emptyVariant} size="compact" title={content} description={description} />
    ) : (
      content
    );
  };

  const fallbackCells = (content: ReactNode, variant: ResourceTableFallbackVariant) => (
    <DataTableRow className="shared-data-table__row--empty">
      <DataTableCell className="shared-data-table__cell--full">{renderFallback(content, variant)}</DataTableCell>
    </DataTableRow>
  );

  return (
    <div className={cn("shared-resource-table", mobileCard && "shared-resource-table--with-mobile")}>
      <DataTable
        className={className}
        columns={gridColumns}
        responsiveMinWidth={responsiveMinWidth}
        responsiveMinWidthMobile={responsiveMinWidthMobile}
      >
        {table.getHeaderGroups().map((headerGroup) => (
          <DataTableHeader key={headerGroup.id}>
            {headerGroup.headers.map((header, index) => {
              const column = visibleColumns[index];
              const sorted = header.column.getIsSorted();
              const ariaSort = sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none";
              const headerContent = flexRender(header.column.columnDef.header, header.getContext());

              return (
                <DataTableCell
                  key={header.id}
                  className={column?.headerClassName}
                  role={header.column.getCanSort() ? "columnheader" : undefined}
                  aria-sort={header.column.getCanSort() ? ariaSort : undefined}
                >
                  {header.column.getCanSort() ? (
                    <button
                      type="button"
                      className={cn(
                        "shared-resource-table__sort-button",
                        sorted && "shared-resource-table__sort-button--active"
                      )}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <span>{headerContent}</span>
                      <AppIcon
                        name="arrow-up"
                        size={12}
                        className={cn(
                          "shared-resource-table__sort-icon",
                          sorted === "desc" && "shared-resource-table__sort-icon--desc",
                          !sorted && "shared-resource-table__sort-icon--muted"
                        )}
                      />
                    </button>
                  ) : (
                    headerContent
                  )}
                </DataTableCell>
              );
            })}
          </DataTableHeader>
        ))}
        <DataTableBody>
          {fallback
            ? fallbackCells(fallback.content, fallback.variant)
            : rows.map((row) => (
                <DataTableRow key={row.id} className={resolveClassName(rowClassName, row.original, row.index)}>
                  {row.getVisibleCells().map((cell, index) => (
                    <DataTableCell
                      key={cell.id}
                      className={resolveClassName(visibleColumns[index]?.cellClassName, row.original, row.index)}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </DataTableCell>
                  ))}
                </DataTableRow>
              ))}
        </DataTableBody>
      </DataTable>

      {mobileCard ? (
        <div className={cn("shared-resource-table__mobile", mobileCard.listClassName)}>
          {fallback ? (
            <div className="shared-resource-table__mobile-state">
              {renderFallback(fallback.content, fallback.variant)}
            </div>
          ) : (
            rows.map((row) => (
              <div
                key={row.id}
                className={cn(
                  "shared-resource-table__mobile-card",
                  resolveClassName(rowClassName, row.original, row.index),
                  resolveClassName(mobileCard.className, row.original, row.index)
                )}
              >
                {mobileCard.render(row.original, row.index)}
              </div>
            ))
          )}
        </div>
      ) : null}

      {pagination ? (
        <nav className="shared-resource-table__pagination" aria-label={pagination.label ?? "Paginacao da tabela"}>
          <div className="shared-resource-table__pagination-meta">
            <span>Pagina {pagination.page}</span>
            {pagination.pageSize ? <span>{pagination.pageSize} / pagina</span> : null}
            {pagination.pageSize && pagination.onPageSizeChange && pagination.pageSizeOptions ? (
              <AppSelect
                value={String(pagination.pageSize)}
                onValueChange={(value) => pagination.onPageSizeChange?.(Number(value))}
                aria-label="Itens por pagina"
                triggerClassName="shared-resource-table__page-size"
                items={pagination.pageSizeOptions.map((pageSize) => ({
                  value: String(pageSize),
                  label: `${pageSize} / pagina`
                }))}
              />
            ) : null}
          </div>
          <div className="shared-resource-table__pagination-actions">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={pagination.onPrevious}
              disabled={!pagination.hasPrevious || pagination.isLoading}
            >
              <AppIcon name="chevron-left" size={14} />
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={pagination.onNext}
              disabled={!pagination.hasNext || pagination.isLoading}
            >
              Proxima
              <AppIcon name="chevron-right" size={14} />
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
