import { buildBoardMetrics, factoryBoardConfig } from "@/entities/task";
import { useWorkspace } from "@/modules/workspace";
import { FormField, Section, Select } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { BoardMetrics } from "@/widgets/board-metrics";
import "./settings-page.css";

export function SettingsPage() {
  const { snapshot, updatePreferences, setCardFieldVisibility } = useWorkspace();

  const tasks = snapshot?.tasks ?? [];
  const rawBoardConfig = snapshot?.boardConfig ?? factoryBoardConfig;
  const boardConfig = {
    ...factoryBoardConfig,
    ...rawBoardConfig,
    statuses: Array.isArray(rawBoardConfig?.statuses) ? rawBoardConfig.statuses : factoryBoardConfig.statuses,
    taskTypes: Array.isArray(rawBoardConfig?.taskTypes) ? rawBoardConfig.taskTypes : factoryBoardConfig.taskTypes,
    fieldDefinitions: Array.isArray(rawBoardConfig?.fieldDefinitions)
      ? rawBoardConfig.fieldDefinitions
      : factoryBoardConfig.fieldDefinitions,
    cardLayout:
      rawBoardConfig?.cardLayout && Array.isArray(rawBoardConfig.cardLayout.visibleFieldIds)
        ? rawBoardConfig.cardLayout
        : factoryBoardConfig.cardLayout,
    perspectives: Array.isArray(rawBoardConfig?.perspectives)
      ? rawBoardConfig.perspectives
      : Array.isArray(rawBoardConfig?.views)
        ? rawBoardConfig.views
        : []
  };
  const metrics = buildBoardMetrics(tasks);

  const boardPerspectives =
    boardConfig.perspectives.length > 0 ? boardConfig.perspectives : [{ id: "dev", label: "DEV" }];
  const defaultMode = snapshot?.preferences.defaultBoardMode ?? boardPerspectives[0]?.id ?? "dev";
  const dateFormat = snapshot?.preferences.dateFormat ?? "dd/mm/yyyy";
  const visibleFields = new Set(snapshot?.preferences.visibleCardFieldIds ?? []);
  const fieldDefinitions = boardConfig.fieldDefinitions;

  const visibleFieldsCount = visibleFields.size;

  return (
    <AppShell metrics={metrics} noPageScroll hideSidebarBrandMark pageTitle="Configuracoes do workspace" pageLabel="Admin">
      <div className="settings-page">
        <BoardMetrics
          metrics={metrics}
          cards={[
            { label: "Campos visiveis", value: visibleFieldsCount },
            { label: "Modo padrao", value: defaultMode.toUpperCase() },
            { label: "Perspectivas", value: boardPerspectives.length },
            { label: "Atualizacao", value: "Agora" }
          ]}
        />

        <section className="settings-view">
          <Section title="Campos visiveis no card" className="settings-view__card settings-view__card--scroll">
            <div className="settings-view__field-list">
              {fieldDefinitions.map(field => (
                <label key={field.id} className="settings-view__checkbox-row">
                  <input
                    type="checkbox"
                    checked={visibleFields.has(field.id)}
                    onChange={event => void setCardFieldVisibility(field.id, event.target.checked)}
                  />
                  {field.label}
                </label>
              ))}
            </div>
          </Section>

          <Section
            title="Preferencias do workspace"
            subtitle="As configuracoes sao aplicadas automaticamente no workspace."
            className="settings-view__card"
          >
            <div className="settings-view__form-grid">
              <FormField label="Modo inicial">
                <Select
                  value={defaultMode}
                  onChange={event =>
                    void updatePreferences({
                      defaultBoardMode: event.target.value
                    })
                  }
                >
                  {boardPerspectives.map(perspective => (
                    <option key={perspective.id} value={perspective.id}>
                      {perspective.label}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Formato de data">
                <Select
                  value={dateFormat}
                  onChange={event =>
                    void updatePreferences({
                      dateFormat: event.target.value as "dd/mm/yyyy" | "mm/dd/yyyy"
                    })
                  }
                >
                  <option value="dd/mm/yyyy">DD/MM/YYYY</option>
                  <option value="mm/dd/yyyy">MM/DD/YYYY</option>
                </Select>
              </FormField>
            </div>
          </Section>
        </section>
      </div>
    </AppShell>
  );
}
