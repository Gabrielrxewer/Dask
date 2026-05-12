import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent
} from '@dnd-kit/core';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  MiniMap,
  Panel,
  addEdge,
  MarkerType,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeTypes,
  type IsValidConnection,
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
import {
  FLOW_NODE_SIDEBAR_DRAG_TYPE,
  FlowNodeSidebarMenu,
  type FlowNodeSidebarDragData
} from "./flow-node-sidebar-menu";
import { createFlowCanvasNode, type FlowCanvasPaletteItem } from "./flow-canvas-node-insertion";
import './flow-canvas.css';

export type { FlowCanvasPaletteItem } from "./flow-canvas-node-insertion";

const DEFAULT_EDGE_OPTIONS = {
  type: 'smoothstep',
  animated: true,
  style: { strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
};

const FLOW_CANVAS_DROP_EXCLUDED_SELECTOR = ".flow-canvas-ui__sidebar, .flow-canvas-ui__rail-toggle";

function readSidebarDragItemId<TKind extends string>(
  event: DragStartEvent | DragMoveEvent | DragEndEvent
): TKind | null {
  const data = event.active.data.current as Partial<FlowNodeSidebarDragData<string>> | undefined;
  if (data?.type !== FLOW_NODE_SIDEBAR_DRAG_TYPE || typeof data.itemId !== "string") {
    return null;
  }
  return data.itemId as TKind;
}

function getClientPointFromActivator(event: Event): XYPosition | null {
  const pointer = event as MouseEvent;
  if (typeof pointer.clientX === "number" && typeof pointer.clientY === "number") {
    return { x: pointer.clientX, y: pointer.clientY };
  }

  const touchEvent = event as TouchEvent;
  const touch = touchEvent.touches?.[0] ?? touchEvent.changedTouches?.[0];
  if (!touch) return null;
  return { x: touch.clientX, y: touch.clientY };
}

function getDndClientPoint(event: Pick<DragMoveEvent | DragEndEvent, "activatorEvent" | "delta">): XYPosition | null {
  const startPoint = getClientPointFromActivator(event.activatorEvent);
  if (!startPoint) return null;
  return {
    x: startPoint.x + event.delta.x,
    y: startPoint.y + event.delta.y
  };
}

function FlowCanvasControls({ fitViewMaxZoom }: { fitViewMaxZoom: number }) {
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
      <button type="button" className="flow-canvas-ui__ctrl-btn" title="Ajustar tela" aria-label="Ajustar tela" onClick={() => fitView({ duration: 300, padding: 0.25, maxZoom: fitViewMaxZoom })}>
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
  focusNodeId?: string | null;
  fitViewMaxZoom?: number;
  focusNodeZoom?: number;
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
  showMiniMap?: boolean;
  showCanvasControls?: boolean;
  validateConnection?: (connection: Connection) => string | null;
  onInvalidConnection?: (connection: Connection, reason: string) => void;
  invalidEdgeIds?: Iterable<string>;
  topPanel?: ReactNode;
  bottomPanel?: ReactNode;
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
  focusNodeId,
  fitViewMaxZoom = 0.85,
  focusNodeZoom = 0.55,
  emptyHint = 'Abra o painel a esquerda e clique ou arraste um tipo de no para comecar',
  paletteTitle = 'Adicionar no',
  paletteEyebrow = 'Canvas',
  className,
  nodesDraggable = true,
  nodesConnectable = true,
  elementsSelectable = true,
  sidebarContent,
  sidebarFooter,
  sidebarDefaultOpen = false,
  showMiniMap = false,
  showCanvasControls,
  validateConnection,
  onInvalidConnection,
  invalidEdgeIds,
  topPanel,
  bottomPanel,
}: FlowCanvasInnerProps<TData, TKind>) {
  const reactFlow = useReactFlow<Node<TData, TKind>, Edge>();
  const canvasRef = useRef<HTMLDivElement>(null);
  const fitDoneRef = useRef<number | null>(null);
  const lastDragPointRef = useRef<XYPosition | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(sidebarDefaultOpen);
  const [activePaletteKind, setActivePaletteKind] = useState<TKind | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 6 }
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 8 }
    })
  );
  const hasSidebar = paletteItems.length > 0 || Boolean(sidebarContent);
  const shouldShowCanvasControls = showCanvasControls ?? !hasSidebar;
  const invalidEdgeIdSet = useMemo(() => new Set(invalidEdgeIds ?? []), [invalidEdgeIds]);
  const activePaletteItem = useMemo(
    () => paletteItems.find((item) => item.kind === activePaletteKind) ?? null,
    [activePaletteKind, paletteItems]
  );
  const renderedEdges = useMemo(
    () => edges.map((edge) => invalidEdgeIdSet.has(edge.id)
      ? {
          ...edge,
          animated: false,
          className: `${edge.className ?? ''} flow-canvas-ui__edge--invalid`.trim(),
          style: {
            ...edge.style,
            stroke: 'var(--danger, #dc2626)',
            strokeWidth: 2.5,
            strokeDasharray: '8 6'
          },
          label: edge.label ?? 'Invalida',
          labelStyle: {
            ...edge.labelStyle,
            fill: 'var(--danger, #dc2626)',
            fontWeight: 800
          }
        }
      : edge
    ),
    [edges, invalidEdgeIdSet]
  );

  useEffect(() => {
    if (fitViewKey !== fitDoneRef.current) {
      fitDoneRef.current = fitViewKey;
      const timer = setTimeout(() => {
        const focusNode = focusNodeId ? nodes.find((node) => node.id === focusNodeId) : null;
        if (focusNode) {
          const width = focusNode.measured?.width ?? focusNode.width ?? 0;
          const height = focusNode.measured?.height ?? focusNode.height ?? 0;
          reactFlow.setCenter(focusNode.position.x + width / 2, focusNode.position.y + height / 2, {
            zoom: focusNodeZoom,
            duration: 300
          });
          return;
        }

        reactFlow.fitView({ padding: 0.25, maxZoom: fitViewMaxZoom, duration: 300 });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [fitViewKey, fitViewMaxZoom, focusNodeId, focusNodeZoom, nodes, reactFlow]);

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      const invalidReason = validateConnection?.(connection);
      if (invalidReason) {
        onInvalidConnection?.(connection, invalidReason);
        return;
      }

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
    [customOnConnect, edges, onEdgesAdd, onInvalidConnection, validateConnection],
  );

  const isValidConnection: IsValidConnection<Edge> = useCallback(
    (connection) => !validateConnection?.(connection as Connection),
    [validateConnection]
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
      const newNode = createFlowCanvasNode(item, pos);
      onNodesAdd([newNode]);
    },
    [getViewportCenter, onNodesAdd],
  );

  const isDropPointOnCanvas = useCallback((point: XYPosition) => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    const rect = canvas.getBoundingClientRect();
    const isInsideCanvasBounds =
      point.x >= rect.left &&
      point.x <= rect.right &&
      point.y >= rect.top &&
      point.y <= rect.bottom;
    if (!isInsideCanvasBounds) return false;
    if (typeof document === "undefined") return true;

    const topElement = document.elementFromPoint(point.x, point.y);
    if (!topElement) return true;
    if (topElement.closest(FLOW_CANVAS_DROP_EXCLUDED_SELECTOR)) return false;
    return canvas.contains(topElement);
  }, []);

  const clearDragState = useCallback(() => {
    setActivePaletteKind(null);
    lastDragPointRef.current = null;
  }, []);

  const handleDndStart = useCallback((event: DragStartEvent) => {
    const kind = readSidebarDragItemId<TKind>(event);
    if (!kind) return;
    setActivePaletteKind(kind);
    lastDragPointRef.current = getClientPointFromActivator(event.activatorEvent);
  }, []);

  const handleDndMove = useCallback((event: DragMoveEvent) => {
    const kind = readSidebarDragItemId<TKind>(event);
    if (!kind) return;
    setActivePaletteKind(kind);
    lastDragPointRef.current = getDndClientPoint(event);
  }, []);

  const handleDndEnd = useCallback(
    (event: DragEndEvent) => {
      const kind = readSidebarDragItemId<TKind>(event);
      const point = getDndClientPoint(event) ?? lastDragPointRef.current;
      clearDragState();
      if (!kind || !point || !isDropPointOnCanvas(point)) return;

      const item = paletteItems.find((entry) => entry.kind === kind);
      if (!item) return;
      const position = reactFlow.screenToFlowPosition(point);
      spawnNode(item, position);
    },
    [clearDragState, isDropPointOnCanvas, paletteItems, reactFlow, spawnNode],
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<TData, TKind>) => {
      onNodeSelect(node.id);
    },
    [onNodeSelect],
  );

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDndStart}
      onDragMove={handleDndMove}
      onDragCancel={clearDragState}
      onDragEnd={handleDndEnd}
    >
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
                  <FlowNodeSidebarMenu
                    sections={[
                      {
                        id: "default",
                        items: paletteItems.map((item) => ({
                          id: item.kind,
                          label: item.label,
                          description: item.description,
                          color: item.color
                        }))
                      }
                    ]}
                    onItemSelect={(menuItem) => {
                      const item = paletteItems.find((entry) => entry.kind === menuItem.id);
                      if (item) spawnNode(item);
                    }}
                  />
                </div>
              )}

              <div className="flow-canvas-ui__sidebar-foot">
                {sidebarFooter ?? (
                  <>
                    <span className="flow-canvas-ui__sidebar-foot-label">Visualizacao</span>
                    <FlowCanvasControls fitViewMaxZoom={fitViewMaxZoom} />
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
          edges={renderedEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          onNodeClick={handleNodeClick}
          onPaneClick={() => onNodeSelect(null)}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          onInit={onInit}
          nodesDraggable={nodesDraggable}
          nodesConnectable={nodesConnectable}
          elementsSelectable={elementsSelectable}
          fitView
          fitViewOptions={{ padding: 0.25, maxZoom: fitViewMaxZoom }}
          proOptions={{ hideAttribution: true }}
          minZoom={0.2}
          maxZoom={2.5}
          className="flow-canvas-ui__flow"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.3} className="flow-canvas-ui__bg" />

          {topPanel ? (
            <Panel position="top-right" className="flow-canvas-ui__panel flow-canvas-ui__panel--top">
              {topPanel}
            </Panel>
          ) : null}

          {bottomPanel ? (
            <Panel position="bottom-center" className="flow-canvas-ui__panel flow-canvas-ui__panel--bottom">
              {bottomPanel}
            </Panel>
          ) : null}

          {shouldShowCanvasControls ? (
            <Panel position="bottom-right" className="flow-canvas-ui__panel flow-canvas-ui__panel--controls">
              <FlowCanvasControls fitViewMaxZoom={fitViewMaxZoom} />
            </Panel>
          ) : null}

          {showMiniMap ? (
            <MiniMap
              pannable
              zoomable
              className="flow-canvas-ui__minimap"
              maskColor="color-mix(in oklab, var(--surface-muted, #f8fafc) 72%, transparent)"
              nodeStrokeWidth={3}
            />
          ) : null}

          {nodes.length === 0 && (
            <Panel position="top-center" className="flow-canvas-ui__empty-hint">
              <EmptyState title={emptyHint} size="compact" />
            </Panel>
          )}
        </ReactFlow>
      </div>

      <DragOverlay dropAnimation={null}>
        {activePaletteItem ? (
          <div
            className="flow-canvas-ui__drag-overlay"
            style={{ "--item-color": activePaletteItem.color } as CSSProperties}
          >
            <span className="flow-canvas-ui__sidebar-dot" />
            <div className="flow-canvas-ui__sidebar-text">
              <span className="flow-canvas-ui__sidebar-label">{activePaletteItem.label}</span>
              <span className="flow-canvas-ui__sidebar-desc">{activePaletteItem.description}</span>
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
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
