import { EmptyState } from "@/shared/ui";
import { getDashboardTabConfig, type DashboardTabId } from "@/modules/dashboard/model";

export function DashboardEmptyState({ activeTab }: { activeTab: DashboardTabId }) {
  const tab = getDashboardTabConfig(activeTab);

  return (
    <EmptyState
      className="dashboard-empty-state"
      variant="centered"
      title={tab.emptyTitle}
      description={tab.emptyDescription}
    />
  );
}
