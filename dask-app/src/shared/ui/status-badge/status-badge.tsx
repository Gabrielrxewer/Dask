import type { ReactNode } from "react";

type StatusBadgeTone = "default" | "success" | "warning";

interface StatusBadgeProps {
  tone?: StatusBadgeTone;
  children: ReactNode;
}

export function StatusBadge({ tone = "default", children }: StatusBadgeProps) {
  return <span className={`shared-status-badge shared-status-badge--${tone}`.trim()}>{children}</span>;
}
