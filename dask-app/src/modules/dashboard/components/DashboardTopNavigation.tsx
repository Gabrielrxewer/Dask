import { AppIcon, WorkspaceActionButton, WorkspaceTopNavigation } from "@/shared/ui";
import { DASHBOARD_TABS, type DashboardTabId } from "@/modules/dashboard/model";

interface DashboardTopNavigationProps {
  activeTab: DashboardTabId;
  activeFilterCount: number;
  isRefreshing: boolean;
  generatedAt?: string;
  onTabChange: (tab: DashboardTabId) => void;
  onOpenFilters: () => void;
  onResetFilters: () => void;
  onRefresh: () => void;
}

function formatGeneratedAt(value: string | undefined): string {
  if (!value) {
    return "Aguardando dados";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Data indisponivel";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function DashboardTopNavigation({
  activeTab,
  activeFilterCount,
  isRefreshing,
  generatedAt,
  onTabChange,
  onOpenFilters,
  onResetFilters,
  onRefresh
}: DashboardTopNavigationProps) {
  return (
    <WorkspaceTopNavigation
      className="dashboard-top-navigation"
      tabsClassName="dashboard-top-navigation__tabs"
      value={activeTab}
      items={DASHBOARD_TABS.map((tab) => ({ id: tab.id, label: tab.label }))}
      onChange={onTabChange}
      ariaLabel="Dashboards disponiveis"
      actions={
        <>
          <WorkspaceActionButton
            className={activeFilterCount > 0 ? "dashboard-top-navigation__button dashboard-top-navigation__button--active" : "dashboard-top-navigation__button"}
            label={activeFilterCount > 0 ? `Filtros ativos: ${activeFilterCount}` : "Filtros"}
            onClick={onOpenFilters}
            icon={<AppIcon name="filter" />}
          />
          <WorkspaceActionButton
            className="dashboard-top-navigation__button"
            label={isRefreshing ? "Atualizando dashboard" : `Atualizar dashboard. Atualizado: ${formatGeneratedAt(generatedAt)}`}
            disabled={isRefreshing}
            onClick={onRefresh}
            icon={<AppIcon name="refresh" />}
          />
          <WorkspaceActionButton
            className="dashboard-top-navigation__button"
            label="Limpar filtros"
            disabled={activeFilterCount === 0}
            onClick={onResetFilters}
            icon={<AppIcon name="x" />}
          />
        </>
      }
    />
  );
}
