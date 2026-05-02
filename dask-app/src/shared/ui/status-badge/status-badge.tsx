import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export type StatusBadgeTone = "default" | "muted" | "success" | "warning" | "danger" | "info";
export type StatusBadgeSize = "sm" | "md";

export interface StatusBadgeProps {
  tone?: StatusBadgeTone;
  size?: StatusBadgeSize;
  dot?: boolean;
  count?: ReactNode;
  pill?: boolean;
  className?: string;
  children?: ReactNode;
}

export function StatusBadge({
  tone = "default",
  size = "md",
  dot = false,
  count,
  pill = true,
  className,
  children
}: StatusBadgeProps) {
  const content = children ?? count;

  return (
    <span
      className={cn(
        "shared-status-badge",
        `shared-status-badge--${tone}`,
        `shared-status-badge--${size}`,
        pill && "shared-status-badge--pill",
        dot && "shared-status-badge--with-dot",
        count !== undefined && "shared-status-badge--count",
        className
      )}
    >
      {dot ? <span className="shared-status-badge__dot" aria-hidden="true" /> : null}
      {content}
    </span>
  );
}
