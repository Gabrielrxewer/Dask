import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  addEdge,
  useEdgesState,
  useNodesState,
  MarkerType,
} from '@xyflow/react';
import type {
  Connection,
  Edge,
  OnConnect,
  ReactFlowInstance,
} from '@xyflow/react';

import type {
  JourneyEdge,
  JourneyNode,
  JourneyNodeData,
  JourneyNodeKind,
} from './types';
import { PALETTE_ITEMS, validateNode } from './types';
import { FlowCanvas, type FlowCanvasPaletteItem } from '@/shared/ui';
import { TriggerNode } from './nodes/trigger-node';
import { ActionNode } from './nodes/action-node';
import { ConditionNode } from './nodes/condition-node';
import { DelayNode } from './nodes/delay-node';
import { ExitNode } from './nodes/exit-node';
import { AddEdge } from './edges/add-edge';
import { NodeInspector } from './panels/node-inspector';
import type { MarketingAutomationFlow } from '@/modules/marketing';
import './journey-builder.css';

const NODE_TYPES = {
  TRIGGER: TriggerNode,
  ACTION: ActionNode,
  CONDITION: ConditionNode,
  DELAY: DelayNode,
  EXIT: ExitNode,
};

const EDGE_TYPES = {
  add: AddEdge,
};

const DEFAULT_EDGE_OPTIONS = {
  type: 'add',
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: 'var(--line-contrast)' },
  animated: false,
};

const KIND_COLORS: Record<JourneyNodeKind, string> = {
  TRIGGER: 'var(--accent)',
  ACTION: 'var(--success)',
  CONDITION: 'var(--warning)',
  DELAY: 'var(--decorative-purple)',
  EXIT: 'var(--danger)',
};

const CANVAS_PALETTE_ITEMS: FlowCanvasPaletteItem<JourneyNodeKind, JourneyNodeData>[] = PALETTE_ITEMS.map((item) => ({
  kind: item.kind,
  label: item.label,
  description: item.description,
  color: KIND_COLORS[item.kind],
  deletable: item.kind !== 'TRIGGER',
  buildData: () => {
    const data: JourneyNodeData = {
      kind: item.kind,
      label: item.label,
      config: item.defaultConfig,
      validation: 'incomplete',
    };
    data.validation = validateNode(data);
    return data;
  },
}));

const FLOW_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Rascunho',
  ACTIVE: 'Ativa',
  PAUSED: 'Pausada',
  ARCHIVED: 'Arquivada',
};

function flowStatusLabel(status: string | null | undefined) {
  return FLOW_STATUS_LABELS[status ?? 'DRAFT'] ?? status ?? 'Rascunho';
}

function makeNode(kind: JourneyNodeKind, position: { x: number; y: number }): JourneyNode {
  const item = PALETTE_ITEMS.find((p) => p.kind === kind)!;
  const data: JourneyNodeData = {
    kind,
    label: item.label,
    config: item.defaultConfig,
    validation: 'incomplete',
  };
  data.validation = validateNode(data);
  return {
    id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: kind,
    position,
    data,
  };
}

interface InsertPickerState {
  edgeId: string;
  x: number;
  y: number;
}

interface ToastState {
  message: string;
  kind: 'ok' | 'error';
}

interface JourneyBuilderInnerProps {
  flow: MarketingAutomationFlow | null;
  onSave: (name: string, nodes: JourneyNode[], edges: JourneyEdge[]) => Promise<void>;
  onActivate: (flowId: string) => Promise<void>;
  onDeactivate: (flowId: string) => Promise<void>;
  isSaving: boolean;
}

function JourneyBuilderInner({ flow, onSave, onActivate, onDeactivate, isSaving }: JourneyBuilderInnerProps) {
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance<JourneyNode, Edge> | null>(null);

  const [flowName, setFlowName] = useState(flow?.name ?? 'Novo fluxo');
  const [nodes, setNodes, onNodesChange] = useNodesState<JourneyNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [insertPicker, setInsertPicker] = useState<InsertPickerState | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Load existing flow
  useEffect(() => {
    if (!flow) return;
    setFlowName(flow.name);
    try {
      const saved = flow.triggerDefinition as { nodes?: JourneyNode[]; edges?: JourneyEdge[] };
      if (saved.nodes && saved.edges) {
        setNodes(saved.nodes);
        setEdges(saved.edges);
      }
    } catch {
      // ignore
    }
  }, [flow?.id]);

  function showToast(message: string, kind: 'ok' | 'error' = 'ok') {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 2800);
  }

  // Connections
  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'add',
            markerEnd: DEFAULT_EDGE_OPTIONS.markerEnd,
            data: { branchType: params.sourceHandle === 'yes' ? 'yes' : params.sourceHandle === 'no' ? 'no' : 'default' },
          },
          eds,
        ),
      );
    },
    [],
  );

  const handleNodeSelect = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    setInsertPicker(null);
  }, []);

  const handleNodesAdd = useCallback((newNodes: JourneyNode[]) => {
    setNodes((nds) => [...nds, ...newNodes]);
  }, [setNodes]);

  // "+" on edge → show insert picker
  function handleInsert(edgeId: string) {
    const edge = edges.find((e) => e.id === edgeId);
    if (!edge) return;
    const sourceNode = nodes.find((n) => n.id === edge.source);
    if (!sourceNode) return;

    // Position picker near center of edge
    const midX = (sourceNode.position.x ?? 0) + 130;
    const midY = (sourceNode.position.y ?? 0) + 100;
    const screenPos = rfInstance?.flowToScreenPosition({ x: midX, y: midY }) ?? { x: 400, y: 300 };
    setInsertPicker({ edgeId, x: screenPos.x, y: screenPos.y });
    setSelectedNodeId(null);
  }

  function insertNodeOnEdge(kind: JourneyNodeKind) {
    if (!insertPicker) return;
    const { edgeId } = insertPicker;
    const edge = edges.find((e) => e.id === edgeId);
    if (!edge) return;

    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);

    const position = {
      x: ((sourceNode?.position.x ?? 0) + (targetNode?.position.x ?? sourceNode?.position.x ?? 0)) / 2,
      y: ((sourceNode?.position.y ?? 0) + (targetNode?.position.y ?? (sourceNode?.position.y ?? 0) + 180)) / 2 + 90,
    };

    const newNode = makeNode(kind, position);

    // Remove old edge, add two new ones
    const newEdge1: JourneyEdge = {
      id: `e-${edge.source}-${newNode.id}`,
      source: edge.source,
      sourceHandle: edge.sourceHandle,
      target: newNode.id,
      type: 'add',
      markerEnd: DEFAULT_EDGE_OPTIONS.markerEnd,
      data: { branchType: 'default' },
    };
    const newEdge2: JourneyEdge = {
      id: `e-${newNode.id}-${edge.target}`,
      source: newNode.id,
      target: edge.target,
      type: 'add',
      markerEnd: DEFAULT_EDGE_OPTIONS.markerEnd,
      data: { branchType: 'default' },
    };

    setEdges((eds) => [...eds.filter((e) => e.id !== edgeId), newEdge1, newEdge2]);
    setNodes((nds) => [...nds, newNode]);
    setInsertPicker(null);
  }

  // Inject edge insert handler into edge data
  const edgesWithHandler = edges.map((e) => ({
    ...e,
    data: { ...e.data, onInsert: handleInsert },
  }));

  // Update node data from inspector
  function handleNodeUpdate(id: string, data: Partial<JourneyNodeData>) {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id
          ? { ...n, data: { ...n.data, ...data } }
          : n,
      ),
    );
  }

  // Delete node from inspector
  function handleNodeDelete(id: string) {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    setSelectedNodeId(null);
  }

  const selectedNode = (nodes.find((n) => n.id === selectedNodeId) ?? null) as JourneyNode | null;

  async function handleSave() {
    try {
      await onSave(flowName, nodes as JourneyNode[], edges as JourneyEdge[]);
      showToast('Fluxo salvo com sucesso');
    } catch {
      showToast('Erro ao salvar', 'error');
    }
  }

  async function handleToggleActive() {
    if (!flow) return;
    try {
      if (flow.status === 'ACTIVE') {
        await onDeactivate(flow.id);
        showToast('Fluxo pausado');
      } else {
        await onActivate(flow.id);
        showToast('Fluxo ativado');
      }
    } catch {
      showToast('Erro ao alterar status', 'error');
    }
  }

  const statusBadgeClass =
    flow?.status === 'ACTIVE'
      ? 'jb-toolbar__badge--active'
      : flow?.status === 'PAUSED'
        ? 'jb-toolbar__badge--paused'
        : 'jb-toolbar__badge--draft';

  const isEmpty = nodes.length === 0;

  return (
    <div className="jb">
      {/* Toolbar */}
      <div className="jb-toolbar">
        <input
          className="jb-toolbar__name"
          value={flowName}
          onChange={(e) => setFlowName(e.target.value)}
          placeholder="Nome do fluxo"
        />

        <div className="jb-toolbar__sep" />

        <span className={`jb-toolbar__badge ${statusBadgeClass}`}>
          {flowStatusLabel(flow?.status)}
        </span>

        <div className="jb-toolbar__spacer" />

        {flow && (
          <button
            type="button"
            className={`jb-toolbar__btn ${flow.status === 'ACTIVE' ? 'jb-toolbar__btn--danger' : ''}`}
            onClick={() => void handleToggleActive()}
          >
            {flow.status === 'ACTIVE' ? (
              <>
                <svg viewBox="0 0 14 14" fill="none">
                  <rect x="2" y="2" width="4" height="10" rx="1" fill="currentColor" />
                  <rect x="8" y="2" width="4" height="10" rx="1" fill="currentColor" />
                </svg>
                Pausar
              </>
            ) : (
              <>
                <svg viewBox="0 0 14 14" fill="none">
                  <path d="M3 2l10 5-10 5V2Z" fill="currentColor" />
                </svg>
                Ativar
              </>
            )}
          </button>
        )}

        <button
          type="button"
          className="jb-toolbar__btn jb-toolbar__btn--primary"
          onClick={() => void handleSave()}
          disabled={isSaving}
        >
          <svg viewBox="0 0 14 14" fill="none">
            <path d="M2 2h8l2 2v8a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2Z" stroke="var(--neutral-white)" strokeWidth="1.3" />
            <path d="M5 2v3h4V2M4 8h6" stroke="var(--neutral-white)" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          {isSaving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      {/* Canvas */}
      <div className="jb__canvas">
        <FlowCanvas<JourneyNodeData, JourneyNodeKind>
          nodes={nodes}
          edges={edgesWithHandler}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
          onConnect={onConnect}
          onInit={setRfInstance}
          paletteItems={CANVAS_PALETTE_ITEMS}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onEdgesAdd={setEdges}
          onNodesAdd={handleNodesAdd}
          onNodeSelect={handleNodeSelect}
          fitViewKey={flow?.id ? nodes.length : 0}
          emptyHint="Abra o painel a esquerda e arraste um bloco para comecar"
          paletteTitle="Adicionar bloco"
          paletteEyebrow="Jornada"
        />

        {selectedNode && (
          <NodeInspector
            node={selectedNode}
            onClose={() => setSelectedNodeId(null)}
            onUpdate={handleNodeUpdate}
            onDelete={handleNodeDelete}
          />
        )}

        {/* Empty state overlay */}
        {isEmpty && (
          <div className="jb__empty" style={{ pointerEvents: 'none' }}>
            <div className="jb__empty-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M13 4L6 13h7L10 20l8-9h-7L13 4Z" fill="currentColor" />
              </svg>
            </div>
            <p className="jb__empty-title">Canvas vazio</p>
            <p className="jb__empty-hint">Arraste blocos da paleta esquerda ou conecte um gatilho para começar</p>
          </div>
        )}

        {/* Insert picker */}
        {insertPicker && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 99 }}
              onClick={() => setInsertPicker(null)}
            />
            <div
              className="jb-insert-picker"
              style={{ top: insertPicker.y, left: insertPicker.x }}
            >
              {PALETTE_ITEMS.filter((p) => p.kind !== 'TRIGGER').map((item) => (
                <button
                  key={item.kind}
                  type="button"
                  className="jb-insert-picker__item"
                  onClick={() => insertNodeOnEdge(item.kind)}
                >
                  <span
                    className="jb-insert-picker__dot"
                    style={{ background: KIND_COLORS[item.kind] }}
                  />
                  {item.label}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Toast */}
        {toast && (
          <div className={`jb-toast jb-toast--${toast.kind}`}>
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}

export interface JourneyBuilderProps {
  flow: MarketingAutomationFlow | null;
  onSave: (name: string, nodes: JourneyNode[], edges: JourneyEdge[]) => Promise<void>;
  onActivate: (flowId: string) => Promise<void>;
  onDeactivate: (flowId: string) => Promise<void>;
  isSaving?: boolean;
}

export function JourneyBuilder(props: JourneyBuilderProps) {
  return (
    <div style={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <JourneyBuilderInner
        flow={props.flow}
        onSave={props.onSave}
        onActivate={props.onActivate}
        onDeactivate={props.onDeactivate}
        isSaving={props.isSaving ?? false}
      />
    </div>
  );
}
