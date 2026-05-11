export const aiAgentsQueryKeys = {
  all: ["ai-agents"] as const,
  workspace: (workspaceId: string) => [...aiAgentsQueryKeys.all, workspaceId] as const,
  agents: (workspaceId: string) => [...aiAgentsQueryKeys.workspace(workspaceId), "agents"] as const,
  agent: (workspaceId: string, agentId: string) =>
    [...aiAgentsQueryKeys.agents(workspaceId), agentId] as const,
  capabilities: (workspaceId: string) =>
    [...aiAgentsQueryKeys.workspace(workspaceId), "capabilities"] as const,
  runs: (workspaceId: string, agentId?: string | null) =>
    [...aiAgentsQueryKeys.workspace(workspaceId), "runs", agentId ?? "all"] as const
};
