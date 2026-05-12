import { useMemo } from "react";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { workspaceService } from "@/modules/workspace/api";
import type { AiAgentSummary, CreateAiAgentInput, RunAiAgentRuntimeInput } from "@/modules/workspace/model";
import { workspaceQueryKeys } from "@/modules/workspace/query";
import { toast } from "@/shared/ui/toast";
import { aiAgentsQueryKeys } from "./ai-agents-query-keys";

type AiAgentCacheInput = Omit<Partial<CreateAiAgentInput>, "description"> & { description?: string | null };

type UpdateAiAgentInput = {
  agentId: string;
  patch: AiAgentCacheInput;
};

function requireWorkspace(workspaceId: string | null | undefined): string {
  if (!workspaceId?.trim()) {
    throw new Error("Nenhum workspace selecionado.");
  }
  return workspaceId;
}

function findCachedAiAgent(queryClient: QueryClient, workspaceId: string, agentId: string): AiAgentSummary | null {
  const agents = queryClient.getQueryData<AiAgentSummary[]>(aiAgentsQueryKeys.agents(workspaceId));
  return agents?.find((agent) => agent.id === agentId) ?? null;
}

function buildCachedAiAgent(
  id: string,
  input: AiAgentCacheInput,
  previous?: AiAgentSummary | null
): AiAgentSummary {
  return {
    id,
    key: input.key ?? previous?.key ?? id,
    name: input.name ?? previous?.name ?? "Agente",
    description: input.description === undefined ? previous?.description ?? null : input.description,
    model: input.model ?? previous?.model ?? "",
    temperature: input.temperature ?? previous?.temperature ?? 0.2,
    systemPrompt: input.systemPrompt ?? previous?.systemPrompt,
    config: input.config ?? previous?.config ?? null,
    isActive: input.isActive ?? previous?.isActive ?? true,
    isDefault: previous?.isDefault ?? false,
    updatedAt: new Date().toISOString()
  };
}

function upsertCachedAiAgent(queryClient: QueryClient, workspaceId: string, agent: AiAgentSummary) {
  queryClient.setQueryData<AiAgentSummary[]>(aiAgentsQueryKeys.agents(workspaceId), (current) => {
    if (!current?.length) return [agent];
    const exists = current.some((item) => item.id === agent.id);
    if (!exists) return [agent, ...current];
    return current.map((item) => (item.id === agent.id ? { ...item, ...agent } : item));
  });
  queryClient.setQueryData<AiAgentSummary | null>(aiAgentsQueryKeys.agent(workspaceId, agent.id), agent);
}

function invalidateAiAgentQueries(queryClient: QueryClient, workspaceId: string, agentId?: string) {
  void queryClient.invalidateQueries({ queryKey: aiAgentsQueryKeys.agents(workspaceId) });
  if (agentId) {
    void queryClient.invalidateQueries({ queryKey: aiAgentsQueryKeys.agent(workspaceId, agentId) });
  }
  void queryClient.invalidateQueries({ queryKey: aiAgentsQueryKeys.runs(workspaceId) });
  void queryClient.invalidateQueries({ queryKey: aiAgentsQueryKeys.runs(workspaceId, agentId) });
  void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.workspace(workspaceId) });
}

export function useCreateAiAgentMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateAiAgentInput) => {
      const workspace = requireWorkspace(workspaceId);
      const result = await workspaceService.createAiAgent(workspace, input);
      return buildCachedAiAgent(result.id, input);
    },
    onSuccess: (agent) => {
      const workspace = requireWorkspace(workspaceId);
      upsertCachedAiAgent(queryClient, workspace, agent);
      invalidateAiAgentQueries(queryClient, workspace, agent.id);
      toast.success("Agente criado.");
    },
    onError: (error) => toast.error("Nao foi possivel criar o agente.", {
      description: error instanceof Error ? error.message : "Tente novamente."
    })
  });
}

export function useUpdateAiAgentMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateAiAgentInput) => {
      const workspace = requireWorkspace(workspaceId);
      const result = await workspaceService.updateAiAgent(workspace, input.agentId, input.patch);
      const previous = findCachedAiAgent(queryClient, workspace, result.id);
      return buildCachedAiAgent(result.id, input.patch, previous);
    },
    onSuccess: (agent) => {
      const workspace = requireWorkspace(workspaceId);
      upsertCachedAiAgent(queryClient, workspace, agent);
      invalidateAiAgentQueries(queryClient, workspace, agent.id);
      toast.success("Agente salvo.");
    },
    onError: (error) => toast.error("Nao foi possivel salvar o agente.", {
      description: error instanceof Error ? error.message : "Tente novamente."
    })
  });
}

export function useValidateAiAgentMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (agentId: string) => workspaceService.validateAiAgent(requireWorkspace(workspaceId), agentId),
    onSuccess: (result, agentId) => {
      const workspace = requireWorkspace(workspaceId);
      invalidateAiAgentQueries(queryClient, workspace, agentId);
      if (result.valid) {
        toast.success("Agente validado para Automation Runtime.");
      } else {
        toast.warning("Ajuste o grafo do agente antes de publicar.", {
          description: result.issues.slice(0, 3).join(" | ") || "Runtime invalido."
        });
      }
    },
    onError: (error) => toast.error("Nao foi possivel validar o agente.", {
      description: error instanceof Error ? error.message : "Revise o grafo do agente."
    })
  });
}

export function usePublishAiAgentMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { agentId: string; activateWorkflow?: boolean }) =>
      workspaceService.publishAiAgent(requireWorkspace(workspaceId), input.agentId, {
        activateWorkflow: input.activateWorkflow ?? true
      }),
    onSuccess: (result) => {
      const workspace = requireWorkspace(workspaceId);
      invalidateAiAgentQueries(queryClient, workspace, result.agentId);
      toast.success("Agente publicado no Automation Runtime.", {
        description: `Workflow ${result.workflowId}, versao ${result.workflowVersionId}.`
      });
    },
    onError: (error) => toast.error("Nao foi possivel publicar o agente.", {
      description: error instanceof Error ? error.message : "Revise a validacao do grafo."
    })
  });
}

export function useRunAiAgentMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { agentId: string } & RunAiAgentRuntimeInput) =>
      workspaceService.runAiAgent(requireWorkspace(workspaceId), input.agentId, {
        instruction: input.instruction,
        context: input.context
      }),
    onSuccess: (result) => {
      const workspace = requireWorkspace(workspaceId);
      invalidateAiAgentQueries(queryClient, workspace, result.agentId);
      toast.success("Execucao do agente iniciada.", {
        description: `Run ${result.runId}: ${result.executionStatus} (${result.executedNodeIds.length} steps).`
      });
    },
    onError: (error) => toast.error("Nao foi possivel executar o agente.", {
      description: error instanceof Error ? error.message : "Confira se o agente foi publicado."
    })
  });
}

export function useArchiveAiAgentMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (agentId: string) => workspaceService.archiveAiAgent(requireWorkspace(workspaceId), agentId),
    onSuccess: (result) => {
      const workspace = requireWorkspace(workspaceId);
      queryClient.setQueryData<AiAgentSummary[]>(aiAgentsQueryKeys.agents(workspace), (current) =>
        current?.filter((agent) => agent.id !== result.id) ?? current
      );
      queryClient.setQueryData<AiAgentSummary | null>(aiAgentsQueryKeys.agent(workspace, result.id), null);
      invalidateAiAgentQueries(queryClient, workspace, result.id);
      toast.success("Agente arquivado.");
    },
    onError: (error) => toast.error("Nao foi possivel arquivar o agente.", {
      description: error instanceof Error ? error.message : "Tente novamente."
    })
  });
}

export function useRunAiAgentOnItemMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      itemId: string;
      agentId: string;
      instruction: string;
      includeSemanticContext?: boolean;
      topKContextDocs?: number;
    }) =>
      workspaceService.runAiAgentOnItem(requireWorkspace(workspaceId), input.itemId, input.agentId, {
        instruction: input.instruction,
        includeSemanticContext: input.includeSemanticContext,
        topKContextDocs: input.topKContextDocs
      }),
    onSuccess: (_result, input) => {
      const workspace = requireWorkspace(workspaceId);
      invalidateAiAgentQueries(queryClient, workspace, input.agentId);
    },
    onError: (error) => toast.error("Nao foi possivel executar o agente neste item.", {
      description: error instanceof Error ? error.message : "Tente novamente."
    })
  });
}

export function useRunAiRiskAnalysisMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      itemId: string;
      includeSemanticContext?: boolean;
      topKContextDocs?: number;
    }) =>
      workspaceService.runAiRiskAnalysis(requireWorkspace(workspaceId), input.itemId, {
        includeSemanticContext: input.includeSemanticContext,
        topKContextDocs: input.topKContextDocs
      }),
    onSuccess: () => {
      const workspace = requireWorkspace(workspaceId);
      void queryClient.invalidateQueries({ queryKey: aiAgentsQueryKeys.runs(workspace) });
      void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.workspace(workspace) });
    },
    onError: (error) => toast.error("Nao foi possivel executar a analise de risco.", {
      description: error instanceof Error ? error.message : "Tente novamente."
    })
  });
}

export interface AiWorkItemActions {
  listAiAgents: () => Promise<AiAgentSummary[]>;
  runAiAgentOnItem: (
    itemId: string,
    agentId: string,
    input: { instruction: string; includeSemanticContext?: boolean; topKContextDocs?: number }
  ) => Promise<{ runId: string; content: string }>;
  runAiRiskAnalysis: (
    itemId: string,
    input?: { includeSemanticContext?: boolean; topKContextDocs?: number }
  ) => Promise<{ runId: string; content: string }>;
}

export function useAiWorkItemActions(workspaceId: string | null | undefined): AiWorkItemActions {
  const queryClient = useQueryClient();
  const { mutateAsync: runAgentOnItem } = useRunAiAgentOnItemMutation(workspaceId);
  const { mutateAsync: runRiskAnalysis } = useRunAiRiskAnalysisMutation(workspaceId);

  return useMemo(
    () => ({
      listAiAgents: () => {
        if (!workspaceId?.trim()) {
          return Promise.resolve([]);
        }

        return queryClient.fetchQuery({
          queryKey: aiAgentsQueryKeys.agents(workspaceId),
          queryFn: () => workspaceService.listAiAgents(workspaceId)
        });
      },
      runAiAgentOnItem: (itemId, agentId, input) =>
        runAgentOnItem({
          itemId,
          agentId,
          instruction: input.instruction,
          includeSemanticContext: input.includeSemanticContext,
          topKContextDocs: input.topKContextDocs
        }),
      runAiRiskAnalysis: (itemId, input) =>
        runRiskAnalysis({
          itemId,
          includeSemanticContext: input?.includeSemanticContext,
          topKContextDocs: input?.topKContextDocs
        })
    }),
    [queryClient, runAgentOnItem, runRiskAnalysis, workspaceId]
  );
}
