import type { ReactNode } from "react";
import { DrawerShellFrame } from "@/shared/ui/drawer-shell";
import type { DrawerShellFrameProps } from "@/shared/ui/drawer-shell";
import { cn } from "@/shared/lib/cn";

export type SidePanelVariant = "inspector" | "details" | "config";

export interface SidePanelProps extends Omit<DrawerShellFrameProps, "subtitle"> {
  description?: ReactNode;
  variant?: SidePanelVariant;
}

export function SidePanel({ description, variant = "details", className, bodyClassName, ...props }: SidePanelProps) {
  return (
    <DrawerShellFrame
      {...props}
      subtitle={description}
      className={cn("shared-side-panel", `shared-side-panel--${variant}`, className)}
      bodyClassName={cn("shared-side-panel__body", bodyClassName)}
    />
  );
}
