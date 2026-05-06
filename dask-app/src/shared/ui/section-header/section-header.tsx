import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export interface SectionHeaderProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  badge?: ReactNode;
}

export function SectionHeader({
  title,
  description,
  eyebrow,
  action,
  secondaryAction,
  badge,
  className,
  ...props
}: SectionHeaderProps) {
  const hasMeta = Boolean(eyebrow || badge);
  const hasActions = Boolean(action || secondaryAction);

  return (
    <header className={cn("shared-section-header", className)} {...props}>
      <div className="shared-section-header__copy">
        {hasMeta ? (
          <div className="shared-section-header__meta">
            {eyebrow ? <span className="shared-section-header__eyebrow">{eyebrow}</span> : null}
            {badge ? <span className="shared-section-header__badge">{badge}</span> : null}
          </div>
        ) : null}
        <h2 className="shared-section-header__title">{title}</h2>
        {description ? <p className="shared-section-header__description">{description}</p> : null}
      </div>
      {hasActions ? (
        <div className="shared-section-header__actions">
          {secondaryAction}
          {action}
        </div>
      ) : null}
    </header>
  );
}
