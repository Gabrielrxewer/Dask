import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

type CardVariant = "default" | "interactive";

interface CardProps extends HTMLAttributes<HTMLElement> {
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
