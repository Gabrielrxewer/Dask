import { cn } from "@/shared/lib/cn";
import type { CSSProperties, ReactNode } from "react";

type SkeletonSize = number | string;

function sizeToCss(value: SkeletonSize | undefined): string | number | undefined {
  return typeof value === "number" ? `${value}px` : value;
}

export interface SkeletonBlockProps {
  width?: SkeletonSize;
  height?: SkeletonSize;
  minHeight?: SkeletonSize;
  flex?: CSSProperties["flex"];
  className?: string;
  style?: CSSProperties;
  ariaHidden?: boolean;
}

export function SkeletonBlock({
  width,
  height,
  minHeight,
  flex,
  className,
  style,
  ariaHidden = true
}: SkeletonBlockProps) {
  return (
    <div
      className={cn("shared-skeleton-block", className)}
      style={{
        width: sizeToCss(width),
        height: sizeToCss(height),
        minHeight: sizeToCss(minHeight),
        flex,
        ...style
      }}
      aria-hidden={ariaHidden}
    />
  );
}

export interface SkeletonLayoutProps {
  count?: number;
  direction?: "row" | "column";
  gap?: SkeletonSize;
  className?: string;
  blockClassName?: string;
  blockProps?: SkeletonBlockProps;
  children?: ReactNode;
  ariaHidden?: boolean;
}

export function SkeletonLayout({
  count = 1,
  direction = "row",
  gap,
  className,
  blockClassName,
  blockProps,
  children,
  ariaHidden = true
}: SkeletonLayoutProps) {
  return (
    <div
      className={cn("shared-skeleton-layout", `shared-skeleton-layout--${direction}`, className)}
      style={{ gap: sizeToCss(gap) }}
      aria-hidden={ariaHidden}
    >
      {children ??
        Array.from({ length: count }, (_, index) => (
          <SkeletonBlock
            key={index}
            {...blockProps}
            className={cn(blockProps?.className, blockClassName)}
            ariaHidden={ariaHidden}
          />
        ))}
    </div>
  );
}

export interface SkeletonColumnsProps {
  count?: number;
  columnWidth?: SkeletonSize;
  minHeight?: SkeletonSize;
  gap?: SkeletonSize;
  className?: string;
  blockClassName?: string;
  ariaHidden?: boolean;
}

export function SkeletonColumns({
  count = 3,
  columnWidth = 265,
  minHeight = 360,
  gap = 10,
  className,
  blockClassName,
  ariaHidden = true
}: SkeletonColumnsProps) {
  return (
    <SkeletonLayout
      count={count}
      direction="row"
      gap={gap}
      className={className}
      blockClassName={blockClassName}
      ariaHidden={ariaHidden}
      blockProps={{
        flex: `0 0 ${sizeToCss(columnWidth)}`,
        height: "100%",
        minHeight
      }}
    />
  );
}
