import type { AutomationWorkflow } from "@/modules/workspace/model";
import { AppIcon, EmptyState, PanelMenu, PanelMenuItem, StatusBadge } from "@/shared/ui";
import { statusTone } from "@/pages/automations-page/model/automation-page-view-model";

export function AutomationWorkflowList({
  workflows,
  selectedWorkflowId,
  busy,
  loading,
  error,
  onCreateWorkflow,
  onSelectWorkflow
}: {
  workflows: AutomationWorkflow[];
  selectedWorkflowId: string | null;
  busy: boolean;
  loading?: boolean;
  error?: unknown;
  onCreateWorkflow: () => Promise<void>;
  onSelectWorkflow: (workflowId: string) => void;
}) {
  const errorMessage = error instanceof Error ? error.message : "Nao foi possivel carregar fluxos.";

  return (
    <PanelMenu
      title="Fluxos"
      count={workflows.length}
      action={
        <button className="ast__create-btn" type="button" onClick={() => void onCreateWorkflow()} disabled={busy}>
          <AppIcon name="plus" size={14} />
        </button>
      }
    >
      {loading ? (
        <EmptyState className="automation-studio__empty-panel" size="compact">Carregando...</EmptyState>
      ) : error ? (
        <EmptyState className="automation-studio__empty-panel" size="compact">{errorMessage}</EmptyState>
      ) : (
        workflows.map((workflow) => (
          <PanelMenuItem
            key={workflow.id}
            selected={workflow.id === selectedWorkflowId}
            onClick={() => onSelectWorkflow(workflow.id)}
            label={workflow.name}
            trailing={
              <StatusBadge size="sm" tone={statusTone(workflow.status)}>
                {workflow.status}
              </StatusBadge>
            }
          />
        ))
      )}
    </PanelMenu>
  );
}
