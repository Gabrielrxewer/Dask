import type { DashboardWidget as DashboardWidgetContract } from "@/modules/dashboard/types";
import { getDashboardWidgetsForTab, type DashboardTabId } from "@/modules/dashboard/model";
import { DashboardWidget } from "./DashboardWidget";

export function DashboardGrid({
  widgets,
  activeTab
}: {
  widgets: DashboardWidgetContract[];
  activeTab: DashboardTabId;
}) {
  const tabWidgets = getDashboardWidgetsForTab(activeTab, widgets);

  if (tabWidgets.length === 0) {
    return null;
  }

  return (
    <section className="dashboard-grid" aria-label="Widgets do dashboard">
      {tabWidgets.map((widget) => (
        <DashboardWidget key={widget.id} widget={widget} />
      ))}
    </section>
  );
}
