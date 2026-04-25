import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useParams } from "react-router-dom";
import { buildBoardMetrics, factoryBoardConfig } from "@/entities/task";
import { useWorkspace } from "@/modules/workspace";
import { workspaceService } from "@/modules/workspace/api";
import { WorkspaceFrame } from "@/shared/ui";
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
    description: "Resumo, template e preferencias",
    buildPath: buildWorkspaceSettingsPath
  },
  {
    label: "Editor de board",
    description: "Perspectivas, colunas e visibilidade",
    buildPath: buildWorkspaceSettingsPerspectivesPath
  },
  {
    label: "Editor de estados",
    description: "Etapas reais do fluxo de trabalho",
    buildPath: buildWorkspaceSettingsWorkflowStatesPath
  },
  {
    label: "Editor de work items",
    description: "Formulario, card e campos no mesmo fluxo",
    buildPath: buildWorkspaceSettingsItemTypesPath
  }
];

export function SettingsShell() {
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const { snapshot } = useWorkspace();
  const [isCorporateWorkspace, setIsCorporateWorkspace] = useState(false);

  useEffect(() => {
    let mounted = true;

    workspaceService
      .listWorkspaces()
      .then(workspaces => {
        if (!mounted) {
          return;
        }

        const currentWorkspace = workspaces.find(workspace => workspace.slug === workspaceSlug);
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
  const boardConfig = snapshot?.boardConfig ?? factoryBoardConfig;

  const columnsCount = boardConfig.statuses.length;
  const typesCount = boardConfig.taskTypes.length;
  const fieldsCount = boardConfig.fieldDefinitions.length;
  const navItems = useMemo(() => {
    if (!isCorporateWorkspace) {
      return NAV_ITEMS;
    }

    return [
      NAV_ITEMS[0],
      {
        label: "Pessoas e acesso",
        description: "Convites, roles e permissoes",
        buildPath: buildWorkspaceSettingsMembersPath
      },
      ...NAV_ITEMS.slice(1)
    ];
  }, [isCorporateWorkspace]);

  return (
    <AppShell metrics={metrics} noPageScroll hideSidebarBrandMark pageTitle="Configuracoes" pageLabel="Admin">
      <WorkspaceFrame className="settings-shell">
        <nav className="settings-shell__nav" aria-label="Configuracoes do workspace">
          <div className="settings-shell__nav-header">
            <span className="settings-shell__eyebrow">Workspace</span>
            <span className="settings-shell__nav-title">Configurar board</span>
            <p className="settings-shell__nav-intro">
              Siga as etapas para criar um fluxo simples, visual e pronto para uso.
            </p>
          </div>

          <ul className="settings-shell__nav-list">
            {navItems.map((item, index) => (
              <li key={item.label}>
                <NavLink
                  to={item.buildPath(workspaceSlug)}
                  end
                  className={({ isActive }) =>
                    `settings-shell__nav-link${isActive ? " is-active" : ""}`
                  }
                >
                  <span className="settings-shell__nav-step">{String(index + 1)}</span>
                  <span className="settings-shell__nav-copy">
                    <span className="settings-shell__nav-link-label">{item.label}</span>
                    <span className="settings-shell__nav-link-desc">{item.description}</span>
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>

          <div className="settings-shell__nav-footer">
            <div className="settings-shell__stat">
              <strong>{columnsCount}</strong>
              <span>colunas</span>
            </div>
            <div className="settings-shell__stat">
              <strong>{typesCount}</strong>
              <span>tipos</span>
            </div>
            <div className="settings-shell__stat">
              <strong>{fieldsCount}</strong>
              <span>campos</span>
            </div>
          </div>
        </nav>

        <main className="settings-shell__content">
          <Outlet />
        </main>
      </WorkspaceFrame>
    </AppShell>
  );
}
