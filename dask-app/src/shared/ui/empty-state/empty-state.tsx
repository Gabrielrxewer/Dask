import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export interface EmptyStateProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
}

export function EmptyState({ children, className, ...props }: EmptyStateProps) {
  return (
    <p className={cn("shared-empty-state", className)} {...props}>
      {children}
    </p>
  );
}
