import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type NodeTypes,
  type OnEdgesChange,
  type OnNodesChange
} from "@xyflow/react";
import type { AutomationCapabilities, AutomationWorkflowVersion } from "@/modules/workspace/model";
import { applyLayeredFlowLayout, toast } from "@/shared/ui";
import type { FlowStudioValidationIssue } from "@/shared/ui";
import { graphToCanvas, readVersionGraph } from "@/pages/automations-page/model/automation-graph-adapter";
import {
  buildNodeConfigValidationIssues,
  validateAutomationConnection
} from "@/pages/automations-page/model/automation-validation-view-model";
import {
  buildDefaultNodeConfig,
  createAutomationNodeComponent
} from "@/pages/automations-page/model/automation-node-registry";
import { summarizeConfig } from "@/pages/automations-page/model/automation-page-view-model";
import type {
  AutomationCanvasNode,
  AutomationNodeMeta,
  AutomationNodeMetaMap,
  FieldOption
} from "@/pages/automations-page/model/automation-page.types";
import { useAutomationGraphValidation } from "./useAutomationGraphValidation";

function countValidationIssues(issues: FlowStudioValidationIssue[]) {
  return {
    errors: issues.filter((issue) => issue.severity === "error").length,
    warnings: issues.filter((issue) => issue.severity === "warning").length
  };
}

export function useAutomationCanvasEditor(input: {
  capabilities: AutomationCapabilities | null;
  selectedVersion: AutomationWorkflowVersion | null;
  boardColumns: FieldOption[];
  workflowStates: FieldOption[];
  customFields: FieldOption[];
  itemTypes: FieldOption[];
  setFeedback: (feedback: string | null) => void;
}) {
  const {
    capabilities,
    selectedVersion,
    boardColumns,
    workflowStates,
    customFields,
    itemTypes,
    setFeedback
  } = input;
  const [canvasNodes, setCanvasNodes] = useState<AutomationCanvasNode[]>([]);
  const [canvasEdges, setCanvasEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [fitViewKey, setFitViewKey] = useState(0);

  const nodeMeta: AutomationNodeMetaMap = useMemo(
    () => new Map((capabilities?.nodeCatalog ?? []).map((node) => [node.type, node])),
    [capabilities]
  );

  const automationNodeTypes = useMemo<NodeTypes>(() => {
    if (!capabilities) return {};
    const NodeComponent = createAutomationNodeComponent(nodeMeta);
    return capabilities.nodeCatalog.reduce<NodeTypes>((acc, node) => {
      acc[node.type] = NodeComponent;
      return acc;
    }, {});
  }, [capabilities, nodeMeta]);

  useEffect(() => {
    if (!capabilities) {
      setCanvasNodes([]);
      setCanvasEdges([]);
      return;
    }

    const graph = readVersionGraph(selectedVersion, capabilities.defaultGraph, nodeMeta);
    const next = graphToCanvas(graph, nodeMeta);
    setCanvasNodes(next.nodes);
    setCanvasEdges(next.edges);
    setSelectedNodeId(null);
    setFitViewKey((value) => value + 1);
  }, [capabilities, nodeMeta, selectedVersion]);

  const graphValidation = useAutomationGraphValidation(canvasNodes, canvasEdges, nodeMeta);
  const nodeConfigValidationIssues = useMemo(() => buildNodeConfigValidationIssues({
    nodes: canvasNodes,
    nodeMeta,
    boardColumns,
    workflowStates,
    customFields,
    itemTypes
  }), [boardColumns, canvasNodes, customFields, itemTypes, nodeMeta, workflowStates]);

  const workflowPreview = useMemo(() => {
    const nodeConfigErrors = nodeConfigValidationIssues
      .filter((issue) => issue.severity === "error")
      .map((issue) => issue.message);
    return {
      ...graphValidation.preview,
      errors: Array.from(new Set([...graphValidation.preview.errors, ...nodeConfigErrors]))
    };
  }, [graphValidation.preview, nodeConfigValidationIssues]);

  const validationIssues = useMemo(
    () => [...graphValidation.issues, ...nodeConfigValidationIssues],
    [graphValidation.issues, nodeConfigValidationIssues]
  );
  const validationIssueCount = useMemo(() => countValidationIssues(validationIssues), [validationIssues]);
  const firstValidationError = validationIssues.find((issue) => issue.severity === "error")?.message ?? null;
  const selectedNode = canvasNodes.find((node) => node.id === selectedNodeId) ?? null;

  const onNodesChange: OnNodesChange<AutomationCanvasNode> = useCallback((changes) => {
    setCanvasNodes((nodes) => applyNodeChanges(changes, nodes) as AutomationCanvasNode[]);
  }, []);

  const onEdgesChange: OnEdgesChange<Edge> = useCallback((changes) => {
    setCanvasEdges((edges) => applyEdgeChanges(changes, edges));
  }, []);

  const handleNodesAdd = useCallback((nodes: AutomationCanvasNode[]) => {
    setCanvasNodes((current) => [...current, ...nodes]);
  }, []);

  const handleAddNodeFromPalette = useCallback((meta: AutomationNodeMeta) => {
    const config = buildDefaultNodeConfig(meta.type);
    setCanvasNodes((nodes) => {
      const index = nodes.length;
      return [
        ...nodes,
        {
          id: `${meta.type}-${Date.now()}`,
          type: meta.type,
          position: { x: 120 + index * 80, y: 160 + index * 28 },
          data: {
            nodeType: meta.type,
            label: meta.label,
            summary: summarizeConfig(config),
            config
          }
        }
      ];
    });
  }, []);

  const handleAutoLayout = useCallback(() => {
    setCanvasNodes((nodes) => applyLayeredFlowLayout(nodes, canvasEdges, {
      origin: { x: 100, y: 160 },
      columnGap: 285,
      rowGap: 152
    }) as AutomationCanvasNode[]);
    setFitViewKey((value) => value + 1);
    setFeedback("Layout automatico aplicado.");
  }, [canvasEdges, setFeedback]);

  const handleSelectedNodeConfigChange = useCallback((config: Record<string, unknown>) => {
    if (!selectedNodeId) return;
    setCanvasNodes((nodes) => nodes.map((node) => (
      node.id === selectedNodeId
        ? { ...node, data: { ...node.data, config, summary: summarizeConfig(config) } }
        : node
    )));
  }, [selectedNodeId]);

  const handleSelectedNodeLabelChange = useCallback((label: string) => {
    if (!selectedNodeId) return;
    setCanvasNodes((nodes) => nodes.map((node) => (
      node.id === selectedNodeId
        ? { ...node, data: { ...node.data, label } }
        : node
    )));
  }, [selectedNodeId]);

  const validateConnection = useCallback(
    (connection: Connection) => validateAutomationConnection(canvasNodes, canvasEdges, connection),
    [canvasEdges, canvasNodes]
  );

  const handleInvalidConnection = useCallback((_connection: Connection, reason: string) => {
    setFeedback(reason);
    toast.warning("Conexao bloqueada", { description: reason });
  }, [setFeedback]);

  return {
    canvasNodes,
    canvasEdges,
    selectedNode,
    selectedNodeId,
    fitViewKey,
    nodeMeta,
    automationNodeTypes,
    workflowPreview,
    validationIssues,
    validationIssueCount,
    firstValidationError,
    setCanvasEdges,
    setSelectedNodeId,
    onNodesChange,
    onEdgesChange,
    handleNodesAdd,
    handleAddNodeFromPalette,
    handleAutoLayout,
    handleSelectedNodeConfigChange,
    handleSelectedNodeLabelChange,
    validateConnection,
    handleInvalidConnection
  };
}
