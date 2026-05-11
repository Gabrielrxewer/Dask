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

type FiscalDataTableClassName<T> = string | ((row: T, index: number) => string | undefined);

export interface FiscalDataTableColumn<T> {
  id: string;
  header: ReactNode;
  width?: string;
  accessor?: keyof T | ((row: T, index: number) => ReactNode);
  render?: (row: T, index: number) => ReactNode;
  cellClassName?: FiscalDataTableClassName<T>;
  headerClassName?: string;
}

export interface FiscalDataTableActions<T> {
  header?: ReactNode;
  width?: string;
  render: (row: T, index: number) => ReactNode;
  cellClassName?: FiscalDataTableClassName<T>;
  headerClassName?: string;
}

export interface FiscalDataTableProps<T> {
  data: readonly T[];
  columns: readonly FiscalDataTableColumn<T>[];
  rowKey: keyof T | ((row: T, index: number) => Key);
  actions?: FiscalDataTableActions<T>;
  emptyState?: ReactNode;
  loading?: boolean;
  loadingState?: ReactNode;
  className?: string;
  rowClassName?: FiscalDataTableClassName<T>;
  responsiveMinWidth?: string;
  responsiveMinWidthMobile?: string;
}

function resolveClassName<T>(className: FiscalDataTableClassName<T> | undefined, row: T, index: number) {
  return typeof className === "function" ? className(row, index) : className;
}

function resolveRowKey<T>(rowKey: FiscalDataTableProps<T>["rowKey"], row: T, index: number): Key {
  const value = typeof rowKey === "function" ? rowKey(row, index) : row[rowKey];
  return typeof value === "string" || typeof value === "number" ? value : String(value);
}

function renderCell<T>(column: FiscalDataTableColumn<T>, row: T, index: number): ReactNode {
  if (column.render) return column.render(row, index);
  if (typeof column.accessor === "function") return column.accessor(row, index);
  if (column.accessor) return row[column.accessor] as ReactNode;
  return null;
}

export function FiscalDataTable<T>({
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
}: FiscalDataTableProps<T>) {
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
            } satisfies FiscalDataTableColumn<T>
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
