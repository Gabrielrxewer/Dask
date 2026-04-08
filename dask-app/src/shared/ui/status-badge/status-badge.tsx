import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

type StatusBadgeTone = "default" | "success" | "warning";

interface StatusBadgeProps {
  tone?: StatusBadgeTone;
  children: ReactNode;
}

export function StatusBadge({ tone = "default", children }: StatusBadgeProps) {
  return <span className={cn("shared-status-badge", `shared-status-badge--${tone}`)}>{children}</span>;
}
