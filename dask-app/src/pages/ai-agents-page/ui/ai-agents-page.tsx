import { useEffect, useMemo, useState } from "react";
import { buildBoardMetrics } from "@/entities/task";
import { useWorkspace } from "@/modules/workspace";
import type { AiAgentConfig, AiAgentRagSource, AiAgentSummary, CreateAiAgentInput } from "@/modules/workspace/model";
import { Button, FormField, LoadingState, Section, StatusBadge, TextInput, Textarea } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { BoardMetrics } from "@/widgets/board-metrics";
import "./ai-agents-page.css";

interface AgentFormState {
  id: string | null;
  baseConfig: AiAgentConfig;
  name: string;
  key: string;
  description: string;
  model: string;
  temperature: string;
  systemPrompt: string;
  isActive: boolean;
  ragSource: AiAgentRagSource;
  includeSemanticContext: boolean;
  includeLinkedDocuments: boolean;
  topKContextDocs: string;
  contextInstruction: string;
  nativeToolsEnabled: boolean;
  allowedNativeTools: string[];
  gptToolsEnabled: boolean;
  allowedGptTools: string[];
}

const RAG_OPTIONS: Array<{ value: AiAgentRagSource; label: string; description: string }> = [
  {
    value: "none",
    label: "Sem RAG",
    description: "O agente responde apenas pelo prompt, sem consultar docs/cards."
  },
  {
    value: "documentation",
    label: "So documentacao",
    description: "Consulta apenas docs do workspace."
  },
  {
    value: "card",
    label: "So cards",
    description: "Consulta apenas contexto dos cards."
  },
  {
    value: "card_and_documentation",
    label: "Doc + cards",
    description: "Consulta docs e cards juntos na resposta."
  }
];

const NATIVE_TOOL_OPTIONS: Array<{ value: string; label: string; description: string }> = [
  {
    value: "update_item_description",
    label: "Atualizar descricao do card",
    description: "Permite a IA editar descricao do item."
  },
  {
    value: "set_item_status",
    label: "Alterar status do card",
    description: "Permite mover status/state do item."
  },
  {
    value: "set_item_priority",
    label: "Alterar prioridade do card",
    description: "Permite definir prioridade do item."
  }
];

const GPT_TOOL_OPTIONS: Array<{ value: string; label: string; description: string }> = [
  {
    value: "web_search",
    label: "Web Search",
    description: "Permite a IA buscar informacoes na web em tempo real."
  }
];

const DEFAULT_PROMPT = [
  "You are a senior workspace assistant.",
  "Give objective and practical answers.",
  "When context is missing, state your assumptions."
].join("\n");

function asAgentConfig(value: unknown): AiAgentConfig {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as AiAgentConfig;
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveSource(source: unknown): AiAgentRagSource {
  if (source === "none" || source === "documentation" || source === "card" || source === "card_and_documentation") {
    return source;
  }
  return "documentation";
}

function sourceLabel(source: AiAgentRagSource): string {
  if (source === "documentation") {
    return "Documentacao";
  }
  if (source === "card") {
    return "Cards";
  }
  if (source === "card_and_documentation") {
    return "Card + Doc";
  }
  return "Sem RAG";
}

function normalizeNativeTools(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowed = new Set(NATIVE_TOOL_OPTIONS.map((tool) => tool.value));
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .filter((entry) => allowed.has(entry));
}

function normalizeGptTools(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowed = new Set(GPT_TOOL_OPTIONS.map((tool) => tool.value));
  return value
    .filter((entry): entry is string => typeof entry === "string")
    .filter((entry) => allowed.has(entry));
}

function createDefaultForm(): AgentFormState {
  return {
    id: null,
    baseConfig: {},
    name: "",
    key: "",
    description: "",
    model: "",
    temperature: "0.2",
    systemPrompt: DEFAULT_PROMPT,
    isActive: true,
    ragSource: "documentation",
    includeSemanticContext: true,
    includeLinkedDocuments: true,
    topKContextDocs: "5",
    contextInstruction: "Responda priorizando a documentacao selecionada e, quando necessario, complemente com contexto relevante.",
    nativeToolsEnabled: false,
    allowedNativeTools: [],
    gptToolsEnabled: false,
    allowedGptTools: []
  };
}

function formFromAgent(agent: AiAgentSummary): AgentFormState {
  const config = asAgentConfig(agent.config);
  const rag = config.rag ?? {};
  const source = rag.enabled === false ? "none" : resolveSource(rag.source);
  const tools = config.tools ?? {};
  const nativeAllowedTools = normalizeNativeTools(tools.nativeAllowed ?? tools.allowed);
  const gptAllowedTools = normalizeGptTools(tools.gptAllowed);

  return {
    id: agent.id,
    baseConfig: config,
    name: agent.name,
    key: agent.key,
    description: agent.description ?? "",
    model: agent.model,
    temperature: String(agent.temperature),
    systemPrompt: agent.systemPrompt ?? DEFAULT_PROMPT,
    isActive: agent.isActive,
    ragSource: source,
    includeSemanticContext: rag.includeSemanticContext !== false,
    includeLinkedDocuments: rag.includeLinkedDocuments !== false,
    topKContextDocs: String(rag.topKContextDocs ?? 5),
    contextInstruction: rag.contextInstruction ?? "",
    nativeToolsEnabled: (tools.nativeEnabled ?? tools.enabled) === true,
    allowedNativeTools: nativeAllowedTools,
    gptToolsEnabled: tools.gptEnabled === true,
    allowedGptTools: gptAllowedTools
  };
}

export function AiAgentsPage() {
  const { snapshot, listAiAgents, createAiAgent, updateAiAgent } = useWorkspace();
  const metrics = useMemo(() => buildBoardMetrics(snapshot?.tasks ?? []), [snapshot?.tasks]);

  const [agents, setAgents] = useState<AiAgentSummary[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [form, setForm] = useState<AgentFormState>(() => createDefaultForm());

  const activeAgentsCount = agents.filter((agent) => agent.isActive).length;
  const ragEnabledCount = agents.filter((agent) => {
    const config = asAgentConfig(agent.config);
    const rag = config.rag ?? {};
    return rag.enabled !== false && resolveSource(rag.source) !== "none";
  }).length;
  const docAwareCount = agents.filter((agent) => {
    const config = asAgentConfig(agent.config);
    const rag = config.rag ?? {};
    if (rag.enabled === false) {
      return false;
    }
    const source = resolveSource(rag.source);
    return source === "documentation" || source === "card_and_documentation";
  }).length;

  useEffect(() => {
    let mounted = true;
    setIsLoadingAgents(true);
    setError(null);

    listAiAgents()
      .then((result) => {
        if (!mounted) {
          return;
        }

        setAgents(result);

        if (result.length === 0) {
          setSelectedAgentId(null);
          setForm(createDefaultForm());
          return;
        }

        const selected = result[0];
        setSelectedAgentId(selected.id);
        setForm(formFromAgent(selected));
      })
      .catch((err) => {
        if (!mounted) {
          return;
        }
        setError(err instanceof Error ? err.message : "Nao foi possivel carregar os agentes.");
      })
      .finally(() => {
        if (mounted) {
          setIsLoadingAgents(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [listAiAgents]);

  const isCreateMode = form.id === null;
  const derivedRagSource = form.ragSource;
  const canSave =
    form.name.trim().length >= 2 &&
    normalizeKey(form.key).length >= 2 &&
    form.systemPrompt.trim().length >= 10 &&
    !isLoadingAgents &&
    !isSaving;
  const activeNativeToolsCount = form.nativeToolsEnabled ? form.allowedNativeTools.length : 0;
  const activeGptToolsCount = form.gptToolsEnabled ? form.allowedGptTools.length : 0;
  const activeToolsCount = activeNativeToolsCount + activeGptToolsCount;

  function handleSelectAgent(agent: AiAgentSummary) {
    setSelectedAgentId(agent.id);
    setForm(formFromAgent(agent));
    setError(null);
  }

  function handleCreateNew() {
    setSelectedAgentId(null);
    setForm(createDefaultForm());
    setError(null);
  }

  function updateForm<K extends keyof AgentFormState>(key: K, value: AgentFormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  function toggleNativeTool(tool: string) {
    setForm((current) => {
      const nextTools = current.allowedNativeTools.includes(tool)
        ? current.allowedNativeTools.filter((entry) => entry !== tool)
        : [...current.allowedNativeTools, tool];

      return {
        ...current,
        nativeToolsEnabled: nextTools.length > 0,
        allowedNativeTools: nextTools
      };
    });
  }

  function toggleGptTool(tool: string) {
    setForm((current) => {
      const nextTools = current.allowedGptTools.includes(tool)
        ? current.allowedGptTools.filter((entry) => entry !== tool)
        : [...current.allowedGptTools, tool];

      return {
        ...current,
        gptToolsEnabled: nextTools.length > 0,
        allowedGptTools: nextTools
      };
    });
  }

  async function refreshAgentsAndSelect(targetAgentId?: string) {
    const nextAgents = await listAiAgents();
    setAgents(nextAgents);

    if (nextAgents.length === 0) {
      setSelectedAgentId(null);
      setForm(createDefaultForm());
      return;
    }

    const selected = nextAgents.find((agent) => agent.id === targetAgentId)
      ?? nextAgents.find((agent) => agent.id === selectedAgentId)
      ?? nextAgents[0];
    setSelectedAgentId(selected.id);
    setForm(formFromAgent(selected));
  }

  async function handleSubmit() {
    if (!canSave) {
      return;
    }

    const temperature = Number(form.temperature);
    if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
      setError("Temperatura invalida. Use um valor entre 0 e 2.");
      return;
    }

    const topKContextDocs = Math.min(Math.max(Number(form.topKContextDocs) || 5, 1), 10);
    const normalizedKey = normalizeKey(form.key);
    if (!/^[a-z0-9-_]+$/.test(normalizedKey)) {
      setError("A chave aceita apenas letras minusculas, numeros, hifen e underscore.");
      return;
    }

    const nextConfig: AiAgentConfig = {
      ...form.baseConfig,
      rag: {
        ...(form.baseConfig.rag ?? {}),
        enabled: derivedRagSource !== "none",
        source: derivedRagSource,
        contextInstruction: form.contextInstruction.trim(),
        includeSemanticContext: form.includeSemanticContext,
        includeLinkedDocuments: form.includeLinkedDocuments,
        topKContextDocs
      },
      tools: {
        ...(form.baseConfig.tools ?? {}),
        enabled: form.nativeToolsEnabled && form.allowedNativeTools.length > 0,
        allowed: form.allowedNativeTools,
        nativeEnabled: form.nativeToolsEnabled && form.allowedNativeTools.length > 0,
        nativeAllowed: form.allowedNativeTools,
        gptEnabled: form.gptToolsEnabled && form.allowedGptTools.length > 0,
        gptAllowed: form.allowedGptTools
      }
    };

    const payload: CreateAiAgentInput = {
      key: normalizedKey,
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      model: form.model.trim() || undefined,
      temperature,
      systemPrompt: form.systemPrompt.trim(),
      config: nextConfig,
      isActive: form.isActive
    };

    setIsSaving(true);
    setError(null);

    try {
      if (form.id) {
        await updateAiAgent(form.id, {
          name: payload.name,
          description: payload.description ?? null,
          model: payload.model,
          temperature: payload.temperature,
          systemPrompt: payload.systemPrompt,
          config: payload.config,
          isActive: payload.isActive
        });
        await refreshAgentsAndSelect(form.id);
      } else {
        const created = await createAiAgent(payload);
        await refreshAgentsAndSelect(created.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel salvar este agente.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppShell
      metrics={metrics}
      noPageScroll
      hideSidebarBrandMark
      pageTitle="Agentes de IA"
      pageLabel="AI Studio"
    >
      <div className="ai-agents-page">
        <BoardMetrics
          metrics={metrics}
          cards={[
            { label: "Agentes cadastrados", value: agents.length },
            { label: "Agentes ativos", value: activeAgentsCount },
            { label: "RAG habilitada", value: ragEnabledCount },
            { label: "Consultam doc", value: docAwareCount }
          ]}
        />

        <div className="ai-agents-page__layout">
          <Section
            title="Catalogo de agentes"
            subtitle="Selecione um agente para editar prompt e politica de RAG."
            className="ai-agents-page__catalog"
            actions={
              <Button type="button" size="sm" onClick={handleCreateNew} disabled={isSaving}>
                Novo agente
              </Button>
            }
          >
            {isLoadingAgents ? (
              <LoadingState text="Carregando agentes..." />
            ) : agents.length === 0 ? (
              <div className="ai-agents-page__empty">
                <h3>Nenhum agente ainda</h3>
                <p>Crie o primeiro agente para configurar prompt e contexto RAG.</p>
              </div>
            ) : (
              <div className="ai-agents-page__agent-list">
                {agents.map((agent) => {
                  const config = asAgentConfig(agent.config);
                  const rag = config.rag ?? {};
                  const source =
                    rag.enabled === false
                      ? ("none" as AiAgentRagSource)
                      : resolveSource(rag.source);

                  return (
                    <button
                      key={agent.id}
                      type="button"
                      className={`ai-agents-page__agent-item${selectedAgentId === agent.id ? " ai-agents-page__agent-item--active" : ""}`}
                      onClick={() => handleSelectAgent(agent)}
                    >
                      <header>
                        <strong>{agent.name}</strong>
                        <StatusBadge tone={agent.isActive ? "success" : "warning"}>
                          {agent.isActive ? "Ativo" : "Inativo"}
                        </StatusBadge>
                      </header>
                      <p>{agent.description || "Sem descricao"}</p>
                      <footer>
                        <span>{agent.key}</span>
                        <span>{sourceLabel(source)}</span>
                      </footer>
                    </button>
                  );
                })}
              </div>
            )}
          </Section>

          <Section
            title={isCreateMode ? "Novo agente customizado" : "Editar agente"}
            subtitle="Defina prompt, modelo e como a IA consulta documentacao e cards."
            className="ai-agents-page__editor"
            actions={
              <Button type="button" size="sm" onClick={() => void handleSubmit()} disabled={!canSave}>
                {isSaving ? "Salvando..." : "Salvar agente"}
              </Button>
            }
          >
            <form
              className="ai-agents-page__form"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmit();
              }}
            >
              <div className="ai-agents-page__grid">
                <FormField label="Nome do agente">
                  <TextInput
                    value={form.name}
                    onChange={(event) => updateForm("name", event.target.value)}
                    placeholder="Ex.: Especialista de Produto"
                    required
                  />
                </FormField>

                <FormField label="Chave tecnica">
                  <TextInput
                    value={form.key}
                    onChange={(event) => updateForm("key", normalizeKey(event.target.value))}
                    placeholder="ex.: specialist-product"
                    disabled={!isCreateMode}
                    required
                  />
                </FormField>
              </div>

              <div className="ai-agents-page__grid">
                <FormField label="Modelo (opcional)">
                  <TextInput
                    value={form.model}
                    onChange={(event) => updateForm("model", event.target.value)}
                    placeholder="Deixe vazio para usar o padrao do backend"
                  />
                </FormField>

                <FormField label="Temperatura (0 a 2)">
                  <TextInput
                    type="number"
                    step="0.1"
                    min={0}
                    max={2}
                    value={form.temperature}
                    onChange={(event) => updateForm("temperature", event.target.value)}
                  />
                </FormField>
              </div>

              <FormField label="Descricao (opcional)">
                <TextInput
                  value={form.description}
                  onChange={(event) => updateForm("description", event.target.value)}
                  placeholder="Objetivo do agente dentro do workspace"
                />
              </FormField>

              <FormField label="Prompt do agente">
                <Textarea
                  rows={8}
                  value={form.systemPrompt}
                  onChange={(event) => updateForm("systemPrompt", event.target.value)}
                  placeholder="Defina o comportamento e tom do agente."
                />
              </FormField>

              <div className="ai-agents-page__toggles">
                <label className="ai-agents-page__toggle">
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) => updateForm("isActive", event.target.checked)}
                  />
                  <span>Agente ativo</span>
                </label>
              </div>

              <section className="ai-agents-page__rag-panel">
                <header>
                  <h3>Politica de contexto (RAG)</h3>
                  <StatusBadge tone={derivedRagSource === "none" ? "warning" : "success"}>
                    {sourceLabel(derivedRagSource)}
                  </StatusBadge>
                </header>

                <div className="ai-agents-page__rag-options" role="radiogroup" aria-label="Tipo de RAG">
                  {RAG_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`ai-agents-page__rag-option${form.ragSource === option.value ? " ai-agents-page__rag-option--active" : ""}`}
                      role="radio"
                      aria-checked={form.ragSource === option.value}
                      onClick={() => updateForm("ragSource", option.value)}
                    >
                      <strong>{option.label}</strong>
                      <span>{option.description}</span>
                    </button>
                  ))}
                </div>

                <div className="ai-agents-page__toggles">
                  <label className="ai-agents-page__toggle">
                    <input
                      type="checkbox"
                      disabled={derivedRagSource === "none" || (derivedRagSource !== "card" && derivedRagSource !== "card_and_documentation")}
                      checked={form.includeSemanticContext}
                      onChange={(event) => updateForm("includeSemanticContext", event.target.checked)}
                    />
                    <span>Contexto semantico (quando usar cards)</span>
                  </label>
                  <label className="ai-agents-page__toggle">
                    <input
                      type="checkbox"
                      disabled={derivedRagSource === "none" || (derivedRagSource !== "card" && derivedRagSource !== "card_and_documentation")}
                      checked={form.includeLinkedDocuments}
                      onChange={(event) => updateForm("includeLinkedDocuments", event.target.checked)}
                    />
                    <span>Incluir docs vinculadas ao card</span>
                  </label>
                </div>

                <div className="ai-agents-page__grid">
                  <FormField label="Top K documentos">
                    <TextInput
                      type="number"
                      min={1}
                      max={10}
                      value={form.topKContextDocs}
                      onChange={(event) => updateForm("topKContextDocs", event.target.value)}
                      disabled={derivedRagSource === "none"}
                    />
                  </FormField>
                </div>

                <FormField label="Definicao de contexto para resposta">
                  <Textarea
                    rows={4}
                    value={form.contextInstruction}
                    onChange={(event) => updateForm("contextInstruction", event.target.value)}
                    placeholder="Ex.: Quando houver conflito entre card e doc, priorize a documentacao oficial e explique a diferenca."
                    disabled={derivedRagSource === "none"}
                  />
                </FormField>
              </section>

              <section className="ai-agents-page__rag-panel">
                <header>
                  <h3>Tools do agente</h3>
                  <StatusBadge tone={activeToolsCount > 0 ? "success" : "warning"}>
                    {activeToolsCount > 0 ? `${activeToolsCount} habilitada(s)` : "Nenhuma tool ativa"}
                  </StatusBadge>
                </header>

                <div className="ai-agents-page__tools-group">
                  <div className="ai-agents-page__tools-group-head">
                    <strong>Tools nativas (acoes no card)</strong>
                  </div>
                  <div className="ai-agents-page__tools-list">
                    {NATIVE_TOOL_OPTIONS.map((tool) => (
                      <label key={tool.value} className="ai-agents-page__tool-item">
                        <input
                          type="checkbox"
                          checked={form.allowedNativeTools.includes(tool.value)}
                          onChange={() => toggleNativeTool(tool.value)}
                        />
                        <div>
                          <strong>{tool.label}</strong>
                          <p>{tool.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="ai-agents-page__tools-group">
                  <div className="ai-agents-page__tools-group-head">
                    <strong>Tools do GPT</strong>
                  </div>
                  <div className="ai-agents-page__tools-list">
                    {GPT_TOOL_OPTIONS.map((tool) => (
                      <label key={tool.value} className="ai-agents-page__tool-item">
                        <input
                          type="checkbox"
                          checked={form.allowedGptTools.includes(tool.value)}
                          onChange={() => toggleGptTool(tool.value)}
                        />
                        <div>
                          <strong>{tool.label}</strong>
                          <p>{tool.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </section>

              {error ? <p className="ai-agents-page__error">{error}</p> : null}

              <footer className="ai-agents-page__actions">
                <Button type="button" variant="outline" onClick={handleCreateNew} disabled={isSaving}>
                  Limpar
                </Button>
                <Button type="submit" disabled={!canSave}>
                  {isSaving ? "Salvando..." : isCreateMode ? "Criar agente" : "Salvar alteracoes"}
                </Button>
              </footer>
            </form>
          </Section>
        </div>
      </div>
    </AppShell>
  );
}
