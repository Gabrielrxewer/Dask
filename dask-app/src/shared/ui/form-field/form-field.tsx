import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export interface FormFieldProps {
  label: string;
  className?: string;
  children: ReactNode;
}

export function FormField({ label, className = "", children }: FormFieldProps) {
  return (
    <label className={cn("shared-form-field", className)}>
      <span className="shared-form-field__label">{label}</span>
      {children}
    </label>
  );
}
