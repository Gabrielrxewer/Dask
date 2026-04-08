import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { routePaths } from "@/app/router/route-paths";
import { useGlobalChrome } from "@/app/layout";
import type { BoardMetrics } from "@/entities/task";
import type { DashboardFilterState } from "@/features/dashboard-filter";
import { DashboardFilter } from "@/features/dashboard-filter";
import { CreateTaskButton } from "@/features/create-task";
import type { CreateTaskInput } from "@/modules/workspace";
import { PageHeader } from "@/shared/ui";
import "./app-shell.css";

interface AppShellProps {
  metrics: BoardMetrics;
  pageLabel?: string;
  pageTitle?: string;
  topNavigation?: ReactNode;
  filter?: DashboardFilterState;
  onFilterQueryChange?: (query: string) => void;
  onMineToggle?: () => void;
  onCreateTask?: (input: CreateTaskInput) => void | Promise<void>;
  noPageScroll?: boolean;
  children: ReactNode;
}

const navGroups = [
  {
    title: "Planejamento",
    items: [
      { to: routePaths.board, label: "Board" },
      { to: routePaths.list, label: "List" },
      { to: routePaths.timeline, label: "Timeline" }
    ]
  },
  {
    title: "Operacao",
    items: [
      { to: routePaths.automations, label: "Automations" },
      { to: routePaths.settings, label: "Settings" }
    ]
  }
];

export function AppShell({
  metrics,
  pageLabel = "Workspace",
  pageTitle = "Dask Platform",
  topNavigation,
  filter,
  onFilterQueryChange,
  onMineToggle,
  onCreateTask,
  noPageScroll = false,
  children
}: AppShellProps) {
  const { isSidebarOpen, closeNavigation } = useGlobalChrome();
  const filterProps =
    filter && onFilterQueryChange && onMineToggle
      ? {
          query: filter.query,
          mineOnly: filter.mineOnly,
          onQueryChange: onFilterQueryChange,
          onMineToggle
        }
      : null;

  return (
    <div
      className={`app-shell ${noPageScroll ? "app-shell--no-scroll" : ""} ${
        isSidebarOpen ? "app-shell--nav-open" : ""
      }`.trim()}
    >
      <div className="app-shell__noise" />
      <button type="button" className="app-shell__nav-backdrop" aria-label="Fechar menu" onClick={closeNavigation} />

      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__brand-mark">D</span>
          <div>
            <p className="sidebar__brand-title">Dask</p>
            <p className="sidebar__brand-subtitle">Universal Workflow</p>
          </div>
        </div>

        {onCreateTask ? <CreateTaskButton onCreate={onCreateTask} /> : null}

        <nav className="sidebar__menu">
          {navGroups.map((group) => (
            <section className="sidebar__menu-group" key={group.title}>
              <p className="sidebar__menu-title">{group.title}</p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={closeNavigation}
                  className={({ isActive }) =>
                    `sidebar__menu-link ${isActive ? "sidebar__menu-link--active" : ""}`.trim()
                  }
                >
                  <span className="sidebar__menu-link-mark" />
                  {item.label}
                </NavLink>
              ))}
            </section>
          ))}
        </nav>

        <div className="sidebar__foot">
          <p className="sidebar__menu-title">Ciclo atual</p>
          <div className="sidebar__sprint-card">
            <p className="sidebar__sprint-name">Entrega principal</p>
            <p className="sidebar__sprint-meta">{`${metrics.active} itens ativos`}</p>
            <div className="sidebar__track">
              <div className="sidebar__fill" style={{ width: `${metrics.donePercent}%` }} />
            </div>
          </div>
        </div>
      </aside>

      <div className="workspace">
        {topNavigation ? <div className="workspace__top-nav">{topNavigation}</div> : null}
        <PageHeader label={pageLabel} title={pageTitle} actions={filterProps ? <DashboardFilter {...filterProps} /> : null} />

        <main className="workspace__content">{children}</main>
      </div>
    </div>
  );
}
