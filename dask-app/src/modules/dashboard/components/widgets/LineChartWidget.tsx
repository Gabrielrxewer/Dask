import { BarChartWidget } from "./BarChartWidget";
import type { DashboardWidget } from "@/modules/dashboard/types";

export function LineChartWidget({ widget }: { widget: DashboardWidget }) {
  return <BarChartWidget widget={widget} variant="bar" />;
}
