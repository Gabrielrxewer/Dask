import type { ReactNode } from "react";
import { ErrorState } from "@/shared/ui/state/ErrorState";
import { SkeletonCard } from "@/shared/ui/state/SkeletonCard";
import { VirtualList, type VirtualListProps } from "@/shared/ui/virtual-list/VirtualList";
import { cn } from "@/shared/lib/cn";

export interface VirtualColumnProps<TItem> extends Pick<
  VirtualListProps<TItem>,
  "items" | "renderItem" | "getItemKey" | "overscan" | "emptyState"
> {
  title?: ReactNode;
  subtitle?: ReactNode;
  count?: number;
  actions?: ReactNode;
  footer?: ReactNode;
  isLoading?: boolean;
  error?: ReactNode;
  estimateCardSize?: number | ((index: number) => number);
  className?: string;
  listClassName?: string;
  viewportClassName?: string;
}

export function VirtualColumn<TItem,>({
  title,
  subtitle,
  count,
  actions,
  footer,
  isLoading,
  error,
  estimateCardSize = 132,
  className,
  listClassName,
  viewportClassName,
  ...listProps
}: VirtualColumnProps<TItem>) {
  return (
    <section className={cn("app-virtual-column", className)}>
      {title || subtitle || typeof count === "number" || actions ? (
        <header className="app-virtual-column__header">
          <div className="app-virtual-column__title-group">
            {title ? <h3>{title}</h3> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <div className="app-virtual-column__meta">
            {typeof count === "number" ? <span className="app-virtual-column__count">{count}</span> : null}
            {actions}
          </div>
        </header>
      ) : null}

      {isLoading ? (
        <div className="app-virtual-column__loading" aria-hidden="true">
          <SkeletonCard />
          <SkeletonCard compact />
          <SkeletonCard />
        </div>
      ) : error ? (
        <ErrorState title="Erro na coluna" description={error} />
      ) : (
        <VirtualList
          {...listProps}
          estimateSize={estimateCardSize}
          className={cn("app-virtual-column__list", listClassName)}
          viewportClassName={cn("app-virtual-column__viewport", viewportClassName)}
        />
      )}

      {footer ? <footer className="app-virtual-column__footer">{footer}</footer> : null}
    </section>
  );
}

