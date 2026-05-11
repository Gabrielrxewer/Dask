import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import type { CSSProperties, ReactNode } from "react";
import { useRef } from "react";
import { cn } from "@/shared/lib/cn";

export interface VirtualListProps<TItem> {
  items: TItem[];
  estimateSize: number | ((index: number) => number);
  renderItem: (item: TItem, index: number, virtualItem: VirtualItem) => ReactNode;
  getItemKey?: (item: TItem, index: number) => string | number;
  overscan?: number;
  emptyState?: ReactNode;
  className?: string;
  viewportClassName?: string;
  contentClassName?: string;
  itemClassName?: string;
  style?: CSSProperties;
  viewportStyle?: CSSProperties;
}

export function VirtualList<TItem,>({
  items,
  estimateSize,
  renderItem,
  getItemKey,
  overscan = 6,
  emptyState,
  className,
  viewportClassName,
  contentClassName,
  itemClassName,
  style,
  viewportStyle
}: VirtualListProps<TItem>) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => viewportRef.current,
    estimateSize: typeof estimateSize === "function" ? estimateSize : () => estimateSize,
    overscan,
    getItemKey: getItemKey ? (index) => getItemKey(items[index], index) : undefined
  });

  if (!items.length && emptyState) {
    return (
      <div className={cn("app-virtual-list", className)} style={style}>
        {emptyState}
      </div>
    );
  }

  return (
    <div className={cn("app-virtual-list", className)} style={style}>
      <div ref={viewportRef} className={cn("app-virtual-list__viewport", viewportClassName)} style={viewportStyle}>
        <div
          className={cn("app-virtual-list__content", contentClassName)}
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const item = items[virtualItem.index];
            return (
              <div
                key={virtualItem.key}
                ref={virtualizer.measureElement}
                data-index={virtualItem.index}
                className={cn("app-virtual-list__item", itemClassName)}
                style={{ transform: `translateY(${virtualItem.start}px)` }}
              >
                {renderItem(item, virtualItem.index, virtualItem)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

