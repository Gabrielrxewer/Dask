import { useMemo, type Dispatch, type SetStateAction } from "react";
import type { Connection, Edge, NodeTypes, OnEdgesChange, OnNodesChange } from "@xyflow/react";
import type {
  AutomationCapabilities,
  AutomationWorkflow
} from "@/modules/workspace/model";
import { EmptyState, StudioLayout } from "@/shared/ui";
import type { FlowStudioValidationIssue } from "@/shared/ui";
import { AutomationToolbar } from "@/pages/automations-page/ui/AutomationToolbar";
import {
  nodeGroupLabels
} from "@/pages/automations-page/model/automation-node-registry";
import type { buildWorkflowPreview } from "@/pages/automations-page/model/automation-validation-view-model";
import type {
  AutomationCanvasNode,
  AutomationNodeMeta,
  AutomationNodeMetaMap,
  AutomationRecipe,
  FieldOption
} from "@/pages/automations-page/model/automation-page.types";
import { AutomationFlowCanvas } from "./automation-flow-canvas";
import { AutomationNodeInspector } from "./automation-node-inspector";
import { AutomationWorkflowInspector } from "./automation-workflow-inspector";
import { AutomationWorkflowList } from "./automation-workflow-list";

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
  validationIssueCount,
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
  onCreateRecipeWorkflow,
  onSelectWorkflow,
  onAutoLayout,
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
  validationIssueCount: { errors: number; warnings: number };
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
  onCreateRecipeWorkflow: (recipe: AutomationRecipe) => Promise<void>;
  onSelectWorkflow: Dispatch<SetStateAction<string | null>>;
  onAutoLayout: () => void;
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
  const nodeMenuSections = useMemo(() => {
    const groups = new Map<string, AutomationNodeMeta[]>();
    for (const node of capabilities.nodeCatalog) {
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
  }, [capabilities.nodeCatalog]);

  const recipeMenuSections = useMemo(() => {
    const recipes = capabilities.recipeCatalog ?? [];
    if (recipes.length === 0) return [];
    return [
      {
        id: "crm-recipes",
        title: "Receitas CRM",
        actions: recipes.map((recipe) => ({
          id: recipe.id,
          label: recipe.name,
          disabled: busy
        }))
      }
    ];
  }, [busy, capabilities.recipeCatalog]);

  return (
    <StudioLayout
      toolbar={
        <AutomationToolbar
          issueCount={validationIssueCount.errors}
          warningCount={validationIssueCount.warnings}
          onAutoLayout={onAutoLayout}
          disabled={canvasNodes.length === 0}
        />
      }
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
          recipeMenuSections={recipeMenuSections}
          fitViewKey={fitViewKey}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onEdgesAdd={onEdgesAdd}
          onNodesAdd={onNodesAdd}
          onNodeSelect={onNodeSelect}
          validateConnection={validateConnection}
          onInvalidConnection={onInvalidConnection}
          onAddNode={onAddNodeFromPalette}
          onCreateRecipe={(recipe) => void onCreateRecipeWorkflow(recipe)}
        />
      ) : (
        <EmptyState className="automation-studio__empty-panel" size="compact">Nenhum fluxo criado.</EmptyState>
      )}
    </StudioLayout>
  );
}
