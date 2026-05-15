import type { ListAutomationApprovalsOptions } from "@/modules/workspace/model";

export interface AutomationRunsFilters {
  workflowId?: string;
  status?: string;
  triggerType?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  limit?: number;
}

export type AutomationApprovalsFilters = ListAutomationApprovalsOptions;
export interface AutomationConsentsFilters {
  status?: string;
  limit?: number;
}

function cleanRecord<TValue>(record: Record<string, TValue | undefined | null | ""> | undefined): Record<string, TValue> {
  return Object.fromEntries(
    Object.entries(record ?? {}).filter(([, value]) => value !== undefined && value !== null && value !== "")
  ) as Record<string, TValue>;
}

export function normalizeAutomationFilters(filters?: object) {
  return cleanRecord(filters as Record<string, string | number | boolean | undefined | null | ""> | undefined);
}

export const automationsQueryKeys = {
  all: ["automations"] as const,
  workspace: (workspaceId: string) => [...automationsQueryKeys.all, workspaceId] as const,
  capabilities: (workspaceId: string) => [...automationsQueryKeys.workspace(workspaceId), "capabilities"] as const,
  workflows: (workspaceId: string) => [...automationsQueryKeys.workspace(workspaceId), "workflows"] as const,
  workflow: (workspaceId: string, workflowId: string) =>
    [...automationsQueryKeys.workflows(workspaceId), workflowId] as const,
  versions: (workspaceId: string, workflowId: string) =>
    [...automationsQueryKeys.workflow(workspaceId, workflowId), "versions"] as const,
  runs: (workspaceId: string, filters?: AutomationRunsFilters) =>
    [...automationsQueryKeys.workspace(workspaceId), "runs", normalizeAutomationFilters(filters)] as const,
  run: (workspaceId: string, runId: string) =>
    [...automationsQueryKeys.workspace(workspaceId), "runs", runId] as const,
  approvals: (workspaceId: string, filters?: AutomationApprovalsFilters) =>
    [...automationsQueryKeys.workspace(workspaceId), "approvals", normalizeAutomationFilters(filters)] as const,
  inbox: (workspaceId: string, filters?: Record<string, unknown>) =>
    [...automationsQueryKeys.workspace(workspaceId), "inbox", normalizeAutomationFilters(filters)] as const,
  conversation: (workspaceId: string, conversationId: string) =>
    [...automationsQueryKeys.workspace(workspaceId), "inbox", "conversation", conversationId] as const,
  templates: (workspaceId: string, filters?: Record<string, unknown>) =>
    [...automationsQueryKeys.workspace(workspaceId), "templates", normalizeAutomationFilters(filters)] as const,
  whatsappIntegration: (workspaceId: string) =>
    [...automationsQueryKeys.workspace(workspaceId), "whatsapp-integration"] as const,
  consents: (workspaceId: string, filters?: AutomationConsentsFilters) =>
    [...automationsQueryKeys.workspace(workspaceId), "consents", normalizeAutomationFilters(filters)] as const
};
