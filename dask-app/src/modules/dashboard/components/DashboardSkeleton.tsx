import { SkeletonBlock } from "@/shared/ui";
import { DashboardSummary } from "./DashboardSummary";
import type { DashboardTabId } from "@/modules/dashboard/model";

export function DashboardSkeleton({ activeTab }: { activeTab: DashboardTabId }) {
  return (
    <div className="dashboard-skeleton" aria-label="Carregando dashboard" aria-busy="true">
      <DashboardSummary activeTab={activeTab} widgets={[]} loading />
      <section className="dashboard-grid dashboard-grid--loading" aria-label="Widgets carregando">
        {Array.from({ length: 4 }, (_, index) => (
          <article className="dashboard-widget-skeleton" key={index}>
            <div className="dashboard-widget-skeleton__header">
              <SkeletonBlock width="44%" height={16} />
              <SkeletonBlock width={76} height={22} />
            </div>
            <div className="dashboard-widget-skeleton__body">
              <SkeletonBlock width="100%" height={12} />
              <SkeletonBlock width="86%" height={12} />
              <SkeletonBlock width="72%" height={12} />
              <SkeletonBlock width="58%" height={12} />
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
