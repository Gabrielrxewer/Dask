import { useMemo, useState } from "react";
import { buildBoardMetrics } from "@/entities/task";
import { useCurrentWorkspace } from "@/modules/workspace";
import type { WorkspaceSnapshot } from "@/modules/workspace/model";
import { useDashboardFilters, useDashboardOverview } from "@/modules/dashboard/hooks";
import { buildDashboardKpis, getDashboardWidgetsForTab, type DashboardTabId } from "@/modules/dashboard/model";
import type { DashboardFilterOptions, DashboardFilters as DashboardFiltersState, DashboardResponse } from "@/modules/dashboard/types";
import { InlineAlert, WorkspaceFrame } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { DashboardEmptyState } from "./DashboardEmptyState";
import { DashboardErrorState } from "./DashboardErrorState";
import { DashboardFilterModal } from "./DashboardFilterModal";
import { buildDashboardFilterChips, DashboardFilters } from "./DashboardFilters";
import { DashboardGrid } from "./DashboardGrid";
import { DashboardSkeleton } from "./DashboardSkeleton";
import { DashboardSummary } from "./DashboardSummary";
import { DashboardTopNavigation } from "./DashboardTopNavigation";
import "./dashboard-page.css";

const automationStatuses = [
  { id: "queued", label: "Na fila" },
  { id: "running", label: "Em execucao" },
  { id: "waiting", label: "Aguardando" },
  { id: "completed", label: "Concluido" },
  { id: "failed", label: "Falhou" },
  { id: "cancelled", label: "Cancelado" },
  { id: "pending", label: "Aprovacao pendente" }
];

function buildFilterOptions(snapshot: WorkspaceSnapshot | null): DashboardFilterOptions {
  const membersById = snapshot?.membersById ?? {};

  return {
    members: Object.values(membersById).map((member) => ({
      id: member.id,
      label: member.name
    })),
    itemTypes: (snapshot?.itemTypes ?? [])
      .filter((itemType) => itemType.isActive)
      .map((itemType) => ({ id: itemType.id, label: itemType.name })),
    states: (snapshot?.workflowStates ?? [])
      .filter((state) => state.isActive)
      .map((state) => ({ id: state.id, label: state.name })),
    columns: (snapshot?.boardColumns ?? [])
      .filter((column) => column.isActive)
      .sort((left, right) => left.order - right.order)
      .map((column) => ({ id: column.id, label: column.name })),
    workflows: (snapshot?.automations ?? []).map((workflow) => ({
      id: workflow.id,
      label: workflow.title
    })),
    automationStatuses
  };
}

export interface DashboardPageViewProps {
  dashboard: DashboardResponse | null;
  filters: DashboardFiltersState;
  filterOptions: DashboardFilterOptions;
  activeTab: DashboardTabId;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function DashboardPageView({
  dashboard,
  filters,
  filterOptions,
  activeTab,
  isLoading,
  error,
  onRefresh
}: DashboardPageViewProps) {
  const widgets = dashboard?.widgets ?? [];
  const tabWidgets = getDashboardWidgetsForTab(activeTab, widgets);
  const tabKpis = buildDashboardKpis(activeTab, widgets);
  const hasTabContent = tabKpis.length > 0 || tabWidgets.length > 0;
  const isInitialLoading = isLoading && !dashboard;
  const hasActiveFilterChips = buildDashboardFilterChips(filters, filterOptions).length > 0;

  return (
    <WorkspaceFrame
      className="dashboard-page workspace-view"
      variant="dashboard"
      scroll="none"
    >
      <div className="dashboard-page__scroll">
        <div className="dashboard-page__layout">
          {hasActiveFilterChips ? (
            <div className="dashboard-page__filters-region">
              <DashboardFilters filters={filters} options={filterOptions} />
            </div>
          ) : null}

          {isInitialLoading ? (
            <div className="dashboard-page__state-region">
              <DashboardSkeleton activeTab={activeTab} />
            </div>
          ) : null}

          {!isInitialLoading && error && !dashboard ? (
            <div className="dashboard-page__state-region">
              <DashboardErrorState message={error} onRetry={onRefresh} />
            </div>
          ) : null}

          {!isInitialLoading && error && dashboard ? (
            <div className="dashboard-page__feedback-region">
              <InlineAlert tone="warning">Nao foi possivel atualizar agora. Mantivemos os ultimos dados carregados.</InlineAlert>
            </div>
          ) : null}

          {!isInitialLoading && !error && !hasTabContent ? (
            <div className="dashboard-page__state-region">
              <DashboardEmptyState activeTab={activeTab} />
            </div>
          ) : null}

          {!isInitialLoading && hasTabContent ? (
            <div className="dashboard-page__data-region">
              <div className="dashboard-page__kpi-region">
                <DashboardSummary activeTab={activeTab} widgets={widgets} />
              </div>
              <div className="dashboard-page__widgets-region">
                <DashboardGrid activeTab={activeTab} widgets={widgets} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </WorkspaceFrame>
  );
}

export function DashboardPage() {
  const { snapshot } = useCurrentWorkspace();
  const [activeTab, setActiveTab] = useState<DashboardTabId>("overview");
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const { filters, applyFilters, resetFilters, activeFilterCount } = useDashboardFilters();
  const { dashboard, isLoading, error, reload } = useDashboardOverview(filters);
  const metrics = useMemo(() => buildBoardMetrics(snapshot?.tasks ?? []), [snapshot?.tasks]);
  const filterOptions = useMemo(() => buildFilterOptions(snapshot), [snapshot]);
  const topNavigation = (
    <DashboardTopNavigation
      activeTab={activeTab}
      activeFilterCount={activeFilterCount}
      isRefreshing={isLoading}
      generatedAt={dashboard?.generatedAt}
      onTabChange={setActiveTab}
      onOpenFilters={() => setIsFilterModalOpen(true)}
      onResetFilters={resetFilters}
      onRefresh={reload}
    />
  );

  return (
    <AppShell metrics={metrics} pageLabel="Workspace" pageTitle="Dashboard" hidePageHeader hideSidebarBrandMark topNavigation={topNavigation}>
      {isFilterModalOpen ? (
        <DashboardFilterModal
          filters={filters}
          options={filterOptions}
          onApply={applyFilters}
          onReset={resetFilters}
          onClose={() => setIsFilterModalOpen(false)}
        />
      ) : null}
      <DashboardPageView
        dashboard={dashboard}
        filters={filters}
        filterOptions={filterOptions}
        activeTab={activeTab}
        isLoading={isLoading}
        error={error}
        onRefresh={reload}
      />
    </AppShell>
  );
}
