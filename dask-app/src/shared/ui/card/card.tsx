import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export type CardVariant = "default" | "interactive";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  variant?: CardVariant;
}

export function Card({ children, className = "", variant = "default", ...props }: CardProps) {
  return (
    <article className={cn("shared-card", `shared-card--${variant}`, className)} {...props}>
      {children}
    </article>
  );
}
