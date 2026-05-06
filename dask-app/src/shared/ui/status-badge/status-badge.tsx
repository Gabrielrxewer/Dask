import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export type StatusBadgeTone = "default" | "neutral" | "muted" | "success" | "warning" | "danger" | "error" | "info";
export type StatusBadgeSize = "sm" | "md";
export type StatusBadgeKind =
  | "tag"
  | "priority"
  | "draft"
  | "active"
  | "sent"
  | "approved"
  | "paid"
  | "pending"
  | "error"
  | "warning"
  | "neutral";

export interface StatusBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: StatusBadgeTone;
  kind?: StatusBadgeKind;
  size?: StatusBadgeSize;
  dot?: boolean;
  count?: ReactNode;
  pill?: boolean;
  className?: string;
  children?: ReactNode;
}

export function StatusBadge({
  tone = "default",
  kind,
  size = "md",
  dot = false,
  count,
  pill = true,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  const content = children ?? count;
  const resolvedTone: StatusBadgeTone =
    tone !== "default" || !kind
      ? tone
      : kind === "active" || kind === "approved" || kind === "paid" || kind === "sent"
        ? "success"
        : kind === "pending" || kind === "draft" || kind === "warning"
          ? "warning"
          : kind === "error"
            ? "danger"
            : kind === "neutral" || kind === "tag" || kind === "priority"
              ? "muted"
              : "default";

  return (
    <span
      className={cn(
        "shared-status-badge",
        `shared-status-badge--${resolvedTone}`,
        kind && `shared-status-badge--kind-${kind}`,
        `shared-status-badge--${size}`,
        pill && "shared-status-badge--pill",
        dot && "shared-status-badge--with-dot",
        count !== undefined && "shared-status-badge--count",
        className
      )}
      {...props}
    >
      {dot ? <span className="shared-status-badge__dot" aria-hidden="true" /> : null}
      {content}
    </span>
  );
}
