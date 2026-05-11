import { FlowStudioAutoLayoutButton, FlowStudioToolbar, StatusBadge } from "@/shared/ui";
import type { FlowStudioValidationIssue } from "@/shared/ui";

export function AutomationToolbar({
  issueCount,
  warningCount,
  onAutoLayout,
  disabled
}: {
  issueCount: number;
  warningCount: number;
  onAutoLayout: () => void;
  disabled?: boolean;
}) {
  return (
    <FlowStudioToolbar>
      <FlowStudioAutoLayoutButton onClick={onAutoLayout} disabled={disabled} />
      <StatusBadge size="sm" tone={issueCount > 0 ? "danger" : warningCount > 0 ? "warning" : "success"}>
        {issueCount > 0 ? `${issueCount} erros` : warningCount > 0 ? `${warningCount} avisos` : "Valido"}
      </StatusBadge>
    </FlowStudioToolbar>
  );
}

export function countValidationIssues(issues: FlowStudioValidationIssue[]) {
  return {
    errors: issues.filter((issue) => issue.severity === "error").length,
    warnings: issues.filter((issue) => issue.severity === "warning").length
  };
}
