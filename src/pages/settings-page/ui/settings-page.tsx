import { useState } from "react";
import { AppShell } from "@/widgets/app-shell";
import { BoardMetrics } from "@/widgets/board-metrics";
import { buildBoardMetrics, initialTasks } from "@/entities/task";
import "./settings-page.css";

const metrics = buildBoardMetrics(initialTasks);

export function SettingsPage() {
  const [showStoryPoints, setShowStoryPoints] = useState(true);
  const [showSeverity, setShowSeverity] = useState(true);
  const [showSprint, setShowSprint] = useState(true);
  const [defaultMode, setDefaultMode] = useState("dev");

  return (
    <AppShell metrics={metrics} pageTitle="Configurações do dashboard" pageLabel="Admin">
      <BoardMetrics
        metrics={metrics}
        cards={[
          { label: "Campos visiveis", value: [showStoryPoints, showSeverity, showSprint].filter(Boolean).length },
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
              checked={showStoryPoints}
              onChange={event => setShowStoryPoints(event.target.checked)}
            />
            Story Points
          </label>
          <label>
            <input
              type="checkbox"
              checked={showSeverity}
              onChange={event => setShowSeverity(event.target.checked)}
            />
            Severidade
          </label>
          <label>
            <input
              type="checkbox"
              checked={showSprint}
              onChange={event => setShowSprint(event.target.checked)}
            />
            Sprint
          </label>
        </article>

        <article className="settings-view__card">
          <h3>Preferencias do workspace</h3>
          <label>
            Modo inicial
            <select value={defaultMode} onChange={event => setDefaultMode(event.target.value)}>
              <option value="dev">Dev</option>
              <option value="po">PO</option>
              <option value="manager">Gerente</option>
              <option value="qa">QA</option>
            </select>
          </label>

          <label>
            Formato de data
            <select defaultValue="dd/mm/yyyy">
              <option value="dd/mm/yyyy">DD/MM/YYYY</option>
              <option value="mm/dd/yyyy">MM/DD/YYYY</option>
            </select>
          </label>

          <button type="button">Salvar configuracoes</button>
        </article>
      </section>
    </AppShell>
  );
}
