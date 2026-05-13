import type { AutomationWorkflow } from "@/modules/workspace/model";
import { AppIcon, EmptyState, PanelMenu, PanelMenuItem, StatusBadge } from "@/shared/ui";
import { statusTone } from "@/pages/automations-page/model/automation-page-view-model";
import { getAutomationWorkflowBadge } from "@/pages/automations-page/model/automation-workflow-metadata";

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
        <button
          className="ast__create-btn"
          type="button"
          onClick={() => void onCreateWorkflow()}
          disabled={busy}
          aria-label="Criar automacao"
          title="Criar automacao"
        >
          <AppIcon name="plus" size={14} />
        </button>
      }
    >
      {loading ? (
        <EmptyState className="automation-studio__empty-panel" size="compact">Carregando...</EmptyState>
      ) : error ? (
        <EmptyState className="automation-studio__empty-panel" size="compact">{errorMessage}</EmptyState>
      ) : (
        workflows.map((workflow) => {
          const workflowBadge = getAutomationWorkflowBadge(workflow);
          return (
            <PanelMenuItem
              key={workflow.id}
              selected={workflow.id === selectedWorkflowId}
              onClick={() => onSelectWorkflow(workflow.id)}
              label={workflow.name}
              trailing={
                <span className="ast__workflow-badges">
                  {workflowBadge ? (
                    <StatusBadge size="sm" tone={workflowBadge.tone}>
                      {workflowBadge.label}
                    </StatusBadge>
                  ) : null}
                  <StatusBadge size="sm" tone={statusTone(workflow.status)}>
                    {workflow.status}
                  </StatusBadge>
                </span>
              }
            />
          );
        })
      )}
    </PanelMenu>
  );
}
