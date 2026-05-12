import type { AutomationRunDetail, AutomationRunListItem } from "@/modules/workspace/model";
import { Button, EmptyState, StatusBadge } from "@/shared/ui";
import { formatDate, statusTone } from "@/pages/automations-page/model/automation-page-view-model";
import { AutomationDataList, AutomationPanelHeader } from "./automation-panel";

export function AutomationRunsPanel({
  runs,
  selectedRun,
  selectedRunLoading,
  loading,
  error,
  onRefresh,
  onLoadRunDetail,
  onCancelRun
}: {
  runs: AutomationRunListItem[];
  selectedRun: AutomationRunDetail | null;
  selectedRunLoading: boolean;
  loading?: boolean;
  error?: unknown;
  onRefresh: () => Promise<unknown> | void;
  onLoadRunDetail: (runId: string) => void;
  onCancelRun: (runId: string) => Promise<void>;
}) {
  return (
    <section className="automation-studio__panel">
      <AutomationPanelHeader title="Execucoes" onRefresh={onRefresh} />
      <div className="automation-studio__split">
        <AutomationDataList
          items={runs}
          empty="Sem execucoes."
          loading={loading}
          error={error}
          render={(run) => (
            <button key={run.runId} type="button" onClick={() => onLoadRunDetail(run.runId)}>
              <span>{run.workflowName}</span>
              <StatusBadge size="sm" tone={statusTone(run.status)}>{run.status}</StatusBadge>
              <small>{formatDate(run.createdAt)}</small>
            </button>
          )}
        />
        <div className="automation-studio__detail">
          {selectedRun ? (
            <>
              <h3>{selectedRun.workflow.name}</h3>
              <p>{selectedRun.run.triggerType} | {selectedRun.summary.stepsCount} passos | {selectedRun.summary.eventsCount} eventos</p>
              <Button size="sm" variant="outline" disabled={!selectedRun.run.canCancel} onClick={() => void onCancelRun(selectedRun.run.runId)}>
                Cancelar
              </Button>
              <pre>{JSON.stringify(selectedRun.steps.slice(0, 8), null, 2)}</pre>
            </>
          ) : (
            <EmptyState className="automation-studio__empty-panel" size="compact">
              {selectedRunLoading ? "Carregando execucao." : "Abra uma execucao."}
            </EmptyState>
          )}
        </div>
      </div>
    </section>
  );
}
