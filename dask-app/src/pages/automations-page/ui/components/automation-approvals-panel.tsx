import type { AutomationApprovalSummary } from "@/modules/workspace/model";
import { StatusBadge } from "@/shared/ui";
import { statusTone } from "@/pages/automations-page/model/automation-page-view-model";
import { AutomationDataList, AutomationPanelHeader } from "./automation-panel";

export function AutomationApprovalsPanel({
  approvals,
  loading,
  error,
  onRefresh
}: {
  approvals: AutomationApprovalSummary[];
  loading?: boolean;
  error?: unknown;
  onRefresh: () => Promise<unknown> | void;
}) {
  return (
    <section className="automation-studio__panel">
      <AutomationPanelHeader title="Aprovacoes" onRefresh={onRefresh} />
      <AutomationDataList
        items={approvals}
        empty="Sem aprovacoes."
        loading={loading}
        error={error}
        render={(approval) => (
          <div key={approval.approvalId} className="automation-studio__row">
            <span>{approval.title}</span>
            <StatusBadge size="sm" tone={statusTone(approval.status)}>{approval.status}</StatusBadge>
            <small>{approval.workflowName}</small>
          </div>
        )}
      />
    </section>
  );
}
