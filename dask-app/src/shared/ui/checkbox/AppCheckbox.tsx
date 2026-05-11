import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import type { ReactNode } from "react";
import { AppIcon } from "@/shared/ui/icon";
import { cn } from "@/shared/lib/cn";

export interface AppCheckboxProps {
  checked?: boolean | "indeterminate";
  defaultChecked?: boolean | "indeterminate";
  onCheckedChange?: (checked: boolean | "indeterminate") => void;
  disabled?: boolean;
  label?: ReactNode;
  description?: ReactNode;
  name?: string;
  value?: string;
  className?: string;
  "aria-label"?: string;
}

export function AppCheckbox({
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  label,
  description,
  name,
  value,
  className,
  "aria-label": ariaLabel
}: AppCheckboxProps) {
  const control = (
    <CheckboxPrimitive.Root
      className="app-checkbox__control"
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      name={name}
      value={value}
      aria-label={ariaLabel}
    >
      <CheckboxPrimitive.Indicator className="app-checkbox__indicator">
        {checked === "indeterminate" ? (
          <AppIcon name="minus" size={14} strokeWidth={2.4} />
        ) : (
          <AppIcon name="check" size={14} strokeWidth={2.4} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );

  if (!label && !description) {
    return control;
  }

  return (
    <label className={cn("app-checkbox", className)}>
      {control}
      <span className="app-checkbox__copy">
        {label ? <span className="app-checkbox__label">{label}</span> : null}
        {description ? <span className="app-checkbox__description">{description}</span> : null}
      </span>
    </label>
  );
}
