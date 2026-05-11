import { useMemo, type Key, type ReactNode } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHeader,
  DataTableRow,
  EmptyState
} from "@/shared/ui";

type BillingDataTableClassName<T> = string | ((row: T, index: number) => string | undefined);

export interface BillingDataTableColumn<T> {
  id: string;
  header: ReactNode;
  width?: string;
  accessor?: keyof T | ((row: T, index: number) => ReactNode);
  render?: (row: T, index: number) => ReactNode;
  cellClassName?: BillingDataTableClassName<T>;
  headerClassName?: string;
}

export interface BillingDataTableActions<T> {
  header?: ReactNode;
  width?: string;
  render: (row: T, index: number) => ReactNode;
  cellClassName?: BillingDataTableClassName<T>;
  headerClassName?: string;
}

export interface BillingDataTableProps<T> {
  data: readonly T[];
  columns: readonly BillingDataTableColumn<T>[];
  rowKey: keyof T | ((row: T, index: number) => Key);
  actions?: BillingDataTableActions<T>;
  emptyState?: ReactNode;
  loading?: boolean;
  loadingState?: ReactNode;
  className?: string;
  rowClassName?: BillingDataTableClassName<T>;
  responsiveMinWidth?: string;
  responsiveMinWidthMobile?: string;
}

function resolveClassName<T>(className: BillingDataTableClassName<T> | undefined, row: T, index: number) {
  return typeof className === "function" ? className(row, index) : className;
}

function resolveRowKey<T>(rowKey: BillingDataTableProps<T>["rowKey"], row: T, index: number): Key {
  const value = typeof rowKey === "function" ? rowKey(row, index) : row[rowKey];
  return typeof value === "string" || typeof value === "number" ? value : String(value);
}

function renderCell<T>(column: BillingDataTableColumn<T>, row: T, index: number): ReactNode {
  if (column.render) return column.render(row, index);
  if (typeof column.accessor === "function") return column.accessor(row, index);
  if (column.accessor) return row[column.accessor] as ReactNode;
  return null;
}

export function BillingDataTable<T>({
  data,
  columns,
  rowKey,
  actions,
  emptyState = "Nenhum registro encontrado.",
  loading = false,
  loadingState = "Carregando...",
  className,
  rowClassName,
  responsiveMinWidth,
  responsiveMinWidthMobile
}: BillingDataTableProps<T>) {
  const visibleColumns = useMemo(
    () =>
      actions
        ? [
            ...columns,
            {
              id: "__actions",
              header: actions.header ?? "Ações",
              width: actions.width,
              render: actions.render,
              cellClassName: actions.cellClassName,
              headerClassName: actions.headerClassName
            } satisfies BillingDataTableColumn<T>
          ]
        : [...columns],
    [actions, columns]
  );
  const tableColumns = useMemo(
    () =>
      visibleColumns.map<ColumnDef<T>>((column) => ({
        id: column.id,
        header: () => column.header,
        cell: ({ row }) => renderCell(column, row.original, row.index)
      })),
    [visibleColumns]
  );
  const tableData = useMemo(() => [...data], [data]);
  const table = useReactTable({
    data: tableData,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row, index) => String(resolveRowKey(rowKey, row, index))
  });
  const gridColumns = visibleColumns.map((column) => column.width ?? "1fr").join(" ");
  const fallbackCells = (content: ReactNode, variant: "loading" | "empty") => (
    <DataTableRow className="shared-data-table__row--empty">
      <DataTableCell className="shared-data-table__cell--full">
        {typeof content === "string" ? (
          <EmptyState
            variant={variant === "loading" ? "loading" : "table"}
            size="compact"
            title={content}
            description={variant === "loading" ? "Os dados serão exibidos assim que o carregamento terminar." : undefined}
          />
        ) : content}
      </DataTableCell>
    </DataTableRow>
  );

  return (
    <DataTable
      className={className}
      columns={gridColumns}
      responsiveMinWidth={responsiveMinWidth}
      responsiveMinWidthMobile={responsiveMinWidthMobile}
    >
      {table.getHeaderGroups().map((headerGroup) => (
        <DataTableHeader key={headerGroup.id}>
          {headerGroup.headers.map((header, index) => (
            <DataTableCell key={header.id} className={visibleColumns[index]?.headerClassName}>
              {flexRender(header.column.columnDef.header, header.getContext())}
            </DataTableCell>
          ))}
        </DataTableHeader>
      ))}
      <DataTableBody>
        {loading
          ? fallbackCells(loadingState, "loading")
          : table.getRowModel().rows.length === 0
            ? fallbackCells(emptyState, "empty")
            : table.getRowModel().rows.map((row) => (
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
  );
}
