import type { ComponentProps } from "react";
import { DashboardFilter } from "@/features/dashboard-filter";
import { WorkspaceTopNavigation } from "@/shared/ui";
import type { AvailabilityMode } from "./agenda-page.model";

interface AgendaTopNavigationProps {
  availabilityMode: AvailabilityMode;
  filter: Pick<ComponentProps<typeof DashboardFilter>, "query" | "mineOnly">;
  onModeChange: (mode: AvailabilityMode) => void;
  onQueryChange: ComponentProps<typeof DashboardFilter>["onQueryChange"];
  onMineToggle: ComponentProps<typeof DashboardFilter>["onMineToggle"];
}

export function AgendaTopNavigation({
  availabilityMode,
  filter,
  onModeChange,
  onQueryChange,
  onMineToggle
}: AgendaTopNavigationProps) {
  return (
    <WorkspaceTopNavigation<AvailabilityMode>
      value={availabilityMode}
      items={[
        { id: "people", label: "Pessoas" },
        { id: "resources", label: "Recursos" }
      ]}
      onChange={onModeChange}
      ariaLabel="Modo da agenda"
      className="agenda-top-nav"
      tabsClassName="agenda-top-nav__tabs"
      itemClassName="agenda-top-nav__tab"
      activeItemClassName="agenda-top-nav__tab--active"
      actionsClassName="agenda-top-nav__filter shared-actions-row"
      actions={
        <DashboardFilter
          query={filter.query}
          mineOnly={filter.mineOnly}
          onQueryChange={onQueryChange}
          onMineToggle={onMineToggle}
        />
      }
    />
  );
}
