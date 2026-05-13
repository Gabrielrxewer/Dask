import type { AutomationWorkflow } from "@/modules/workspace/model";
import type { StatusBadgeTone } from "@/shared/ui";

export type AutomationWorkflowOrigin = NonNullable<AutomationWorkflow["origin"]>;

export interface AutomationWorkflowBadge {
  label: string;
  tone: StatusBadgeTone;
}

const domainLabels: Record<string, string> = {
  ai: "IA",
  billing: "Cobranca",
  commercial: "Comercial",
  fiscal: "Fiscal",
  marketing: "Marketing"
};

function readWorkflowMetadata(workflow: AutomationWorkflow | null) {
  return workflow?.metadata ?? {};
}

export function getAutomationWorkflowOrigin(workflow: AutomationWorkflow | null): AutomationWorkflowOrigin {
  const metadata = readWorkflowMetadata(workflow);
  return workflow?.origin ?? metadata.origin ?? "user";
}

export function getAutomationWorkflowDomain(workflow: AutomationWorkflow | null): string | null {
  const metadata = readWorkflowMetadata(workflow);
  return workflow?.domain ?? workflow?.nativeDomain ?? metadata.domain ?? metadata.nativeDomain ?? null;
}

export function isAutomationWorkflowProtected(workflow: AutomationWorkflow | null): boolean {
  const metadata = readWorkflowMetadata(workflow);
  return workflow?.isProtected ?? metadata.isProtected ?? false;
}

export function isAutomationWorkflowEditable(workflow: AutomationWorkflow | null): boolean {
  const metadata = readWorkflowMetadata(workflow);
  const editableMode = workflow?.editableMode ?? metadata.editableMode;
  return workflow?.isEditable ?? metadata.isEditable ?? editableMode !== "readonly";
}

export function getAutomationWorkflowNativeKey(workflow: AutomationWorkflow | null): string | null {
  const metadata = readWorkflowMetadata(workflow);
  return workflow?.nativeKey ?? metadata.nativeKey ?? null;
}

export function getAutomationWorkflowBadge(workflow: AutomationWorkflow): AutomationWorkflowBadge | null {
  const origin = getAutomationWorkflowOrigin(workflow);
  if (origin === "user") return null;

  const domain = getAutomationWorkflowDomain(workflow);
  if (domain) {
    return {
      label: domainLabels[domain] ?? domain,
      tone: origin === "system" ? "muted" : "info"
    };
  }

  return {
    label: origin === "system" ? "Sistema" : "Nativa",
    tone: origin === "system" ? "muted" : "info"
  };
}
