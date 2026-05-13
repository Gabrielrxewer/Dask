import { createContext, useContext, type CSSProperties, type HTMLAttributes, type Key, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/empty-state";
import { AppIcon } from "@/shared/ui/icon";
import { LoadingState } from "@/shared/ui/loading-state";
import { AppSelect } from "@/shared/ui/select";

type DataTableClassName<T> = string | ((row: T, index: number) => string | undefined);
export type DataTableColumnVisibility = Record<string, boolean>;

export interface DataTableColumn<T> {
  id: string;
  header: ReactNode;
  width?: string;
  render?: (row: T, index: number) => ReactNode;
  cellClassName?: DataTableClassName<T>;
  headerClassName?: string;
  visible?: boolean;
}

export interface DataTableSelection<T> {
  selectedRowIds: Record<string, boolean>;
  isAllSelected?: boolean;
  isSomeSelected?: boolean;
  renderHeader?: () => ReactNode;
  renderCell?: (row: T, index: number, rowId: string) => ReactNode;
}

export interface DataTableRowActions<T> {
  header?: ReactNode;
  width?: string;
  render: (row: T, index: number) => ReactNode;
  cellClassName?: DataTableClassName<T>;
  headerClassName?: string;
}

export interface DataTablePaginationProps extends HTMLAttributes<HTMLElement> {
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  pageCount: number;
  canPreviousPage: boolean;
  canNextPage: boolean;
  pageSizeOptions?: readonly number[];
  onPageChange: (pageIndex: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  infoClassName?: string;
  controlsClassName?: string;
  pageSizeClassName?: string;
  actionsClassName?: string;
  previousLabel?: ReactNode;
  nextLabel?: ReactNode;
  showButtonText?: boolean;
}

export interface DataTableConfiguredProps<T> {
  data: readonly T[];
  getRowId: (row: T, index: number) => Key;
  emptyState?: ReactNode;
  loading?: boolean;
  loadingState?: ReactNode;
  error?: unknown;
  errorState?: ReactNode;
  rowClassName?: DataTableClassName<T>;
  rowActions?: DataTableRowActions<T>;
  selection?: DataTableSelection<T>;
  columnVisibility?: DataTableColumnVisibility;
  toolbar?: ReactNode;
  footer?: ReactNode;
  pagination?: DataTablePaginationProps;
}

export interface DataTableProps<T = unknown> extends HTMLAttributes<HTMLDivElement>, Partial<DataTableConfiguredProps<T>> {
  columns: string | readonly DataTableColumn<T>[];
  responsiveMinWidth?: string;
  responsiveMinWidthMobile?: string;
  children?: ReactNode;
  containerClassName?: string;
}

interface DataTableGridContextValue {
  columns: string;
}

const DataTableGridContext = createContext<DataTableGridContextValue>({ columns: "1fr" });
const noopPageChange = () => undefined;

function useDataTableColumns(): string {
  return useContext(DataTableGridContext).columns;
}

function stringifyKey(key: Key): string {
  return typeof key === "string" || typeof key === "number" ? String(key) : "";
}

function resolveClassName<T>(className: DataTableClassName<T> | undefined, row: T, index: number) {
  return typeof className === "function" ? className(row, index) : className;
}

function renderConfiguredCell<T>(column: DataTableColumn<T>, row: T, index: number): ReactNode {
  return column.render ? column.render(row, index) : null;
}

function errorMessage(error: unknown): string {
  if (typeof error === "string" && error.trim()) return error;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Nao foi possivel carregar os dados.";
}

function fallbackContent(content: ReactNode, variant: "empty" | "loading" | "error") {
  if (typeof content !== "string") return content;

  if (variant === "loading") {
    return <LoadingState text={content} animation="list" variant="frame" visible />;
  }

  return (
    <EmptyState
      variant={variant === "error" ? "error" : "table"}
      title={content}
      description={variant === "error" ? "Tente novamente em instantes." : undefined}
    />
  );
}

export function DataTable<T = unknown>({
  columns,
  className = "",
  containerClassName = "",
  responsiveMinWidth = "100%",
  responsiveMinWidthMobile = "100%",
  children,
  data,
  getRowId,
  emptyState = "Nenhum registro encontrado.",
  loading = false,
  loadingState = "Carregando...",
  error,
  errorState,
  rowClassName,
  rowActions,
  selection,
  columnVisibility,
  toolbar,
  footer,
  pagination,
  ...props
}: DataTableProps<T>) {
  const configuredColumns = typeof columns === "string"
    ? null
    : columns.filter((column) => column.visible !== false && columnVisibility?.[column.id] !== false);
  const visibleColumns = configuredColumns
    ? [
        ...(selection
          ? [{
              id: "__select",
              header: selection.renderHeader?.() ?? null,
              width: "44px",
              render: (row: T, index: number) => selection.renderCell?.(row, index, stringifyKey(getRowId?.(row, index) ?? index)) ?? null
            } satisfies DataTableColumn<T>]
          : []),
        ...configuredColumns,
        ...(rowActions
          ? [{
              id: "__actions",
              header: rowActions.header ?? "Acoes",
              width: rowActions.width,
              render: rowActions.render,
              cellClassName: rowActions.cellClassName,
              headerClassName: rowActions.headerClassName
            } satisfies DataTableColumn<T>]
          : [])
      ]
    : null;
  const gridColumns: string = visibleColumns
    ? visibleColumns.map((column) => column.width ?? "1fr").join(" ")
    : String(columns);
  const fallback =
    visibleColumns && getRowId
      ? loading
        ? { content: loadingState, variant: "loading" as const }
        : error
          ? { content: errorState ?? errorMessage(error), variant: "error" as const }
          : (data?.length ?? 0) === 0
            ? { content: emptyState, variant: "empty" as const }
          : null
      : null;
  const shouldRenderDefaultPagination = Boolean(visibleColumns && getRowId && !children && !pagination);
  const defaultPagination: DataTablePaginationProps | undefined = shouldRenderDefaultPagination
    ? {
        pageIndex: 0,
        pageSize: data?.length ?? 0,
        totalCount: data?.length ?? 0,
        pageCount: 1,
        canPreviousPage: false,
        canNextPage: false,
        onPageChange: noopPageChange
      }
    : undefined;
  const resolvedPagination = pagination ?? defaultPagination;
  const tableMarkup = (
    <div className={cn("shared-data-table", className)} {...props}>
      <div
        className="shared-data-table__scroll"
        style={
          {
            "--table-min-width": responsiveMinWidth,
            "--table-min-width-mobile": responsiveMinWidthMobile
          } as CSSProperties
        }
      >
        {children ?? (
          visibleColumns && getRowId ? (
            <>
              <DataTableHeader>
                {visibleColumns.map((column) => (
                  <DataTableCell key={column.id} className={column.headerClassName}>
                    {column.header}
                  </DataTableCell>
                ))}
              </DataTableHeader>
              <DataTableBody>
                {fallback ? (
                  <DataTableStateRow>{fallbackContent(fallback.content, fallback.variant)}</DataTableStateRow>
                ) : (
                  data?.map((row, index) => (
                    <DataTableRow
                      key={getRowId(row, index)}
                      className={resolveClassName(rowClassName, row, index)}
                      data-selected={
                        selection?.selectedRowIds[stringifyKey(getRowId(row, index))] ? "true" : undefined
                      }
                    >
                      {visibleColumns.map((column) => (
                        <DataTableCell key={column.id} className={resolveClassName(column.cellClassName, row, index)}>
                          {renderConfiguredCell(column, row, index)}
                        </DataTableCell>
                      ))}
                    </DataTableRow>
                  ))
                )}
              </DataTableBody>
            </>
          ) : null
        )}
      </div>
    </div>
  );
  const needsContainer = Boolean(toolbar || footer || resolvedPagination || containerClassName);

  return (
    <DataTableGridContext.Provider value={{ columns: gridColumns }}>
      {needsContainer ? (
        <div className={cn("shared-data-table-container", containerClassName)}>
          {toolbar ? <DataTableToolbarSlot>{toolbar}</DataTableToolbarSlot> : null}
          {tableMarkup}
          {resolvedPagination ? <DataTablePagination {...resolvedPagination} /> : null}
          {footer ? <DataTableActionsSlot>{footer}</DataTableActionsSlot> : null}
        </div>
      ) : tableMarkup}
    </DataTableGridContext.Provider>
  );
}

export interface DataTableRowLikeProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function DataTableHeader({ children, className = "", style, ...props }: DataTableRowLikeProps) {
  const columns = useDataTableColumns();
  return (
    <header
      className={cn("shared-data-table__header", className)}
      style={{ gridTemplateColumns: columns, ...style }}
      {...props}
    >
      {children}
    </header>
  );
}

export function DataTableBody({ children, className = "", ...props }: DataTableRowLikeProps) {
  return <div className={cn("shared-data-table__body", className)} {...props}>{children}</div>;
}

export function DataTableRow({ children, className = "", style, ...props }: DataTableRowLikeProps) {
  const columns = useDataTableColumns();
  return (
    <div
      className={cn("shared-data-table__row", className)}
      style={{ gridTemplateColumns: columns, ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

export function DataTableCell({ children, className = "", ...props }: DataTableRowLikeProps) {
  return <div className={cn("shared-data-table__cell", className)} {...props}>{children}</div>;
}

export function DataTableToolbarSlot({ children, className = "", ...props }: DataTableRowLikeProps) {
  return <div className={cn("shared-data-table__toolbar-slot", className)} {...props}>{children}</div>;
}

export function DataTableActionsSlot({ children, className = "", ...props }: DataTableRowLikeProps) {
  return <div className={cn("shared-data-table__actions-slot", className)} {...props}>{children}</div>;
}

export function DataTableStateRow({ children, className = "", style, ...props }: DataTableRowLikeProps) {
  return (
    <DataTableRow
      className={cn("shared-data-table__row--empty", className)}
      style={{ ...style, gridTemplateColumns: "minmax(0, 1fr)" }}
      {...props}
    >
      <DataTableCell className="shared-data-table__cell--full">{children}</DataTableCell>
    </DataTableRow>
  );
}

export function DataTableEmptyState({ children, title, description }: { children?: ReactNode; title?: ReactNode; description?: ReactNode }) {
  return (
    <DataTableStateRow>
      <EmptyState variant="table" title={title} description={description}>
        {children}
      </EmptyState>
    </DataTableStateRow>
  );
}

export function DataTableLoadingState({ text = "Carregando..." }: { text?: string }) {
  return (
    <DataTableStateRow>
      <LoadingState text={text} animation="list" variant="frame" visible />
    </DataTableStateRow>
  );
}

export function DataTableErrorState({ title = "Nao foi possivel carregar os dados.", description }: { title?: ReactNode; description?: ReactNode }) {
  return (
    <DataTableStateRow>
      <EmptyState variant="table" title={title} description={description} />
    </DataTableStateRow>
  );
}

const DEFAULT_PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

export function DataTablePagination({
  pageIndex,
  pageSize,
  totalCount,
  pageCount,
  canPreviousPage,
  canNextPage,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageChange,
  onPageSizeChange,
  className,
  infoClassName,
  controlsClassName,
  pageSizeClassName,
  actionsClassName,
  previousLabel,
  nextLabel,
  showButtonText = false,
  ...props
}: DataTablePaginationProps) {
  return (
    <footer className={cn("shared-data-table__pagination", className)} {...props}>
      <span className={cn("shared-data-table__pagination-info", infoClassName)}>
        Pagina {pageIndex + 1} de {Math.max(pageCount, 1)} - {totalCount} itens
      </span>
      <div className={cn("shared-data-table__pagination-controls", controlsClassName)}>
        {onPageSizeChange ? (
          <AppSelect
            className={cn("shared-data-table__page-size", pageSizeClassName)}
            value={String(pageSize)}
            items={pageSizeOptions.map((option) => ({ value: String(option), label: `${option} / pagina` }))}
            onValueChange={(value) => onPageSizeChange(Number(value))}
            aria-label="Itens por pagina"
          />
        ) : null}
        <div className={cn("shared-data-table__pagination-actions", actionsClassName)}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(Math.max(pageIndex - 1, 0))}
            disabled={!canPreviousPage}
            aria-label="Pagina anterior"
          >
            <AppIcon name="chevron-left" size={15} />
            {showButtonText ? previousLabel ?? "Anterior" : null}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(pageIndex + 1)}
            disabled={!canNextPage}
            aria-label="Proxima pagina"
          >
            {showButtonText ? nextLabel ?? "Proxima" : null}
            <AppIcon name="chevron-right" size={15} />
          </Button>
        </div>
      </div>
    </footer>
  );
}
