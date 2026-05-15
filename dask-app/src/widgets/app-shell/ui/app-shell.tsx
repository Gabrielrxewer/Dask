import type { ReactNode } from "react";
import { NavLink, useParams } from "react-router-dom";
import {
  buildWorkspaceAgendaPath,
  buildWorkspaceAiAgentsPath,
  buildWorkspaceAutomationsPath,
  buildWorkspaceBillingPath,
  buildWorkspaceBoardPath,
  buildWorkspaceDashboardPath,
  buildWorkspaceDocumentationPath,
  buildWorkspaceFiscalPath,
  buildWorkspaceCommercialPath,
  buildWorkspaceMarketingPath,
  buildWorkspaceListPath,
  buildWorkspaceSettingsPath
} from "@/app/router/route-paths";
import { useGlobalChrome } from "@/app/layout";
import { useWorkspacePermissions } from "@/modules/workspace";
import type { BoardMetrics } from "@/entities/task";
import type { DashboardFilterState } from "@/features/dashboard-filter";
import { DashboardFilter } from "@/features/dashboard-filter";
import { cn } from "@/shared/lib/cn";
import { AppIcon, PageHeader, type AppIconName } from "@/shared/ui";
import "./app-shell.css";

const daskLogoSrc = "/favicon.svg";

type SidebarIconName = "dashboard" | "board" | "list" | "agenda" | "documentation" | "ai" | "automation" | "settings" | "billing" | "fiscal" | "commercial" | "marketing";
type SidebarTone = "blue" | "mint" | "amber" | "cyan" | "rose" | "violet" | "slate";
type AppModuleKey = "dashboard" | "board" | "automation" | "documentation" | "billing" | "ai" | "settings" | "fiscal" | "commercial" | "marketing";

interface AppShellProps {
  metrics: BoardMetrics;
  pageLabel?: string;
  pageTitle?: string;
  topNavigation?: ReactNode;
  filter?: DashboardFilterState;
  onFilterQueryChange?: (query: string) => void;
  onMineToggle?: () => void;
  noPageScroll?: boolean;
  hidePageHeader?: boolean;
  hideSidebarBrandMark?: boolean;
  children: ReactNode;
}

function SidebarIcon({ name }: { name: SidebarIconName }) {
  const iconByName: Record<SidebarIconName, AppIconName> = {
    dashboard: "dashboard",
    board: "board",
    list: "list",
    agenda: "calendar-check",
    documentation: "documentation",
    ai: "bot",
    automation: "automation",
    settings: "settings",
    billing: "billing",
    fiscal: "receipt",
    commercial: "users",
    marketing: "marketing"
  };

  return <AppIcon name={iconByName[name]} size={18} strokeWidth={1.9} />;
}

export function AppShell({
  metrics: _metrics,
  pageLabel = "Workspace",
  pageTitle = "Dask Platform",
  topNavigation,
  filter,
  onFilterQueryChange,
  onMineToggle,
  noPageScroll = false,
  hidePageHeader = false,
  hideSidebarBrandMark = false,
  children
}: AppShellProps) {
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const permissions = useWorkspacePermissions();
  const isClient = permissions.isClient;
  const navGroups = [
    {
      title: "Planejamento",
      items: [
        {
          to: buildWorkspaceDashboardPath(workspaceSlug),
          label: "Dashboard",
          icon: "dashboard" as const,
          tone: "blue" as const,
          module: "dashboard" as AppModuleKey,
          hideForClient: true
        },
        {
          to: buildWorkspaceBoardPath(workspaceSlug),
          label: "Board",
          icon: "board" as const,
          tone: "blue" as const,
          module: "board" as AppModuleKey
        },
        {
          to: buildWorkspaceListPath(workspaceSlug),
          label: "List",
          icon: "list" as const,
          tone: "mint" as const,
          module: "board" as AppModuleKey,
          hideForClient: true
        },
        {
          to: buildWorkspaceAgendaPath(workspaceSlug),
          label: "Agenda",
          icon: "agenda" as const,
          tone: "cyan" as const,
          module: "board" as AppModuleKey
        }
      ]
    },
    {
      title: "Operacao",
      items: [
        {
          to: buildWorkspaceDocumentationPath(workspaceSlug),
          label: "Documentation",
          icon: "documentation" as const,
          tone: "slate" as const,
          module: "documentation" as AppModuleKey
        },
        {
          to: buildWorkspaceAiAgentsPath(workspaceSlug),
          label: "AI Agents",
          icon: "ai" as const,
          tone: "violet" as const,
          module: "ai" as AppModuleKey
        },
        {
          to: buildWorkspaceAutomationsPath(workspaceSlug),
          label: "Automations",
          icon: "automation" as const,
          tone: "rose" as const,
          module: "automation" as AppModuleKey
        },
        {
          to: buildWorkspaceCommercialPath(workspaceSlug),
          label: "Comercial",
          icon: "commercial" as const,
          tone: "mint" as const,
          module: "commercial" as AppModuleKey
        },
        {
          to: buildWorkspaceMarketingPath(workspaceSlug),
          label: "Marketing",
          icon: "marketing" as const,
          tone: "rose" as const,
          module: "marketing" as AppModuleKey
        }
      ]
    },
    {
      title: "Financeiro",
      items: [
        {
          to: buildWorkspaceFiscalPath(workspaceSlug),
          label: "Fiscal",
          icon: "fiscal" as const,
          tone: "slate" as const,
          module: "fiscal" as AppModuleKey
        },
        {
          to: buildWorkspaceBillingPath(workspaceSlug),
          label: "Cobranca",
          icon: "billing" as const,
          tone: "amber" as const,
          module: "billing" as AppModuleKey
        }
      ]
    }
  ]
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => permissions.canAccessModule(item.module) && !(isClient && "hideForClient" in item && item.hideForClient))
    }))
    .filter((group) => group.items.length > 0);
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
            <img className="sidebar__brand-mark" src={daskLogoSrc} alt="" aria-hidden="true" />
          )}
          <div>
            <p className="sidebar__brand-title">Dask</p>
            <p className="sidebar__brand-subtitle">Universal Workflow</p>
          </div>
        </div>

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

        {permissions.canAccessModule("settings") ? (
          <div className="sidebar__foot">
            <NavLink
              to={buildWorkspaceSettingsPath(workspaceSlug)}
              onClick={closeNavigation}
              className={({ isActive }) =>
                cn("sidebar__menu-link", "sidebar__menu-link--tone-violet", isActive && "sidebar__menu-link--active")
              }
            >
              <span className="sidebar__menu-icon sidebar__menu-icon--settings sidebar__menu-icon--tone-violet" aria-hidden="true">
                <SidebarIcon name="settings" />
              </span>
              <span className="sidebar__menu-link-copy">
                <span className="sidebar__menu-link-label">Settings</span>
              </span>
            </NavLink>
          </div>
        ) : null}
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
