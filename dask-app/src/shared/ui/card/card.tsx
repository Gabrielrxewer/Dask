import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export type CardVariant = "default" | "compact" | "metric" | "featured" | "interactive";
export type CardAccent = "blue" | "green" | "purple" | "amber" | "success" | "warning" | "danger" | "info";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  variant?: CardVariant;
  interactive?: boolean;
  accent?: CardAccent;
}

export function Card({
  children,
  className = "",
  variant = "default",
  interactive = false,
  accent,
  ...props
}: CardProps) {
  const visualVariant = variant === "interactive" ? "default" : variant;
  const isInteractive = interactive || variant === "interactive";

  return (
    <article
      className={cn(
        "shared-card",
        `shared-card--${visualVariant}`,
        isInteractive && "shared-card--interactive",
        accent && `shared-card--accent-${accent}`,
        className
      )}
      {...props}
    >
      {children}
    </article>
  );
}
