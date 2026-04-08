import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

interface DataTableProps {
  columns: string;
  className?: string;
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
  children
}: DataTableProps) {
  return (
    <DataTableGridContext.Provider value={{ columns }}>
      <div className={cn("shared-data-table", className)}>
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

interface RowLikeProps {
  children: ReactNode;
  className?: string;
}

export function DataTableHeader({ children, className = "" }: RowLikeProps) {
  const columns = useDataTableColumns();
  return (
    <header className={cn("shared-data-table__header", className)} style={{ gridTemplateColumns: columns }}>
      {children}
    </header>
  );
}

export function DataTableBody({ children, className = "" }: RowLikeProps) {
  return <div className={cn("shared-data-table__body", className)}>{children}</div>;
}

export function DataTableRow({ children, className = "" }: RowLikeProps) {
  const columns = useDataTableColumns();
  return (
    <div className={cn("shared-data-table__row", className)} style={{ gridTemplateColumns: columns }}>
      {children}
    </div>
  );
}

export function DataTableCell({ children, className = "" }: RowLikeProps) {
  return <div className={cn("shared-data-table__cell", className)}>{children}</div>;
}
