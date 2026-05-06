import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

// ── StudioSidebar ─────────────────────────────────────────────────────────────

export interface StudioSidebarProps {
  title: string;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function StudioSidebar({ title, count, action, children, footer, className }: StudioSidebarProps) {
  const heading = typeof count === "number" ? `${title} · ${count}` : title;
  return (
    <div className={cn("studio-sidebar", className)}>
      <div className="studio-sidebar__head">
        <span className="studio-sidebar__title">{heading}</span>
        {action ? <div className="studio-sidebar__action">{action}</div> : null}
      </div>
      <div className="studio-sidebar__list">{children}</div>
      {footer ? <div className="studio-sidebar__footer">{footer}</div> : null}
    </div>
  );
}

// ── StudioLayout ──────────────────────────────────────────────────────────────

export interface StudioLayoutProps {
  toolbar?: ReactNode;
  toolbarEnd?: ReactNode;
  subBar?: ReactNode;
  sidebar?: ReactNode;
  inspector?: ReactNode;
  inspectorOpen?: boolean;
  sidebarWidth?: number;
  inspectorWidth?: number;
  className?: string;
  children: ReactNode;
}

export function StudioLayout({
  toolbar,
  toolbarEnd,
  subBar,
  sidebar,
  inspector,
  inspectorOpen = true,
  sidebarWidth = 280,
  inspectorWidth = 320,
  className,
  children,
}: StudioLayoutProps) {
  const hasInspector = Boolean(inspector) && inspectorOpen;
  const hasSidebar = Boolean(sidebar);
  return (
    <div
      className={cn("studio-layout", className)}
      style={{
        "--studio-sidebar-w": `${sidebarWidth}px`,
        "--studio-inspector-w": hasInspector ? `${inspectorWidth}px` : "0px",
      } as CSSProperties}
    >
      {(toolbar || toolbarEnd) ? (
        <div className="studio-layout__toolbar">
          {toolbar ? <div className="studio-layout__toolbar-start">{toolbar}</div> : <div />}
          {toolbarEnd ? <div className="studio-layout__toolbar-end">{toolbarEnd}</div> : null}
        </div>
      ) : null}
      {subBar ? <div className="studio-layout__sub-bar">{subBar}</div> : null}
      <div className={cn(
        "studio-layout__body",
        !hasSidebar && "studio-layout__body--no-sidebar",
        hasInspector && "studio-layout__body--with-inspector"
      )}>
        {hasSidebar ? <aside className="studio-layout__sidebar">{sidebar}</aside> : null}
        <div className="studio-layout__canvas">{children}</div>
        {hasInspector ? <aside className="studio-layout__inspector">{inspector}</aside> : null}
      </div>
    </div>
  );
}
