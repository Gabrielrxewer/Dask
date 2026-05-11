import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export interface AppTooltipProps {
  children: ReactNode;
  content: ReactNode;
  side?: TooltipPrimitive.TooltipContentProps["side"];
  align?: TooltipPrimitive.TooltipContentProps["align"];
  delayDuration?: number;
  disabled?: boolean;
  className?: string;
}

export function AppTooltip({
  children,
  content,
  side = "top",
  align = "center",
  delayDuration = 300,
  disabled = false,
  className
}: AppTooltipProps) {
  if (disabled || content === null || content === undefined) {
    return <>{children}</>;
  }

  return (
    <TooltipPrimitive.Provider delayDuration={delayDuration}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content side={side} align={align} sideOffset={8} className={cn("app-tooltip__content", className)}>
            {content}
            <TooltipPrimitive.Arrow className="app-tooltip__arrow" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

export const AppTooltipProvider = TooltipPrimitive.Provider;
export const AppTooltipRoot = TooltipPrimitive.Root;
export const AppTooltipTrigger = TooltipPrimitive.Trigger;
export const AppTooltipContent = TooltipPrimitive.Content;

