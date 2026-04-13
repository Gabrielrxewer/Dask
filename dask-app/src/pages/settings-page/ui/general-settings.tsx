import { useMemo } from "react";
import { factoryBoardConfig } from "@/entities/task";
import { useWorkspace } from "@/modules/workspace";
import { FormField, Section, Select } from "@/shared/ui";
import "./general-settings.css";

type BoardPerspective = {
  id: string;
  label: string;
};

export function GeneralSettings() {
  const { snapshot, updatePreferences } = useWorkspace();

  const rawBoardConfig = snapshot?.boardConfig ?? factoryBoardConfig;
  const perspectives = useMemo(() => {
    const fromPerspectives =
      Array.isArray((rawBoardConfig as { perspectives?: unknown }).perspectives)
        ? ((rawBoardConfig as { perspectives: BoardPerspective[] }).perspectives ?? [])
        : [];

    if (fromPerspectives.length > 0) {
      return fromPerspectives;
    }

    const fromViews =
      Array.isArray((rawBoardConfig as { views?: unknown }).views)
        ? ((rawBoardConfig as { views: BoardPerspective[] }).views ?? [])
        : [];

    if (fromViews.length > 0) {
      return fromViews;
    }

    return [{ id: "dev", label: "DEV" }];
  }, [rawBoardConfig]);

  const defaultMode = snapshot?.preferences.defaultBoardMode ?? perspectives[0]?.id ?? "dev";
  const dateFormat = snapshot?.preferences.dateFormat ?? "dd/mm/yyyy";

  return (
    <div className="general-settings">
      <Section
        title="Preferencias do workspace"
        subtitle="As configuracoes sao aplicadas automaticamente no workspace."
        className="general-settings__card"
      >
        <div className="general-settings__form-grid">
          <FormField label="Perspectiva inicial">
            <Select
              value={defaultMode}
              onChange={event =>
                void updatePreferences({
                  defaultBoardMode: event.target.value
                })
              }
            >
              {perspectives.map(perspective => (
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
    </div>
  );
}
