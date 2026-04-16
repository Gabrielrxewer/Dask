import type { ReactNode } from "react";
import { NavLink, useParams } from "react-router-dom";
import {
  buildWorkspaceAgendaPath,
  buildWorkspaceAutomationsPath,
  buildWorkspaceBoardPath,
  buildWorkspaceDocumentationPath,
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

type SidebarIconName = "board" | "list" | "timeline" | "agenda" | "documentation" | "automation" | "settings";
type SidebarTone = "blue" | "mint" | "amber" | "cyan" | "rose" | "violet" | "slate";

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
  hidePageHeader?: boolean;
  hideSidebarBrandMark?: boolean;
  children: ReactNode;
}

function SidebarIcon({ name }: { name: SidebarIconName }) {
  const commonProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false
  };

  if (name === "board") {
    return (
      <svg {...commonProps}>
        <rect x="4" y="4" width="16" height="16" rx="3.5" />
        <path d="M9 4v16" />
        <path d="M15 4v16" />
        <path d="M4 10h5" />
        <path d="M15 14h5" />
      </svg>
    );
  }

  if (name === "list") {
    return (
      <svg {...commonProps}>
        <path d="M9 6h10" />
        <path d="M9 12h10" />
        <path d="M9 18h10" />
        <path d="M5 6h.01" />
        <path d="M5 12h.01" />
        <path d="M5 18h.01" />
      </svg>
    );
  }

  if (name === "timeline") {
    return (
      <svg {...commonProps}>
        <path d="M4 18h16" />
        <path d="M7 18V8" />
        <path d="M12 18V5" />
        <path d="M17 18v-7" />
        <circle cx="7" cy="8" r="2" />
        <circle cx="12" cy="5" r="2" />
        <circle cx="17" cy="11" r="2" />
      </svg>
    );
  }

  if (name === "agenda") {
    return (
      <svg {...commonProps}>
        <rect x="4" y="5" width="16" height="15" rx="3" />
        <path d="M8 3.5v3" />
        <path d="M16 3.5v3" />
        <path d="M4 9h16" />
        <path d="M8 13h3.5" />
        <path d="M8 16h2.5" />
        <path d="m14 15.5 1.4 1.4 2.6-3" />
      </svg>
    );
  }

  if (name === "automation") {
    return (
      <svg {...commonProps}>
        <path d="M8 7.2A6.4 6.4 0 0 1 18.2 10" />
        <path d="M16.6 10h2.9V7.1" />
        <path d="M16 16.8A6.4 6.4 0 0 1 5.8 14" />
        <path d="M7.4 14H4.5v2.9" />
        <path d="m11 8 3 4h-3l2 4" />
      </svg>
    );
  }

  if (name === "documentation") {
    return (
      <svg {...commonProps}>
        <path d="M8 4.8h7.1L19 8.7V19a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6.8a2 2 0 0 1 2-2Z" />
        <path d="M15.1 4.8V9H19" />
        <path d="M9.5 12.3h5" />
        <path d="M9.5 15.5h5" />
      </svg>
    );
  }

  if (name === "settings") {
    return (
      <svg {...commonProps}>
        <path d="M12 8.4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Z" />
        <path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l2-1.2-2-3.4-2.2 1a8 8 0 0 0-2.6-1.5L14.3 3h-4.1l-.4 2.4a8 8 0 0 0-2.6 1.5l-2.2-1-2 3.4 2 1.2a7.7 7.7 0 0 0 0 3l-2 1.2 2 3.4 2.2-1a8 8 0 0 0 2.6 1.5l.4 2.4h4.1l.4-2.4a8 8 0 0 0 2.6-1.5l2.2 1 2-3.4-2.1-1.2Z" />
      </svg>
    );
  }

  return (
    <svg {...commonProps}>
      <rect x="4" y="7" width="16" height="13" rx="3" />
      <path d="M8 7V5.8A2.8 2.8 0 0 1 10.8 3h2.4A2.8 2.8 0 0 1 16 5.8V7" />
      <path d="M4 12h16" />
      <path d="M10 15h4" />
    </svg>
  );
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
  hidePageHeader = false,
  hideSidebarBrandMark = false,
  children
}: AppShellProps) {
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const navGroups = [
    {
      title: "Planejamento",
      items: [
        { to: buildWorkspaceBoardPath(workspaceSlug), label: "Board", icon: "board" as const, tone: "blue" as const },
        { to: buildWorkspaceListPath(workspaceSlug), label: "List", icon: "list" as const, tone: "mint" as const },
        { to: buildWorkspaceTimelinePath(workspaceSlug), label: "Timeline", icon: "timeline" as const, tone: "amber" as const },
        { to: buildWorkspaceAgendaPath(workspaceSlug), label: "Agenda", icon: "agenda" as const, tone: "cyan" as const }
      ]
    },
    {
      title: "Operacao",
      items: [
        {
          to: buildWorkspaceDocumentationPath(workspaceSlug),
          label: "Documentation",
          icon: "documentation" as const,
          tone: "slate" as const
        },
        {
          to: buildWorkspaceAutomationsPath(workspaceSlug),
          label: "Automations",
          icon: "automation" as const,
          tone: "rose" as const
        },
        {
          to: buildWorkspaceSettingsPath(workspaceSlug),
          label: "Settings",
          icon: "settings" as const,
          tone: "violet" as const
        }
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
                  className={({ isActive }) =>
                    cn(
                      "sidebar__menu-link",
                      `sidebar__menu-link--tone-${item.tone as SidebarTone}`,
                      isActive && "sidebar__menu-link--active"
                    )
                  }
                >
                  <span
                    className={cn(
                      "sidebar__menu-icon",
                      `sidebar__menu-icon--${item.icon as SidebarIconName}`,
                      `sidebar__menu-icon--tone-${item.tone as SidebarTone}`
                    )}
                    aria-hidden="true"
                  >
                    <SidebarIcon name={item.icon as SidebarIconName} />
                  </span>
                  <span className="sidebar__menu-link-copy">
                    <span className="sidebar__menu-link-label">{item.label}</span>
                  </span>
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
        {hidePageHeader ? null : (
          <PageHeader label={pageLabel} title={pageTitle} actions={filterProps ? <DashboardFilter {...filterProps} /> : null} />
        )}

        <main className="workspace__content">{children}</main>
      </div>
    </div>
  );
}
