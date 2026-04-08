import { AppShell } from "@/widgets/app-shell";
import { BoardMetrics } from "@/widgets/board-metrics";
import { buildBoardMetrics } from "@/entities/task";
import { useWorkspace } from "@/modules/workspace";
import "./settings-page.css";

export function SettingsPage() {
  const { snapshot, updatePreferences, setCardFieldVisibility } = useWorkspace();

  const tasks = snapshot?.tasks ?? [];
  const metrics = buildBoardMetrics(tasks);

  const defaultMode = snapshot?.preferences.defaultBoardMode ?? "dev";
  const dateFormat = snapshot?.preferences.dateFormat ?? "dd/mm/yyyy";
  const visibleFields = new Set(snapshot?.preferences.visibleCardFieldIds ?? []);

  const visibleFieldsCount = visibleFields.size;

  return (
    <AppShell metrics={metrics} pageTitle="Configuracoes do dashboard" pageLabel="Admin">
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
        <article className="settings-view__card">
          <h3>Campos visiveis no card</h3>
          <label>
            <input
              type="checkbox"
              checked={visibleFields.has("storyPoints")}
              onChange={event => void setCardFieldVisibility("storyPoints", event.target.checked)}
            />
            Story Points
          </label>
          <label>
            <input
              type="checkbox"
              checked={visibleFields.has("severity")}
              onChange={event => void setCardFieldVisibility("severity", event.target.checked)}
            />
            Severidade
          </label>
          <label>
            <input
              type="checkbox"
              checked={visibleFields.has("sprint")}
              onChange={event => void setCardFieldVisibility("sprint", event.target.checked)}
            />
            Sprint
          </label>
        </article>

        <article className="settings-view__card">
          <h3>Preferencias do workspace</h3>
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
              <option value="manager">Gerente</option>
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

          <p className="settings-view__hint">As configuracoes sao aplicadas automaticamente no workspace.</p>
        </article>
      </section>
    </AppShell>
  );
}
