import { useMutation, useQueryClient } from "@tanstack/react-query";
import { workspaceService } from "@/modules/workspace/api";
import type {
  CreateAutomationWorkflowInput,
  SaveAutomationWorkflowVersionInput,
  UpdateAutomationWorkflowInput
} from "@/modules/workspace/model";
import { toast } from "@/shared/ui/toast";
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

function invalidateAutomationQueries(queryClient: ReturnType<typeof useQueryClient>, workspaceId: string) {
  void queryClient.invalidateQueries({ queryKey: automationsQueryKeys.workspace(workspaceId) });
}

function mutationError(title: string) {
  return (error: unknown) => {
    toast.error(title, { description: error instanceof Error ? error.message : "Tente novamente." });
  };
}

export function useCreateAutomationWorkflowMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAutomationWorkflowInput) =>
      workspaceService.createAutomationWorkflow(requireWorkspace(workspaceId), input),
    onSuccess: () => {
      const resolved = requireWorkspace(workspaceId);
      invalidateAutomationQueries(queryClient, resolved);
      toast.success("Workflow criado.");
    },
    onError: mutationError("Nao foi possivel criar o workflow.")
  });
}

export function useUpdateAutomationWorkflowMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workflowId, input }: { workflowId: string; input: UpdateAutomationWorkflowInput }) =>
      workspaceService.updateAutomationWorkflow(requireWorkspace(workspaceId), workflowId, input),
    onSuccess: (_workflow, input) => {
      const resolved = requireWorkspace(workspaceId);
      invalidateAutomationQueries(queryClient, resolved);
      void queryClient.invalidateQueries({ queryKey: automationsQueryKeys.workflow(resolved, input.workflowId) });
      toast.success("Workflow atualizado.");
    },
    onError: mutationError("Nao foi possivel atualizar o workflow.")
  });
}

export function usePublishAutomationVersionMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workflowId, versionId, activateWorkflow = true }: { workflowId: string; versionId: string; activateWorkflow?: boolean }) =>
      workspaceService.publishAutomationWorkflowVersion(requireWorkspace(workspaceId), workflowId, versionId, { activateWorkflow }),
    onSuccess: (_version, input) => {
      const resolved = requireWorkspace(workspaceId);
      invalidateAutomationQueries(queryClient, resolved);
      void queryClient.invalidateQueries({ queryKey: automationsQueryKeys.versions(resolved, input.workflowId) });
      toast.success("Versao publicada.");
    },
    onError: mutationError("Nao foi possivel publicar a versao.")
  });
}

export function useSaveAutomationDraftMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workflowId, versionId, input }: { workflowId: string; versionId: string; input: SaveAutomationWorkflowVersionInput }) =>
      workspaceService.updateAutomationWorkflowVersion(requireWorkspace(workspaceId), workflowId, versionId, input),
    onSuccess: (_version, input) => {
      const resolved = requireWorkspace(workspaceId);
      void queryClient.invalidateQueries({ queryKey: automationsQueryKeys.versions(resolved, input.workflowId) });
      toast.success("Draft salvo.");
    },
    onError: mutationError("Nao foi possivel salvar o draft.")
  });
}

export function useRunAutomationWorkflowMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workflowId, context }: { workflowId: string; context?: Record<string, unknown> }) =>
      workspaceService.runAutomationWorkflow(requireWorkspace(workspaceId), workflowId, {
        triggerType: "manual",
        context: context ?? { source: "automation_studio" }
      }),
    onSuccess: () => {
      const resolved = requireWorkspace(workspaceId);
      void queryClient.invalidateQueries({ queryKey: automationsQueryKeys.runs(resolved) });
      toast.success("Execucao iniciada.");
    },
    onError: mutationError("Nao foi possivel executar o workflow.")
  });
}
