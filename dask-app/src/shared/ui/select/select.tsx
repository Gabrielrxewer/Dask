import type { SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {}

export function Select({ className = "", children, ...props }: SelectProps) {
  return (
    <select className={`shared-select ${className}`.trim()} {...props}>
      {children}
    </select>
  );
}
