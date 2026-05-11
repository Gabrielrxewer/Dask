import type { DashboardWidget as DashboardWidgetContract } from "@/modules/dashboard/types";
import { DashboardWidgetCard } from "./DashboardWidgetCard";
import { WidgetRenderer } from "./WidgetRenderer";

export function DashboardWidget({ widget }: { widget: DashboardWidgetContract }) {
  return (
    <DashboardWidgetCard widget={widget}>
      <WidgetRenderer widget={widget} />
    </DashboardWidgetCard>
  );
}
