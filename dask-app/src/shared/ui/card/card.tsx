import type { HTMLAttributes, ReactNode } from "react";

type CardVariant = "default" | "interactive";

interface CardProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  variant?: CardVariant;
}

export function Card({ children, className = "", variant = "default", ...props }: CardProps) {
  return (
    <article className={`shared-card shared-card--${variant} ${className}`.trim()} {...props}>
      {children}
    </article>
  );
}
