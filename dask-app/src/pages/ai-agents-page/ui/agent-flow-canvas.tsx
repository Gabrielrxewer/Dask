import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Panel,
  addEdge,
  MarkerType,
  useReactFlow,
  type OnConnect,
  type OnNodesChange,
  type OnEdgesChange,
  type Connection,
  type XYPosition,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  TriggerNode,
  LlmNode,
  RagNode,
  ToolNode,
  ConditionNode,
  OutputNode,
} from './agent-flow-nodes';
import type {
  AgentFlowNode,
  AgentFlowEdge,
  AgentNodeKind,
  AgentNodeData,
  TriggerNodeData,
  LlmNodeData,
  RagNodeData,
  ToolNodeData,
  ConditionNodeData,
  OutputNodeData,
} from './agent-flow-types';
import { NODE_KIND_META } from './agent-flow-types';
import './agent-flow-canvas.css';

const NODE_TYPES = {
  trigger: TriggerNode,
  llm: LlmNode,
  rag: RagNode,
  tool: ToolNode,
  condition: ConditionNode,
  output: OutputNode,
} as const;

const DEFAULT_EDGE_OPTIONS = {
  type: 'smoothstep',
  animated: true,
  style: { strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
};

function buildDefaultNodeData(kind: AgentNodeKind): AgentNodeData {
  const map: Record<AgentNodeKind, AgentNodeData> = {
    trigger: { kind: 'trigger', label: 'Disparador', triggerType: 'manual' } as TriggerNodeData,
    llm: { kind: 'llm', label: 'LLM', model: 'gpt-4.1-mini', temperature: 0.2, systemPrompt: '' } as LlmNodeData,
    rag: {
      kind: 'rag',
      label: 'Contexto',
      source: 'documentation',
      topK: 5,
      contextInstruction: '',
      includeSemanticContext: true,
      includeLinkedDocuments: true,
    } as RagNodeData,
    tool: { kind: 'tool', label: 'Tool', toolId: 'web_search' } as ToolNodeData,
    condition: { kind: 'condition', label: 'Condicao', condition: '' } as ConditionNodeData,
    output: { kind: 'output', label: 'Resposta', outputType: 'text_response' } as OutputNodeData,
  };
  return map[kind];
}

function CanvasControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  return (
    <div className="afc__ctrl">
      <button
        type="button"
        className="afc__ctrl-btn"
        title="Aumentar zoom"
        aria-label="Aumentar zoom"
        onClick={() => zoomIn({ duration: 200 })}
      >
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>
      <div className="afc__ctrl-sep" />
      <button
        type="button"
        className="afc__ctrl-btn"
        title="Reduzir zoom"
        aria-label="Reduzir zoom"
        onClick={() => zoomOut({ duration: 200 })}
      >
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>
      <div className="afc__ctrl-sep" />
      <button
        type="button"
        className="afc__ctrl-btn"
        title="Ajustar tela"
        aria-label="Ajustar tela"
        onClick={() => fitView({ duration: 300, padding: 0.2 })}
      >
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M2 5.5V3h2.5M11.5 3H14v2.5M14 10.5V13h-2.5M4.5 13H2v-2.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

interface CanvasInnerProps {
  nodes: AgentFlowNode[];
  edges: AgentFlowEdge[];
  onNodesChange: OnNodesChange<AgentFlowNode>;
  onEdgesChange: OnEdgesChange<AgentFlowEdge>;
  onEdgesAdd: (edges: AgentFlowEdge[]) => void;
  onNodeSelect: (nodeId: string | null) => void;
  onNodesAdd: (nodes: AgentFlowNode[]) => void;
  fitViewKey: number;
  selectedNodeId: string | null;
}

function AgentFlowCanvasInner({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onEdgesAdd,
  onNodeSelect,
  onNodesAdd,
  fitViewKey,
}: CanvasInnerProps) {
  const reactFlow = useReactFlow();
  const canvasRef = useRef<HTMLDivElement>(null);
  const fitDoneRef = useRef(0);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    if (fitViewKey !== fitDoneRef.current) {
      fitDoneRef.current = fitViewKey;
      const timer = setTimeout(() => reactFlow.fitView({ padding: 0.2, duration: 300 }), 60);
      return () => clearTimeout(timer);
    }
  }, [fitViewKey, reactFlow]);

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const newEdges = addEdge(
        {
          ...connection,
          type: 'smoothstep',
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
        },
        edges,
      );
      onEdgesAdd(newEdges as AgentFlowEdge[]);
    },
    [edges, onEdgesAdd],
  );

  const getViewportCenter = useCallback((): XYPosition => {
    const el = canvasRef.current;
    if (!el) return { x: 300, y: 300 };
    const rect = el.getBoundingClientRect();
    return reactFlow.screenToFlowPosition({
      x: rect.x + rect.width / 2 + (Math.random() - 0.5) * 100,
      y: rect.y + rect.height / 2 + (Math.random() - 0.5) * 60,
    });
  }, [reactFlow]);

  const spawnNode = useCallback(
    (kind: AgentNodeKind, position?: XYPosition) => {
      const pos = position ?? getViewportCenter();
      const id = `${kind}-${Date.now()}`;
      const newNode: AgentFlowNode = {
        id,
        type: kind,
        position: pos,
        data: buildDefaultNodeData(kind),
        deletable: kind !== 'trigger' && kind !== 'output',
      };
      onNodesAdd([newNode]);
    },
    [getViewportCenter, onNodesAdd],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData('application/reactflow') as AgentNodeKind;
      if (!kind) return;
      const position = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      spawnNode(kind, position);
    },
    [reactFlow, spawnNode],
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: AgentFlowNode) => {
      onNodeSelect(node.id);
    },
    [onNodeSelect],
  );

  const handlePaneClick = useCallback(() => {
    onNodeSelect(null);
  }, [onNodeSelect]);

  return (
    <div className="afc" ref={canvasRef}>
      <div className={`afc__rail${paletteOpen ? ' afc__rail--open' : ''}`}>
        <div className="afc__sidebar">
          <div className="afc__sidebar-head">
            <div className="afc__sidebar-title">
              <span>Canvas</span>
              <strong>Adicionar no</strong>
            </div>
            <button
              type="button"
              className="afc__sidebar-close"
              onClick={() => setPaletteOpen(false)}
              aria-label="Fechar painel"
              title="Fechar painel"
            >
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="afc__sidebar-list">
            {NODE_KIND_META.map((meta) => (
              <div
                key={meta.kind}
                className="afc__sidebar-item"
                style={{ '--item-color': meta.color } as React.CSSProperties}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData('application/reactflow', meta.kind);
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => spawnNode(meta.kind)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    spawnNode(meta.kind);
                  }
                }}
                title={meta.description}
              >
                <span className="afc__sidebar-dot" />
                <div className="afc__sidebar-text">
                  <span className="afc__sidebar-label">{meta.label}</span>
                  <span className="afc__sidebar-desc">{meta.description}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="afc__sidebar-foot">
            <span className="afc__sidebar-foot-label">Visualizacao</span>
            <CanvasControls />
          </div>
        </div>

        <button
          type="button"
          className="afc__rail-toggle"
          onClick={() => setPaletteOpen((value) => !value)}
          title={paletteOpen ? 'Fechar painel' : 'Abrir painel de nos'}
          aria-label={paletteOpen ? 'Fechar painel' : 'Abrir painel de nos'}
        >
          <svg viewBox="0 0 8 14" fill="none" aria-hidden="true">
            {paletteOpen ? (
              <path d="M6 1L2 7l4 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <path d="M2 1l4 6-4 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            )}
          </svg>
        </button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={NODE_TYPES}
        defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
        fitView
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={2.5}
        className="afc__flow"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.3} className="afc__bg" />

        {nodes.length === 0 && (
          <Panel position="top-center" className="afc__empty-hint">
            <span>Abra o painel a esquerda e clique em um tipo de no para comecar</span>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

interface AgentFlowCanvasProps {
  nodes: AgentFlowNode[];
  edges: AgentFlowEdge[];
  onNodesChange: OnNodesChange<AgentFlowNode>;
  onEdgesChange: OnEdgesChange<AgentFlowEdge>;
  onEdgesAdd: (edges: AgentFlowEdge[]) => void;
  onNodeSelect: (nodeId: string | null) => void;
  onNodesAdd: (nodes: AgentFlowNode[]) => void;
  fitViewKey: number;
  selectedNodeId: string | null;
}

export function AgentFlowCanvas(props: AgentFlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <AgentFlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
