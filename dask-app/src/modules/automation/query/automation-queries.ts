import { useQuery } from "@tanstack/react-query";
import { workspaceService } from "@/modules/workspace/api";
import type { AutomationApprovalsFilters, AutomationRunsFilters } from "./automation-query-keys";
import { automationsQueryKeys } from "./automation-query-keys";

function isWorkspaceReady(workspaceId: string | null | undefined): workspaceId is string {
  return Boolean(workspaceId?.trim());
}

function requireWorkspace(workspaceId: string | null | undefined): string {
  if (!isWorkspaceReady(workspaceId)) {
    throw new Error("Nenhum workspace selecionado.");
  }
  return workspaceId;
}

export function useAutomationCapabilitiesQuery(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: automationsQueryKeys.capabilities(workspaceId ?? "__missing_workspace__"),
    queryFn: () => workspaceService.getAutomationCapabilities(requireWorkspace(workspaceId)),
    enabled: isWorkspaceReady(workspaceId)
  });
}

export function useAutomationWorkflows(workspaceId: string | null | undefined) {
  return useQuery({
    queryKey: automationsQueryKeys.workflows(workspaceId ?? "__missing_workspace__"),
    queryFn: () => workspaceService.listAutomationWorkflows(requireWorkspace(workspaceId), { limit: 200 }),
    enabled: isWorkspaceReady(workspaceId)
  });
}

export function useAutomationWorkflowEditor(
  workspaceId: string | null | undefined,
  workflowId: string | null | undefined
) {
  return useQuery({
    queryKey: automationsQueryKeys.versions(workspaceId ?? "__missing_workspace__", workflowId ?? "__missing_workflow__"),
    queryFn: () => workspaceService.listAutomationWorkflowVersions(requireWorkspace(workspaceId), workflowId ?? "", { limit: 100 }),
    enabled: isWorkspaceReady(workspaceId) && Boolean(workflowId?.trim())
  });
}

export function useAutomationRuns(
  workspaceId: string | null | undefined,
  filters?: AutomationRunsFilters
) {
  return useQuery({
    queryKey: automationsQueryKeys.runs(workspaceId ?? "__missing_workspace__", filters),
    queryFn: () => workspaceService.listAutomationRuns(requireWorkspace(workspaceId), filters),
    enabled: isWorkspaceReady(workspaceId)
  });
}

export function useAutomationRunDetail(
  workspaceId: string | null | undefined,
  runId: string | null | undefined
) {
  return useQuery({
    queryKey: automationsQueryKeys.run(workspaceId ?? "__missing_workspace__", runId ?? "__missing_run__"),
    queryFn: () => workspaceService.getAutomationRunDetail(requireWorkspace(workspaceId), runId ?? ""),
    enabled: isWorkspaceReady(workspaceId) && Boolean(runId?.trim())
  });
}

export function useAutomationApprovals(
  workspaceId: string | null | undefined,
  filters?: AutomationApprovalsFilters
) {
  return useQuery({
    queryKey: automationsQueryKeys.approvals(workspaceId ?? "__missing_workspace__", filters),
    queryFn: () => workspaceService.listAutomationApprovals(requireWorkspace(workspaceId), filters),
    enabled: isWorkspaceReady(workspaceId)
  });
}

export function useAutomationInbox(
  workspaceId: string | null | undefined,
  filters?: Record<string, unknown>
) {
  return useQuery({
    queryKey: automationsQueryKeys.inbox(workspaceId ?? "__missing_workspace__", filters),
    queryFn: () => workspaceService.listCommunicationInbox(requireWorkspace(workspaceId), filters),
    enabled: isWorkspaceReady(workspaceId)
  });
}

export function useAutomationTemplates(
  workspaceId: string | null | undefined,
  filters?: Record<string, unknown>
) {
  return useQuery({
    queryKey: automationsQueryKeys.templates(workspaceId ?? "__missing_workspace__", filters),
    queryFn: () => workspaceService.listCommunicationTemplates(requireWorkspace(workspaceId), filters),
    enabled: isWorkspaceReady(workspaceId)
  });
}
