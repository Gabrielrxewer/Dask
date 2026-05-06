import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export type InlineAlertTone = "default" | "info" | "success" | "warning" | "danger";

export interface InlineAlertProps extends HTMLAttributes<HTMLDivElement> {
  tone?: InlineAlertTone;
  title?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}

export function InlineAlert({
  tone = "default",
  title,
  action,
  children,
  className,
  role,
  ...props
}: InlineAlertProps) {
  const resolvedRole = role ?? (tone === "danger" ? "alert" : "status");

  return (
    <div
      className={cn("shared-inline-alert", `shared-inline-alert--${tone}`, className)}
      role={resolvedRole}
      {...props}
    >
      <div className="shared-inline-alert__copy">
        {title ? <strong className="shared-inline-alert__title">{title}</strong> : null}
        {children ? <div className="shared-inline-alert__body">{children}</div> : null}
      </div>
      {action ? <div className="shared-inline-alert__action">{action}</div> : null}
    </div>
  );
}
