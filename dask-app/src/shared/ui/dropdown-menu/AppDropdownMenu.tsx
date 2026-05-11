import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export interface AppDropdownMenuItemConfig {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  danger?: boolean;
  separatorBefore?: boolean;
  onSelect?: () => void;
}

export interface AppDropdownMenuProps {
  trigger: ReactNode;
  items?: AppDropdownMenuItemConfig[];
  children?: ReactNode;
  align?: DropdownMenuPrimitive.DropdownMenuContentProps["align"];
  side?: DropdownMenuPrimitive.DropdownMenuContentProps["side"];
  sideOffset?: number;
  className?: string;
}

export function AppDropdownMenu({
  trigger,
  items,
  children,
  align = "end",
  side = "bottom",
  sideOffset = 8,
  className
}: AppDropdownMenuProps) {
  return (
    <DropdownMenuPrimitive.Root>
      <DropdownMenuPrimitive.Trigger asChild>{trigger}</DropdownMenuPrimitive.Trigger>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          align={align}
          side={side}
          sideOffset={sideOffset}
          className={cn("app-dropdown-menu__content", className)}
        >
          {items?.map((item) => (
            <div key={item.id}>
              {item.separatorBefore ? <DropdownMenuPrimitive.Separator className="app-dropdown-menu__separator" /> : null}
              <DropdownMenuPrimitive.Item
                className={cn("app-dropdown-menu__item", item.danger && "app-dropdown-menu__item--danger")}
                disabled={item.disabled}
                onSelect={item.onSelect}
              >
                {item.icon ? <span className="app-dropdown-menu__item-icon">{item.icon}</span> : null}
                <span className="app-dropdown-menu__item-label">{item.label}</span>
                {item.hint ? <span className="app-dropdown-menu__item-hint">{item.hint}</span> : null}
              </DropdownMenuPrimitive.Item>
            </div>
          ))}
          {children}
        </DropdownMenuPrimitive.Content>
      </DropdownMenuPrimitive.Portal>
    </DropdownMenuPrimitive.Root>
  );
}

export const AppDropdownMenuRoot = DropdownMenuPrimitive.Root;
export const AppDropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const AppDropdownMenuContent = DropdownMenuPrimitive.Content;
export const AppDropdownMenuItem = DropdownMenuPrimitive.Item;
export const AppDropdownMenuSeparator = DropdownMenuPrimitive.Separator;

