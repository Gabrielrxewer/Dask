import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export interface WorkspaceFrameProps {
  className?: string;
  children: ReactNode;
}

export function WorkspaceFrame({ className = "", children }: WorkspaceFrameProps) {
  return <div className={cn("workspace-frame workspace-view", className)}>{children}</div>;
}
