import type { ReactNode } from "react";
import { NavLink, useParams } from "react-router-dom";
import {
  buildWorkspaceAutomationsPath,
  buildWorkspaceBoardPath,
  buildWorkspaceListPath,
  buildWorkspaceSettingsPath,
  buildWorkspaceTimelinePath
} from "@/app/router/route-paths";
import { useGlobalChrome } from "@/app/layout";
import type { BoardMetrics } from "@/entities/task";
import type { DashboardFilterState } from "@/features/dashboard-filter";
import { DashboardFilter } from "@/features/dashboard-filter";
import { CreateTaskButton } from "@/features/create-task";
import type { CreateTaskInput } from "@/modules/workspace";
import daskLogoMark from "@/shared/assets/dask-logo-mark.svg";
import { cn } from "@/shared/lib/cn";
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
  createTaskTypes?: Array<{ id: string; label: string }>;
  noPageScroll?: boolean;
  hideSidebarBrandMark?: boolean;
  children: ReactNode;
}

export function AppShell({
  metrics,
  pageLabel = "Workspace",
  pageTitle = "Dask Platform",
  topNavigation,
  filter,
  onFilterQueryChange,
  onMineToggle,
  onCreateTask,
  createTaskTypes,
  noPageScroll = false,
  hideSidebarBrandMark = false,
  children
}: AppShellProps) {
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const navGroups = [
    {
      title: "Planejamento",
      items: [
        { to: buildWorkspaceBoardPath(workspaceSlug), label: "Board" },
        { to: buildWorkspaceListPath(workspaceSlug), label: "List" },
        { to: buildWorkspaceTimelinePath(workspaceSlug), label: "Timeline" }
      ]
    },
    {
      title: "Operacao",
      items: [
        { to: buildWorkspaceAutomationsPath(workspaceSlug), label: "Automations" },
        { to: buildWorkspaceSettingsPath(workspaceSlug), label: "Settings" }
      ]
    }
  ];
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
      className={cn("app-shell", noPageScroll && "app-shell--no-scroll", isSidebarOpen && "app-shell--nav-open")}
    >
      <div className="app-shell__noise" />
      <button type="button" className="app-shell__nav-backdrop" aria-label="Fechar menu" onClick={closeNavigation} />

      <aside className="sidebar">
        <div className="sidebar__brand">
          {hideSidebarBrandMark ? null : (
            <img className="sidebar__brand-mark" src={daskLogoMark} alt="" aria-hidden="true" />
          )}
          <div>
            <p className="sidebar__brand-title">Dask</p>
            <p className="sidebar__brand-subtitle">Universal Workflow</p>
          </div>
        </div>

        {onCreateTask ? <CreateTaskButton onCreate={onCreateTask} typeOptions={createTaskTypes} /> : null}

        <nav className="sidebar__menu">
          {navGroups.map((group) => (
            <section className="sidebar__menu-group" key={group.title}>
              <p className="sidebar__menu-title">{group.title}</p>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={closeNavigation}
                  className={({ isActive }) => cn("sidebar__menu-link", isActive && "sidebar__menu-link--active")}
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
