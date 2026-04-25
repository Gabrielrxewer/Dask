import { useEffect, useState } from "react";
import { buildBoardMetrics, factoryBoardConfig, mergeCardFieldDefinitions } from "@/entities/task";
import { useWorkspace } from "@/modules/workspace";
import type { AiAgentSummary, AiObservability, AiRunSummary } from "@/modules/workspace/model";
import { Button, FormField, Section, Select, TextInput, Textarea, WorkspaceFrame } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { BoardMetrics } from "@/widgets/board-metrics";
import "./settings-page.css";

export function SettingsPage() {
  const { snapshot, updatePreferences, listAiAgents, listAiRuns, getAiObservability, createAiAgent } = useWorkspace();
  const [agents, setAgents] = useState<AiAgentSummary[]>([]);
  const [aiRuns, setAiRuns] = useState<AiRunSummary[]>([]);
  const [observability, setObservability] = useState<AiObservability>({
    totals: {
      runs24h: 0,
      failed24h: 0,
      failureRate24h: 0,
      avgLatencyMs24h: 0,
      tokens24h: 0,
      estimatedCostUsd24h: 0
    },
    byProvider: []
  });
  const [agentName, setAgentName] = useState("");
  const [agentKey, setAgentKey] = useState("");
  const [agentPrompt, setAgentPrompt] = useState("");
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);

  useEffect(() => {
    let mounted = true;
    void Promise.all([listAiAgents(), listAiRuns({ limit: 20 }), getAiObservability()]).then(([result, runs, obs]) => {
      if (mounted) {
        setAgents(result);
        setAiRuns(runs);
        setObservability(obs);
      }
    });
    return () => {
      mounted = false;
    };
  }, [listAiAgents, listAiRuns, getAiObservability]);

  const tasks = snapshot?.tasks ?? [];
  const rawBoardConfig = snapshot?.boardConfig ?? factoryBoardConfig;
  const boardConfig = {
    ...factoryBoardConfig,
    ...rawBoardConfig,
    statuses: Array.isArray(rawBoardConfig?.statuses) ? rawBoardConfig.statuses : factoryBoardConfig.statuses,
    taskTypes: Array.isArray(rawBoardConfig?.taskTypes) ? rawBoardConfig.taskTypes : factoryBoardConfig.taskTypes,
    fieldDefinitions: mergeCardFieldDefinitions(
      Array.isArray(rawBoardConfig?.fieldDefinitions) ? rawBoardConfig.fieldDefinitions : factoryBoardConfig.fieldDefinitions
    ),
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
  const fieldDefinitions = boardConfig.fieldDefinitions;

  const visibleFieldsCount = fieldDefinitions.length;
  const activeAgentsCount = agents.filter(agent => agent.isActive).length;

  const handleCreateAgent = async () => {
    const name = agentName.trim();
    const key = agentKey.trim().toLowerCase();
    const systemPrompt = agentPrompt.trim();

    if (name.length < 2 || key.length < 2 || systemPrompt.length < 10) {
      return;
    }

    setIsCreatingAgent(true);
    try {
      await createAiAgent({
        name,
        key,
        systemPrompt,
        description: "Agente customizado do workspace",
        temperature: 0.2
      });

      const [nextAgents, nextRuns, nextObs] = await Promise.all([
        listAiAgents(),
        listAiRuns({ limit: 20 }),
        getAiObservability()
      ]);
      setAgents(nextAgents);
      setAiRuns(nextRuns);
      setObservability(nextObs);
      setAgentName("");
      setAgentKey("");
      setAgentPrompt("");
    } finally {
      setIsCreatingAgent(false);
    }
  };

  return (
    <AppShell metrics={metrics} noPageScroll hideSidebarBrandMark pageTitle="Configuracoes do workspace" pageLabel="Admin">
      <WorkspaceFrame className="settings-page">
        <BoardMetrics
          metrics={metrics}
          cards={[
            { label: "Campos disponiveis", value: visibleFieldsCount },
            { label: "Modo padrao", value: defaultMode.toUpperCase() },
            { label: "Perspectivas", value: boardPerspectives.length },
            { label: "Agentes IA", value: activeAgentsCount },
            { label: "Falhas IA (24h)", value: observability.totals.failed24h },
            { label: "Atualizacao", value: "Agora" }
          ]}
        />

        <section className="settings-view">
          <Section title="Campos por Tipo" className="settings-view__card settings-view__card--scroll">
            <div className="settings-view__field-list">
              {fieldDefinitions.map(field => (
                <label key={field.id} className="settings-view__checkbox-row">
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

          <Section
            title="Agentes de IA"
            subtitle="Crie agentes para usar no chat do card e analise de risco."
            className="settings-view__card"
          >
            <div className="settings-view__form-grid">
              <FormField label="Nome do agente">
                <TextInput value={agentName} onChange={event => setAgentName(event.target.value)} />
              </FormField>
              <FormField label="Chave tecnica (ex: risk-ops)">
                <TextInput value={agentKey} onChange={event => setAgentKey(event.target.value)} />
              </FormField>
            </div>
            <FormField label="System prompt">
              <Textarea value={agentPrompt} onChange={event => setAgentPrompt(event.target.value)} />
            </FormField>
            <div className="settings-view__form-grid">
              <Button
                type="button"
                onClick={() => void handleCreateAgent()}
                disabled={isCreatingAgent || agentName.trim().length < 2 || agentKey.trim().length < 2 || agentPrompt.trim().length < 10}
              >
                {isCreatingAgent ? "Criando..." : "Criar agente"}
              </Button>
            </div>
            <div className="settings-view__field-list">
              {agents.map(agent => (
                <label key={agent.id} className="settings-view__checkbox-row">
                  {agent.name} ({agent.key}) {agent.isActive ? "ativo" : "inativo"}
                </label>
              ))}
            </div>
          </Section>

          <Section
            title="Observabilidade IA"
            subtitle="Saude das execucoes nas ultimas 24 horas."
            className="settings-view__card"
          >
            <div className="settings-view__form-grid">
              <label className="settings-view__checkbox-row">Runs: {observability.totals.runs24h}</label>
              <label className="settings-view__checkbox-row">Falhas: {observability.totals.failed24h}</label>
              <label className="settings-view__checkbox-row">Taxa de falha: {(observability.totals.failureRate24h * 100).toFixed(1)}%</label>
              <label className="settings-view__checkbox-row">Latencia media: {observability.totals.avgLatencyMs24h}ms</label>
              <label className="settings-view__checkbox-row">Tokens: {observability.totals.tokens24h}</label>
              <label className="settings-view__checkbox-row">Custo estimado: ${observability.totals.estimatedCostUsd24h.toFixed(4)}</label>
            </div>
            <div className="settings-view__field-list">
              {observability.byProvider.map(provider => (
                <label key={provider.provider} className="settings-view__checkbox-row">
                  {provider.provider}: runs={provider.runs24h} falhas={provider.failed24h} lat={provider.avgLatencyMs24h}ms tokens={provider.tokens24h} custo=${provider.estimatedCostUsd24h.toFixed(4)}
                </label>
              ))}
            </div>
          </Section>

          <Section
            title="Ultimos Runs IA"
            subtitle="Historico recente para debug operacional."
            className="settings-view__card settings-view__card--scroll"
          >
            <div className="settings-view__field-list">
              {aiRuns.map(run => (
                <label key={run.id} className="settings-view__checkbox-row">
                  {run.status} | provider={run.provider ?? "-"} | lat={run.latencyMs ?? 0}ms | tokens={run.totalTokens ?? 0} | custo=${(run.estimatedCostUsd ?? 0).toFixed(4)}
                </label>
              ))}
            </div>
          </Section>
        </section>
      </WorkspaceFrame>
    </AppShell>
  );
}
