import { NavLink, Outlet, useParams } from "react-router-dom";
import { buildBoardMetrics, factoryBoardConfig } from "@/entities/task";
import { useWorkspace } from "@/modules/workspace";
import { AppShell } from "@/widgets/app-shell";
import {
  buildWorkspaceSettingsColumnsPath,
  buildWorkspaceSettingsCustomFieldsPath,
  buildWorkspaceSettingsItemTypesPath,
  buildWorkspaceSettingsPath,
  buildWorkspaceSettingsWorkflowStatesPath
} from "@/app/router";
import "./settings-shell.css";

const NAV_ITEMS = [
  {
    label: "Geral",
    description: "Preferencias do workspace",
    buildPath: buildWorkspaceSettingsPath
  },
  {
    label: "Workflow States",
    description: "Status que aparecem no board",
    buildPath: buildWorkspaceSettingsWorkflowStatesPath
  },
  {
    label: "Colunas (agrupamentos)",
    description: "Agrupar states em colunas visuais",
    buildPath: buildWorkspaceSettingsColumnsPath
  },
  {
    label: "Tipos de work item",
    description: "Tipos e campos visiveis por tipo",
    buildPath: buildWorkspaceSettingsItemTypesPath
  },
  {
    label: "Campos customizados",
    description: "Definir campos para work items",
    buildPath: buildWorkspaceSettingsCustomFieldsPath
  }
];

export function SettingsShell() {
  const { workspaceSlug = "" } = useParams<{ workspaceSlug: string }>();
  const { snapshot } = useWorkspace();

  const tasks = snapshot?.tasks ?? [];
  const metrics = buildBoardMetrics(tasks);
  const boardConfig = snapshot?.boardConfig ?? factoryBoardConfig;

  const columnsCount = boardConfig.statuses.length;
  const typesCount = boardConfig.taskTypes.length;
  const fieldsCount = boardConfig.fieldDefinitions.length;

  return (
    <AppShell metrics={metrics} noPageScroll hideSidebarBrandMark pageTitle="Configuracoes" pageLabel="Admin">
      <div className="settings-shell">
        <nav className="settings-shell__nav">
          <div className="settings-shell__nav-header">
            <span className="settings-shell__nav-title">Configuracoes</span>
          </div>

          <ul className="settings-shell__nav-list">
            {NAV_ITEMS.map(item => (
              <li key={item.label}>
                <NavLink
                  to={item.buildPath(workspaceSlug)}
                  end
                  className={({ isActive }) =>
                    `settings-shell__nav-link${isActive ? " is-active" : ""}`
                  }
                >
                  <span className="settings-shell__nav-link-label">{item.label}</span>
                  <span className="settings-shell__nav-link-desc">{item.description}</span>
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
      </div>
    </AppShell>
  );
}
