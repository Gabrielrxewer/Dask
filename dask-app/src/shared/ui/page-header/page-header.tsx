import type { ReactNode } from "react";

interface PageHeaderProps {
  label?: string;
  title: string;
  actions?: ReactNode;
}

export function PageHeader({ label, title, actions }: PageHeaderProps) {
  return (
    <header className="shared-page-header">
      <div>
        {label ? <p className="shared-page-header__label">{label}</p> : null}
        <h1 className="shared-page-header__title">{title}</h1>
      </div>
      {actions ? <div>{actions}</div> : null}
    </header>
  );
}
