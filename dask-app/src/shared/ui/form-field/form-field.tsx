import type { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  className?: string;
  children: ReactNode;
}

export function FormField({ label, className = "", children }: FormFieldProps) {
  return (
    <label className={`shared-form-field ${className}`.trim()}>
      <span className="shared-form-field__label">{label}</span>
      {children}
    </label>
  );
}
