import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

interface SectionProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Section({ title, subtitle, actions, className = "", children }: SectionProps) {
  return (
    <section className={cn("shared-section", className)}>
      <header className="shared-section__header">
        <div>
          <h2 className="shared-section__title">{title}</h2>
          {subtitle ? <p className="shared-section__subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div>{actions}</div> : null}
      </header>
      <div className="shared-section__content">{children}</div>
    </section>
  );
}
