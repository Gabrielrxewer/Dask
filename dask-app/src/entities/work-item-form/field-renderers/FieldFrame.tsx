import type { ReactNode } from "react";

export function FieldFrame({ label, description, error, children }: {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="work-item-form-field">
      <span className="work-item-form-field__label">{label}</span>
      {description ? <span className="work-item-form-field__description">{description}</span> : null}
      {children}
      {error ? <span className="work-item-form-field__error">{error}</span> : null}
    </label>
  );
}

