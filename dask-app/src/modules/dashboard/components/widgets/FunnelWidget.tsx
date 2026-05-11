import { EmptyState } from "@/shared/ui";
import type { DashboardSeriesData, DashboardSeriesItem, DashboardWidget } from "@/modules/dashboard/types";

function isSeriesData(data: unknown): data is DashboardSeriesData {
  return Boolean(data) && typeof data === "object" && Array.isArray((data as DashboardSeriesData).items);
}

export function FunnelWidget({ widget }: { widget: DashboardWidget }) {
  const items = (isSeriesData(widget.data) ? widget.data.items : []).filter((item): item is DashboardSeriesItem =>
    Number.isFinite(item.value) && item.value > 0
  );
  const max = Math.max(0, ...items.map((item) => item.value));
  const hasData = items.length > 0;

  if (!hasData) {
    return <EmptyState size="compact" variant="table" title="Sem funil" description="Nenhum card ativo para os filtros atuais." />;
  }

  return (
    <div className="dashboard-funnel" role="list" aria-label={widget.title}>
      {items.map((item, index) => {
        const scale = max > 0 ? Math.max(0.18, item.value / max) : 0.18;
        return (
          <div className="dashboard-funnel__step" key={`${item.id ?? item.label}-${index}`} role="listitem">
            <span className="dashboard-funnel__bar" style={{ transform: `scaleX(${scale})`, background: item.color ?? undefined }} />
            <span className="dashboard-funnel__label">{item.label}</span>
            <strong className="dashboard-funnel__value">{item.value}</strong>
          </div>
        );
      })}
    </div>
  );
}
