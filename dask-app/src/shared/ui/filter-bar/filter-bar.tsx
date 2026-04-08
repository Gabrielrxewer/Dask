import type { HTMLAttributes, ReactNode } from "react";

interface FilterBarProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function FilterBar({ className = "", children, ...props }: FilterBarProps) {
  return (
    <div className={`shared-filter-bar ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
