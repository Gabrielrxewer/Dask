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
import { AppIcon, Button, EmptyState, FlowCanvas, StatusBadge, TextInput, type FlowCanvasPaletteItem } from '@/shared/ui';
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
  BRANCH: ConditionNode,
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
  BRANCH: 'var(--warning)',
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

function flowStatusTone(status: string | null | undefined) {
  if (status === 'ACTIVE') return 'success';
  if (status === 'PAUSED') return 'warning';
  if (status === 'ARCHIVED') return 'muted';
  return 'neutral';
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

interface JourneyBuilderInnerProps {
  flow: MarketingAutomationFlow | null;
  onSave: (name: string, nodes: JourneyNode[], edges: JourneyEdge[]) => Promise<void>;
  onActivate: (flowId: string, name: string, nodes: JourneyNode[], edges: JourneyEdge[]) => Promise<void>;
  onDeactivate: (flowId: string) => Promise<void>;
  isSaving: boolean;
}

function JourneyBuilderInner({ flow, onSave, onActivate, onDeactivate, isSaving }: JourneyBuilderInnerProps) {
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance<JourneyNode, JourneyEdge> | null>(null);

  const [flowName, setFlowName] = useState(flow?.name ?? 'Novo fluxo');
  const [nodes, setNodes, onNodesChange] = useNodesState<JourneyNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<JourneyEdge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [insertPicker, setInsertPicker] = useState<InsertPickerState | null>(null);

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
  }, [flow?.id, flow?.updatedAt, setEdges, setNodes]);

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
    await onSave(flowName, nodes, edges);
  }

  async function handleToggleActive() {
    if (!flow) return;
    if (flow.status === 'ACTIVE') {
      await onDeactivate(flow.id);
    } else {
      await onActivate(flow.id, flowName, nodes, edges);
    }
  }

  const isEmpty = nodes.length === 0;

  return (
    <div className="jb">
      {/* Toolbar */}
      <div className="jb-toolbar">
        <TextInput
          className="jb-toolbar__name"
          value={flowName}
          onChange={(e) => setFlowName(e.target.value)}
          placeholder="Nome do fluxo"
        />

        <div className="jb-toolbar__sep" />

        <StatusBadge tone={flowStatusTone(flow?.status)} size="sm">
          {flowStatusLabel(flow?.status)}
        </StatusBadge>

        <div className="jb-toolbar__spacer" />

        {flow && (
          <Button
            size="sm"
            variant={flow.status === 'ACTIVE' ? 'danger' : 'outline'}
            onClick={() => void handleToggleActive()}
            disabled={isSaving}
          >
            {flow.status === 'ACTIVE' ? (
              <>
                <AppIcon name="pause" size={14} strokeWidth={2.2} />
                Pausar
              </>
            ) : (
              <>
                <AppIcon name="play" size={14} strokeWidth={2.2} />
                Ativar
              </>
            )}
          </Button>
        )}

        <Button
          size="sm"
          variant="primary"
          onClick={() => void handleSave()}
          disabled={isSaving}
        >
          <AppIcon name="check" size={14} strokeWidth={2.2} />
          {isSaving ? 'Salvando...' : 'Salvar'}
        </Button>
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
          <EmptyState
            className="jb__empty"
            style={{ pointerEvents: 'none' }}
            icon={
              <span className="jb__empty-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M13 4L6 13h7L10 20l8-9h-7L13 4Z" fill="currentColor" />
              </svg>
              </span>
            }
            title="Canvas vazio"
            description="Arraste blocos da paleta esquerda ou conecte um gatilho para começar"
          />
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
      </div>
    </div>
  );
}

export interface JourneyBuilderProps {
  flow: MarketingAutomationFlow | null;
  onSave: (name: string, nodes: JourneyNode[], edges: JourneyEdge[]) => Promise<void>;
  onActivate: (flowId: string, name: string, nodes: JourneyNode[], edges: JourneyEdge[]) => Promise<void>;
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
