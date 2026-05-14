import * as SwitchPrimitive from "@radix-ui/react-switch";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export interface AppSwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  description?: ReactNode;
  name?: string;
  value?: string;
  className?: string;
  "aria-label"?: string;
}

export function AppSwitch({
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
}: AppSwitchProps) {
  const control = (
    <SwitchPrimitive.Root
      className="app-switch__root"
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      name={name}
      value={value}
      aria-label={ariaLabel}
    >
      <SwitchPrimitive.Thumb className="app-switch__thumb" />
    </SwitchPrimitive.Root>
  );

  if (!label && !description) {
    return control;
  }

  return (
    <label className={cn("app-switch", className)}>
      {control}
      <span className="app-switch__copy">
        {label ? <span className="app-switch__label">{label}</span> : null}
        {description ? <span className="app-switch__description">{description}</span> : null}
      </span>
    </label>
  );
}
