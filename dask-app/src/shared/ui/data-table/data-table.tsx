import { createContext, useContext, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export interface DataTableProps extends HTMLAttributes<HTMLDivElement> {
  columns: string;
  responsiveMinWidth?: string;
  responsiveMinWidthMobile?: string;
  children: ReactNode;
}

interface DataTableGridContextValue {
  columns: string;
}

const DataTableGridContext = createContext<DataTableGridContextValue>({ columns: "1fr" });

function useDataTableColumns(): string {
  return useContext(DataTableGridContext).columns;
}

export function DataTable({
  columns,
  className = "",
  responsiveMinWidth = "100%",
  responsiveMinWidthMobile = "100%",
  children,
  ...props
}: DataTableProps) {
  return (
    <DataTableGridContext.Provider value={{ columns }}>
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
          {children}
        </div>
      </div>
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
      style={{ ...style, gridTemplateColumns: columns }}
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
      style={{ ...style, gridTemplateColumns: columns }}
      {...props}
    >
      {children}
    </div>
  );
}

export function DataTableCell({ children, className = "", ...props }: DataTableRowLikeProps) {
  return <div className={cn("shared-data-table__cell", className)} {...props}>{children}</div>;
}
