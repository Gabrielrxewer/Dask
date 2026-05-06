import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { Section } from "@/shared/ui/section";
import { WorkspaceFrame } from "@/shared/ui/workspace-frame";
import type { WorkspaceFrameScroll, WorkspaceFrameVariant } from "@/shared/ui/workspace-frame";

interface BasePageTemplateProps {
  className?: string;
  frameClassName?: string;
  variant?: WorkspaceFrameVariant;
  scroll?: WorkspaceFrameScroll;
  children: ReactNode;
}

export interface DashboardPageTemplateProps extends BasePageTemplateProps {
  metrics?: ReactNode;
  toolbar?: ReactNode;
}

export function DashboardPageTemplate({
  className,
  frameClassName,
  variant = "dashboard",
  scroll = "content",
  metrics,
  toolbar,
  children
}: DashboardPageTemplateProps) {
  return (
    <WorkspaceFrame className={cn("shared-page-template shared-page-template--dashboard", frameClassName)} variant={variant} scroll={scroll}>
      {toolbar ? <div className="shared-page-template__toolbar">{toolbar}</div> : null}
      {metrics ? <div className="shared-page-template__metrics">{metrics}</div> : null}
      <div className={cn("shared-page-template__content", className)}>{children}</div>
    </WorkspaceFrame>
  );
}

export interface ResourceListPageTemplateProps extends BasePageTemplateProps {
  title: ReactNode;
  description?: ReactNode;
  toolbar?: ReactNode;
  loading?: ReactNode;
  sectionClassName?: string;
  sectionContentClassName?: string;
}

export function ResourceListPageTemplate({
  className,
  frameClassName,
  variant = "table",
  scroll = "none",
  title,
  description,
  toolbar,
  loading,
  sectionClassName,
  sectionContentClassName,
  children
}: ResourceListPageTemplateProps) {
  return (
    <WorkspaceFrame className={cn("shared-page-template shared-page-template--resource-list", frameClassName)} variant={variant} scroll={scroll}>
      {loading}
      {toolbar ? <div className="shared-page-template__toolbar">{toolbar}</div> : null}
      <Section
        title={title}
        subtitle={description}
        className={cn("shared-page-template__section", sectionClassName)}
        contentClassName={sectionContentClassName}
      >
        <div className={cn("shared-page-template__content", className)}>{children}</div>
      </Section>
    </WorkspaceFrame>
  );
}

export interface SettingsPageTemplateProps extends BasePageTemplateProps {
  tabs?: ReactNode;
  aside?: ReactNode;
}

export function SettingsPageTemplate({ className, frameClassName, variant = "editor", scroll = "none", tabs, aside, children }: SettingsPageTemplateProps) {
  return (
    <WorkspaceFrame className={cn("shared-page-template shared-page-template--settings", frameClassName)} variant={variant} scroll={scroll}>
      {tabs ? <div className="shared-page-template__tabs">{tabs}</div> : null}
      <div className={cn("shared-page-template__split", className)}>
        {aside ? <aside className="shared-page-template__aside">{aside}</aside> : null}
        <div className="shared-page-template__content">{children}</div>
      </div>
    </WorkspaceFrame>
  );
}

export interface DetailPreviewTemplateProps extends BasePageTemplateProps {
  header?: ReactNode;
  preview?: ReactNode;
  footer?: ReactNode;
}

export function DetailPreviewTemplate({
  className,
  frameClassName,
  header,
  preview,
  footer,
  children
}: DetailPreviewTemplateProps) {
  return (
    <div className={cn("shared-page-template shared-page-template--detail-preview", frameClassName)}>
      {header ? <div className="shared-page-template__header">{header}</div> : null}
      <div className={cn("shared-page-template__split", className)}>
        <div className="shared-page-template__content">{children}</div>
        {preview ? <aside className="shared-page-template__preview">{preview}</aside> : null}
      </div>
      {footer ? <div className="shared-page-template__footer">{footer}</div> : null}
    </div>
  );
}

export interface BuilderPageTemplateProps extends BasePageTemplateProps {
  palette?: ReactNode;
  inspector?: ReactNode;
  header?: ReactNode;
}

export function BuilderPageTemplate({
  className,
  frameClassName,
  variant = "editor",
  scroll = "none",
  palette,
  inspector,
  header,
  children
}: BuilderPageTemplateProps) {
  return (
    <WorkspaceFrame className={cn("shared-page-template shared-page-template--builder", frameClassName)} variant={variant} scroll={scroll}>
      {header ? <div className="shared-page-template__header">{header}</div> : null}
      <div className={cn("shared-page-template__builder-grid", className)}>
        {palette ? <aside className="shared-page-template__palette">{palette}</aside> : null}
        <div className="shared-page-template__canvas">{children}</div>
        {inspector ? <aside className="shared-page-template__inspector">{inspector}</aside> : null}
      </div>
    </WorkspaceFrame>
  );
}
