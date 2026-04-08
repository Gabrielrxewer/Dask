import { AppShell } from "@/widgets/app-shell";
import { BoardMetrics } from "@/widgets/board-metrics";
import { buildBoardMetrics, factoryBoardConfig } from "@/entities/task";
import { useWorkspace } from "@/modules/workspace";
import "./settings-page.css";

export function SettingsPage() {
  const { snapshot, updatePreferences, setCardFieldVisibility } = useWorkspace();

  const tasks = snapshot?.tasks ?? [];
  const boardConfig = snapshot?.boardConfig ?? factoryBoardConfig;
  const metrics = buildBoardMetrics(tasks);

  const defaultMode = snapshot?.preferences.defaultBoardMode ?? "dev";
  const dateFormat = snapshot?.preferences.dateFormat ?? "dd/mm/yyyy";
  const visibleFields = new Set(snapshot?.preferences.visibleCardFieldIds ?? []);
  const fieldDefinitions = boardConfig.fieldDefinitions;

  const visibleFieldsCount = visibleFields.size;

  return (
    <AppShell metrics={metrics} pageTitle="Configurações do workspace" pageLabel="Admin">
      <BoardMetrics
        metrics={metrics}
        cards={[
          { label: "Campos visíveis", value: visibleFieldsCount },
          { label: "Modo padrão", value: defaultMode.toUpperCase() },
          { label: "Layouts salvos", value: 4 },
          { label: "Atualização", value: "Agora" }
        ]}
      />

      <section className="settings-view">
        <article className="settings-view__card">
          <h3>Campos visíveis no card</h3>
          {fieldDefinitions.map(field => (
            <label key={field.id}>
              <input
                type="checkbox"
                checked={visibleFields.has(field.id)}
                onChange={event => void setCardFieldVisibility(field.id, event.target.checked)}
              />
              {field.label}
            </label>
          ))}
        </article>

        <article className="settings-view__card">
          <h3>Preferências do workspace</h3>
          <label>
            Modo inicial
            <select
              value={defaultMode}
              onChange={event =>
                void updatePreferences({
                  defaultBoardMode: event.target.value as "dev" | "po" | "manager" | "qa"
                })
              }
            >
              <option value="dev">Dev</option>
              <option value="po">PO</option>
              <option value="manager">Gestão</option>
              <option value="qa">QA</option>
            </select>
          </label>

          <label>
            Formato de data
            <select
              value={dateFormat}
              onChange={event =>
                void updatePreferences({
                  dateFormat: event.target.value as "dd/mm/yyyy" | "mm/dd/yyyy"
                })
              }
            >
              <option value="dd/mm/yyyy">DD/MM/YYYY</option>
              <option value="mm/dd/yyyy">MM/DD/YYYY</option>
            </select>
          </label>

          <p className="settings-view__hint">As configurações são aplicadas automaticamente no workspace.</p>
        </article>
      </section>
    </AppShell>
  );
}

