import {
  getWorkspaceBoardConfig,
  getWorkspaceMetrics,
  getWorkspacePreferences,
  useWorkspace,
  type WorkspaceBoardMode,
  type WorkspaceDateFormat,
  workspaceBoardModeOptions,
  workspaceDateFormatOptions
} from "@/modules/workspace";
import { FormField, Section, Select } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { BoardMetrics } from "@/widgets/board-metrics";
import "./settings-page.css";

export function SettingsPage() {
  const { snapshot, updatePreferences, setCardFieldVisibility } = useWorkspace();

  const boardConfig = getWorkspaceBoardConfig(snapshot);
  const metrics = getWorkspaceMetrics(snapshot);
  const preferences = getWorkspacePreferences(snapshot);
  const defaultMode = preferences.defaultBoardMode;
  const dateFormat = preferences.dateFormat;
  const visibleFields = new Set(preferences.visibleCardFieldIds);
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
            { label: "Layouts salvos", value: 4 },
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
                      defaultBoardMode: event.target.value as WorkspaceBoardMode
                    })
                  }
                >
                  {workspaceBoardModeOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Formato de data">
                <Select
                  value={dateFormat}
                  onChange={event =>
                    void updatePreferences({
                      dateFormat: event.target.value as WorkspaceDateFormat
                    })
                  }
                >
                  {workspaceDateFormatOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
          </Section>
        </section>
      </div>
    </AppShell>
  );
}
