import type { Dispatch, SetStateAction } from "react";
import type { AutomationWorkflow } from "@/modules/workspace/model";
import { EmptyState, TextInput } from "@/shared/ui";
import type { buildWorkflowPreview } from "@/pages/automations-page/model/automation-validation-view-model";
import { WorkflowPreviewPanel } from "./workflow-preview-panel";

export function AutomationWorkflowInspector({
  workflow,
  workflowName,
  workflowDescription,
  workflowPreview,
  setWorkflowName,
  setWorkflowDescription
}: {
  workflow: AutomationWorkflow | null;
  workflowName: string;
  workflowDescription: string;
  workflowPreview: ReturnType<typeof buildWorkflowPreview>;
  setWorkflowName: Dispatch<SetStateAction<string>>;
  setWorkflowDescription: Dispatch<SetStateAction<string>>;
}) {
  if (!workflow) {
    return <EmptyState className="automation-studio__empty-panel" size="compact">Selecione um fluxo.</EmptyState>;
  }

  return (
    <>
      <label className="ast__inspector-label">
        <span>Nome</span>
        <TextInput value={workflowName} onChange={(event) => setWorkflowName(event.target.value)} />
      </label>
      <label className="ast__inspector-label">
        <span>Descricao</span>
        <TextInput value={workflowDescription} onChange={(event) => setWorkflowDescription(event.target.value)} placeholder="Descricao" />
      </label>
      <WorkflowPreviewPanel preview={workflowPreview} />
    </>
  );
}
