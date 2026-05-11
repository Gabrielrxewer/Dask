import * as SelectPrimitive from "@radix-ui/react-select";
import type { ReactNode } from "react";
import { AppIcon } from "@/shared/ui/icon";
import { cn } from "@/shared/lib/cn";

export interface AppSelectItem<TValue extends string = string> {
  value: TValue;
  label: ReactNode;
  disabled?: boolean;
  description?: ReactNode;
}

export interface AppSelectProps<TValue extends string = string> {
  items: Array<AppSelectItem<TValue>>;
  value?: TValue;
  defaultValue?: TValue;
  onValueChange?: (value: TValue) => void;
  placeholder?: ReactNode;
  disabled?: boolean;
  name?: string;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  "aria-label"?: string;
}

export function AppSelect<TValue extends string = string>({
  items,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Selecione",
  disabled,
  name,
  className,
  triggerClassName,
  contentClassName,
  "aria-label": ariaLabel
}: AppSelectProps<TValue>) {
  return (
    <SelectPrimitive.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={(nextValue) => onValueChange?.(nextValue as TValue)}
      disabled={disabled}
      name={name}
    >
      <SelectPrimitive.Trigger
        className={cn("app-select__trigger shared-select__control", triggerClassName, className)}
        aria-label={ariaLabel}
      >
        <SelectPrimitive.Value className="app-select__value" placeholder={placeholder} />
        <SelectPrimitive.Icon className="app-select__icon">
          <AppIcon name="chevron-down" size={16} strokeWidth={2} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className={cn("app-select__content shared-select__menu", contentClassName)} position="popper" sideOffset={6}>
          <SelectPrimitive.Viewport className="app-select__viewport">
            {items.map((item) => (
              <SelectPrimitive.Item
                key={item.value}
                value={item.value}
                disabled={item.disabled}
                className="app-select__item shared-select__option"
              >
                <SelectPrimitive.ItemText>
                  <span className="app-select__item-label">{item.label}</span>
                  {item.description ? <span className="app-select__item-description">{item.description}</span> : null}
                </SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="app-select__item-indicator">
                  <AppIcon name="check" size={15} strokeWidth={2.2} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
