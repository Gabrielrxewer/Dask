import { useQuery } from "@tanstack/react-query";
import { workspaceService } from "@/modules/workspace/api";
import type { AiAgentSummary, AiRunSummary } from "@/modules/workspace/model";
import { aiAgentsQueryKeys } from "./ai-agents-query-keys";

function isWorkspaceReady(workspaceSlug: string | null | undefined): workspaceSlug is string {
  return Boolean(workspaceSlug?.trim());
}

function requireWorkspace(workspaceSlug: string | null | undefined): string {
  if (!isWorkspaceReady(workspaceSlug)) {
    throw new Error("Nenhum workspace selecionado.");
  }
  return workspaceSlug;
}

export function useAiAgentsQuery(workspaceSlug: string | null | undefined) {
  const resolvedWorkspace = workspaceSlug ?? "__missing_workspace__";

  return useQuery({
    queryKey: aiAgentsQueryKeys.agents(resolvedWorkspace),
    queryFn: () => workspaceService.listAiAgents(requireWorkspace(workspaceSlug)),
    enabled: isWorkspaceReady(workspaceSlug)
  });
}

export function useAiAgentQuery(
  workspaceSlug: string | null | undefined,
  agentId: string | null | undefined
) {
  const resolvedWorkspace = workspaceSlug ?? "__missing_workspace__";
  const resolvedAgentId = agentId ?? "__missing_agent__";

  return useQuery<AiAgentSummary | null>({
    queryKey: aiAgentsQueryKeys.agent(resolvedWorkspace, resolvedAgentId),
    queryFn: async () => {
      const agents = await workspaceService.listAiAgents(requireWorkspace(workspaceSlug));
      return agents.find((agent) => agent.id === agentId) ?? null;
    },
    enabled: isWorkspaceReady(workspaceSlug) && Boolean(agentId)
  });
}

export function useAiCapabilitiesQuery(workspaceSlug: string | null | undefined) {
  const resolvedWorkspace = workspaceSlug ?? "__missing_workspace__";

  return useQuery({
    queryKey: aiAgentsQueryKeys.capabilities(resolvedWorkspace),
    queryFn: () => workspaceService.getAiCapabilities(requireWorkspace(workspaceSlug)),
    enabled: isWorkspaceReady(workspaceSlug)
  });
}

export function useAiAgentRunsQuery(
  workspaceSlug: string | null | undefined,
  input?: { agentId?: string | null; itemId?: string; limit?: number }
) {
  const resolvedWorkspace = workspaceSlug ?? "__missing_workspace__";

  return useQuery<AiRunSummary[]>({
    queryKey: aiAgentsQueryKeys.runs(resolvedWorkspace, input?.agentId),
    queryFn: () =>
      workspaceService.listAiRuns(requireWorkspace(workspaceSlug), {
        itemId: input?.itemId,
        limit: input?.limit ?? 50
      }),
    enabled: isWorkspaceReady(workspaceSlug)
  });
}
