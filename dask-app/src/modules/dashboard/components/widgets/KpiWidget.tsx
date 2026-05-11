import type { DashboardKpiData, DashboardWidget } from "@/modules/dashboard/types";

function isKpiData(data: unknown): data is DashboardKpiData {
  if (!data || typeof data !== "object" || !("value" in data)) {
    return false;
  }

  return typeof (data as DashboardKpiData).value === "number";
}

function formatKpiValue(value: number, unit?: string): string {
  const formatted = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function KpiWidget({ widget }: { widget: DashboardWidget }) {
  const data = isKpiData(widget.data) ? widget.data : { value: 0 };

  return (
    <div className="dashboard-kpi-widget">
      <strong>{formatKpiValue(data.value, data.unit)}</strong>
      {widget.description ? <span>{widget.description}</span> : null}
    </div>
  );
}
