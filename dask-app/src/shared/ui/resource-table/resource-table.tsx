import type { Key, ReactNode } from "react";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHeader,
  DataTableRow
} from "@/shared/ui/data-table";
import { EmptyState } from "@/shared/ui/empty-state";

type ResourceTableClassName<T> = string | ((row: T, index: number) => string | undefined);

export interface ResourceTableColumn<T> {
  id: string;
  header: ReactNode;
  width?: string;
  accessor?: keyof T | ((row: T, index: number) => ReactNode);
  render?: (row: T, index: number) => ReactNode;
  cellClassName?: ResourceTableClassName<T>;
  headerClassName?: string;
}

export interface ResourceTableActions<T> {
  header?: ReactNode;
  width?: string;
  render: (row: T, index: number) => ReactNode;
  cellClassName?: ResourceTableClassName<T>;
  headerClassName?: string;
}

export interface ResourceTableProps<T> {
  data: readonly T[];
  columns: readonly ResourceTableColumn<T>[];
  rowKey: keyof T | ((row: T, index: number) => Key);
  actions?: ResourceTableActions<T>;
  emptyState?: ReactNode;
  loading?: boolean;
  loadingState?: ReactNode;
  className?: string;
  rowClassName?: ResourceTableClassName<T>;
  responsiveMinWidth?: string;
  responsiveMinWidthMobile?: string;
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

export function ResourceTable<T>({
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
}: ResourceTableProps<T>) {
  const visibleColumns = actions
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
    : columns;
  const gridColumns = visibleColumns.map((column) => column.width ?? "1fr").join(" ");

  const fallbackCells = (content: ReactNode, variant: "loading" | "empty") => (
    <DataTableRow className="shared-data-table__row--empty">
      <DataTableCell className="shared-data-table__cell--full">
        {typeof content === "string" ? (
          <EmptyState
            variant={variant === "loading" ? "loading" : "table"}
            size="compact"
            title={content}
            description={variant === "loading" ? "Os dados serao exibidos assim que o carregamento terminar." : undefined}
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
      <DataTableHeader>
        {visibleColumns.map((column) => (
          <DataTableCell key={column.id} className={column.headerClassName}>
            {column.header}
          </DataTableCell>
        ))}
      </DataTableHeader>
      <DataTableBody>
        {loading
          ? fallbackCells(loadingState, "loading")
          : data.length === 0
            ? fallbackCells(emptyState, "empty")
            : data.map((row, rowIndex) => (
                <DataTableRow
                  key={resolveRowKey(rowKey, row, rowIndex)}
                  className={resolveClassName(rowClassName, row, rowIndex)}
                >
                  {visibleColumns.map((column) => (
                    <DataTableCell key={column.id} className={resolveClassName(column.cellClassName, row, rowIndex)}>
                      {renderCell(column, row, rowIndex)}
                    </DataTableCell>
                  ))}
                </DataTableRow>
              ))}
      </DataTableBody>
    </DataTable>
  );
}
