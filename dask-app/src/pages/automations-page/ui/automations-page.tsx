import {
  countActiveAutomations,
  countPausedAutomations,
  getWorkspaceAutomations,
  getWorkspaceMetrics,
  useWorkspace
} from "@/modules/workspace";
import { Button, Card, EmptyState, LoadingState, Section, StatusBadge } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { BoardMetrics } from "@/widgets/board-metrics";
import "./automations-page.css";

export function AutomationsPage() {
  const { snapshot, isLoading, setAutomationStatus } = useWorkspace();

  const automations = getWorkspaceAutomations(snapshot);
  const metrics = getWorkspaceMetrics(snapshot);
  const activeAutomations = countActiveAutomations(automations);
  const pausedAutomations = countPausedAutomations(automations);

  return (
    <AppShell metrics={metrics} noPageScroll hideSidebarBrandMark pageTitle="Automacoes" pageLabel="Automation Hub">
      <div className="automations-view">
        <BoardMetrics
          metrics={metrics}
          cards={[
            { label: "Automacoes ativas", value: activeAutomations },
            { label: "Automacoes pausadas", value: pausedAutomations },
            { label: "Execucoes hoje", value: 47 },
            { label: "Falhas", value: 0 }
          ]}
        />

        <Section
          title="Catalogo de automacoes"
          subtitle="Gerencie rotinas ativas, pause fluxos e valide execucoes em teste."
          className="automations-view__section"
        >
          {isLoading ? (
            <LoadingState text="Carregando workspace..." />
          ) : automations.length === 0 ? (
            <EmptyState>Nenhuma automacao configurada.</EmptyState>
          ) : (
            <div className="automations-view__grid">
              {automations.map(item => {
                const isActive = item.status === "active";

                return (
                  <Card key={item.id} className="automations-view__card" variant="interactive">
                    <header>
                      <h3>{item.title}</h3>
                      <StatusBadge tone={isActive ? "success" : "warning"}>{isActive ? "Ativa" : "Pausada"}</StatusBadge>
                    </header>
                    <p>
                      <strong>Gatilho:</strong> {item.trigger}
                    </p>
                    <p>
                      <strong>Acao:</strong> {item.action}
                    </p>
                    <footer>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void setAutomationStatus(item.id, isActive ? "paused" : "active")}
                      >
                        {isActive ? "Pausar" : "Ativar"}
                      </Button>
                      <Button type="button" variant="outline" size="sm">
                        Executar teste
                      </Button>
                    </footer>
                  </Card>
                );
              })}
            </div>
          )}
        </Section>
      </div>
    </AppShell>
  );
}

