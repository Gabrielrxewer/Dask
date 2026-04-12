import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { routePaths } from "@/app/router/route-paths";
import { useGlobalChrome } from "@/app/layout";
import type { BoardMetrics } from "@/entities/task";
import type { DashboardFilterState } from "@/features/dashboard-filter";
import { DashboardFilter } from "@/features/dashboard-filter";
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
  noPageScroll?: boolean;
  hideSidebarBrandMark?: boolean;
  children: ReactNode;
}

type NavIconComponent = () => ReactNode;

interface NavItem {
  to: string;
  label: string;
  description: string;
  Icon: NavIconComponent;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      {children}
    </svg>
  );
}

function BoardIcon() {
  return (
    <NavIcon>
      <rect x="2.5" y="3" width="6" height="5.5" rx="1.3" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11.5" y="3" width="6" height="5.5" rx="1.3" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2.5" y="11.5" width="6" height="5.5" rx="1.3" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11.5" y="11.5" width="6" height="5.5" rx="1.3" stroke="currentColor" strokeWidth="1.5" />
    </NavIcon>
  );
}

function ListIcon() {
  return (
    <NavIcon>
      <circle cx="4" cy="5" r="1.25" fill="currentColor" />
      <circle cx="4" cy="10" r="1.25" fill="currentColor" />
      <circle cx="4" cy="15" r="1.25" fill="currentColor" />
      <path d="M7.5 5H16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7.5 10H16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M7.5 15H16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </NavIcon>
  );
}

function TimelineIcon() {
  return (
    <NavIcon>
      <path d="M3 14.5H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M5 14.5V8.5H9V5.5H14V11.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="5" cy="14.5" r="1.25" fill="currentColor" />
      <circle cx="9" cy="8.5" r="1.25" fill="currentColor" />
      <circle cx="14" cy="11.5" r="1.25" fill="currentColor" />
    </NavIcon>
  );
}

function AutomationsIcon() {
  return (
    <NavIcon>
      <path
        d="M9.5 2.75L6.25 10H10L8.75 17.25L13.75 9.25H10.5L12.75 2.75H9.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </NavIcon>
  );
}

function SettingsIcon() {
  return (
    <NavIcon>
      <path d="M4 5.5H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 10H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 14.5H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="7" cy="5.5" r="1.75" fill="#0f3f70" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="12.5" cy="10" r="1.75" fill="#0f3f70" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="9" cy="14.5" r="1.75" fill="#0f3f70" stroke="currentColor" strokeWidth="1.2" />
    </NavIcon>
  );
}

const navGroups: NavGroup[] = [
  {
    title: "Planejamento",
    items: [
      { to: routePaths.board, label: "Board", description: "Fluxo visual por colunas", Icon: BoardIcon },
      { to: routePaths.list, label: "List", description: "Controle tabular e edicao rapida", Icon: ListIcon },
      { to: routePaths.timeline, label: "Timeline", description: "Prazos, janelas e riscos", Icon: TimelineIcon }
    ]
  },
  {
    title: "Operacao",
    items: [
      {
        to: routePaths.automations,
        label: "Automations",
        description: "Rotinas, regras e agentes",
        Icon: AutomationsIcon
      },
      { to: routePaths.settings, label: "Settings", description: "Preferencias e administracao", Icon: SettingsIcon }
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
  noPageScroll = false,
  hideSidebarBrandMark = false,
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
      className={cn("app-shell", noPageScroll && "app-shell--no-scroll", isSidebarOpen && "app-shell--nav-open")}
    >
      <div className="app-shell__noise" />
      <button type="button" className="app-shell__nav-backdrop" aria-label="Fechar menu" onClick={closeNavigation} />

      <aside className="sidebar">
        <div className="sidebar__body">
          <div className="sidebar__brand">
            {hideSidebarBrandMark ? null : (
              <div className="sidebar__brand-mark-wrap">
                <img className="sidebar__brand-mark" src={daskLogoMark} alt="" aria-hidden="true" />
              </div>
            )}

            <div className="sidebar__brand-copy">
              <p className="sidebar__brand-kicker">Navegacao principal</p>
              <p className="sidebar__brand-title">Dask</p>
              <p className="sidebar__brand-subtitle">Universal Workflow</p>

              <div className="sidebar__brand-badges" aria-label="Resumo do workspace">
                <span className="sidebar__brand-badge">Workspace ativo</span>
                <span className="sidebar__brand-badge">{`${metrics.total} itens`}</span>
              </div>
            </div>
          </div>

          <nav className="sidebar__menu" aria-label="Navegacao principal do workspace">
            {navGroups.map((group) => (
              <section className="sidebar__menu-group" key={group.title}>
                <div className="sidebar__menu-group-head">
                  <p className="sidebar__menu-title">{group.title}</p>
                  <span className="sidebar__menu-group-count">{group.items.length}</span>
                </div>

                <div className="sidebar__menu-group-stack">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={closeNavigation}
                      className={({ isActive }) => cn("sidebar__menu-link", isActive && "sidebar__menu-link--active")}
                    >
                      <span className="sidebar__menu-link-icon" aria-hidden="true">
                        <item.Icon />
                      </span>

                      <span className="sidebar__menu-link-copy">
                        <span className="sidebar__menu-link-label">{item.label}</span>
                        <span className="sidebar__menu-link-description">{item.description}</span>
                      </span>

                      <span className="sidebar__menu-link-arrow" aria-hidden="true" />
                    </NavLink>
                  ))}
                </div>
              </section>
            ))}
          </nav>

          <div className="sidebar__foot">
            <div className="sidebar__sprint-card">
              <div className="sidebar__sprint-head">
                <div>
                  <p className="sidebar__sprint-label">Ciclo atual</p>
                  <p className="sidebar__sprint-name">Entrega principal</p>
                </div>
                <span className="sidebar__sprint-pill">{`${metrics.donePercent}%`}</span>
              </div>

              <p className="sidebar__sprint-meta">{`${metrics.active} ativos de ${metrics.total} itens do workspace`}</p>

              <div className="sidebar__track" aria-hidden="true">
                <div className="sidebar__fill" style={{ width: `${metrics.donePercent}%` }} />
              </div>

              <div className="sidebar__sprint-stats" aria-label="Indicadores do ciclo atual">
                <div>
                  <strong>{metrics.active}</strong>
                  <span>Ativos</span>
                </div>
                <div>
                  <strong>{metrics.done}</strong>
                  <span>Concluidos</span>
                </div>
              </div>
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
