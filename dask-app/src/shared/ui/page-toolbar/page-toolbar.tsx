import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export interface PageToolbarProps {
  className?: string;
  start?: ReactNode;
  search?: ReactNode;
  filters?: ReactNode;
  viewActions?: ReactNode;
  secondaryActions?: ReactNode;
  primaryAction?: ReactNode;
  end?: ReactNode;
  children?: ReactNode;
  compact?: boolean;
  ariaLabel?: string;
}

export function PageToolbar({
  className,
  start,
  search,
  filters,
  viewActions,
  secondaryActions,
  primaryAction,
  end,
  children,
  compact = false,
  ariaLabel = "Acoes da pagina"
}: PageToolbarProps) {
  return (
    <section className={cn("shared-page-toolbar", compact && "shared-page-toolbar--compact", className)} aria-label={ariaLabel}>
      {start ? <div className="shared-page-toolbar__start">{start}</div> : null}
      {search ? <div className="shared-page-toolbar__search">{search}</div> : null}
      {filters ? <div className="shared-page-toolbar__filters">{filters}</div> : null}
      {children ? <div className="shared-page-toolbar__content">{children}</div> : null}
      {viewActions ? <div className="shared-page-toolbar__view-actions">{viewActions}</div> : null}
      {secondaryActions ? <div className="shared-page-toolbar__secondary">{secondaryActions}</div> : null}
      {primaryAction ? <div className="shared-page-toolbar__primary">{primaryAction}</div> : null}
      {end ? <div className="shared-page-toolbar__end">{end}</div> : null}
    </section>
  );
}
