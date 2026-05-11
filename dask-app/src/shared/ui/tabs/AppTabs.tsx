import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export interface AppTabsItem<TValue extends string = string> {
  value: TValue;
  label: ReactNode;
  content?: ReactNode;
  disabled?: boolean;
  badge?: ReactNode;
}

export interface AppTabsProps<TValue extends string = string> {
  items: Array<AppTabsItem<TValue>>;
  value?: TValue;
  defaultValue?: TValue;
  onValueChange?: (value: TValue) => void;
  ariaLabel?: string;
  className?: string;
  listClassName?: string;
  triggerClassName?: string;
  contentClassName?: string;
}

export function AppTabs<TValue extends string = string>({
  items,
  value,
  defaultValue,
  onValueChange,
  ariaLabel,
  className,
  listClassName,
  triggerClassName,
  contentClassName
}: AppTabsProps<TValue>) {
  return (
    <TabsPrimitive.Root
      className={cn("app-tabs", className)}
      value={value}
      defaultValue={defaultValue ?? items[0]?.value}
      onValueChange={(nextValue) => onValueChange?.(nextValue as TValue)}
    >
      <TabsPrimitive.List className={cn("app-tabs__list shared-tabs", listClassName)} aria-label={ariaLabel}>
        {items.map((item) => (
          <TabsPrimitive.Trigger
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            className={cn("app-tabs__trigger shared-tabs__item", triggerClassName)}
          >
            <span className="shared-tabs__label">{item.label}</span>
            {item.badge ? <span className="shared-tabs__badge">{item.badge}</span> : null}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {items.map((item) =>
        item.content ? (
          <TabsPrimitive.Content key={item.value} value={item.value} className={cn("app-tabs__content", contentClassName)}>
            {item.content}
          </TabsPrimitive.Content>
        ) : null
      )}
    </TabsPrimitive.Root>
  );
}

export const AppTabsRoot = TabsPrimitive.Root;
export const AppTabsList = TabsPrimitive.List;
export const AppTabsTrigger = TabsPrimitive.Trigger;
export const AppTabsContent = TabsPrimitive.Content;

