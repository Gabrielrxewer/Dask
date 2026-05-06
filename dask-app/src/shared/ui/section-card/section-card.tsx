import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export type SectionCardDensity = "default" | "compact" | "spacious";

export interface SectionCardProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  footer?: ReactNode;
  density?: SectionCardDensity;
  selected?: boolean;
  muted?: boolean;
  elevated?: boolean;
  interactive?: boolean;
  contentClassName?: string;
  children: ReactNode;
}

export function SectionCard({
  title,
  subtitle,
  action,
  footer,
  density = "default",
  selected = false,
  muted = false,
  elevated = false,
  interactive = false,
  className,
  contentClassName,
  children,
  ...props
}: SectionCardProps) {
  const hasHeader = title || subtitle || action;

  return (
    <section
      className={cn(
        "shared-section-card",
        `shared-section-card--${density}`,
        selected && "shared-section-card--selected",
        muted && "shared-section-card--muted",
        elevated && "shared-section-card--elevated",
        interactive && "shared-section-card--interactive",
        className
      )}
      {...props}
    >
      {hasHeader ? (
        <header className="shared-section-card__header">
          <div className="shared-section-card__heading">
            {title ? <h2>{title}</h2> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {action ? <div className="shared-section-card__action">{action}</div> : null}
        </header>
      ) : null}
      <div className={cn("shared-section-card__content", contentClassName)}>{children}</div>
      {footer ? <footer className="shared-section-card__footer">{footer}</footer> : null}
    </section>
  );
}
