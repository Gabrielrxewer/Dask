import type { ReactNode } from "react";
import { DataTableCell } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";

interface WorkItemDataGridCellProps {
  children: ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
}

export function WorkItemDataGridCell({ children, align = "left", className }: WorkItemDataGridCellProps) {
  return (
    <DataTableCell className={cn("work-item-data-grid__cell", `work-item-data-grid__cell--${align}`, className)}>
      {children}
    </DataTableCell>
  );
}
