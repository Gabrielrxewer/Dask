import { AppShell } from "@/widgets/app-shell";
import { BoardMetrics } from "@/widgets/board-metrics";
import { buildBoardMetrics, initialTasks } from "@/entities/task";
import "./automations-page.css";

const metrics = buildBoardMetrics(initialTasks);

const automationMocks = [
  {
    id: "a-1",
    title: "Aprimorar descricoes com IA",
    status: "Ativa",
    trigger: "Ao mover para Review",
    action: "Sugere descricao mais clara e criterios de aceite"
  },
  {
    id: "a-2",
    title: "Resumo diario para gerente",
    status: "Ativa",
    trigger: "Todo dia 18:00",
    action: "Publica panorama de epicos, riscos e progresso"
  },
  {
    id: "a-3",
    title: "Fluxo QA assistido",
    status: "Pausada",
    trigger: "Ao entrar em Liberado para teste",
    action: "Abre checklist de regressao e cria tarefa de validacao"
  }
];

export function AutomationsPage() {
  return (
    <AppShell metrics={metrics} pageTitle="Automações" pageLabel="Automation Hub">
      <BoardMetrics
        metrics={metrics}
        cards={[
          { label: "Automacoes ativas", value: 2 },
          { label: "Automacoes pausadas", value: 1 },
          { label: "Execucoes hoje", value: 47 },
          { label: "Falhas", value: 0 }
        ]}
      />

      <section className="automations-view">
        {automationMocks.map(item => (
          <article key={item.id} className="automations-view__card">
            <header>
              <h3>{item.title}</h3>
              <span className={`automations-view__status ${item.status === "Ativa" ? "is-active" : ""}`}>
                {item.status}
              </span>
            </header>
            <p>
              <strong>Gatilho:</strong> {item.trigger}
            </p>
            <p>
              <strong>Acao:</strong> {item.action}
            </p>
            <footer>
              <button type="button">Editar fluxo</button>
              <button type="button">Executar teste</button>
            </footer>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
