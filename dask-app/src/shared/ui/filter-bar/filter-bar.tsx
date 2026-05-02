import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export interface FilterBarProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function FilterBar({ className = "", children, ...props }: FilterBarProps) {
  return (
    <div className={cn("shared-filter-bar", className)} {...props}>
      {children}
    </div>
  );
}
