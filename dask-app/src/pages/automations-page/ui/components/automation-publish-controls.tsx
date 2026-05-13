import type { AutomationWorkflow, AutomationWorkflowVersion } from "@/modules/workspace/model";
import { AppIcon, WorkspaceActionButton } from "@/shared/ui";
import {
  isAutomationWorkflowEditable,
  isAutomationWorkflowProtected
} from "@/pages/automations-page/model/automation-workflow-metadata";

export function AutomationPublishControls({
  workflow,
  selectedVersion,
  currentVersion,
  busy,
  onStatusChange,
  onCloneVersion,
  onRun,
  onSaveWorkflow,
  onPublish
}: {
  workflow: AutomationWorkflow;
  selectedVersion: AutomationWorkflowVersion | null;
  currentVersion: AutomationWorkflowVersion | null;
  busy: boolean;
  onStatusChange: (status: "active" | "paused" | "archived") => Promise<void>;
  onCloneVersion: () => Promise<void>;
  onRun: () => Promise<void>;
  onSaveWorkflow: () => Promise<boolean>;
  onPublish: () => Promise<void>;
}) {
  const isEditable = isAutomationWorkflowEditable(workflow);
  const isProtected = isAutomationWorkflowProtected(workflow);

  return (
    <>
      <WorkspaceActionButton
        label="Ativar"
        icon={<AppIcon name="play" />}
        onClick={() => void onStatusChange("active")}
        disabled={busy || !currentVersion}
      />
      <WorkspaceActionButton
        label="Pausar"
        icon={<AppIcon name="pause" />}
        onClick={() => void onStatusChange("paused")}
        disabled={busy}
      />
      <WorkspaceActionButton
        tone="danger"
        label="Arquivar"
        icon={<AppIcon name="archive" />}
        onClick={() => void onStatusChange("archived")}
        disabled={busy || isProtected}
      />
      <WorkspaceActionButton
        label="Clonar versao"
        icon={<AppIcon name="copy" />}
        onClick={() => void onCloneVersion()}
        disabled={busy || !isEditable || !selectedVersion}
      />
      <WorkspaceActionButton
        label="Executar teste"
        icon={<AppIcon name="zap" />}
        onClick={() => void onRun()}
        disabled={busy || workflow.status !== "active" || !currentVersion}
      />
      <WorkspaceActionButton
        label="Salvar draft"
        icon={<AppIcon name="save" />}
        onClick={() => void onSaveWorkflow()}
        disabled={busy || !isEditable || selectedVersion?.status !== "draft"}
      />
      <WorkspaceActionButton
        tone="accent"
        label="Publicar"
        icon={<AppIcon name="send" />}
        onClick={() => void onPublish()}
        disabled={busy || !isEditable || selectedVersion?.status !== "draft"}
      />
    </>
  );
}
