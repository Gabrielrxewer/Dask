import type { ReactNode } from "react";
import type { BoardMetrics } from "@/entities/task";
import type { DashboardFilterState } from "@/features/dashboard-filter";
import { DashboardFilter } from "@/features/dashboard-filter";
import { CreateTaskButton } from "@/features/create-task";
import "./app-shell.css";

interface AppShellProps {
  metrics: BoardMetrics;
  filter: DashboardFilterState;
  onFilterQueryChange: (query: string) => void;
  onMineToggle: () => void;
  onCreateTask: () => void;
  children: ReactNode;
}

export function AppShell({
  metrics,
  filter,
  onFilterQueryChange,
  onMineToggle,
  onCreateTask,
  children
}: AppShellProps) {
  return (
    <div className="app-shell">
      <div className="app-shell__noise" />

      <aside className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__brand-mark">CF</span>
          <div>
            <p className="sidebar__brand-title">ClickFlow</p>
            <p className="sidebar__brand-subtitle">Workspace 2.0</p>
          </div>
        </div>

        <CreateTaskButton onCreate={onCreateTask} />

        <nav className="sidebar__menu">
          <p className="sidebar__menu-title">Navegacao</p>
          <a className="sidebar__menu-link sidebar__menu-link--active" href="#">
            Board
          </a>
          <a className="sidebar__menu-link" href="#">
            List
          </a>
          <a className="sidebar__menu-link" href="#">
            Timeline
          </a>
          <a className="sidebar__menu-link" href="#">
            Docs
          </a>
          <a className="sidebar__menu-link" href="#">
            Automations
          </a>
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
            <p className="workspace__label">Space</p>
            <h1 className="workspace__title">Growth Squad Board</h1>
          </div>

          <DashboardFilter
            query={filter.query}
            mineOnly={filter.mineOnly}
            onQueryChange={onFilterQueryChange}
            onMineToggle={onMineToggle}
          />
        </header>

        {children}
      </div>
    </div>
  );
}
