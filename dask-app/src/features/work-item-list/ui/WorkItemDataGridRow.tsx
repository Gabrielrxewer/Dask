import type { CSSProperties, ReactNode } from "react";
import { DataTableRow } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";

interface WorkItemDataGridRowProps {
  children: ReactNode;
  selected?: boolean;
  virtualStyle?: CSSProperties;
}

export function WorkItemDataGridRow({ children, selected = false, virtualStyle }: WorkItemDataGridRowProps) {
  return (
    <DataTableRow
      className={cn("work-item-data-grid__row", selected && "is-selected")}
      style={virtualStyle}
      data-selected={selected ? "true" : undefined}
    >
      {children}
    </DataTableRow>
  );
}
