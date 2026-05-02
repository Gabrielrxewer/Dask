import { cn } from "@/shared/lib/cn";
import type { ReactNode } from "react";

export interface ResourceSectionProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  empty?: boolean | ReactNode;
  emptyTitle?: ReactNode;
  emptyDescription?: ReactNode;
  className?: string;
  contentClassName?: string;
  variant?: "section" | "plain";
}

function renderEmptyState(empty: ResourceSectionProps["empty"], emptyTitle: ReactNode, emptyDescription: ReactNode) {
  if (empty && empty !== true) {
    return empty;
  }

  return (
    <div className="shared-resource-section__empty">
      {emptyTitle ? <strong>{emptyTitle}</strong> : null}
      {emptyDescription ? <p>{emptyDescription}</p> : null}
    </div>
  );
}

export function ResourceSection({
  title,
  subtitle,
  actions,
  children,
  empty = false,
  emptyTitle = "Nenhum item encontrado.",
  emptyDescription,
  className,
  contentClassName,
  variant = "section"
}: ResourceSectionProps) {
  const hasHeader = Boolean(title || subtitle || actions);
  const framed = variant === "section";

  return (
    <section className={cn("shared-resource-section", framed && "shared-section", className)}>
      {hasHeader ? (
        <header className={cn("shared-resource-section__header", framed && "shared-section__header")}>
          <div>
            {title ? <h2 className={cn("shared-resource-section__title", framed && "shared-section__title")}>{title}</h2> : null}
            {subtitle ? <p className={cn("shared-resource-section__subtitle", framed && "shared-section__subtitle")}>{subtitle}</p> : null}
          </div>
          {actions ? <div className="shared-resource-section__actions">{actions}</div> : null}
        </header>
      ) : null}
      <div className={cn("shared-resource-section__content", framed && "shared-section__content", contentClassName)}>
        {empty ? renderEmptyState(empty, emptyTitle, emptyDescription) : children}
      </div>
    </section>
  );
}
