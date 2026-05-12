import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { marketingService } from "@/modules/marketing/api";
import type {
  CreateMarketingCampaignInput,
  CreateMarketingFollowUpInput,
  MarketingAutomationFlow,
  MarketingJourneyDefinition,
  MarketingCampaignDetails,
  MarketingSegment,
  MarketingSegmentPreview,
  MarketingTemplate,
  SendMarketingTemplateTestInput
} from "@/modules/marketing/model";
import { marketingQueryKeys } from "@/modules/marketing/query/marketing-query-keys";
import { workspaceQueryKeys } from "@/modules/workspace/query/workspace-query-keys";
import { toast } from "@/shared/ui/toast";

function isWorkspaceReady(workspaceId: string | null | undefined): workspaceId is string {
  return Boolean(workspaceId?.trim());
}

function requireWorkspace(workspaceId: string | null | undefined): string {
  if (!isWorkspaceReady(workspaceId)) {
    throw new Error("Nenhum workspace selecionado.");
  }

  return workspaceId;
}

function campaignIdFromDetails(details: MarketingCampaignDetails): string | null {
  const value = details.campaign.id;
  return typeof value === "string" && value ? value : null;
}

function mutationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Tente novamente.";
}

function invalidateMarketingCollections(queryClient: QueryClient, workspaceId: string) {
  void queryClient.invalidateQueries({ queryKey: marketingQueryKeys.dashboard(workspaceId) });
}

function invalidateCampaignQueries(queryClient: QueryClient, workspaceId: string, campaignId?: string | null) {
  void queryClient.invalidateQueries({ queryKey: [...marketingQueryKeys.workspace(workspaceId), "campaigns"] });
  void queryClient.invalidateQueries({ queryKey: [...marketingQueryKeys.workspace(workspaceId), "analytics"] });
  void queryClient.invalidateQueries({ queryKey: marketingQueryKeys.dashboard(workspaceId) });

  if (campaignId) {
    void queryClient.invalidateQueries({ queryKey: marketingQueryKeys.campaignDetails(workspaceId, campaignId) });
  }
}

function invalidateAudienceQueries(queryClient: QueryClient, workspaceId: string) {
  void queryClient.invalidateQueries({ queryKey: [...marketingQueryKeys.workspace(workspaceId), "audience"] });
  void queryClient.invalidateQueries({ queryKey: marketingQueryKeys.segments(workspaceId) });
}

function invalidateTemplateQueries(queryClient: QueryClient, workspaceId: string) {
  void queryClient.invalidateQueries({ queryKey: [...marketingQueryKeys.workspace(workspaceId), "templates"] });
}

function invalidateSignalQueries(queryClient: QueryClient, workspaceId: string) {
  void queryClient.invalidateQueries({ queryKey: [...marketingQueryKeys.workspace(workspaceId), "signals"] });
}

function invalidateJourneyQueries(queryClient: QueryClient, workspaceId: string, journeyId?: string | null) {
  void queryClient.invalidateQueries({ queryKey: [...marketingQueryKeys.workspace(workspaceId), "journeys"] });
  void queryClient.invalidateQueries({ queryKey: marketingQueryKeys.dashboard(workspaceId) });

  if (journeyId) {
    void queryClient.invalidateQueries({ queryKey: marketingQueryKeys.journey(workspaceId, journeyId) });
  }
}

function handleMutationError(title: string) {
  return (error: unknown) => {
    toast.error(title, { description: mutationErrorMessage(error) });
  };
}

export function useCreateCampaignMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateMarketingCampaignInput) => createMarketingCampaignMutationRequest(workspaceId, input),
    onSuccess: (details) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      const campaignId = campaignIdFromDetails(details);
      if (campaignId) {
        queryClient.setQueryData(marketingQueryKeys.campaignDetails(resolvedWorkspaceId, campaignId), details);
      }
      invalidateCampaignQueries(queryClient, resolvedWorkspaceId, campaignId);
      toast.success("Campanha criada.");
    },
    onError: handleMutationError("Nao foi possivel criar a campanha.")
  });
}

export async function createMarketingCampaignMutationRequest(
  workspaceId: string | null | undefined,
  input: CreateMarketingCampaignInput
) {
  return marketingService.createCampaign(requireWorkspace(workspaceId), input);
}

export function useUpdateCampaignMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, patch }: { campaignId: string; patch: Record<string, unknown> }) =>
      marketingService.updateCampaign(requireWorkspace(workspaceId), campaignId, patch),
    onSuccess: (details, input) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      queryClient.setQueryData(marketingQueryKeys.campaignDetails(resolvedWorkspaceId, input.campaignId), details);
      invalidateCampaignQueries(queryClient, resolvedWorkspaceId, input.campaignId);
      toast.success("Campanha atualizada.");
    },
    onError: handleMutationError("Nao foi possivel atualizar a campanha.")
  });
}

export function useSubmitCampaignForReviewMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (campaignId: string) => marketingService.submitForReview(requireWorkspace(workspaceId), campaignId),
    onSuccess: (details, campaignId) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      queryClient.setQueryData(marketingQueryKeys.campaignDetails(resolvedWorkspaceId, campaignId), details);
      invalidateCampaignQueries(queryClient, resolvedWorkspaceId, campaignId);
      toast.success("Campanha enviada para revisao.");
    },
    onError: handleMutationError("Nao foi possivel enviar a campanha para revisao.")
  });
}

export function useApproveCampaignMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (campaignId: string) => marketingService.approveCampaign(requireWorkspace(workspaceId), campaignId),
    onSuccess: (details, campaignId) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      queryClient.setQueryData(marketingQueryKeys.campaignDetails(resolvedWorkspaceId, campaignId), details);
      invalidateCampaignQueries(queryClient, resolvedWorkspaceId, campaignId);
      toast.success("Campanha aprovada.");
    },
    onError: handleMutationError("Nao foi possivel aprovar a campanha.")
  });
}

export function useScheduleCampaignMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, scheduledAt }: { campaignId: string; scheduledAt: string }) =>
      marketingService.scheduleCampaign(requireWorkspace(workspaceId), campaignId, scheduledAt),
    onSuccess: (details, input) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      queryClient.setQueryData(marketingQueryKeys.campaignDetails(resolvedWorkspaceId, input.campaignId), details);
      invalidateCampaignQueries(queryClient, resolvedWorkspaceId, input.campaignId);
      toast.success("Campanha agendada.");
    },
    onError: handleMutationError("Nao foi possivel agendar a campanha.")
  });
}

export function useSendTestEmailMutation(workspaceId: string | null | undefined) {
  return useMutation({
    mutationFn: ({ campaignId, to, subject, content }: { campaignId: string; to: string; subject?: string; content?: string }) =>
      marketingService.sendTestEmail(requireWorkspace(workspaceId), campaignId, { to, subject, content }),
    onSuccess: (result) => {
      toast.success("E-mail de teste enviado.", {
        description: `${result.providerKey}${result.providerMessageId ? ` (${result.providerMessageId})` : ""}`
      });
    },
    onError: handleMutationError("Nao foi possivel enviar o e-mail de teste.")
  });
}

export function useLaunchCampaignMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, dryRun }: { campaignId: string; dryRun?: boolean }) =>
      marketingService.launchCampaign(requireWorkspace(workspaceId), campaignId, { dryRun }),
    onSuccess: (result, input) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateCampaignQueries(queryClient, resolvedWorkspaceId, input.campaignId);
      toast.success(input.dryRun ? "Simulacao concluida." : "Campanha enviada para fila.", {
        description: `${result.queued} elegiveis, ${result.skipped} ignorados.`
      });
    },
    onError: handleMutationError("Nao foi possivel lancar a campanha.")
  });
}

export function useGenerateCampaignWithAiMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      objective: string;
      tone?: string;
      targetStage?: string;
      segmentHint?: string;
      documentLimit?: number;
    }) => marketingService.aiGenerateCampaign(requireWorkspace(workspaceId), input),
    onSuccess: (details) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      const campaignId = campaignIdFromDetails(details);
      if (campaignId) {
        queryClient.setQueryData(marketingQueryKeys.campaignDetails(resolvedWorkspaceId, campaignId), details);
      }
      invalidateCampaignQueries(queryClient, resolvedWorkspaceId, campaignId);
      toast.success("Campanha gerada por IA.");
    },
    onError: handleMutationError("Nao foi possivel gerar a campanha com IA.")
  });
}

export function useImproveCampaignVariantWithAiMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, variantId, objective, tone }: { campaignId: string; variantId: string; objective?: string; tone?: string }) =>
      marketingService.aiImproveVariant(requireWorkspace(workspaceId), campaignId, variantId, { objective, tone }),
    onSuccess: (details, input) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      queryClient.setQueryData(marketingQueryKeys.campaignDetails(resolvedWorkspaceId, input.campaignId), details);
      invalidateCampaignQueries(queryClient, resolvedWorkspaceId, input.campaignId);
      toast.success("Variante ajustada por IA.");
    },
    onError: handleMutationError("Nao foi possivel melhorar a variante com IA.")
  });
}

export function useCreateSegmentMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { name: string; description?: string; kind?: "STATIC" | "DYNAMIC"; filters: MarketingSegment["filters"] }) =>
      marketingService.createSegment(requireWorkspace(workspaceId), input),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateAudienceQueries(queryClient, resolvedWorkspaceId);
      toast.success("Segmento criado.");
    },
    onError: handleMutationError("Nao foi possivel criar o segmento.")
  });
}

export function useUpdateSegmentMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ segmentId, patch }: { segmentId: string; patch: { name?: string; description?: string; kind?: "STATIC" | "DYNAMIC"; filters?: MarketingSegment["filters"]; isActive?: boolean } }) =>
      marketingService.updateSegment(requireWorkspace(workspaceId), segmentId, patch),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateAudienceQueries(queryClient, resolvedWorkspaceId);
      toast.success("Segmento atualizado.");
    },
    onError: handleMutationError("Nao foi possivel atualizar o segmento.")
  });
}

export function usePreviewSegmentMutation(workspaceId: string | null | undefined) {
  return useMutation({
    mutationFn: ({ segmentId, limit = 30 }: { segmentId: string; limit?: number }): Promise<MarketingSegmentPreview> =>
      marketingService.previewSegment(requireWorkspace(workspaceId), segmentId, limit),
    onSuccess: (preview) => {
      toast.success("Previa do segmento atualizada.", {
        description: `${preview.estimatedContacts} contatos estimados.`
      });
    },
    onError: handleMutationError("Nao foi possivel simular o segmento.")
  });
}

export function useCreateTemplateMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      name: string;
      slug?: string;
      category?: string;
      objective?: string;
      funnelStage?: string;
      subject: string;
      bodyMarkdown: string;
      bodyHtml?: string;
      blocks?: Record<string, unknown>;
    }) => marketingService.createTemplate(requireWorkspace(workspaceId), input),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateTemplateQueries(queryClient, resolvedWorkspaceId);
      toast.success("Template criado.");
    },
    onError: handleMutationError("Nao foi possivel criar o template.")
  });
}

export function useUpdateTemplateMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, patch }: { templateId: string; patch: Record<string, unknown> }) =>
      marketingService.updateTemplate(requireWorkspace(workspaceId), templateId, patch),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateTemplateQueries(queryClient, resolvedWorkspaceId);
      toast.success("Template atualizado.");
    },
    onError: handleMutationError("Nao foi possivel atualizar o template.")
  });
}

export function useDuplicateTemplateMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ template, name }: { template: MarketingTemplate; name?: string }) =>
      marketingService.createTemplate(requireWorkspace(workspaceId), {
        name: name ?? `${template.name} (copia ${Date.now()})`,
        category: template.category ?? undefined,
        objective: template.objective ?? undefined,
        funnelStage: template.funnelStage ?? undefined,
        subject: template.subject,
        bodyMarkdown: template.bodyMarkdown,
        bodyHtml: template.bodyHtml ?? undefined
      }),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateTemplateQueries(queryClient, resolvedWorkspaceId);
      toast.success("Template duplicado.");
    },
    onError: handleMutationError("Nao foi possivel duplicar o template.")
  });
}

export function useArchiveTemplateMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (templateId: string) =>
      marketingService.updateTemplate(requireWorkspace(workspaceId), templateId, { isArchived: true }),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateTemplateQueries(queryClient, resolvedWorkspaceId);
      toast.success("Template arquivado.");
    },
    onError: handleMutationError("Nao foi possivel arquivar o template.")
  });
}

export function useSendTemplateTestEmailMutation(workspaceId: string | null | undefined) {
  return useMutation({
    mutationFn: ({ templateId, input }: { templateId: string; input: SendMarketingTemplateTestInput }) =>
      marketingService.sendTemplateTestEmail(requireWorkspace(workspaceId), templateId, input),
    onSuccess: (result) => {
      toast.success("Teste de template enviado.", {
        description: `${result.providerKey}${result.providerMessageId ? ` (${result.providerMessageId})` : ""}`
      });
    },
    onError: handleMutationError("Nao foi possivel enviar o teste do template.")
  });
}

export function useMarkSignalMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ signalId, action }: { signalId: string; action: "seen" | "dismissed" }) =>
      marketingService.markSignal(requireWorkspace(workspaceId), signalId, action),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateSignalQueries(queryClient, resolvedWorkspaceId);
    },
    onError: handleMutationError("Nao foi possivel atualizar o sinal.")
  });
}

export function useCreateFollowUpMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateMarketingFollowUpInput) =>
      marketingService.createFollowUp(requireWorkspace(workspaceId), input),
    onSuccess: () => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateSignalQueries(queryClient, resolvedWorkspaceId);
      invalidateAudienceQueries(queryClient, resolvedWorkspaceId);
      void queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.workspace(resolvedWorkspaceId) });
      invalidateMarketingCollections(queryClient, resolvedWorkspaceId);
      toast.success("Follow-up criado.");
    },
    onError: handleMutationError("Nao foi possivel criar o follow-up.")
  });
}

export function useSaveJourneyMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      flowId?: string | null;
      name: string;
      description?: string;
      status?: MarketingAutomationFlow["status"];
      triggerDefinition: MarketingJourneyDefinition;
      steps?: Array<Record<string, unknown>>;
    }) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      if (input.flowId) {
        return marketingService.updateAutomationFlow(resolvedWorkspaceId, input.flowId, {
          name: input.name,
          description: input.description,
          status: input.status,
          triggerDefinition: input.triggerDefinition
        });
      }

      return marketingService.createAutomationFlow(resolvedWorkspaceId, {
        name: input.name,
        description: input.description,
        status: input.status ?? "DRAFT",
        triggerDefinition: input.triggerDefinition,
        steps: input.steps ?? []
      });
    },
    onSuccess: (flow) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateJourneyQueries(queryClient, resolvedWorkspaceId, flow.id);
      toast.success("Jornada salva.");
    },
    onError: handleMutationError("Nao foi possivel salvar a jornada.")
  });
}

export function useActivateJourneyMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (flowId: string) =>
      marketingService.updateAutomationFlow(requireWorkspace(workspaceId), flowId, { status: "ACTIVE" }),
    onSuccess: (flow) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateJourneyQueries(queryClient, resolvedWorkspaceId, flow.id);
      toast.success("Jornada ativada.");
    },
    onError: handleMutationError("Nao foi possivel ativar a jornada.")
  });
}

export function usePauseJourneyMutation(workspaceId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (flowId: string) =>
      marketingService.updateAutomationFlow(requireWorkspace(workspaceId), flowId, { status: "PAUSED" }),
    onSuccess: (flow) => {
      const resolvedWorkspaceId = requireWorkspace(workspaceId);
      invalidateJourneyQueries(queryClient, resolvedWorkspaceId, flow.id);
      toast.success("Jornada pausada.");
    },
    onError: handleMutationError("Nao foi possivel pausar a jornada.")
  });
}
