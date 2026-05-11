import { useMemo, useState } from "react";
import { EmptyState } from "@/shared/ui";
import type { DashboardSeriesData, DashboardSeriesItem, DashboardWidget } from "@/modules/dashboard/types";

function isSeriesData(data: unknown): data is DashboardSeriesData {
  return Boolean(data) && typeof data === "object" && Array.isArray((data as DashboardSeriesData).items);
}

function normalizeItems(items: DashboardSeriesItem[]): DashboardSeriesItem[] {
  return items
    .filter((item) => Number.isFinite(item.value))
    .sort((left, right) => right.value - left.value);
}

export function BarChartWidget({ widget, variant = "bar" }: { widget: DashboardWidget; variant?: "bar" | "pie" }) {
  const [showZeroItems, setShowZeroItems] = useState(false);
  const items = useMemo(() => normalizeItems(isSeriesData(widget.data) ? widget.data.items : []), [widget.data]);
  const max = Math.max(0, ...items.map((item) => item.value));
  const hasData = items.some((item) => item.value > 0);
  const zeroItemsCount = items.filter((item) => item.value === 0).length;
  const visibleItems = showZeroItems || !hasData ? items : items.filter((item) => item.value > 0);

  if (!hasData) {
    return <EmptyState size="compact" variant="table" title="Sem dados" description="Nenhum registro encontrado para os filtros atuais." />;
  }

  return (
    <div className={`dashboard-chart dashboard-chart--${variant}`} aria-label={widget.title}>
      <div className="dashboard-chart__list" role="list">
        {visibleItems.map((item, index) => {
          const width = max > 0 ? Math.max(item.value > 0 ? 6 : 0, (item.value / max) * 100) : 0;
          return (
            <div className="dashboard-chart__row" key={`${item.id ?? item.label}-${index}`} role="listitem">
              <div className="dashboard-chart__label">
                <span className="dashboard-chart__dot" style={{ background: item.color ?? undefined }} />
                <span>{item.label}</span>
              </div>
              <div className="dashboard-chart__track" aria-hidden="true">
                <span className="dashboard-chart__bar" style={{ width: `${width}%`, background: item.color ?? undefined }} />
              </div>
              <strong className="dashboard-chart__value">{item.value}</strong>
            </div>
          );
        })}
      </div>

      {zeroItemsCount > 0 ? (
        <button className="dashboard-chart__zero-toggle" type="button" onClick={() => setShowZeroItems((current) => !current)}>
          {showZeroItems ? "Ocultar etapas zeradas" : `Mostrar etapas zeradas (${zeroItemsCount})`}
        </button>
      ) : null}
    </div>
  );
}
