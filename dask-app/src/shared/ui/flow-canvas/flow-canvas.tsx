import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Panel,
  addEdge,
  MarkerType,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeTypes,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  type ReactFlowInstance,
  type XYPosition,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { EmptyState } from "@/shared/ui/empty-state";
import { AppIcon } from "@/shared/ui/icon";
import './flow-canvas.css';

export interface FlowCanvasPaletteItem<TKind extends string, TData extends Record<string, unknown>> {
  kind: TKind;
  label: string;
  description: string;
  color: string;
  buildData: () => TData;
  deletable?: boolean;
}

const DEFAULT_EDGE_OPTIONS = {
  type: 'smoothstep',
  animated: true,
  style: { strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
};

function FlowCanvasControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div className="flow-canvas-ui__ctrl">
      <button type="button" className="flow-canvas-ui__ctrl-btn" title="Aumentar zoom" aria-label="Aumentar zoom" onClick={() => zoomIn({ duration: 200 })}>
        <AppIcon name="plus" size={16} strokeWidth={1.7} />
      </button>
      <div className="flow-canvas-ui__ctrl-sep" />
      <button type="button" className="flow-canvas-ui__ctrl-btn" title="Reduzir zoom" aria-label="Reduzir zoom" onClick={() => zoomOut({ duration: 200 })}>
        <AppIcon name="minus" size={16} strokeWidth={1.7} />
      </button>
      <div className="flow-canvas-ui__ctrl-sep" />
      <button type="button" className="flow-canvas-ui__ctrl-btn" title="Ajustar tela" aria-label="Ajustar tela" onClick={() => fitView({ duration: 300, padding: 0.25, maxZoom: 0.85 })}>
        <AppIcon name="settings" size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
}

interface FlowCanvasInnerProps<TData extends Record<string, unknown>, TKind extends string> {
  nodes: Node<TData, TKind>[];
  edges: Edge[];
  nodeTypes: NodeTypes;
  edgeTypes?: EdgeTypes;
  defaultEdgeOptions?: Partial<Edge>;
  onConnect?: OnConnect;
  onInit?: (instance: ReactFlowInstance<Node<TData, TKind>, Edge>) => void;
  paletteItems: FlowCanvasPaletteItem<TKind, TData>[];
  onNodesChange: OnNodesChange<Node<TData, TKind>>;
  onEdgesChange: OnEdgesChange<Edge>;
  onEdgesAdd: (edges: Edge[]) => void;
  onNodesAdd: (nodes: Node<TData, TKind>[]) => void;
  onNodeSelect: (nodeId: string | null) => void;
  fitViewKey: number;
  emptyHint?: string;
  paletteTitle?: string;
  paletteEyebrow?: string;
  className?: string;
  nodesDraggable?: boolean;
  nodesConnectable?: boolean;
  elementsSelectable?: boolean;
  sidebarContent?: ReactNode;
  sidebarFooter?: ReactNode;
  sidebarDefaultOpen?: boolean;
}

function FlowCanvasInner<TData extends Record<string, unknown>, TKind extends string>({
  nodes,
  edges,
  nodeTypes,
  edgeTypes,
  defaultEdgeOptions = DEFAULT_EDGE_OPTIONS,
  onConnect: customOnConnect,
  onInit,
  paletteItems,
  onNodesChange,
  onEdgesChange,
  onEdgesAdd,
  onNodesAdd,
  onNodeSelect,
  fitViewKey,
  emptyHint = 'Abra o painel a esquerda e clique em um tipo de no para comecar',
  paletteTitle = 'Adicionar no',
  paletteEyebrow = 'Canvas',
  className,
  nodesDraggable = true,
  nodesConnectable = true,
  elementsSelectable = true,
  sidebarContent,
  sidebarFooter,
  sidebarDefaultOpen = false,
}: FlowCanvasInnerProps<TData, TKind>) {
  const reactFlow = useReactFlow<Node<TData, TKind>, Edge>();
  const canvasRef = useRef<HTMLDivElement>(null);
  const fitDoneRef = useRef(0);
  const [paletteOpen, setPaletteOpen] = useState(sidebarDefaultOpen);
  const hasSidebar = paletteItems.length > 0 || Boolean(sidebarContent);

  useEffect(() => {
    if (fitViewKey !== fitDoneRef.current) {
      fitDoneRef.current = fitViewKey;
      const timer = setTimeout(() => reactFlow.fitView({ padding: 0.25, maxZoom: 0.85, duration: 300 }), 60);
      return () => clearTimeout(timer);
    }
  }, [fitViewKey, reactFlow]);

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (customOnConnect) {
        customOnConnect(connection);
        return;
      }
      const newEdges = addEdge(
        {
          ...connection,
          type: 'smoothstep',
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
        },
        edges,
      );
      onEdgesAdd(newEdges);
    },
    [customOnConnect, edges, onEdgesAdd],
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
    (item: FlowCanvasPaletteItem<TKind, TData>, position?: XYPosition) => {
      const pos = position ?? getViewportCenter();
      const id = `${item.kind}-${Date.now()}`;
      const newNode: Node<TData, TKind> = {
        id,
        type: item.kind,
        position: pos,
        data: item.buildData(),
        deletable: item.deletable ?? true,
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
      const kind = event.dataTransfer.getData('application/reactflow') as TKind;
      const item = paletteItems.find((entry) => entry.kind === kind);
      if (!item) return;
      const position = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      spawnNode(item, position);
    },
    [paletteItems, reactFlow, spawnNode],
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<TData, TKind>) => {
      onNodeSelect(node.id);
    },
    [onNodeSelect],
  );

  return (
    <div className={`flow-canvas-ui${className ? ` ${className}` : ''}`} ref={canvasRef}>
      {hasSidebar && (
        <div className={`flow-canvas-ui__rail${paletteOpen ? ' flow-canvas-ui__rail--open' : ''}`}>
          <div className="flow-canvas-ui__sidebar">
            <div className="flow-canvas-ui__sidebar-head">
              <div className="flow-canvas-ui__sidebar-title">
                <span>{paletteEyebrow}</span>
                <strong>{paletteTitle}</strong>
              </div>
              <button type="button" className="flow-canvas-ui__sidebar-close" onClick={() => setPaletteOpen(false)} aria-label="Fechar painel" title="Fechar painel">
                <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {sidebarContent ? (
              <div className="flow-canvas-ui__sidebar-list flow-canvas-ui__sidebar-list--custom">
                {sidebarContent}
              </div>
            ) : (
              <div className="flow-canvas-ui__sidebar-list">
                {paletteItems.map((item) => (
                  <div
                    key={item.kind}
                    className="flow-canvas-ui__sidebar-item"
                    style={{ '--item-color': item.color } as React.CSSProperties}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData('application/reactflow', item.kind);
                      event.dataTransfer.effectAllowed = 'move';
                    }}
                    onClick={() => spawnNode(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        spawnNode(item);
                      }
                    }}
                    title={item.description}
                  >
                    <span className="flow-canvas-ui__sidebar-dot" />
                    <div className="flow-canvas-ui__sidebar-text">
                      <span className="flow-canvas-ui__sidebar-label">{item.label}</span>
                      <span className="flow-canvas-ui__sidebar-desc">{item.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flow-canvas-ui__sidebar-foot">
              {sidebarFooter ?? (
                <>
                  <span className="flow-canvas-ui__sidebar-foot-label">Visualizacao</span>
                  <FlowCanvasControls />
                </>
              )}
            </div>
          </div>

          <button type="button" className="flow-canvas-ui__rail-toggle" onClick={() => setPaletteOpen((value) => !value)} title={paletteOpen ? 'Fechar painel' : 'Abrir painel de nos'} aria-label={paletteOpen ? 'Fechar painel' : 'Abrir painel de nos'}>
            <svg viewBox="0 0 8 14" fill="none" aria-hidden="true">
              {paletteOpen ? (
                <path d="M6 1L2 7l4 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              ) : (
                <path d="M2 1l4 6-4 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </svg>
          </button>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={() => onNodeSelect(null)}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        onInit={onInit}
        nodesDraggable={nodesDraggable}
        nodesConnectable={nodesConnectable}
        elementsSelectable={elementsSelectable}
        fitView
        proOptions={{ hideAttribution: true }}
        minZoom={0.2}
        maxZoom={2.5}
        className="flow-canvas-ui__flow"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.3} className="flow-canvas-ui__bg" />

        {nodes.length === 0 && (
          <Panel position="top-center" className="flow-canvas-ui__empty-hint">
            <EmptyState title={emptyHint} size="compact" />
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

export interface FlowCanvasProps<TData extends Record<string, unknown>, TKind extends string>
  extends FlowCanvasInnerProps<TData, TKind> {}

export function FlowCanvas<TData extends Record<string, unknown>, TKind extends string>(props: FlowCanvasProps<TData, TKind>) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
