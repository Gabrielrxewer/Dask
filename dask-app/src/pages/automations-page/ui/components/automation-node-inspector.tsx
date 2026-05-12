import { NodeConfigForm } from "@/shared/flow-node-config";
import { TextInput } from "@/shared/ui";
import { useAutomationNodeInspector } from "@/pages/automations-page/hooks";
import type {
  AutomationCanvasNode,
  AutomationNodeMetaMap,
  FieldOption
} from "@/pages/automations-page/model/automation-page.types";

export function AutomationNodeInspector({
  node,
  nodeMeta,
  boardColumns,
  workflowStates,
  customFields,
  itemTypes,
  onConfigChange,
  onLabelChange
}: {
  node: AutomationCanvasNode;
  nodeMeta: AutomationNodeMetaMap;
  boardColumns: FieldOption[];
  workflowStates: FieldOption[];
  customFields: FieldOption[];
  itemTypes: FieldOption[];
  onConfigChange: (config: Record<string, unknown>) => void;
  onLabelChange: (label: string) => void;
}) {
  const descriptor = useAutomationNodeInspector({
    node,
    nodeMeta,
    boardColumns,
    workflowStates,
    customFields,
    itemTypes
  });

  if (!descriptor) return null;

  return (
    <div className="ast__inspector">
      <label className="ast__inspector-label">
        <span>Rotulo</span>
        <TextInput value={node.data.label} onChange={(event) => onLabelChange(event.target.value)} />
      </label>

      <NodeConfigForm
        descriptor={descriptor}
        value={node.data.config}
        onChange={onConfigChange}
        submitLabel="Validar config"
      />
    </div>
  );
}
