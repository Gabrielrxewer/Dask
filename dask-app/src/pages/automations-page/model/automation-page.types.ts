import type { Edge, Node } from "@xyflow/react";
import type {
  AutomationCapabilities,
  AutomationWorkflowGraph,
  AutomationWorkflowGraphEdge,
  AutomationWorkflowGraphNode
} from "@/modules/workspace/model";

export type StudioTab = "flows" | "runs" | "approvals" | "inbox" | "templates" | "contacts" | "settings";
export type AutomationNodeType = string;

export type AutomationCanvasData = Record<string, unknown> & {
  nodeType: AutomationNodeType;
  label: string;
  summary: string;
  config: Record<string, unknown>;
};

export type AutomationCanvasNode = Node<AutomationCanvasData, AutomationNodeType>;
export type AutomationCanvasEdge = Edge;

export type FieldOption = { id?: string; slug?: string; name?: string; label?: string; key?: string; type?: string };
export type AutomationNodeMeta = AutomationCapabilities["nodeCatalog"][number];
export type AutomationNodeMetaMap = Map<string, AutomationNodeMeta>;

export type {
  AutomationWorkflowGraph,
  AutomationWorkflowGraphEdge,
  AutomationWorkflowGraphNode
};
