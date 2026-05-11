import type { ReactNode } from "react";

export interface PageHeaderProps {
  label?: string;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ label, title, subtitle, actions }: PageHeaderProps) {
  return (
    <header className="shared-page-header">
      <div>
        {label ? <p className="shared-page-header__label">{label}</p> : null}
        <h1 className="shared-page-header__title">{title}</h1>
        {subtitle ? <p className="shared-page-header__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div>{actions}</div> : null}
    </header>
  );
}
