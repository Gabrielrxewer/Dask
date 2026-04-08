import { AppShell } from "@/widgets/app-shell";
import { BoardMetrics } from "@/widgets/board-metrics";
import { buildBoardMetrics } from "@/entities/task";
import { useWorkspace } from "@/modules/workspace";
import "./automations-page.css";

export function AutomationsPage() {
  const { snapshot, isLoading, setAutomationStatus } = useWorkspace();

  const tasks = snapshot?.tasks ?? [];
  const automations = snapshot?.automations ?? [];

  const metrics = buildBoardMetrics(tasks);
  const activeAutomations = automations.filter(item => item.status === "active").length;
  const pausedAutomations = automations.filter(item => item.status === "paused").length;

  return (
    <AppShell metrics={metrics} pageTitle="Automacoes" pageLabel="Automation Hub">
      <BoardMetrics
        metrics={metrics}
        cards={[
          { label: "Automacoes ativas", value: activeAutomations },
          { label: "Automacoes pausadas", value: pausedAutomations },
          { label: "Execucoes hoje", value: 47 },
          { label: "Falhas", value: 0 }
        ]}
      />

      <section className="automations-view">
        {isLoading ? (
          <article className="automations-view__empty">Carregando workspace...</article>
        ) : automations.length === 0 ? (
          <article className="automations-view__empty">Nenhuma automacao configurada.</article>
        ) : (
          automations.map(item => {
            const isActive = item.status === "active";

            return (
              <article key={item.id} className="automations-view__card">
                <header>
                  <h3>{item.title}</h3>
                  <span className={`automations-view__status ${isActive ? "is-active" : ""}`}>
                    {isActive ? "Ativa" : "Pausada"}
                  </span>
                </header>
                <p>
                  <strong>Gatilho:</strong> {item.trigger}
                </p>
                <p>
                  <strong>Acao:</strong> {item.action}
                </p>
                <footer>
                  <button type="button" onClick={() => void setAutomationStatus(item.id, isActive ? "paused" : "active")}>
                    {isActive ? "Pausar" : "Ativar"}
                  </button>
                  <button type="button">Executar teste</button>
                </footer>
              </article>
            );
          })
        )}
      </section>
    </AppShell>
  );
}
