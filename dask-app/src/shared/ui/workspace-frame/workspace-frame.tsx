import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

export type WorkspaceFrameVariant = "dashboard" | "table" | "kanban" | "canvas" | "editor";
export type WorkspaceFrameScroll = "content" | "page" | "none";

export interface WorkspaceFrameProps {
  className?: string;
  contentClassName?: string;
  variant?: WorkspaceFrameVariant;
  scroll?: WorkspaceFrameScroll;
  header?: ReactNode;
  toolbar?: ReactNode;
  tabs?: ReactNode;
  children: ReactNode;
}

export function WorkspaceFrame({
  className = "",
  contentClassName,
  variant = "dashboard",
  scroll = "content",
  header,
  toolbar,
  tabs,
  children
}: WorkspaceFrameProps) {
  const hasShellSlots = Boolean(header || toolbar || tabs);

  return (
    <div
      className={cn(
        "workspace-frame workspace-view workspace-page-shell",
        `workspace-page-shell--${variant}`,
        `workspace-page-shell--scroll-${scroll}`,
        className
      )}
      data-page-shell-variant={variant}
      data-page-shell-scroll={scroll}
    >
      {header ? <div className="workspace-page-shell__header">{header}</div> : null}
      {tabs ? <div className="workspace-page-shell__tabs">{tabs}</div> : null}
      {toolbar ? <div className="workspace-page-shell__toolbar">{toolbar}</div> : null}
      {hasShellSlots ? (
        <div className={cn("workspace-page-shell__content", contentClassName)}>{children}</div>
      ) : (
        children
      )}
    </div>
  );
}
