import { useMemo, type Dispatch, type SetStateAction } from "react";
import type { Connection, Edge, NodeTypes, OnEdgesChange, OnNodesChange } from "@xyflow/react";
import type {
  AutomationCapabilities,
  AutomationWorkflow
} from "@/modules/workspace/model";
import { EmptyState, StudioLayout } from "@/shared/ui";
import type { FlowStudioValidationIssue } from "@/shared/ui";
import {
  nodeGroupLabels
} from "@/pages/automations-page/model/automation-node-registry";
import type { buildWorkflowPreview } from "@/pages/automations-page/model/automation-validation-view-model";
import type {
  AutomationCanvasNode,
  AutomationNodeMeta,
  AutomationNodeMetaMap,
  FieldOption
} from "@/pages/automations-page/model/automation-page.types";
import { isAutomationWorkflowEditable } from "@/pages/automations-page/model/automation-workflow-metadata";
import { AutomationFlowCanvas } from "./automation-flow-canvas";
import { AutomationNodeInspector } from "./automation-node-inspector";
import { AutomationWorkflowInspector } from "./automation-workflow-inspector";
import { AutomationWorkflowList } from "./automation-workflow-list";

export function buildAutomationNodeMenuSections(nodeCatalog: AutomationCapabilities["nodeCatalog"]) {
  const groups = new Map<string, AutomationNodeMeta[]>();
  for (const node of nodeCatalog) {
    const group = node.group ?? "system";
    groups.set(group, [...(groups.get(group) ?? []), node]);
  }
  return Array.from(groups.entries()).map(([group, nodes]) => ({
    id: group,
    title: nodeGroupLabels[group] ?? group,
    items: nodes.map((node) => ({
      id: node.type,
      label: node.label,
      description: node.description,
      color: node.color
    }))
  }));
}

export function AutomationFlowsView({
  capabilities,
  workflows,
  workflowsLoading,
  workflowsError,
  selectedWorkflow,
  selectedWorkflowId,
  selectedNode,
  workflowName,
  workflowDescription,
  workflowPreview,
  validationIssues,
  canvasNodes,
  canvasEdges,
  automationNodeTypes,
  nodeMeta,
  boardColumns,
  workflowStates,
  customFields,
  itemTypes,
  busy,
  fitViewKey,
  setWorkflowName,
  setWorkflowDescription,
  onCreateWorkflow,
  onSelectWorkflow,
  onNodesChange,
  onEdgesChange,
  onEdgesAdd,
  onNodesAdd,
  onNodeSelect,
  onAddNodeFromPalette,
  onNodeConfigChange,
  onNodeLabelChange,
  validateConnection,
  onInvalidConnection
}: {
  capabilities: AutomationCapabilities;
  workflows: AutomationWorkflow[];
  workflowsLoading?: boolean;
  workflowsError?: unknown;
  selectedWorkflow: AutomationWorkflow | null;
  selectedWorkflowId: string | null;
  selectedNode: AutomationCanvasNode | null;
  workflowName: string;
  workflowDescription: string;
  workflowPreview: ReturnType<typeof buildWorkflowPreview>;
  validationIssues: FlowStudioValidationIssue[];
  canvasNodes: AutomationCanvasNode[];
  canvasEdges: Edge[];
  automationNodeTypes: NodeTypes;
  nodeMeta: AutomationNodeMetaMap;
  boardColumns: FieldOption[];
  workflowStates: FieldOption[];
  customFields: FieldOption[];
  itemTypes: FieldOption[];
  busy: boolean;
  fitViewKey: number;
  setWorkflowName: Dispatch<SetStateAction<string>>;
  setWorkflowDescription: Dispatch<SetStateAction<string>>;
  onCreateWorkflow: () => Promise<void>;
  onSelectWorkflow: Dispatch<SetStateAction<string | null>>;
  onNodesChange: OnNodesChange<AutomationCanvasNode>;
  onEdgesChange: OnEdgesChange<Edge>;
  onEdgesAdd: (edges: Edge[]) => void;
  onNodesAdd: (nodes: AutomationCanvasNode[]) => void;
  onNodeSelect: (nodeId: string | null) => void;
  onAddNodeFromPalette: (node: AutomationNodeMeta) => void;
  onNodeConfigChange: (config: Record<string, unknown>) => void;
  onNodeLabelChange: (label: string) => void;
  validateConnection: (connection: Connection) => string | null;
  onInvalidConnection: (connection: Connection, reason: string) => void;
}) {
  const selectedWorkflowEditable = isAutomationWorkflowEditable(selectedWorkflow);
  const nodeMenuSections = useMemo(
    () => buildAutomationNodeMenuSections(capabilities.nodeCatalog),
    [capabilities.nodeCatalog]
  );

  return (
    <StudioLayout
      sidebar={
        <AutomationWorkflowList
          workflows={workflows}
          selectedWorkflowId={selectedWorkflowId}
          busy={busy}
          loading={workflowsLoading}
          error={workflowsError}
          onCreateWorkflow={onCreateWorkflow}
          onSelectWorkflow={onSelectWorkflow}
        />
      }
      inspector={
        selectedNode ? (
          <AutomationNodeInspector
            node={selectedNode}
            nodeMeta={nodeMeta}
            boardColumns={boardColumns}
            workflowStates={workflowStates}
            customFields={customFields}
            itemTypes={itemTypes}
            disabled={!selectedWorkflowEditable}
            onConfigChange={onNodeConfigChange}
            onLabelChange={onNodeLabelChange}
          />
        ) : (
          <AutomationWorkflowInspector
            workflow={selectedWorkflow}
            workflowName={workflowName}
            workflowDescription={workflowDescription}
            workflowPreview={workflowPreview}
            setWorkflowName={setWorkflowName}
            setWorkflowDescription={setWorkflowDescription}
          />
        )
      }
      inspectorOpen={true}
      inspectorWidth={340}
    >
      {selectedWorkflow ? (
        <AutomationFlowCanvas
          capabilities={capabilities}
          nodes={canvasNodes}
          edges={canvasEdges}
          nodeTypes={automationNodeTypes}
          nodeMeta={nodeMeta}
          validationIssues={validationIssues}
          nodeMenuSections={nodeMenuSections}
          fitViewKey={fitViewKey}
          readOnly={!selectedWorkflowEditable}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onEdgesAdd={onEdgesAdd}
          onNodesAdd={onNodesAdd}
          onNodeSelect={onNodeSelect}
          validateConnection={validateConnection}
          onInvalidConnection={onInvalidConnection}
          onAddNode={onAddNodeFromPalette}
        />
      ) : (
        <EmptyState className="automation-studio__empty-panel" size="compact">Nenhum fluxo criado.</EmptyState>
      )}
    </StudioLayout>
  );
}
