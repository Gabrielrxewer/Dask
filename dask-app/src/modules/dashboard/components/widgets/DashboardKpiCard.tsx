import { AppIcon, MetricCard, SkeletonBlock } from "@/shared/ui";
import type { DashboardKpiView } from "@/modules/dashboard/model";

export function DashboardKpiCard({
  item,
  loading = false
}: {
  item?: DashboardKpiView;
  loading?: boolean;
}) {
  if (loading || !item) {
    return (
      <article className="dashboard-kpi-card dashboard-kpi-card--loading" aria-busy="true">
        <SkeletonBlock width={34} height={34} />
        <SkeletonBlock width="62%" height={11} />
        <SkeletonBlock width="34%" height={26} />
        <SkeletonBlock width="76%" height={10} />
      </article>
    );
  }

  return (
    <MetricCard
      className="dashboard-kpi-card"
      label={item.label}
      value={item.value}
      subtitle={item.subtitle}
      helpText={item.description}
      icon={<AppIcon name={item.icon} size={18} />}
      accent={item.accent}
      compact
      empty={item.unavailable}
    />
  );
}
