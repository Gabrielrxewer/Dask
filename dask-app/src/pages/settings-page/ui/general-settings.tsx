import { factoryBoardConfig } from "@/entities/task";
import { useWorkspace } from "@/modules/workspace";
import { FormField, Section, Select } from "@/shared/ui";
import "./general-settings.css";

export function GeneralSettings() {
  const { snapshot, updatePreferences } = useWorkspace();

  const rawBoardConfig = snapshot?.boardConfig ?? factoryBoardConfig;
  const boardConfig = {
    ...factoryBoardConfig,
    ...rawBoardConfig,
    views: Array.isArray(rawBoardConfig?.views) ? rawBoardConfig.views : []
  };

  const boardViews = boardConfig.views.length > 0 ? boardConfig.views : [{ id: "dev", label: "Dev" }];
  const defaultMode = snapshot?.preferences.defaultBoardMode ?? boardViews[0]?.id ?? "dev";
  const dateFormat = snapshot?.preferences.dateFormat ?? "dd/mm/yyyy";

  return (
    <div className="general-settings">
      <Section
        title="Preferencias do workspace"
        subtitle="As configuracoes sao aplicadas automaticamente no workspace."
        className="general-settings__card"
      >
        <div className="general-settings__form-grid">
          <FormField label="Modo inicial">
            <Select
              value={defaultMode}
              onChange={event =>
                void updatePreferences({
                  defaultBoardMode: event.target.value
                })
              }
            >
              {boardViews.map(view => (
                <option key={view.id} value={view.id}>
                  {view.label}
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
    </div>
  );
}
