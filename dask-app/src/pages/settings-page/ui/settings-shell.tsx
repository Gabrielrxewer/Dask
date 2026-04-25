import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useParams } from "react-router-dom";
import { buildBoardMetrics } from "@/entities/task";
import { useWorkspace } from "@/modules/workspace";
import { workspaceService } from "@/modules/workspace/api";
import { LoadingState, WorkspaceFrame } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import {
  buildWorkspaceSettingsItemTypesPath,
  buildWorkspaceSettingsMembersPath,
  buildWorkspaceSettingsPerspectivesPath,
  buildWorkspaceSettingsPath,
  buildWorkspaceSettingsWorkflowStatesPath
} from "@/app/router";
import "./settings-shell.css";

const NAV_ITEMS = [
  {
    label: "Comece aqui",
    buildPath: buildWorkspaceSettingsPath
  },
  {
    label: "Editor de board",
    buildPath: buildWorkspaceSettingsPerspectivesPath
  },
  {
    label: "Editor de estados",
    buildPath: buildWorkspaceSettingsWorkflowStatesPath
  },
  {
    label: "Editor de work items",
    buildPath: buildWorkspaceSettingsItemTypesPath
  }
];

export function SettingsShell() {
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const { snapshot, isLoading } = useWorkspace();
  const [isCorporateWorkspace, setIsCorporateWorkspace] = useState(false);

  useEffect(() => {
    let mounted = true;

    workspaceService
      .listWorkspaces()
      .then((workspaces) => {
        if (!mounted) {
          return;
        }

        const currentWorkspace = workspaces.find((workspace) => workspace.slug === workspaceSlug);
        setIsCorporateWorkspace(currentWorkspace?.kind === "CORPORATE");
      })
      .catch(() => {
        if (mounted) {
          setIsCorporateWorkspace(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [workspaceSlug]);

  const tasks = snapshot?.tasks ?? [];
  const metrics = buildBoardMetrics(tasks);
  const navItems = useMemo(() => {
    if (!isCorporateWorkspace) {
      return NAV_ITEMS;
    }

    return [
      NAV_ITEMS[0],
      {
        label: "Pessoas e acesso",
        buildPath: buildWorkspaceSettingsMembersPath
      },
      ...NAV_ITEMS.slice(1)
    ];
  }, [isCorporateWorkspace]);

  const topNavigation = (
    <nav className="settings-top-nav" aria-label="Configuracoes do workspace">
      <div className="settings-top-nav__tabs shared-tabs" role="tablist" aria-label="Secoes de configuracao">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.buildPath(workspaceSlug)}
            end
            role="tab"
            className={({ isActive }) =>
              `settings-top-nav__tab shared-tabs__item${isActive ? " shared-tabs__item--active" : ""}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );

  return (
    <AppShell
      metrics={metrics}
      noPageScroll
      hidePageHeader
      hideSidebarBrandMark
      topNavigation={topNavigation}
    >
      <WorkspaceFrame className="settings-shell">
        <LoadingState
          text="Carregando configuracoes..."
          animation="settings"
          variant="frame"
          visible={isLoading && !snapshot}
        />
        <main className="settings-shell__content">
          <Outlet />
        </main>
      </WorkspaceFrame>
    </AppShell>
  );
}
