import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type {
  CreateMarketingFollowUpInput,
  MarketingAudienceContact,
  MarketingAutomationFlow,
  MarketingCampaignAnalytics,
  MarketingCampaignDetails,
  MarketingCampaignListItem,
  MarketingCampaignObjective,
  MarketingCampaignStatus,
  MarketingDashboard,
  MarketingTemplateFormValues,
  MarketingSegment,
  MarketingSignal,
  MarketingTemplate
} from "@/modules/marketing/model";
import {
  compileJourneyGraphToAutomationDefinition,
  createMarketingCampaignSchema,
  getMarketingJourneyActivationErrors,
  marketingAiCampaignComposerSchema,
  marketingAiCampaignSchema,
  marketingCampaignComposerSchema,
  marketingSegmentComposerSchema,
  marketingSegmentFormSchema,
  marketingTemplateFormSchema,
  scheduleMarketingCampaignSchema,
  sendMarketingTestEmailSchema
} from "@/modules/marketing/model";
import {
  useActivateJourneyMutation,
  useApproveCampaignMutation,
  useArchiveTemplateMutation,
  useCreateCampaignMutation,
  useCreateFollowUpMutation,
  useCreateSegmentMutation,
  useCreateTemplateMutation,
  useDuplicateTemplateMutation,
  useGenerateCampaignWithAiMutation,
  useImproveCampaignVariantWithAiMutation,
  useLaunchCampaignMutation,
  useMarkSignalMutation,
  useMarketingAnalyticsQuery,
  useMarketingAudienceQuery,
  useMarketingCampaignDetailsQuery,
  useMarketingCampaignsQuery,
  useMarketingJourneysQuery,
  useMarketingSegmentsQuery,
  useMarketingSignalsQuery,
  useMarketingTemplatesQuery,
  usePauseJourneyMutation,
  usePreviewSegmentMutation,
  useSaveJourneyMutation,
  useScheduleCampaignMutation,
  useSendTemplateTestEmailMutation,
  useSendTestEmailMutation,
  useSubmitCampaignForReviewMutation,
  useUpdateTemplateMutation
} from "@/modules/marketing/query";
import type { WorkspacePermissionKey, WorkspaceSnapshot } from "@/modules/workspace/model";
import type { JourneyEdge, JourneyNode } from "../journey-builder/types";
import {
  INITIAL_SEGMENT_FILTERS,
  TEMPLATE_GOAL_FILTERS,
  analyticsEventTotal,
  buildSegmentFilters,
  campaignId,
  fmtNum,
  fmtPct,
  fmtRevenue,
  safeString,
  sanitizeJson,
  type AiFormState,
  type CampaignFormState,
  type MarketingTab,
  type SegmentFilterRule,
  type SegmentFormState,
  type SegmentPreviewState
} from "./marketing-page.model";

interface MarketingFeedbackControls {
  setError: Dispatch<SetStateAction<string>>;
  setMessage: Dispatch<SetStateAction<string>>;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function getFirstSchemaError(error: { issues: Array<{ message: string }> }): string {
  return error.issues[0]?.message ?? "Revise os campos informados.";
}

async function runMarketingAction(
  controls: MarketingFeedbackControls,
  handler: () => Promise<void>,
  fallbackError: string
) {
  controls.setError("");
  controls.setMessage("");

  try {
    await handler();
  } catch (error) {
    controls.setError(getErrorMessage(error, fallbackError));
  }
}

function isMutationPending(...values: Array<{ isPending: boolean }>): boolean {
  return values.some((entry) => entry.isPending);
}

const DEFAULT_CAMPAIGN_FORM: CampaignFormState = {
  name: "",
  description: "",
  objective: "LEAD_NURTURE",
  segmentId: "",
  templateId: "",
  subject: "",
  bodyMarkdown: "Ola {{lead.firstName}},\n\nQuero compartilhar um update rapido com contexto da sua operacao.\n\n[]"
};

const DEFAULT_AI_FORM: AiFormState = {
  objective: "Gerar campanha de nutricao para leads com score acima de 60 e ultima interacao maior que 14 dias",
  tone: "consultivo premium",
  targetStage: "MQL",
  segmentHint: "leads com fit em software sob medida"
};

const DEFAULT_SEGMENT_FORM: SegmentFormState = {
  name: "",
  description: "",
  kind: "DYNAMIC",
  filtersText: INITIAL_SEGMENT_FILTERS
};

export function useMarketingPermissionsModel(snapshot: WorkspaceSnapshot | null) {
  const allowedModules = snapshot?.access?.allowedModules ?? [];
  const moduleEntitlements = snapshot?.access?.moduleEntitlements ?? {};
  const hasMarketingModule = allowedModules.length === 0 || allowedModules.includes("marketing");
  const isMarketingEntitled = moduleEntitlements.marketing !== false;

  const can = useCallback((_permission: WorkspacePermissionKey) => {
    return hasMarketingModule && isMarketingEntitled;
  }, [hasMarketingModule, isMarketingEntitled]);

  return useMemo(
    () => ({
      hasMarketingModule,
      isMarketingEntitled,
      canViewMarketing: can("marketing.view"),
      canCreateCampaign: can("marketing.campaign.create"),
      canSendCampaign: can("marketing.campaign.send"),
      canManageTemplates: can("marketing.template.manage"),
      canManageSegments: can("marketing.segment.manage"),
      canManageJourneys: can("marketing.automation.manage"),
      canUseAi: can("marketing.ai.use"),
      can
    }),
    [can, hasMarketingModule, isMarketingEntitled]
  );
}

export function useMarketingCampaignsModel(
  workspaceId: string,
  controls: MarketingFeedbackControls,
  setTab: (tab: MarketingTab) => void
) {
  const [campaignSearch, setCampaignSearch] = useState("");
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<MarketingCampaignStatus | "ALL">("ALL");
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(true);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const campaignFormMethods = useForm<CampaignFormState>({
    resolver: zodResolver(marketingCampaignComposerSchema),
    defaultValues: DEFAULT_CAMPAIGN_FORM
  });
  const aiFormMethods = useForm<AiFormState>({
    resolver: zodResolver(marketingAiCampaignComposerSchema),
    defaultValues: DEFAULT_AI_FORM
  });
  const setAiForm = useCallback<Dispatch<SetStateAction<AiFormState>>>(
    (next) => {
      const current = aiFormMethods.getValues();
      const resolved = typeof next === "function" ? next(current) : next;
      aiFormMethods.reset(resolved, { keepDirty: true, keepTouched: true });
    },
    [aiFormMethods]
  );

  const campaignsQuery = useMarketingCampaignsQuery(workspaceId, {
    status: campaignStatusFilter,
    search: campaignSearch,
    limit: 150
  });
  const campaignDetailsQuery = useMarketingCampaignDetailsQuery(workspaceId, selectedCampaignId);

  const createCampaignMutation = useCreateCampaignMutation(workspaceId);
  const submitReviewMutation = useSubmitCampaignForReviewMutation(workspaceId);
  const approveCampaignMutation = useApproveCampaignMutation(workspaceId);
  const scheduleCampaignMutation = useScheduleCampaignMutation(workspaceId);
  const sendTestMutation = useSendTestEmailMutation(workspaceId);
  const launchCampaignMutation = useLaunchCampaignMutation(workspaceId);
  const generateAiMutation = useGenerateCampaignWithAiMutation(workspaceId);
  const improveAiMutation = useImproveCampaignVariantWithAiMutation(workspaceId);

  const campaigns = campaignsQuery.data?.items ?? [];
  const campaignDetails = campaignDetailsQuery.data ?? null;

  useEffect(() => {
    if (!selectedCampaignId && campaigns.length > 0) {
      setSelectedCampaignId(campaigns[0]?.id ?? null);
    }
  }, [campaigns, selectedCampaignId]);

  useEffect(() => {
    if (!campaignDetails) return;
    const firstVariantId = campaignDetails.variants[0]?.id ?? "";
    if (!selectedVariantId || !campaignDetails.variants.some((variant) => variant.id === selectedVariantId)) {
      setSelectedVariantId(firstVariantId);
    }
  }, [campaignDetails, selectedVariantId]);

  const loadCampaignDetails = useCallback(
    async (campaignIdValue: string) => {
      if (!campaignIdValue) {
        return;
      }

      setSelectedCampaignId(campaignIdValue);
      setSelectedVariantId("");
    },
    []
  );

  const createCampaign = useCallback(async () => {
    await runMarketingAction(controls, async () => {
      if (!workspaceId) return;

      await campaignFormMethods.trigger();
      const formValues = campaignFormMethods.getValues();
      const parsedForm = marketingCampaignComposerSchema.safeParse(formValues);

      if (!parsedForm.success) {
        controls.setError(getFirstSchemaError(parsedForm.error));
        return;
      }

      const parsed = createMarketingCampaignSchema.safeParse({
        name: parsedForm.data.name,
        description: parsedForm.data.description || undefined,
        objective: parsedForm.data.objective,
        segmentId: parsedForm.data.segmentId || undefined,
        templateId: parsedForm.data.templateId || undefined,
        variants: [
          {
            name: "Controle",
            subject: parsedForm.data.subject,
            bodyMarkdown: parsedForm.data.bodyMarkdown,
            weight: 100,
            isControl: true
          }
        ]
      });

      if (!parsed.success) {
        controls.setError(getFirstSchemaError(parsed.error));
        return;
      }

      const created = await createCampaignMutation.mutateAsync(parsed.data);

      const createdCampaignId = campaignId(created.campaign as Record<string, unknown>);
      if (createdCampaignId) {
        setSelectedCampaignId(createdCampaignId);
        setSelectedVariantId(created.variants[0]?.id ?? "");
      }

      setTab("campaigns");
      controls.setMessage("Campanha criada e conectada ao contexto operacional.");
      campaignFormMethods.reset({
        ...parsedForm.data,
        name: "",
        description: "",
        subject: "",
        bodyMarkdown: DEFAULT_CAMPAIGN_FORM.bodyMarkdown
      });
    }, "Nao foi possivel criar a campanha.");
  }, [campaignFormMethods, controls, createCampaignMutation, setTab, workspaceId]);

  const submitForReview = useCallback(async () => {
    await runMarketingAction(controls, async () => {
      if (!selectedCampaignId) return;
      await submitReviewMutation.mutateAsync(selectedCampaignId);
      controls.setMessage("Campanha enviada para revisao.");
    }, "Nao foi possivel enviar a campanha para revisao.");
  }, [controls, selectedCampaignId, submitReviewMutation]);

  const approveCampaign = useCallback(async () => {
    await runMarketingAction(controls, async () => {
      if (!selectedCampaignId) return;
      await approveCampaignMutation.mutateAsync(selectedCampaignId);
      controls.setMessage("Campanha aprovada para agendamento/envio.");
    }, "Nao foi possivel aprovar a campanha.");
  }, [approveCampaignMutation, controls, selectedCampaignId]);

  const scheduleCampaign = useCallback(async () => {
    await runMarketingAction(controls, async () => {
      if (!selectedCampaignId || !scheduleAt) {
        controls.setError("Informe data/hora para agendar.");
        return;
      }

      const parsed = scheduleMarketingCampaignSchema.safeParse({ scheduledAt: scheduleAt });
      if (!parsed.success) {
        controls.setError(getFirstSchemaError(parsed.error));
        return;
      }

      await scheduleCampaignMutation.mutateAsync({
        campaignId: selectedCampaignId,
        scheduledAt: new Date(parsed.data.scheduledAt).toISOString()
      });
      controls.setMessage("Campanha agendada.");
    }, "Nao foi possivel agendar a campanha.");
  }, [controls, scheduleAt, scheduleCampaignMutation, selectedCampaignId]);

  const sendTest = useCallback(async () => {
    await runMarketingAction(controls, async () => {
      if (!selectedCampaignId || !testEmail.trim()) {
        controls.setError("Informe e-mail de teste para validar conteudo.");
        return;
      }

      const parsed = sendMarketingTestEmailSchema.safeParse({
        to: testEmail.trim()
      });
      if (!parsed.success) {
        controls.setError(getFirstSchemaError(parsed.error));
        return;
      }

      const result = await sendTestMutation.mutateAsync({
        campaignId: selectedCampaignId,
        to: parsed.data.to
      });
      controls.setMessage(`Teste enviado via ${result.providerKey} (${result.providerMessageId}).`);
    }, "Nao foi possivel enviar o e-mail de teste.");
  }, [controls, selectedCampaignId, sendTestMutation, testEmail]);

  const launchCampaign = useCallback(async (dryRun?: boolean) => {
    await runMarketingAction(controls, async () => {
      if (!selectedCampaignId) return;
      const result = await launchCampaignMutation.mutateAsync({ campaignId: selectedCampaignId, dryRun });
      controls.setMessage(
        dryRun
          ? `Simulacao concluida: ${result.queued} envios elegiveis, ${result.skipped} ignorados.`
          : `Campanha lancada: ${result.queued} envios enfileirados, ${result.skipped} ignorados.`
      );
    }, "Nao foi possivel lancar a campanha.");
  }, [controls, launchCampaignMutation, selectedCampaignId]);

  const generateWithAI = useCallback(async () => {
    await runMarketingAction(controls, async () => {
      await aiFormMethods.trigger();
      const aiValues = aiFormMethods.getValues();

      const parsed = marketingAiCampaignSchema.safeParse({
        objective: aiValues.objective,
        tone: aiValues.tone || undefined,
        targetStage: aiValues.targetStage || undefined,
        segmentHint: aiValues.segmentHint || undefined,
        documentLimit: 6
      });
      if (!parsed.success) {
        controls.setError(getFirstSchemaError(parsed.error));
        return;
      }

      const generated = await generateAiMutation.mutateAsync({
        objective: parsed.data.objective,
        tone: parsed.data.tone,
        targetStage: parsed.data.targetStage,
        segmentHint: parsed.data.segmentHint,
        documentLimit: parsed.data.documentLimit
      });

      const generatedCampaignId = campaignId(generated.campaign as Record<string, unknown>);
      if (generatedCampaignId) {
        setSelectedCampaignId(generatedCampaignId);
        setSelectedVariantId(generated.variants[0]?.id ?? "");
      }
      setTab("campaigns");
      controls.setMessage("Campanha gerada por IA com contexto real do workspace.");
    }, "Nao foi possivel gerar a campanha com IA.");
  }, [aiFormMethods, controls, generateAiMutation, setTab]);

  const improveVariantWithAI = useCallback(async () => {
    await runMarketingAction(controls, async () => {
      if (!selectedCampaignId || !selectedVariantId) {
        controls.setError("Selecione uma variante para melhorar com IA.");
        return;
      }

      const aiValues = aiFormMethods.getValues();
      await improveAiMutation.mutateAsync({
        campaignId: selectedCampaignId,
        variantId: selectedVariantId,
        objective: aiValues.objective,
        tone: aiValues.tone
      });
      controls.setMessage("Variante ajustada pela IA com base no contexto.");
    }, "Nao foi possivel melhorar a variante com IA.");
  }, [aiFormMethods, controls, improveAiMutation, selectedCampaignId, selectedVariantId]);

  const scheduledCampaigns = useMemo(
    () =>
      campaigns
        .filter((campaign) => Boolean(campaign.scheduledAt))
        .sort((a, b) => new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime()),
    [campaigns]
  );

  const activeCampaigns = useMemo(
    () => campaigns.filter((campaign) => campaign.status === "ACTIVE"),
    [campaigns]
  );

  const reviewCampaigns = useMemo(
    () => campaigns.filter((campaign) => campaign.status === "IN_REVIEW" || campaign.status === "DRAFT"),
    [campaigns]
  );

  const isSubmitting = isMutationPending(
    createCampaignMutation,
    submitReviewMutation,
    approveCampaignMutation,
    scheduleCampaignMutation,
    sendTestMutation,
    launchCampaignMutation,
    generateAiMutation,
    improveAiMutation
  );

  return {
    campaigns,
    scheduledCampaigns,
    activeCampaigns,
    reviewCampaigns,
    campaignDetails,
    selectedCampaignId,
    selectedVariantId,
    setSelectedVariantId,
    testEmail,
    setTestEmail,
    scheduleAt,
    setScheduleAt,
    campaignSearch,
    setCampaignSearch,
    campaignStatusFilter,
    setCampaignStatusFilter,
    campaignFormControl: campaignFormMethods.control,
    campaignFormErrors: campaignFormMethods.formState.errors,
    setAiForm,
    aiFormControl: aiFormMethods.control,
    aiFormErrors: aiFormMethods.formState.errors,
    isAiAssistantOpen,
    setIsAiAssistantOpen,
    isLoading: campaignsQuery.isLoading || campaignDetailsQuery.isLoading,
    isFetching: campaignsQuery.isFetching || campaignDetailsQuery.isFetching,
    isSubmitting,
    error: campaignsQuery.error ?? campaignDetailsQuery.error,
    createCampaign,
    loadCampaignDetails,
    generateWithAI,
    submitForReview,
    approveCampaign,
    scheduleCampaign,
    sendTest,
    improveVariantWithAI,
    launchCampaign
  };
}

export function useMarketingAudienceModel(workspaceId: string, controls: MarketingFeedbackControls) {
  const [audienceSearch, setAudienceSearch] = useState("");
  const [segmentPreview, setSegmentPreview] = useState<SegmentPreviewState | null>(null);
  const segmentFormMethods = useForm<SegmentFormState>({
    resolver: zodResolver(marketingSegmentComposerSchema),
    defaultValues: DEFAULT_SEGMENT_FORM
  });
  const segmentForm = useWatch({ control: segmentFormMethods.control }) as SegmentFormState;

  const audienceQuery = useMarketingAudienceQuery(workspaceId, {
    search: audienceSearch || undefined,
    limit: 200
  });
  const segmentsQuery = useMarketingSegmentsQuery(workspaceId);
  const createSegmentMutation = useCreateSegmentMutation(workspaceId);
  const previewSegmentMutation = usePreviewSegmentMutation(workspaceId);

  const audience = audienceQuery.data?.items ?? [];
  const segments = segmentsQuery.data?.items ?? [];

  const segmentFilterRule = useMemo<SegmentFilterRule>(() => {
    try {
      const parsed = sanitizeJson(segmentForm.filtersText);
      const rules = Array.isArray(parsed.rules) ? parsed.rules : [];
      const firstRule = rules[0] as Record<string, unknown> | undefined;
      return {
        field: safeString(firstRule?.field) || "score",
        operator: safeString(firstRule?.operator) || "gte",
        value: firstRule?.value == null ? "60" : String(firstRule.value)
      };
    } catch {
      return { field: "score", operator: "gte", value: "60" };
    }
  }, [segmentForm.filtersText]);

  const updateSegmentFilterRule = useCallback((updates: Partial<{ field: string; operator: string; value: string }>) => {
    const next = { ...segmentFilterRule, ...updates };
    const normalizedValue = next.field === "score" ? Number(next.value) || 0 : next.value;
    segmentFormMethods.setValue("filtersText", buildSegmentFilters(next.field, next.operator, normalizedValue), {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true
    });
  }, [segmentFilterRule, segmentFormMethods]);

  const loadData = useCallback(async () => {
    await Promise.all([audienceQuery.refetch(), segmentsQuery.refetch()]);
  }, [audienceQuery, segmentsQuery]);

  const createSegment = useCallback(async () => {
    await runMarketingAction(controls, async () => {
      await segmentFormMethods.trigger();
      const formValues = segmentFormMethods.getValues();
      const parsedForm = marketingSegmentComposerSchema.safeParse(formValues);
      if (!parsedForm.success) {
        controls.setError(getFirstSchemaError(parsedForm.error));
        return;
      }

      const filters = sanitizeJson(parsedForm.data.filtersText);
      const parsed = marketingSegmentFormSchema.safeParse({
        name: parsedForm.data.name,
        description: parsedForm.data.description || undefined,
        kind: parsedForm.data.kind,
        filters
      });
      if (!parsed.success) {
        controls.setError(getFirstSchemaError(parsed.error));
        return;
      }

      await createSegmentMutation.mutateAsync({
        name: parsed.data.name,
        description: parsed.data.description,
        kind: parsed.data.kind,
        filters: parsed.data.filters as MarketingSegment["filters"]
      });
      segmentFormMethods.reset(DEFAULT_SEGMENT_FORM);
      controls.setMessage("Segmento criado com filtros dinamicos.");
    }, "Nao foi possivel criar o segmento.");
  }, [controls, createSegmentMutation, segmentFormMethods]);

  const previewSegment = useCallback(async (segmentId: string) => {
    await runMarketingAction(controls, async () => {
      const preview = await previewSegmentMutation.mutateAsync({ segmentId, limit: 30 });
      setSegmentPreview({
        segmentName: preview.segment.name,
        estimatedContacts: preview.estimatedContacts,
        sample: preview.sample
      });
    }, "Nao foi possivel simular o segmento.");
  }, [controls, previewSegmentMutation]);

  return {
    audience,
    segments,
    audienceSearch,
    setAudienceSearch,
    segmentForm,
    segmentFormControl: segmentFormMethods.control,
    segmentFormErrors: segmentFormMethods.formState.errors,
    segmentPreview,
    segmentFilterRule,
    updateSegmentFilterRule,
    isLoading: audienceQuery.isLoading || segmentsQuery.isLoading,
    isFetching: audienceQuery.isFetching || segmentsQuery.isFetching,
    isSubmitting: isMutationPending(createSegmentMutation, previewSegmentMutation),
    error: audienceQuery.error ?? segmentsQuery.error,
    loadData,
    createSegment,
    previewSegment
  };
}

export function useMarketingSignalsModel(
  workspaceId: string,
  controls: MarketingFeedbackControls,
  setTab: (tab: MarketingTab) => void
) {
  const [signalTypeFilter, setSignalTypeFilter] = useState<string>("ALL");
  const [signalShowDismissed, setSignalShowDismissed] = useState(false);
  const [signalGroupByLead, setSignalGroupByLead] = useState(false);

  const signalsQuery = useMarketingSignalsQuery(workspaceId, {
    includeDismissed: signalShowDismissed,
    limit: 100
  });
  const markSignalMutation = useMarkSignalMutation(workspaceId);
  const createFollowUpMutation = useCreateFollowUpMutation(workspaceId);

  const loadSignals = useCallback(async () => {
    const result = await signalsQuery.refetch();
    if (result.error) {
      controls.setError(getErrorMessage(result.error, "Nao foi possivel carregar os sinais agora."));
    }
  }, [controls, signalsQuery]);

  const handleSignalAction = useCallback(async (signal: MarketingSignal, action: "seen" | "dismissed") => {
    await runMarketingAction(controls, async () => {
      await markSignalMutation.mutateAsync({ signalId: signal.id, action });
    }, "Nao foi possivel atualizar o sinal.");
  }, [controls, markSignalMutation]);

  const createFollowUp = useCallback(async (input: CreateMarketingFollowUpInput) => {
    await runMarketingAction(controls, async () => {
      await createFollowUpMutation.mutateAsync(input);
      controls.setMessage("Follow-up registrado no historico do lead.");
    }, "Nao foi possivel criar o follow-up.");
  }, [controls, createFollowUpMutation]);

  return {
    signalUnreadCount: signalsQuery.data?.unreadCount ?? 0,
    signals: signalsQuery.data?.items ?? [],
    isLoadingSignals: signalsQuery.isLoading || signalsQuery.isFetching || markSignalMutation.isPending,
    isCreatingFollowUp: createFollowUpMutation.isPending,
    signalsError: getErrorMessage(signalsQuery.error, ""),
    signalTypeFilter,
    signalShowDismissed,
    signalGroupByLead,
    setSignalTypeFilter,
    setSignalShowDismissed,
    setSignalGroupByLead,
    setMessage: controls.setMessage,
    setTab,
    loadSignals,
    handleSignalAction,
    createFollowUp
  };
}

export function useMarketingAnalyticsModel(
  workspaceId: string,
  tab: MarketingTab,
  dashboard: MarketingDashboard | null,
  campaigns: MarketingCampaignListItem[],
  setTab: (tab: MarketingTab) => void,
  loadCampaignDetails: (campaignIdValue: string) => Promise<void>
) {
  const [analyticsObjectiveFilter, setAnalyticsObjectiveFilter] = useState<MarketingCampaignObjective | "ALL">("ALL");
  const campaignIds = useMemo(
    () => (tab === "analytics" ? campaigns.map((campaign) => campaign.id) : []),
    [campaigns, tab]
  );
  const analyticsQuery = useMarketingAnalyticsQuery(workspaceId, { campaignIds });
  const campaignAnalyticsMap = analyticsQuery.data ?? {};

  const enrichedCampaigns = useMemo(() => {
    return campaigns
      .filter((campaign) => analyticsObjectiveFilter === "ALL" || campaign.objective === analyticsObjectiveFilter)
      .map((campaign) => {
        const analytics = campaignAnalyticsMap[campaign.id];
        const sent = analyticsEventTotal(analytics, "SENT");
        const opened = analyticsEventTotal(analytics, "OPENED");
        const clicked = analyticsEventTotal(analytics, "CLICKED");
        const bounced = analyticsEventTotal(analytics, "BOUNCED");
        return {
          ...campaign,
          sent,
          opened,
          clicked,
          bounced,
          openRate: sent > 0 ? opened / sent : null,
          clickRate: sent > 0 ? clicked / sent : null
        };
      });
  }, [analyticsObjectiveFilter, campaignAnalyticsMap, campaigns]);

  const analyticsDataVolume = useMemo(() => {
    const totalSent = enrichedCampaigns.reduce((total, campaign) => total + campaign.sent, 0);
    const totalEvents = Object.values(campaignAnalyticsMap).reduce(
      (total, analytics) => total + analytics.byType.reduce((subtotal, entry) => subtotal + entry.total, 0),
      0
    );

    return {
      totalSent,
      totalEvents,
      hasExecutedCampaigns: totalSent > 0 || totalEvents > 0,
      hasBusinessImpact:
        (dashboard?.influencedLeads ?? 0) > 0 ||
        (dashboard?.influencedCustomers ?? 0) > 0 ||
        (dashboard?.influencedRevenue ?? 0) > 0
    };
  }, [campaignAnalyticsMap, dashboard, enrichedCampaigns]);

  const hasEnoughAnalyticsData = analyticsDataVolume.hasExecutedCampaigns || analyticsDataVolume.hasBusinessImpact;

  const analyticsInsights = useMemo(() => {
    if (!dashboard) return [];
    if (!hasEnoughAnalyticsData) return [];
    const insights: string[] = [];

    if (dashboard.openRate < 0.22) {
      insights.push(`Open rate em ${fmtPct(dashboard.openRate)} - testar variacao de assunto por estagio e score.`);
    } else {
      insights.push(`Open rate saudavel (${fmtPct(dashboard.openRate)}) - foque em converter aberturas em cliques.`);
    }

    if (dashboard.clickRate < 0.05) {
      insights.push("Click rate abaixo de 5% - revisar CTA e alinhamento entre assunto e conteudo do corpo.");
    } else {
      insights.push(`Click rate de ${fmtPct(dashboard.clickRate)} - considere aumentar frequencia para leads engajados.`);
    }

    if (dashboard.influencedRevenue > 0 && dashboard.influencedCustomers > 0) {
      const ltv = dashboard.influencedRevenue / dashboard.influencedCustomers;
      insights.push(`Ticket medio por cliente influenciado: ${fmtRevenue(ltv)}.`);
    }

    const topClick = enrichedCampaigns.filter((campaign) => campaign.sent > 0).sort((a, b) => (b.clickRate ?? 0) - (a.clickRate ?? 0))[0];
    if (topClick) {
      insights.push(`"${topClick.name}" lidera em click rate: ${fmtPct(topClick.clickRate)}.`);
    }

    const highBounce = enrichedCampaigns.filter((campaign) => campaign.sent > 0 && campaign.bounced / campaign.sent > 0.05)[0];
    if (highBounce) {
      insights.push(`"${highBounce.name}" com bounce rate elevado - limpar lista antes do proximo envio.`);
    } else if (dashboard.activeCampaigns > 0) {
      insights.push(`${fmtNum(dashboard.influencedLeads)} leads influenciados por campanhas ativas - qualificar e distribuir.`);
    }

    return insights;
  }, [dashboard, enrichedCampaigns, hasEnoughAnalyticsData]);

  return {
    enrichedCampaigns,
    analyticsInsights,
    analyticsObjectiveFilter,
    isLoadingAnalytics: analyticsQuery.isFetching,
    hasEnoughAnalyticsData,
    setAnalyticsObjectiveFilter,
    setTab,
    loadCampaignDetails,
    onRefreshAnalytics: async () => {
      await analyticsQuery.refetch();
    },
    error: analyticsQuery.error
  };
}

export function useMarketingTemplatesModel(workspaceId: string, controls: MarketingFeedbackControls) {
  const [templateGoalFilter, setTemplateGoalFilter] = useState<(typeof TEMPLATE_GOAL_FILTERS)[number]>("Todos");

  const templatesQuery = useMarketingTemplatesQuery(workspaceId);
  const createTemplateMutation = useCreateTemplateMutation(workspaceId);
  const updateTemplateMutation = useUpdateTemplateMutation(workspaceId);
  const duplicateTemplateMutation = useDuplicateTemplateMutation(workspaceId);
  const archiveTemplateMutation = useArchiveTemplateMutation(workspaceId);
  const sendTemplateTestEmailMutation = useSendTemplateTestEmailMutation(workspaceId);
  const templates = templatesQuery.data?.items ?? [];

  const filteredTemplates = useMemo(() => {
    if (templateGoalFilter === "Todos") {
      return templates;
    }

    const query = templateGoalFilter.toLowerCase();
    return templates.filter((template) =>
      [template.category, template.objective, template.funnelStage, template.name, template.subject]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [templateGoalFilter, templates]);

  const createTemplate = useCallback(async (values?: MarketingTemplateFormValues) => {
    await runMarketingAction(controls, async () => {
      const source = values ?? {
        name: "",
        category: "newsletter",
        objective: "LEAD_NURTURE",
        funnelStage: "mql",
        subject: "",
        bodyMarkdown: "## Assunto principal\n\nMensagem com contexto operacional.\n\n- ponto 1\n- ponto 2",
        bodyHtml: undefined,
        variables: []
      };
      const parsed = marketingTemplateFormSchema.safeParse(source);
      if (!parsed.success) {
        controls.setError(getFirstSchemaError(parsed.error));
        return;
      }

      await createTemplateMutation.mutateAsync({
        name: parsed.data.name,
        category: parsed.data.category,
        objective: parsed.data.objective,
        funnelStage: parsed.data.funnelStage,
        subject: parsed.data.subject,
        bodyMarkdown: parsed.data.bodyMarkdown,
        bodyHtml: parsed.data.bodyHtml
      });

      controls.setMessage("Template salvo na biblioteca.");
    }, "Nao foi possivel criar o template.");
  }, [controls, createTemplateMutation]);

  const updateTemplate = useCallback(async (templateId: string, values: MarketingTemplateFormValues) => {
    await runMarketingAction(controls, async () => {
      const parsed = marketingTemplateFormSchema.safeParse(values);
      if (!parsed.success) {
        controls.setError(getFirstSchemaError(parsed.error));
        return;
      }

      await updateTemplateMutation.mutateAsync({
        templateId,
        patch: {
          name: parsed.data.name,
          category: parsed.data.category,
          objective: parsed.data.objective,
          funnelStage: parsed.data.funnelStage,
          subject: parsed.data.subject,
          bodyMarkdown: parsed.data.bodyMarkdown,
          bodyHtml: parsed.data.bodyHtml
        }
      });
      controls.setMessage("Template atualizado.");
    }, "Nao foi possivel atualizar o template.");
  }, [controls, updateTemplateMutation]);

  const duplicateTemplate = useCallback(async (template: MarketingTemplate) => {
    await runMarketingAction(controls, async () => {
      await duplicateTemplateMutation.mutateAsync({ template });
      controls.setMessage("Template duplicado.");
    }, "Nao foi possivel duplicar o template.");
  }, [controls, duplicateTemplateMutation]);

  const archiveTemplate = useCallback(async (templateId: string) => {
    await runMarketingAction(controls, async () => {
      await archiveTemplateMutation.mutateAsync(templateId);
      controls.setMessage("Template arquivado.");
    }, "Nao foi possivel arquivar o template.");
  }, [archiveTemplateMutation, controls]);

  const sendTemplateTest = useCallback(async (
    templateId: string,
    input: { to: string; variables?: Record<string, string | number | boolean | null> }
  ) => {
    await runMarketingAction(controls, async () => {
      await sendTemplateTestEmailMutation.mutateAsync({ templateId, input });
      controls.setMessage("Teste de template enviado.");
    }, "Nao foi possivel enviar o teste do template.");
  }, [controls, sendTemplateTestEmailMutation]);

  return {
    templates,
    filteredTemplates,
    templateGoalFilter,
    setTemplateGoalFilter,
    isLoading: templatesQuery.isLoading,
    isFetching: templatesQuery.isFetching,
    isSubmitting: isMutationPending(
      createTemplateMutation,
      updateTemplateMutation,
      duplicateTemplateMutation,
      archiveTemplateMutation,
      sendTemplateTestEmailMutation
    ),
    error: templatesQuery.error,
    createTemplate,
    updateTemplate,
    duplicateTemplate,
    archiveTemplate,
    sendTemplateTest
  };
}

export function useMarketingJourneysModel(workspaceId: string, controls: MarketingFeedbackControls) {
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const journeysQuery = useMarketingJourneysQuery(workspaceId);
  const saveJourneyMutation = useSaveJourneyMutation(workspaceId);
  const activateJourneyMutation = useActivateJourneyMutation(workspaceId);
  const pauseJourneyMutation = usePauseJourneyMutation(workspaceId);

  const flows = journeysQuery.data?.items ?? [];

  const handleJourneySave = useCallback(async (name: string, nodes: JourneyNode[], edges: JourneyEdge[]) => {
    await runMarketingAction(controls, async () => {
      const compiled = compileJourneyGraphToAutomationDefinition(nodes, edges, {
        flowId: activeFlowId,
        workspaceId,
        name,
        status: activeFlowId ? undefined : "DRAFT",
        allowDraft: true
      });
      const triggerDefinition = compiled.definition as unknown as Record<string, unknown>;
      const saved = await saveJourneyMutation.mutateAsync({
        flowId: activeFlowId,
        name,
        status: activeFlowId ? undefined : "DRAFT",
        triggerDefinition,
        steps: compiled.definition.steps
      });
      setActiveFlowId(saved.id);
      if (compiled.errors.length > 0 || compiled.warnings.length > 0) {
        controls.setMessage("Jornada salva como rascunho com pendencias de validacao.");
      } else {
        controls.setMessage("Jornada salva com definicao versionada.");
      }
    }, "Nao foi possivel salvar a jornada.");
  }, [activeFlowId, controls, saveJourneyMutation, workspaceId]);

  const handleJourneyActivate = useCallback(async (flowId: string) => {
    await runMarketingAction(controls, async () => {
      const flow = flows.find((entry) => entry.id === flowId);
      const savedDefinition = (flow?.triggerDefinition ?? {}) as { nodes?: JourneyNode[]; edges?: JourneyEdge[] };
      const nodes = Array.isArray(savedDefinition.nodes) ? savedDefinition.nodes : [];
      const edges = Array.isArray(savedDefinition.edges) ? savedDefinition.edges : [];
      const compiled = compileJourneyGraphToAutomationDefinition(nodes, edges, {
        flowId,
        workspaceId,
        name: flow?.name ?? "Jornada",
        status: "ACTIVE",
        allowDraft: false
      });
      const activationErrors = getMarketingJourneyActivationErrors(compiled);
      if (activationErrors.length > 0) {
        controls.setError(activationErrors[0]?.message ?? "Revise a jornada antes de ativar.");
        return;
      }

      await saveJourneyMutation.mutateAsync({
        flowId,
        name: flow?.name ?? "Jornada",
        status: "DRAFT",
        triggerDefinition: compiled.definition as unknown as Record<string, unknown>,
        steps: compiled.definition.steps
      });
      await activateJourneyMutation.mutateAsync(flowId);
    }, "Nao foi possivel ativar a jornada.");
  }, [activateJourneyMutation, controls, flows, saveJourneyMutation, workspaceId]);

  const handleJourneyDeactivate = useCallback(async (flowId: string) => {
    await runMarketingAction(controls, async () => {
      await pauseJourneyMutation.mutateAsync(flowId);
    }, "Nao foi possivel pausar a jornada.");
  }, [controls, pauseJourneyMutation]);

  return {
    flows,
    activeFlowId,
    setActiveFlowId,
    handleJourneySave,
    handleJourneyActivate,
    handleJourneyDeactivate,
    isLoading: journeysQuery.isLoading,
    isFetching: journeysQuery.isFetching,
    isSavingFlow: isMutationPending(saveJourneyMutation, activateJourneyMutation, pauseJourneyMutation),
    error: journeysQuery.error
  };
}

export type MarketingCampaignsModel = ReturnType<typeof useMarketingCampaignsModel>;
export type MarketingAudienceModel = ReturnType<typeof useMarketingAudienceModel>;
export type MarketingSignalsModel = ReturnType<typeof useMarketingSignalsModel>;
export type MarketingAnalyticsModel = ReturnType<typeof useMarketingAnalyticsModel>;
export type MarketingTemplatesModel = ReturnType<typeof useMarketingTemplatesModel>;
export type MarketingJourneysModel = ReturnType<typeof useMarketingJourneysModel>;
