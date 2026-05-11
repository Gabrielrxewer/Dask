import * as PopoverPrimitive from "@radix-ui/react-popover";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export interface AppPopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: PopoverPrimitive.PopoverContentProps["align"];
  side?: PopoverPrimitive.PopoverContentProps["side"];
  sideOffset?: number;
  modal?: boolean;
  className?: string;
  contentClassName?: string;
}

export function AppPopover({
  trigger,
  children,
  open,
  defaultOpen,
  onOpenChange,
  align = "start",
  side = "bottom",
  sideOffset = 8,
  modal = false,
  className,
  contentClassName
}: AppPopoverProps) {
  return (
    <PopoverPrimitive.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} modal={modal}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          side={side}
          sideOffset={sideOffset}
          className={cn("app-popover__content", className, contentClassName)}
        >
          {children}
          <PopoverPrimitive.Arrow className="app-popover__arrow" />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export const AppPopoverRoot = PopoverPrimitive.Root;
export const AppPopoverTrigger = PopoverPrimitive.Trigger;
export const AppPopoverContent = PopoverPrimitive.Content;
export const AppPopoverClose = PopoverPrimitive.Close;

