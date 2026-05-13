import type { Connection, Edge, NodeTypes, OnEdgesChange, OnNodesChange } from "@xyflow/react";
import type { AutomationCapabilities } from "@/modules/workspace/model";
import {
  FlowNodeSidebarMenu,
  FlowStudioCanvas,
  FlowStudioValidationPanel
} from "@/shared/ui";
import type { FlowStudioValidationIssue } from "@/shared/ui";
import { buildDefaultNodeConfig } from "@/pages/automations-page/model/automation-node-registry";
import type {
  AutomationCanvasData,
  AutomationCanvasNode,
  AutomationNodeMetaMap,
  AutomationNodeType
} from "@/pages/automations-page/model/automation-page.types";

export interface AutomationNodeMenuSection {
  id: string;
  title: string;
  items: Array<{
    id: string;
    label: string;
    description?: string;
    color?: string;
    disabled?: boolean;
  }>;
}

export function AutomationFlowCanvas({
  capabilities,
  nodes,
  edges,
  nodeTypes,
  nodeMeta,
  validationIssues,
  nodeMenuSections,
  fitViewKey,
  readOnly = false,
  onNodesChange,
  onEdgesChange,
  onEdgesAdd,
  onNodesAdd,
  onNodeSelect,
  validateConnection,
  onInvalidConnection,
  onAddNode
}: {
  capabilities: AutomationCapabilities;
  nodes: AutomationCanvasNode[];
  edges: Edge[];
  nodeTypes: NodeTypes;
  nodeMeta: AutomationNodeMetaMap;
  validationIssues: FlowStudioValidationIssue[];
  nodeMenuSections: AutomationNodeMenuSection[];
  fitViewKey: number;
  readOnly?: boolean;
  onNodesChange: OnNodesChange<AutomationCanvasNode>;
  onEdgesChange: OnEdgesChange<Edge>;
  onEdgesAdd: (edges: Edge[]) => void;
  onNodesAdd: (nodes: AutomationCanvasNode[]) => void;
  onNodeSelect: (nodeId: string | null) => void;
  validateConnection: (connection: Connection) => string | null;
  onInvalidConnection: (connection: Connection, reason: string) => void;
  onAddNode: (node: AutomationCapabilities["nodeCatalog"][number]) => void;
}) {
  return (
    <FlowStudioCanvas<AutomationCanvasData, AutomationNodeType>
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      validationIssues={validationIssues}
      showMiniMap
      paletteItems={readOnly ? [] : capabilities.nodeCatalog.map((node) => ({
        kind: node.type,
        label: node.label,
        description: node.description,
        color: node.color,
        buildData: () => ({
          nodeType: node.type,
          label: node.label,
          summary: "Sem configuracao",
          config: buildDefaultNodeConfig(node.type)
        })
      }))}
      onNodesChange={readOnly ? () => undefined : onNodesChange}
      onEdgesChange={readOnly ? () => undefined : onEdgesChange}
      onEdgesAdd={readOnly ? () => undefined : onEdgesAdd}
      onNodesAdd={readOnly ? () => undefined : onNodesAdd}
      onNodeSelect={onNodeSelect}
      nodesDraggable={!readOnly}
      nodesConnectable={!readOnly}
      validateConnection={validateConnection}
      onInvalidConnection={onInvalidConnection}
      fitViewKey={fitViewKey}
      fitViewMaxZoom={0.78}
      paletteTitle="Adicionar no"
      paletteEyebrow="Workflow"
      topPanel={<FlowStudioValidationPanel issues={validationIssues} />}
      sidebarContent={
        <FlowNodeSidebarMenu
          sections={readOnly ? nodeMenuSections.map((section) => ({
            ...section,
            items: section.items.map((item) => ({ ...item, disabled: true }))
          })) : nodeMenuSections}
          onItemSelect={(item) => {
            if (readOnly) return;
            const meta = nodeMeta.get(item.id);
            if (meta) onAddNode(meta);
          }}
        />
      }
    />
  );
}
