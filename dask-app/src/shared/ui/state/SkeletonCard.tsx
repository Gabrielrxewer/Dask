import type { HTMLAttributes } from "react";
import { SkeletonBlock, SkeletonLayout } from "@/shared/ui/skeleton";
import { cn } from "@/shared/lib/cn";

export interface SkeletonCardProps extends HTMLAttributes<HTMLDivElement> {
  lines?: number;
  compact?: boolean;
}

export function SkeletonCard({ lines = 3, compact = false, className, ...props }: SkeletonCardProps) {
  return (
    <div className={cn("app-skeleton-card", compact && "app-skeleton-card--compact", className)} {...props}>
      <div className="app-skeleton-card__header">
        <SkeletonBlock width="42%" height={12} />
        <SkeletonBlock width={34} height={18} />
      </div>
      <SkeletonLayout direction="column" gap={8}>
        {Array.from({ length: lines }, (_, index) => (
          <SkeletonBlock
            key={index}
            width={index === lines - 1 ? "62%" : "100%"}
            height={compact ? 8 : 10}
          />
        ))}
      </SkeletonLayout>
      {!compact ? (
        <div className="app-skeleton-card__footer">
          <SkeletonBlock width={58} height={18} />
          <SkeletonBlock width={78} height={18} />
        </div>
      ) : null}
    </div>
  );
}

