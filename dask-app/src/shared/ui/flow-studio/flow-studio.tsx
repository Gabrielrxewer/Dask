import type { ReactNode } from "react";
import type { Connection, Edge, Node, NodeTypes, OnEdgesChange, OnNodesChange } from "@xyflow/react";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/empty-state";
import { FlowCanvas, FlowNodeSidebarMenu, type FlowCanvasPaletteItem, type FlowNodeSidebarMenuProps } from "@/shared/ui/flow-canvas";
import { StudioLayout } from "@/shared/ui/studio-layout";
import { AppIcon } from "@/shared/ui/icon";
import { cn } from "@/shared/lib/cn";
import "./flow-studio.css";

export type FlowStudioIssueSeverity = "error" | "warning" | "info";

export interface FlowStudioValidationIssue {
  id: string;
  severity: FlowStudioIssueSeverity;
  message: string;
  nodeId?: string;
  edgeId?: string;
  path?: string;
}

export type FlowStudioRunStepStatus =
  | "waiting"
  | "running"
  | "success"
  | "failed"
  | "skipped"
  | "requires_approval";

export interface FlowStudioRunStep {
  id: string;
  nodeId: string;
  label: string;
  status: FlowStudioRunStepStatus;
  summary?: string;
}

export interface FlowStudioLayoutProps {
  sidebar?: ReactNode;
  inspector?: ReactNode;
  toolbar?: ReactNode;
  toolbarEnd?: ReactNode;
  subBar?: ReactNode;
  inspectorOpen?: boolean;
  sidebarWidth?: number;
  inspectorWidth?: number;
  className?: string;
  children: ReactNode;
}

export function FlowStudioLayout(props: FlowStudioLayoutProps) {
  return <StudioLayout {...props} className={cn("flow-studio-layout", props.className)} />;
}

export function FlowStudioHeader({
  title,
  description,
  actions
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flow-studio-header">
      <div className="flow-studio-header__copy">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="flow-studio-header__actions">{actions}</div> : null}
    </div>
  );
}

export function FlowStudioSidebar({ children, className }: { children: ReactNode; className?: string }) {
  return <aside className={cn("flow-studio-sidebar", className)}>{children}</aside>;
}

export function FlowStudioInspector({ children, emptyText = "Selecione um no." }: { children?: ReactNode; emptyText?: ReactNode }) {
  return (
    <section className="flow-studio-inspector">
      {children ?? <EmptyState size="compact">{emptyText}</EmptyState>}
    </section>
  );
}

export function FlowStudioToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flow-studio-toolbar", className)}>{children}</div>;
}

export function FlowStudioNodePalette<TItem extends string = string, TAction extends string = string>(
  props: FlowNodeSidebarMenuProps<TItem, TAction>
) {
  return <FlowNodeSidebarMenu {...props} />;
}

export interface FlowStudioCanvasProps<TData extends Record<string, unknown>, TKind extends string> {
  nodes: Node<TData, TKind>[];
  edges: Edge[];
  nodeTypes: NodeTypes;
  paletteItems?: FlowCanvasPaletteItem<TKind, TData>[];
  onNodesChange: OnNodesChange<Node<TData, TKind>>;
  onEdgesChange: OnEdgesChange<Edge>;
  onEdgesAdd: (edges: Edge[]) => void;
  onNodesAdd: (nodes: Node<TData, TKind>[]) => void;
  onNodeSelect: (nodeId: string | null) => void;
  fitViewKey: number;
  fitViewMaxZoom?: number;
  focusNodeId?: string | null;
  focusNodeZoom?: number;
  emptyHint?: string;
  paletteTitle?: string;
  paletteEyebrow?: string;
  nodesDraggable?: boolean;
  nodesConnectable?: boolean;
  elementsSelectable?: boolean;
  validateConnection?: (connection: Connection) => string | null;
  onInvalidConnection?: (connection: Connection, reason: string) => void;
  validationIssues?: FlowStudioValidationIssue[];
  showMiniMap?: boolean;
  className?: string;
  sidebarContent?: ReactNode;
  topPanel?: ReactNode;
  bottomPanel?: ReactNode;
}

export function FlowStudioCanvas<TData extends Record<string, unknown>, TKind extends string>({
  paletteItems = [],
  validationIssues = [],
  showMiniMap = true,
  ...props
}: FlowStudioCanvasProps<TData, TKind>) {
  const invalidEdgeIds = validationIssues
    .filter((issue) => issue.severity === "error" && issue.edgeId)
    .map((issue) => issue.edgeId as string);

  return (
    <FlowCanvas<TData, TKind>
      {...props}
      paletteItems={paletteItems}
      invalidEdgeIds={invalidEdgeIds}
      showMiniMap={showMiniMap}
    />
  );
}

export function FlowStudioValidationPanel({ issues }: { issues: FlowStudioValidationIssue[] }) {
  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");

  return (
    <section className="flow-studio-panel flow-studio-validation-panel">
      <div className="flow-studio-panel__head">
        <span>Validacao</span>
        <strong>{errors.length} erros</strong>
      </div>
      {issues.length === 0 ? (
        <p className="flow-studio-panel__empty">Sem bloqueios no grafo.</p>
      ) : (
        <ul className="flow-studio-panel__list">
          {issues.slice(0, 6).map((issue) => (
            <li key={issue.id} className={`flow-studio-panel__item flow-studio-panel__item--${issue.severity}`}>
              <AppIcon name={issue.severity === "error" ? "alert-circle" : "info"} size={14} />
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      )}
      {warnings.length > 0 ? <small>{warnings.length} avisos</small> : null}
    </section>
  );
}

export function FlowStudioPreviewPanel({
  title = "Preview",
  children
}: {
  title?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flow-studio-panel">
      <div className="flow-studio-panel__head">
        <span>{title}</span>
      </div>
      {children}
    </section>
  );
}

export function FlowStudioDebugPanel({ steps }: { steps: FlowStudioRunStep[] }) {
  return (
    <section className="flow-studio-panel flow-studio-debug-panel">
      <div className="flow-studio-panel__head">
        <span>Debug</span>
        <strong>{steps.length} steps</strong>
      </div>
      {steps.length === 0 ? (
        <p className="flow-studio-panel__empty">Nenhuma execucao aberta.</p>
      ) : (
        <ol className="flow-studio-debug-panel__steps">
          {steps.map((step) => (
            <li key={step.id} className={`flow-studio-debug-panel__step flow-studio-debug-panel__step--${step.status}`}>
              <span className="flow-studio-debug-panel__dot" />
              <div>
                <strong>{step.label}</strong>
                {step.summary ? <small>{step.summary}</small> : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function FlowStudioRunPanel({ children }: { children: ReactNode }) {
  return <section className="flow-studio-panel flow-studio-run-panel">{children}</section>;
}

export function FlowStudioMinimap() {
  return null;
}

export function FlowStudioControls() {
  return null;
}

export function FlowStudioAutoLayoutButton({
  onClick,
  disabled,
  label = "Auto-layout"
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={disabled}>
      <AppIcon name="layers" size={14} />
      {label}
    </Button>
  );
}
