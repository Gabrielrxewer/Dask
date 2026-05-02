import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export interface SectionProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  contentClassName?: string;
  children: ReactNode;
}

export function Section({
  title,
  subtitle,
  actions,
  className = "",
  contentClassName,
  children,
  ...props
}: SectionProps) {
  return (
    <section className={cn("shared-section", className)} {...props}>
      <header className="shared-section__header">
        <div>
          <h2 className="shared-section__title">{title}</h2>
          {subtitle ? <p className="shared-section__subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div>{actions}</div> : null}
      </header>
      <div className={cn("shared-section__content", contentClassName)}>{children}</div>
    </section>
  );
}
