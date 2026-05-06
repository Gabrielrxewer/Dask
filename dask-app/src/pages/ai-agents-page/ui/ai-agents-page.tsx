import { useCallback, useEffect, useMemo, useState } from 'react';
import { applyEdgeChanges, applyNodeChanges, type OnEdgesChange, type OnNodesChange } from '@xyflow/react';
import { buildBoardMetrics } from '@/entities/task';
import { useWorkspace } from '@/modules/workspace';
import type {
  AiAgentConfig,
  AiAgentRagSource,
  AiAgentSummary,
  CreateAiAgentInput,
} from '@/modules/workspace/model';
import { AppIcon, EmptyState, LoadingState, PanelMenu, PanelMenuItem, StatusBadge, StudioLayout, WorkspaceActionButton, WorkspaceFrame, WorkspaceTopNavigation } from '@/shared/ui';
import { AppShell } from '@/widgets/app-shell';
import { AgentFlowCanvas } from './agent-flow-canvas';
import { AgentConfigPanel, type AgentMetaForm } from './agent-config-panel';
import type {
  AgentFlow,
  AgentFlowEdge,
  AgentFlowNode,
  AgentNodeData,
  AgentNodeKind,
  LlmNodeData,
  RagNodeData,
  ToolNodeData,
  RagSource,
  ToolId,
} from './agent-flow-types';
import './ai-agents-page.css';

// ── Flow serialization ────────────────────────────────────────────────────────

function agentToFlow(agent: AiAgentSummary | null): AgentFlow {
  const CX = 220;
  const SPACE = 180;

  if (!agent) {
    return {
      nodes: [
        fixedNode('trigger', 'trigger-1', CX, 40, { kind: 'trigger', label: 'Disparador', triggerType: 'manual' }),
        flowNode('rag', 'rag-1', CX, 40 + SPACE, { kind: 'rag', label: 'Contexto', source: 'documentation', topK: 5, contextInstruction: '', includeSemanticContext: true, includeLinkedDocuments: true }),
        flowNode('llm', 'llm-1', CX, 40 + SPACE * 2, { kind: 'llm', label: 'LLM', model: 'gpt-4.1-mini', temperature: 0.2, systemPrompt: '' }),
        fixedNode('output', 'output-1', CX, 40 + SPACE * 3, { kind: 'output', label: 'Resposta', outputType: 'text_response' }),
      ],
      edges: [
        makeEdge('trigger-1', 'rag-1'),
        makeEdge('rag-1', 'llm-1'),
        makeEdge('llm-1', 'output-1'),
      ],
    };
  }

  const cfg = (agent.config ?? {}) as AiAgentConfig;

  // If a saved flow exists, restore it directly
  const savedFlow = (cfg as Record<string, unknown>).flow as AgentFlow | undefined;
  if (savedFlow?.nodes?.length) return savedFlow;

  // Build a representative flow from flat config
  const rag = cfg.rag;
  const tools = cfg.tools;
  const nativeTools: string[] = tools?.nativeAllowed ?? tools?.allowed ?? [];
  const gptTools: string[] = tools?.gptAllowed ?? [];
  const allToolIds = [...nativeTools, ...gptTools];

  const nodes: AgentFlowNode[] = [];
  const edges: AgentFlowEdge[] = [];
  let y = 40;
  let prevId = '';

  const triggerId = 'trigger-1';
  nodes.push(fixedNode('trigger', triggerId, CX, y, { kind: 'trigger', label: 'Disparador', triggerType: 'manual' }));
  prevId = triggerId;
  y += SPACE;

  if (rag?.enabled !== false) {
    const ragId = 'rag-1';
    nodes.push(flowNode('rag', ragId, CX, y, {
      kind: 'rag',
      label: 'Contexto',
      source: (rag?.source ?? 'documentation') as RagSource,
      topK: rag?.topKContextDocs ?? 5,
      contextInstruction: rag?.contextInstruction ?? '',
      includeSemanticContext: rag?.includeSemanticContext !== false,
      includeLinkedDocuments: rag?.includeLinkedDocuments !== false,
    }));
    edges.push(makeEdge(prevId, ragId));
    prevId = ragId;
    y += SPACE;
  }

  if (allToolIds.length > 0) {
    const totalW = (allToolIds.length - 1) * 280;
    let tx = CX - totalW / 2;
    for (const toolId of allToolIds) {
      const nodeId = `tool-${toolId}`;
      nodes.push(flowNode('tool', nodeId, tx, y, { kind: 'tool', label: 'Tool', toolId: toolId as ToolId }));
      edges.push(makeEdge(prevId, nodeId));
      tx += 280;
    }
    y += SPACE;
  }

  const llmId = 'llm-1';
  nodes.push(flowNode('llm', llmId, CX, y, {
    kind: 'llm',
    label: 'LLM',
    model: agent.model || 'gpt-4.1-mini',
    temperature: agent.temperature ?? 0.2,
    systemPrompt: agent.systemPrompt ?? '',
  }));

  if (allToolIds.length > 0) {
    for (const toolId of allToolIds) {
      edges.push(makeEdge(`tool-${toolId}`, llmId));
    }
  } else {
    edges.push(makeEdge(prevId, llmId));
  }
  y += SPACE;

  const outputId = 'output-1';
  nodes.push(fixedNode('output', outputId, CX, y, { kind: 'output', label: 'Resposta', outputType: 'text_response' }));
  edges.push(makeEdge(llmId, outputId));

  return { nodes, edges };
}

function flowToAgentPayload(
  flow: AgentFlow,
  meta: { name: string; key: string; description: string; isActive: boolean },
): CreateAiAgentInput {
  const llmNode = flow.nodes.find((n) => n.type === 'llm');
  const ragNode = flow.nodes.find((n) => n.type === 'rag');
  const toolNodes = flow.nodes.filter((n) => n.type === 'tool');

  const llm = llmNode?.data as LlmNodeData | undefined;
  const rag = ragNode?.data as RagNodeData | undefined;

  const nativeToolIds = toolNodes
    .map((n) => (n.data as ToolNodeData).toolId)
    .filter((id) => id !== 'web_search');
  const gptToolIds = toolNodes
    .map((n) => (n.data as ToolNodeData).toolId)
    .filter((id) => id === 'web_search');

  const config: AiAgentConfig = {
    rag: rag
      ? {
          enabled: rag.source !== 'none',
          source: rag.source as AiAgentRagSource,
          topKContextDocs: rag.topK,
          contextInstruction: rag.contextInstruction,
          includeSemanticContext: rag.includeSemanticContext,
          includeLinkedDocuments: rag.includeLinkedDocuments,
        }
      : { enabled: false },
    tools: {
      enabled: nativeToolIds.length > 0,
      allowed: nativeToolIds,
      nativeEnabled: nativeToolIds.length > 0,
      nativeAllowed: nativeToolIds,
      gptEnabled: gptToolIds.length > 0,
      gptAllowed: gptToolIds,
    },
    flow: flow as unknown as Record<string, unknown>,
  };

  return {
    key: meta.key,
    name: meta.name,
    description: meta.description || undefined,
    model: llm?.model || undefined,
    temperature: llm?.temperature ?? 0.2,
    systemPrompt: llm?.systemPrompt ?? '',
    config,
    isActive: meta.isActive,
  };
}

// ── Node builder helpers ──────────────────────────────────────────────────────

function flowNode(type: AgentNodeKind, id: string, x: number, y: number, data: AgentNodeData): AgentFlowNode {
  return { id, type, position: { x, y }, data };
}

function fixedNode(type: AgentNodeKind, id: string, x: number, y: number, data: AgentNodeData): AgentFlowNode {
  return { id, type, position: { x, y }, data, deletable: false };
}

function makeEdge(source: string, target: string): AgentFlowEdge {
  return {
    id: `e-${source}-${target}`,
    source,
    target,
    type: 'smoothstep',
    animated: true,
    markerEnd: { type: 'arrowclosed' as const, width: 14, height: 14 },
  };
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

function asConfig(value: unknown): AiAgentConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as AiAgentConfig;
}

function sourceLabel(source: string): string {
  if (source === 'documentation') return 'Docs';
  if (source === 'card') return 'Cards';
  if (source === 'card_and_documentation') return 'Doc+Card';
  return 'Sem RAG';
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AiAgentsPage() {
  const { snapshot, listAiAgents, createAiAgent, updateAiAgent } = useWorkspace();
  const metrics = useMemo(() => buildBoardMetrics(snapshot?.tasks ?? []), [snapshot?.tasks]);

  // Agent list
  const [agents, setAgents] = useState<AiAgentSummary[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? null;

  // Agent metadata form (top nav)
  const [agentName, setAgentName] = useState('');
  const [agentKey, setAgentKey] = useState('');
  const [agentDescription, setAgentDescription] = useState('');
  const [agentIsActive, setAgentIsActive] = useState(true);
  const isCreateMode = selectedAgentId === null;

  // Flow state (lifted so config panel can update nodes)
  const [nodes, setNodes] = useState<AgentFlowNode[]>([]);
  const [edges, setEdges] = useState<AgentFlowEdge[]>([]);
  const [fitViewKey, setFitViewKey] = useState(0);

  // Selected node for config panel
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [configPanelMode, setConfigPanelMode] = useState<'agent' | 'node' | null>(null);
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;
  const agentMetaPanel: AgentMetaForm | null =
    configPanelMode === 'agent'
      ? {
          name: agentName,
          key: agentKey,
          description: agentDescription,
          isActive: agentIsActive,
          isCreateMode,
        }
      : null;
  const selectedConfigNode = configPanelMode === 'node' ? selectedNode : null;
  const isConfigPanelVisible = Boolean(agentMetaPanel || selectedConfigNode);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load agents ─────────────────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true;
    setIsLoadingAgents(true);
    listAiAgents()
      .then((result) => {
        if (!mounted) return;
        setAgents(result);
        if (result.length > 0) {
          const first = result[0];
          selectAgent(first);
        } else {
          loadFlow(null);
        }
      })
      .catch(() => {
        if (mounted) setError('Não foi possível carregar os agentes.');
      })
      .finally(() => {
        if (mounted) setIsLoadingAgents(false);
      });
    return () => { mounted = false; };
  }, [listAiAgents]);

  // ── Flow state management ────────────────────────────────────────────────────

  function loadFlow(agent: AiAgentSummary | null) {
    const flow = agentToFlow(agent);
    setNodes(flow.nodes);
    setEdges(flow.edges);
    setFitViewKey((k) => k + 1);
    setSelectedNodeId(null);
    setConfigPanelMode(null);
  }

  function selectAgent(agent: AiAgentSummary) {
    setSelectedAgentId(agent.id);
    setAgentName(agent.name);
    setAgentKey(agent.key);
    setAgentDescription(agent.description ?? '');
    setAgentIsActive(agent.isActive);
    setError(null);
    loadFlow(agent);
  }

  function handleCreateNew() {
    setSelectedAgentId(null);
    setAgentName('');
    setAgentKey('');
    setAgentDescription('');
    setAgentIsActive(true);
    setError(null);
    loadFlow(null);
    setConfigPanelMode('agent');
  }

  // ── ReactFlow handlers ───────────────────────────────────────────────────────

  const onNodesChange: OnNodesChange<AgentFlowNode> = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds) as AgentFlowNode[]),
    [],
  );

  const onEdgesChange: OnEdgesChange<AgentFlowEdge> = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds) as AgentFlowEdge[]),
    [],
  );

  const handleEdgesAdd = useCallback((newEdges: AgentFlowEdge[]) => {
    setEdges(newEdges);
  }, []);

  const handleNodesAdd = useCallback((newNodes: AgentFlowNode[]) => {
    setNodes((nds) => [...nds, ...newNodes]);
  }, []);

  const handleNodeDataChange = useCallback((nodeId: string, data: AgentNodeData) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data } : n)),
    );
  }, []);

  const handleNodeSelect = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    setConfigPanelMode(nodeId ? 'node' : null);
  }, []);

  const handleAgentMetaChange = useCallback(
    (patch: Partial<Omit<AgentMetaForm, 'isCreateMode'>>) => {
      if (patch.name !== undefined) {
        setAgentName(patch.name);
        if (isCreateMode && patch.key === undefined) setAgentKey(normalizeKey(patch.name));
      }
      if (patch.key !== undefined && isCreateMode) setAgentKey(normalizeKey(patch.key));
      if (patch.description !== undefined) setAgentDescription(patch.description);
      if (patch.isActive !== undefined) setAgentIsActive(patch.isActive);
    },
    [isCreateMode],
  );

  function handleEditAgent(agent: AiAgentSummary) {
    if (agent.id !== selectedAgentId) selectAgent(agent);
    setSelectedNodeId(null);
    setConfigPanelMode('agent');
  }

  function handleCloseConfigPanel() {
    setSelectedNodeId(null);
    setConfigPanelMode(null);
  }

  // ── Save ─────────────────────────────────────────────────────────────────────

  const canSave =
    agentName.trim().length >= 2 &&
    !isSaving &&
    !isLoadingAgents;

  async function handleSave() {
    if (!canSave) return;

    const key = isCreateMode ? normalizeKey(agentKey || agentName) : agentKey;
    if (isCreateMode && key.length < 2) {
      setError('Nome do agente muito curto para gerar chave.');
      return;
    }

    const currentFlow: AgentFlow = { nodes, edges };
    const payload = flowToAgentPayload(currentFlow, {
      name: agentName.trim(),
      key,
      description: agentDescription.trim(),
      isActive: agentIsActive,
    });

    setIsSaving(true);
    setError(null);
    try {
      let savedId: string;
      if (isCreateMode) {
        const created = await createAiAgent(payload);
        savedId = created.id;
      } else {
        await updateAiAgent(selectedAgentId!, {
          name: payload.name,
          description: payload.description ?? null,
          model: payload.model,
          temperature: payload.temperature,
          systemPrompt: payload.systemPrompt,
          config: payload.config,
          isActive: payload.isActive,
        });
        savedId = selectedAgentId!;
      }
      const nextAgents = await listAiAgents();
      setAgents(nextAgents);
      const saved = nextAgents.find((a) => a.id === savedId) ?? nextAgents[0];
      if (saved) selectAgent(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    } finally {
      setIsSaving(false);
    }
  }

  // ── Auto-generate key from name (create mode) ────────────────────────────────

  function handleNameChange(value: string) {
    setAgentName(value);
    if (isCreateMode) setAgentKey(normalizeKey(value));
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const topNavigation = (
    <WorkspaceTopNavigation<'agents'>
      value="agents"
      items={[{ id: 'agents', label: 'Agentes de IA' }]}
      onChange={() => undefined}
      ariaLabel="Agentes de IA"
      actions={
        <>
          <WorkspaceActionButton
            label="Novo agente"
            icon={<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>}
            onClick={handleCreateNew}
            disabled={isSaving}
          />
          <WorkspaceActionButton
            tone="accent"
            label={isCreateMode ? 'Criar agente' : 'Salvar alteracoes'}
            onClick={() => void handleSave()}
            disabled={!canSave}
            icon={
              isSaving ? (
                <svg viewBox="0 0 16 16" fill="none" className="ab-nav__spin">
                  <path d="M8 2a6 6 0 1 1-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              ) : (
                <AppIcon name="check" />
              )
            }
          />
        </>
      }
    />
  );

  return (
    <AppShell
      metrics={metrics}
      noPageScroll
      hidePageHeader
      hideSidebarBrandMark
      topNavigation={topNavigation}
    >
      <WorkspaceFrame className="ab-page" variant="editor" scroll="none">
        <LoadingState text="Carregando agentes..." animation="ai" variant="frame" visible={isLoadingAgents} />

        <StudioLayout
          sidebar={
            <PanelMenu
              title="Agentes"
              count={agents.length}
              action={
                <button
                  type="button"
                  className="ab-create-btn"
                  onClick={handleCreateNew}
                  disabled={isSaving}
                  aria-label="Novo agente"
                  title="Novo agente"
                >
                  <AppIcon name="plus" size={14} />
                </button>
              }
            >
              {agents.length === 0 && !isLoadingAgents ? (
                <EmptyState
                  title="Nenhum agente ainda"
                  description='Clique em "Novo agente" para configurar contexto, modelo e saida.'
                  size="compact"
                  variant="card"
                />
              ) : (
                agents.map((agent) => {
                  const cfg = asConfig(agent.config);
                  const rag = cfg.rag ?? {};
                  const src = rag.enabled === false ? 'none' : (rag.source ?? 'documentation');
                  const isSelected = agent.id === selectedAgentId;
                  return (
                    <PanelMenuItem
                      key={agent.id}
                      selected={isSelected}
                      onClick={() => selectAgent(agent)}
                      label={agent.name}
                      meta={agent.key}
                      trailing={
                        <StatusBadge tone={agent.isActive ? 'success' : 'warning'} size="sm">
                          {agent.isActive ? 'Ativo' : 'Inativo'}
                        </StatusBadge>
                      }
                      actions={
                        <button
                          type="button"
                          className="ab-agent-edit-btn"
                          onClick={(e) => { e.stopPropagation(); handleEditAgent(agent); }}
                          aria-label={`Editar ${agent.name}`}
                          title="Editar agente"
                        >
                          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                            <path
                              d="M9.8 3.1l3.1 3.1M3.5 12.5l2.7-.5 6.2-6.2a1.45 1.45 0 0 0-2.1-2.1L4.1 9.9l-.6 2.6z"
                              stroke="currentColor"
                              strokeWidth="1.4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      }
                    />
                  );
                })
              )}
              {isCreateMode && (
                <PanelMenuItem
                  selected
                  label={agentName || 'Novo agente'}
                  description="Ainda nao salvo"
                  trailing={<StatusBadge tone="warning" size="sm">Novo</StatusBadge>}
                  className="ab-agent-new-item"
                />
              )}
            </PanelMenu>
          }
          inspector={
            <AgentConfigPanel
              node={selectedConfigNode}
              agent={agentMetaPanel}
              onClose={handleCloseConfigPanel}
              onNodeDataChange={handleNodeDataChange}
              onAgentMetaChange={handleAgentMetaChange}
            />
          }
          inspectorOpen={isConfigPanelVisible}
          inspectorWidth={340}
        >
          {error ? (
            <div className="ab-error">{error}</div>
          ) : null}
          <AgentFlowCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onEdgesAdd={handleEdgesAdd}
            onNodesAdd={handleNodesAdd}
            onNodeSelect={handleNodeSelect}
            fitViewKey={fitViewKey}
            selectedNodeId={selectedNodeId}
          />
        </StudioLayout>
      </WorkspaceFrame>
    </AppShell>
  );
}
