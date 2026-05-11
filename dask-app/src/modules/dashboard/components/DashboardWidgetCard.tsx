import type { ReactNode } from "react";
import { SectionCard, StatusBadge } from "@/shared/ui";
import { cn } from "@/shared/lib/cn";
import type { DashboardWidget } from "@/modules/dashboard/types";

const WIDE_WIDGET_IDS = new Set([
  "cards-by-column",
  "commercial-funnel",
  "automation-failures-by-workflow"
]);

function getLayoutClass(widget: DashboardWidget): string {
  if (widget.type === "kpi") {
    return "dashboard-widget-card--compact";
  }

  if (WIDE_WIDGET_IDS.has(widget.id) || widget.type === "table" || widget.type === "funnel") {
    return "dashboard-widget-card--wide";
  }

  return "dashboard-widget-card--medium";
}

export function DashboardWidgetCard({
  widget,
  children
}: {
  widget: DashboardWidget;
  children: ReactNode;
}) {
  return (
    <SectionCard
      className={cn("dashboard-widget-card", `dashboard-widget-card--${widget.type}`, getLayoutClass(widget))}
      contentClassName="dashboard-widget-card__content"
      title={widget.title}
      subtitle={widget.description}
      action={
        widget.status === "unavailable" ? (
          <StatusBadge size="sm" tone="warning">Indisponivel</StatusBadge>
        ) : null
      }
      data-widget-id={widget.id}
    >
      {children}
    </SectionCard>
  );
}
