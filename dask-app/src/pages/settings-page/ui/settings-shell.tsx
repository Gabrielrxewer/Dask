import { NavLink, Outlet, useParams } from "react-router-dom";
import { buildBoardMetrics, factoryBoardConfig } from "@/entities/task";
import { useWorkspace } from "@/modules/workspace";
import { AppShell } from "@/widgets/app-shell";
import {
  buildWorkspaceSettingsColumnsPath,
  buildWorkspaceSettingsCustomFieldsPath,
  buildWorkspaceSettingsItemTypesPath,
  buildWorkspaceSettingsPerspectivesPath,
  buildWorkspaceSettingsPath,
  buildWorkspaceSettingsWorkflowStatesPath
} from "@/app/router";
import "./settings-shell.css";

const NAV_ITEMS = [
  {
    step: "1",
    label: "Comece aqui",
    description: "Resumo, template e preferencias",
    buildPath: buildWorkspaceSettingsPath
  },
  {
    step: "2",
    label: "Perspectivas",
    description: "Visoes para cada equipe ou rotina",
    buildPath: buildWorkspaceSettingsPerspectivesPath
  },
  {
    step: "3",
    label: "Estados",
    description: "Etapas reais do fluxo de trabalho",
    buildPath: buildWorkspaceSettingsWorkflowStatesPath
  },
  {
    step: "4",
    label: "Colunas",
    description: "Como os estados aparecem no board",
    buildPath: buildWorkspaceSettingsColumnsPath
  },
  {
    step: "5",
    label: "Work items",
    description: "Tipos, campos e preview do card",
    buildPath: buildWorkspaceSettingsItemTypesPath
  },
  {
    step: "6",
    label: "Campos",
    description: "Informacoes extras dos work items",
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
        <nav className="settings-shell__nav" aria-label="Configuracoes do workspace">
          <div className="settings-shell__nav-header">
            <span className="settings-shell__eyebrow">Workspace</span>
            <span className="settings-shell__nav-title">Configurar board</span>
            <p className="settings-shell__nav-intro">
              Siga as etapas para criar um fluxo simples, visual e pronto para uso.
            </p>
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
                  <span className="settings-shell__nav-step">{item.step}</span>
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
      </div>
    </AppShell>
  );
}
