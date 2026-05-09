import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export interface RegistrationListProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  summary?: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  surfaceClassName?: string;
  contentClassName?: string;
}

export function RegistrationList({
  title,
  description,
  actions,
  summary,
  toolbar,
  footer,
  children,
  className,
  headerClassName,
  surfaceClassName,
  contentClassName
}: RegistrationListProps) {
  return (
    <section className={cn("shared-registration-list", className)}>
      <header className={cn("shared-registration-list__header", headerClassName)}>
        <div className="shared-registration-list__heading">
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        {actions ? <div className="shared-registration-list__actions">{actions}</div> : null}
      </header>

      {summary ? <div className="shared-registration-list__summary">{summary}</div> : null}

      <div className={cn("shared-registration-list__surface", surfaceClassName)}>
        {toolbar ? <div className="shared-registration-list__toolbar">{toolbar}</div> : null}
        <div className={cn("shared-registration-list__content", contentClassName)}>{children}</div>
        {footer ? <div className="shared-registration-list__footer">{footer}</div> : null}
      </div>
    </section>
  );
}
