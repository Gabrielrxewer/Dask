import { useMemo } from "react";
import type { Edge } from "@xyflow/react";
import {
  buildAutomationValidationIssues,
  buildWorkflowPreview
} from "@/pages/automations-page/model/automation-validation-view-model";
import type { AutomationCanvasNode, AutomationNodeMetaMap } from "@/pages/automations-page/model/automation-page.types";

export function useAutomationGraphValidation(
  nodes: AutomationCanvasNode[],
  edges: Edge[],
  nodeMeta: AutomationNodeMetaMap
) {
  return useMemo(() => ({
    preview: buildWorkflowPreview(nodes, edges, nodeMeta),
    issues: buildAutomationValidationIssues(nodes, edges, nodeMeta)
  }), [edges, nodeMeta, nodes]);
}
