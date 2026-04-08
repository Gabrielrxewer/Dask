import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import type { BoardMetrics } from "@/entities/task";
import type { DashboardFilterState } from "@/features/dashboard-filter";
import { DashboardFilter } from "@/features/dashboard-filter";
import { CreateTaskButton } from "@/features/create-task";
import "./app-shell.css";

interface AppShellProps {
  metrics: BoardMetrics;
  pageLabel?: string;
  pageTitle?: string;
  filter?: DashboardFilterState;
  onFilterQueryChange?: (query: string) => void;
  onMineToggle?: () => void;
  onCreateTask?: () => void;
  children: ReactNode;
}

const navItems = [
  { to: "/board", label: "Board" },
  { to: "/list", label: "List" },
  { to: "/timeline", label: "Timeline" },
  { to: "/automations", label: "Automations" },
  { to: "/settings", label: "Settings" }
];

export function AppShell({
  metrics,
  pageLabel = "Space",
  pageTitle = "Dask Workspace",
  filter,
  onFilterQueryChange,
  onMineToggle,
  onCreateTask,
  children
}: AppShellProps) {
  const hasFilter = Boolean(filter && onFilterQueryChange && onMineToggle);

  return (
    <div className="app-shell">
      <div className="app-shell__noise" />

      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__brand-mark">D</span>
          <div>
            <p className="sidebar__brand-title">Dask</p>
            <p className="sidebar__brand-subtitle">Workspace 2.0</p>
          </div>
        </div>

        {onCreateTask ? <CreateTaskButton onCreate={onCreateTask} /> : null}

        <nav className="sidebar__menu">
          <p className="sidebar__menu-title">Navegacao</p>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `sidebar__menu-link ${isActive ? "sidebar__menu-link--active" : ""}`.trim()
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar__foot">
          <p className="sidebar__menu-title">Sprint atual</p>
          <div className="sidebar__sprint-card">
            <p className="sidebar__sprint-name">Q2 Product Push</p>
            <p className="sidebar__sprint-meta">{`${metrics.active} tarefas ativas`}</p>
            <div className="sidebar__track">
              <div className="sidebar__fill" style={{ width: `${metrics.donePercent}%` }} />
            </div>
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="workspace__topbar">
          <div>
            <p className="workspace__label">{pageLabel}</p>
            <h1 className="workspace__title">{pageTitle}</h1>
          </div>

          {hasFilter && filter && onFilterQueryChange && onMineToggle ? (
            <DashboardFilter
              query={filter.query}
              mineOnly={filter.mineOnly}
              onQueryChange={onFilterQueryChange}
              onMineToggle={onMineToggle}
            />
          ) : null}
        </header>

        {children}
      </div>
    </div>
  );
}
