import { ModuleTabs } from "@/shared/ui";
import { DASHBOARD_TABS, type DashboardTabId } from "@/modules/dashboard/model";

export function DashboardTabs({
  activeTab,
  onTabChange
}: {
  activeTab: DashboardTabId;
  onTabChange: (tab: DashboardTabId) => void;
}) {
  return (
    <nav className="dashboard-tabs" aria-label="Secoes do dashboard">
      <ModuleTabs<DashboardTabId>
        value={activeTab}
        items={DASHBOARD_TABS.map((tab) => ({ id: tab.id, label: tab.label }))}
        onChange={onTabChange}
        ariaLabel="Dashboards disponiveis"
        className="dashboard-tabs__list"
        variant="underline"
      />
    </nav>
  );
}
