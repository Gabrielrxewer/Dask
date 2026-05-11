import { buildDashboardKpis, type DashboardTabId } from "@/modules/dashboard/model";
import type { DashboardWidget } from "@/modules/dashboard/types";
import { DashboardKpiCard } from "./widgets/DashboardKpiCard";

export function DashboardSummary({
  activeTab,
  widgets,
  loading = false
}: {
  activeTab: DashboardTabId;
  widgets: DashboardWidget[];
  loading?: boolean;
}) {
  if (loading && widgets.length === 0) {
    return (
      <section className="dashboard-summary" aria-label="Indicadores principais" aria-busy="true">
        {Array.from({ length: activeTab === "automation" ? 3 : 4 }, (_, index) => (
          <DashboardKpiCard key={index} loading />
        ))}
      </section>
    );
  }

  const kpis = buildDashboardKpis(activeTab, widgets);
  if (kpis.length === 0) {
    return null;
  }

  return (
    <section className={`dashboard-summary dashboard-summary--count-${kpis.length}`} aria-label="Indicadores principais">
      {kpis.map((item) => (
        <DashboardKpiCard key={item.id} item={item} />
      ))}
    </section>
  );
}
