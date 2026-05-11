import type { ReactNode } from "react";

interface WorkItemInlineEditableCellProps {
  children: ReactNode;
  pending?: boolean;
}

export function WorkItemInlineEditableCell({ children, pending = false }: WorkItemInlineEditableCellProps) {
  return (
    <span className={pending ? "work-item-inline-editable-cell is-pending" : "work-item-inline-editable-cell"}>
      {children}
    </span>
  );
}
