import { AppIcon, WorkspaceActionButton } from "@/shared/ui";

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
  const status = getValidationStatus(issueCount, warningCount);

  return (
    <>
      <WorkspaceActionButton
        label="Auto-layout"
        icon={<AppIcon name="layers" />}
        onClick={onAutoLayout}
        disabled={disabled}
      />
      <span
        className={`workspace-action-button ast__validation-action ast__validation-action--${status.tone}`}
        role="status"
        aria-label={status.label}
        title={status.label}
      >
        <span className="workspace-action-button__icon" aria-hidden="true">
          <AppIcon name={status.icon} />
        </span>
      </span>
    </>
  );
}

function getValidationStatus(issueCount: number, warningCount: number) {
  if (issueCount > 0) {
    return {
      tone: "danger",
      icon: "alert-circle" as const,
      label: issueCount === 1 ? "1 erro" : `${issueCount} erros`
    };
  }

  if (warningCount > 0) {
    return {
      tone: "warning",
      icon: "info" as const,
      label: warningCount === 1 ? "1 aviso" : `${warningCount} avisos`
    };
  }

  return {
    tone: "success",
    icon: "check" as const,
    label: "Valido"
  };
}
