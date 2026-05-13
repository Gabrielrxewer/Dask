import type { Dispatch, SetStateAction } from "react";
import type { AutomationWorkflow } from "@/modules/workspace/model";
import { EmptyState, StatusBadge, TextInput } from "@/shared/ui";
import type { buildWorkflowPreview } from "@/pages/automations-page/model/automation-validation-view-model";
import {
  getAutomationWorkflowBadge,
  getAutomationWorkflowNativeKey,
  isAutomationWorkflowEditable,
  isAutomationWorkflowProtected
} from "@/pages/automations-page/model/automation-workflow-metadata";
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

  const workflowBadge = getAutomationWorkflowBadge(workflow);
  const isEditable = isAutomationWorkflowEditable(workflow);
  const nativeKey = getAutomationWorkflowNativeKey(workflow);

  return (
    <>
      {workflowBadge || isAutomationWorkflowProtected(workflow) ? (
        <div className="ast__workflow-meta">
          {workflowBadge ? (
            <StatusBadge size="sm" tone={workflowBadge.tone}>
              {workflowBadge.label}
            </StatusBadge>
          ) : null}
          {isAutomationWorkflowProtected(workflow) ? (
            <StatusBadge size="sm" tone="muted">
              Protegida
            </StatusBadge>
          ) : null}
          {nativeKey ? <span>{nativeKey}</span> : null}
        </div>
      ) : null}
      <label className="ast__inspector-label">
        <span>Nome</span>
        <TextInput
          value={workflowName}
          onChange={(event) => setWorkflowName(event.target.value)}
          disabled={!isEditable}
        />
      </label>
      <label className="ast__inspector-label">
        <span>Descricao</span>
        <TextInput
          value={workflowDescription}
          onChange={(event) => setWorkflowDescription(event.target.value)}
          placeholder="Descricao"
          disabled={!isEditable}
        />
      </label>
      {!isEditable ? (
        <p className="ast__inspector-muted">
          Esta automacao e gerenciada pelo sistema. Apenas campos liberados pelo backend podem ser alterados.
        </p>
      ) : null}
      <WorkflowPreviewPanel preview={workflowPreview} />
    </>
  );
}
