import { useMemo } from "react";
import { createAutomationNodeConfigDescriptor } from "@/pages/automations-page/model/automation-node-registry";
import type { AutomationCanvasNode, AutomationNodeMetaMap, FieldOption } from "@/pages/automations-page/model/automation-page.types";

export function useAutomationNodeInspector(input: {
  node: AutomationCanvasNode | null;
  nodeMeta: AutomationNodeMetaMap;
  boardColumns: FieldOption[];
  workflowStates: FieldOption[];
  customFields: FieldOption[];
  itemTypes: FieldOption[];
}) {
  return useMemo(() => {
    if (!input.node) return null;
    const meta = input.nodeMeta.get(input.node.data.nodeType);
    return createAutomationNodeConfigDescriptor({
      nodeType: input.node.data.nodeType,
      nodeLabel: meta?.label ?? input.node.data.label,
      configSchema: meta?.configSchema,
      boardColumns: input.boardColumns,
      workflowStates: input.workflowStates,
      customFields: input.customFields,
      itemTypes: input.itemTypes
    });
  }, [input.boardColumns, input.customFields, input.itemTypes, input.node, input.nodeMeta, input.workflowStates]);
}
