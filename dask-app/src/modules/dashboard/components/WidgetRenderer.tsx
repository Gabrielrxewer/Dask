import { EmptyState } from "@/shared/ui";
import type { DashboardWidget as DashboardWidgetContract } from "@/modules/dashboard/types";
import { BarChartWidget } from "@/modules/dashboard/components/widgets/BarChartWidget";
import { FunnelWidget } from "@/modules/dashboard/components/widgets/FunnelWidget";
import { KpiWidget } from "@/modules/dashboard/components/widgets/KpiWidget";
import { LineChartWidget } from "@/modules/dashboard/components/widgets/LineChartWidget";
import { TableWidget } from "@/modules/dashboard/components/widgets/TableWidget";

export function UnsupportedWidget({ widget }: { widget: DashboardWidgetContract }) {
  return (
    <EmptyState
      size="compact"
      variant="card"
      title="Widget nao suportado"
      description={`Tipo ${widget.type} ainda nao possui renderer.`}
    />
  );
}

export function UnavailableWidget({ widget }: { widget: DashboardWidgetContract }) {
  return (
    <EmptyState
      size="compact"
      variant="card"
      title="Metrica indisponivel"
      description={widget.unavailableReason ?? "Esta metrica ainda nao pode ser calculada com os dados atuais."}
    />
  );
}

export function WidgetRenderer({ widget }: { widget: DashboardWidgetContract }) {
  if (widget.status === "unavailable") {
    return <UnavailableWidget widget={widget} />;
  }

  switch (widget.type) {
    case "kpi":
      return <KpiWidget widget={widget} />;
    case "bar":
      return <BarChartWidget widget={widget} />;
    case "line":
      return <LineChartWidget widget={widget} />;
    case "funnel":
      return <FunnelWidget widget={widget} />;
    case "table":
      return <TableWidget widget={widget} />;
    case "pie":
      return <BarChartWidget widget={widget} variant="pie" />;
    default:
      return <UnsupportedWidget widget={widget} />;
  }
}
