import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { workspaceService } from "@/modules/workspace/api";
import type {
  CreateAutomationWorkflowInput,
  SaveAutomationWorkflowVersionInput,
  UpdateAutomationWorkflowInput,
  UpsertWhatsAppIntegrationInput
} from "@/modules/workspace/model";
import { workspaceQueryKeys } from "@/modules/workspace/query";
import { toast } from "@/shared/ui/toast";
import { automationsQueryKeys } from "./automation-query-keys";

type WorkflowStatusMutation = "active" | "paused" | "archived";

function isWorkspaceReady(workspaceId: string | null | undefined): workspaceId is string {
  return Boolean(workspaceId?.trim());
}

function requireWorkspace(workspaceId: string | null | undefined): string {
  if (!isWorkspaceReady(workspaceId)) {
    throw new Error("Nenhum workspace selecionado.");
  }
  return workspaceId;
}

export function invalidateAutomationWorkspaceQueries(queryClient: QueryClient, workspaceId: string) {
  void queryClient.invalidateQueries({ queryKey: automationsQueryKeys.workspace(workspaceId) });
  void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.workspace(workspaceId) });
}

function invalidateWorkflowQueries(queryClient: QueryClient, workspaceId: string, workflowId?: string | null) {
  invalidateAutomationWorkspaceQueries(queryClient, workspaceId);

  if (workflowId) {
    void queryClient.invalidateQueries({ queryKey: automationsQueryKeys.workflow(workspaceId, workflowId) });
    void queryClient.invalidateQueries({ queryKey: automationsQueryKeys.versions(workspaceId, workflowId) });
  }
}

function mutationError(title: string) {
  return (error: unknown) => {
    toast.error(title, { description: error instanceof Error ? error.message : "Tente novamente." });
  };
}

export function createAutomationWorkflowMutationRequest(
  workspaceId: string | null | undefined,
  input: CreateAutomationWorkflowInput
) {
  return workspaceService.createAutomationWorkflow(requireWorkspace(workspaceId), input);
}

export function createAutomationDraftVersionMutationRequest(
  workspaceId: string | null | undefined,
  input: { workflowId: string; versionInput?: SaveAutomationWorkflowVersionInput }
) {
  return workspaceService.createAutomationWorkflowDraftVersion(
    requireWorkspace(workspaceId),
    input.workflowId,
    input.versionInput
  );
}

export function updateAutomationWorkflowMutationRequest(
  workspaceId: string | null | undefined,
  input: { workflowId: string; patch: UpdateAutomationWorkflowInput }
) {
  return workspaceService.updateAutomationWorkflow(requireWorkspace(workspaceId), input.workflowId, input.patch);
}

export function saveAutomationDraftMutationRequest(
  workspaceId: string | null | undefined,
  input: { workflowId: string; versionId: string; patch: SaveAutomationWorkflowVersionInput }
) {
  return workspaceService.updateAutomationWorkflowVersion(
    requireWorkspace(workspaceId),
    input.workflowId,
    input.versionId,
    input.patch
  );
}

export function publishAutomationVersionMutationRequest(
  workspaceId: string | null | undefined,
  input: { workflowId: string; versionId: string; activateWorkflow?: boolean }
) {
  return workspaceService.publishAutomationWorkflowVersion(
    requireWorkspace(workspaceId),
    input.workflowId,
    input.versionId,
    { activateWorkflow: input.activateWorkflow ?? true }
  );
}

export function cloneAutomationVersionMutationRequest(
  workspaceId: string | null | undefined,
  input: { workflowId: string; versionId: string }
) {
  return workspaceService.cloneAutomationWorkflowVersion(requireWorkspace(workspaceId), input.workflowId, input.versionId);
}

export function setAutomationWorkflowStatusMutationRequest(
  workspaceId: string | null | undefined,
  input: { workflowId: string; status: WorkflowStatusMutation }
) {
  const resolvedWorkspaceId = requireWorkspace(workspaceId);

  if (input.status === "active") {
    return workspaceService.activateAutomationWorkflow(resolvedWorkspaceId, input.workflowId);
  }
  if (input.status === "paused") {
    return workspaceService.pauseAutomationWorkflow(resolvedWorkspaceId, input.workflowId);
  }
  return workspaceService.archiveAutomationWorkflow(resolvedWorkspaceId, input.workflowId);
}

export function runAutomationWorkflowMutationRequest(
  workspaceId: string | null | undefined,
  input: { workflowId: string; context?: Record<string, unknown> }
) {
  return workspaceService.runAutomationWorkflow(requireWorkspace(workspaceId), input.workflowId, {
    triggerType: "manual",
    context: input.context ?? { source: "automation_studio" }
  });
}

export function cancelAutomationRunMutationRequest(
  workspaceId: string | null | undefined,
  input: { runId: string; reason?: string }
) {
  return workspaceService.cancelAutomationRun(requireWorkspace(workspaceId), input.runId, input.reason);
}

export function replyAutomationConversationMutationRequest(
  workspaceId: string | null | undefined,
  input: { conversationId: string; channel: "email" | "whatsapp"; text: string }
) {
  return workspaceService.replyCommunicationConversation(requireWorkspace(workspaceId), input.conversationId, {
    channel: input.channel,
    text: input.text,
    sendMode: "manual"
  });
}

export function upsertWhatsAppConsentMutationRequest(
  workspaceId: string | null | undefined,
  input: {
    address: string;
    status: "unknown" | "opted_in" | "opted_out" | "suppressed" | "bounced" | "complained" | "invalid";
    source?: string | null;
    reason?: string | null;
  }
) {
  return workspaceService.upsertWhatsAppConsent(requireWorkspace(workspaceId), input);
}

export function upsertWhatsAppIntegrationMutationRequest(
  workspaceId: string | null | undefined,
  input: UpsertWhatsAppIntegrationInput
) {
  return workspaceService.upsertWhatsAppIntegration(requireWorkspace(workspaceId), input);
}

export function testWhatsAppIntegrationMutationRequest(workspaceId: string | null | undefined) {
  return workspaceService.testWhatsAppIntegration(requireWorkspace(workspaceId));
}

export function disableWhatsAppIntegrationMutationRequest(workspaceId: string | null | undefined) {
  return workspaceService.disableWhatsAppIntegration(requireWorkspace(workspaceId));
}

export function useCreateAutomationWorkflowMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAutomationWorkflowInput) => createAutomationWorkflowMutationRequest(workspaceId, input),
    onSuccess: () => {
      invalidateAutomationWorkspaceQueries(queryClient, requireWorkspace(workspaceId));
      toast.success("Workflow criado.");
    },
    onError: mutationError("Nao foi possivel criar o workflow.")
  });
}

export function useCreateAutomationDraftVersionMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { workflowId: string; versionInput?: SaveAutomationWorkflowVersionInput }) =>
      createAutomationDraftVersionMutationRequest(workspaceId, input),
    onSuccess: (_version, input) => {
      invalidateWorkflowQueries(queryClient, requireWorkspace(workspaceId), input.workflowId);
      toast.success("Draft criado.");
    },
    onError: mutationError("Nao foi possivel criar o draft.")
  });
}

export function useUpdateAutomationWorkflowMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { workflowId: string; patch: UpdateAutomationWorkflowInput }) =>
      updateAutomationWorkflowMutationRequest(workspaceId, input),
    onSuccess: (_workflow, input) => {
      invalidateWorkflowQueries(queryClient, requireWorkspace(workspaceId), input.workflowId);
      toast.success("Workflow atualizado.");
    },
    onError: mutationError("Nao foi possivel atualizar o workflow.")
  });
}

export function usePublishAutomationVersionMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { workflowId: string; versionId: string; activateWorkflow?: boolean }) =>
      publishAutomationVersionMutationRequest(workspaceId, input),
    onSuccess: (_version, input) => {
      invalidateWorkflowQueries(queryClient, requireWorkspace(workspaceId), input.workflowId);
      toast.success("Versao publicada.");
    },
    onError: mutationError("Nao foi possivel publicar a versao.")
  });
}

export function useSaveAutomationDraftMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { workflowId: string; versionId: string; patch: SaveAutomationWorkflowVersionInput }) =>
      saveAutomationDraftMutationRequest(workspaceId, input),
    onSuccess: (_version, input) => {
      invalidateWorkflowQueries(queryClient, requireWorkspace(workspaceId), input.workflowId);
      toast.success("Draft salvo.");
    },
    onError: mutationError("Nao foi possivel salvar o draft.")
  });
}

export function useCloneAutomationVersionMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { workflowId: string; versionId: string }) =>
      cloneAutomationVersionMutationRequest(workspaceId, input),
    onSuccess: (_version, input) => {
      invalidateWorkflowQueries(queryClient, requireWorkspace(workspaceId), input.workflowId);
      toast.success("Draft criado a partir da versao.");
    },
    onError: mutationError("Nao foi possivel clonar a versao.")
  });
}

export function useSetAutomationWorkflowStatusMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { workflowId: string; status: WorkflowStatusMutation }) =>
      setAutomationWorkflowStatusMutationRequest(workspaceId, input),
    onSuccess: (_workflow, input) => {
      invalidateWorkflowQueries(queryClient, requireWorkspace(workspaceId), input.workflowId);
      toast.success("Status atualizado.");
    },
    onError: mutationError("Nao foi possivel atualizar o status.")
  });
}

export function useRunAutomationWorkflowMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { workflowId: string; context?: Record<string, unknown> }) =>
      runAutomationWorkflowMutationRequest(workspaceId, input),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      void queryClient.invalidateQueries({ queryKey: automationsQueryKeys.runs(resolvedWorkspaceId) });
      toast.success("Execucao iniciada.");
    },
    onError: mutationError("Nao foi possivel executar o workflow.")
  });
}

export function useCancelAutomationRunMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { runId: string; reason?: string }) => cancelAutomationRunMutationRequest(workspaceId, input),
    onSuccess: (_run, input) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      void queryClient.invalidateQueries({ queryKey: automationsQueryKeys.runs(resolvedWorkspaceId) });
      void queryClient.invalidateQueries({ queryKey: automationsQueryKeys.run(resolvedWorkspaceId, input.runId) });
      toast.success("Execucao cancelada.");
    },
    onError: mutationError("Nao foi possivel cancelar a execucao.")
  });
}

export function useReplyAutomationConversationMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { conversationId: string; channel: "email" | "whatsapp"; text: string }) =>
      replyAutomationConversationMutationRequest(workspaceId, input),
    onSuccess: (_reply, input) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      void queryClient.invalidateQueries({ queryKey: automationsQueryKeys.inbox(resolvedWorkspaceId) });
      void queryClient.invalidateQueries({ queryKey: automationsQueryKeys.conversation(resolvedWorkspaceId, input.conversationId) });
      toast.success("Resposta enviada.");
    },
    onError: mutationError("Nao foi possivel responder a conversa.")
  });
}

export function useUpsertWhatsAppConsentMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof upsertWhatsAppConsentMutationRequest>[1]) =>
      upsertWhatsAppConsentMutationRequest(workspaceId, input),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      void queryClient.invalidateQueries({ queryKey: automationsQueryKeys.consents(resolvedWorkspaceId) });
      toast.success("Consentimento atualizado.");
    },
    onError: mutationError("Nao foi possivel atualizar o consentimento.")
  });
}

export function useUpsertWhatsAppIntegrationMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertWhatsAppIntegrationInput) => upsertWhatsAppIntegrationMutationRequest(workspaceId, input),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      void queryClient.invalidateQueries({ queryKey: automationsQueryKeys.whatsappIntegration(resolvedWorkspaceId) });
      toast.success("WhatsApp conectado.");
    },
    onError: mutationError("Nao foi possivel salvar a integracao do WhatsApp.")
  });
}

export function useTestWhatsAppIntegrationMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => testWhatsAppIntegrationMutationRequest(workspaceId),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      void queryClient.invalidateQueries({ queryKey: automationsQueryKeys.whatsappIntegration(resolvedWorkspaceId) });
      toast.success("Conexao com WhatsApp validada.");
    },
    onError: mutationError("Nao foi possivel testar a conexao com WhatsApp.")
  });
}

export function useDisableWhatsAppIntegrationMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => disableWhatsAppIntegrationMutationRequest(workspaceId),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      void queryClient.invalidateQueries({ queryKey: automationsQueryKeys.whatsappIntegration(resolvedWorkspaceId) });
      toast.success("WhatsApp desativado.");
    },
    onError: mutationError("Nao foi possivel desativar o WhatsApp.")
  });
}
