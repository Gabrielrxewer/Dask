import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  children?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  size?: "default" | "compact";
  variant?: "default" | "centered" | "card" | "table" | "canvas" | "error" | "permission" | "loading";
}

export function EmptyState({
  children,
  title,
  description,
  icon,
  action,
  primaryAction,
  secondaryAction,
  size = "default",
  variant = "default",
  className,
  ...props
}: EmptyStateProps) {
  const actions = action ?? (primaryAction || secondaryAction ? (
    <>
      {primaryAction}
      {secondaryAction}
    </>
  ) : null);

  if (!title && !description && !icon && !actions) {
    return (
      <p
        className={cn("shared-empty-state", `shared-empty-state--${size}`, `shared-empty-state--${variant}`, className)}
        {...props}
      >
        {children}
      </p>
    );
  }

  return (
    <div
      className={cn(
        "shared-empty-state",
        "shared-empty-state--structured",
        `shared-empty-state--${size}`,
        `shared-empty-state--${variant}`,
        className
      )}
      {...props}
    >
      {icon ? <span className="shared-empty-state__icon" aria-hidden="true">{icon}</span> : null}
      {title ? <strong className="shared-empty-state__title">{title}</strong> : null}
      {description ? <p className="shared-empty-state__description">{description}</p> : null}
      {children}
      {actions ? <div className="shared-empty-state__actions">{actions}</div> : null}
    </div>
  );
}
