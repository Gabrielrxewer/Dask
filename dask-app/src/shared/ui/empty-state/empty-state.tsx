import type { ReactNode } from "react";

interface EmptyStateProps {
  children: ReactNode;
}

export function EmptyState({ children }: EmptyStateProps) {
  return <p className="shared-empty-state">{children}</p>;
}
