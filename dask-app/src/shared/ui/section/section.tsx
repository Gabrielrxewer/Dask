import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { SectionHeader } from "@/shared/ui/section-header";

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
      <SectionHeader className="shared-section__header" title={title} description={subtitle} action={actions} />
      <div className={cn("shared-section__content", contentClassName)}>{children}</div>
    </section>
  );
}
