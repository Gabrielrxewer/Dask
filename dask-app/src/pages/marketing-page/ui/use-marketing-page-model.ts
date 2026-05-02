import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildBoardMetrics } from "@/entities/task";
import { marketingService } from "@/modules/marketing";
import type {
  MarketingAudienceContact,
  MarketingAutomationFlow,
  MarketingCampaignAnalytics,
  MarketingCampaignDetails,
  MarketingCampaignListItem,
  MarketingCampaignObjective,
  MarketingCampaignStatus,
  MarketingDashboard,
  MarketingSegment,
  MarketingSignal,
  MarketingTemplate
} from "@/modules/marketing";
import { useWorkspace } from "@/modules/workspace";
import type { JourneyNode, JourneyEdge } from "../journey-builder/types";
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
  type SegmentPreviewState,
  type TemplateFormState
} from "./marketing-page.model";

export function useMarketingPageModel() {
  const { snapshot } = useWorkspace();
  const workspaceId = snapshot?.id ?? "";
  const metrics = useMemo(() => buildBoardMetrics(snapshot?.tasks ?? []), [snapshot?.tasks]);

  const [tab, setTab] = useState<MarketingTab>("overview");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [dashboard, setDashboard] = useState<MarketingDashboard | null>(null);
  const [campaigns, setCampaigns] = useState<MarketingCampaignListItem[]>([]);
  const [segments, setSegments] = useState<MarketingSegment[]>([]);
  const [templates, setTemplates] = useState<MarketingTemplate[]>([]);
  const [audience, setAudience] = useState<MarketingAudienceContact[]>([]);
  const [flows, setFlows] = useState<MarketingAutomationFlow[]>([]);
  const [activeFlowId, setActiveFlowId] = useState<string | null>(null);
  const [isSavingFlow, setIsSavingFlow] = useState(false);

  const [signals, setSignals] = useState<MarketingSignal[]>([]);
  const [signalUnreadCount, setSignalUnreadCount] = useState(0);
  const [isLoadingSignals, setIsLoadingSignals] = useState(false);
  const [signalsError, setSignalsError] = useState("");
  const [signalTypeFilter, setSignalTypeFilter] = useState<string>("ALL");
  const [signalShowDismissed, setSignalShowDismissed] = useState(false);
  const [signalGroupByLead, setSignalGroupByLead] = useState(false);

  const [campaignAnalyticsMap, setCampaignAnalyticsMap] = useState<Record<string, MarketingCampaignAnalytics>>({});
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [analyticsObjectiveFilter, setAnalyticsObjectiveFilter] = useState<MarketingCampaignObjective | "ALL">("ALL");
  const analyticsLoadedRef = useRef<string>("");

  const [campaignSearch, setCampaignSearch] = useState("");
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<MarketingCampaignStatus | "ALL">("ALL");
  const [audienceSearch, setAudienceSearch] = useState("");
  const [isAiAssistantOpen, setIsAiAssistantOpen] = useState(true);
  const [templateGoalFilter, setTemplateGoalFilter] = useState<(typeof TEMPLATE_GOAL_FILTERS)[number]>("Todos");

  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [campaignDetails, setCampaignDetails] = useState<MarketingCampaignDetails | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");

  const [testEmail, setTestEmail] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");

  const [campaignForm, setCampaignForm] = useState<CampaignFormState>({
    name: "",
    description: "",
    objective: "LEAD_NURTURE",
    segmentId: "",
    templateId: "",
    subject: "",
    bodyMarkdown: "Olá {{lead.firstName}},\n\nQuero compartilhar um update rápido com contexto da sua operação.\n\n[]"
  });

  const [segmentForm, setSegmentForm] = useState<SegmentFormState>({
    name: "",
    description: "",
    kind: "DYNAMIC",
    filtersText: INITIAL_SEGMENT_FILTERS
  });
  const [segmentPreview, setSegmentPreview] = useState<SegmentPreviewState | null>(null);

  const [templateForm, setTemplateForm] = useState<TemplateFormState>({
    name: "",
    category: "newsletter",
    objective: "LEAD_NURTURE",
    funnelStage: "mql",
    subject: "",
    bodyMarkdown: "## Assunto principal\n\nMensagem com contexto operacional.\n\n- ponto 1\n- ponto 2"
  });

  const [aiForm, setAiForm] = useState<AiFormState>({
    objective: "Gerar campanha de nutrição para leads com score acima de 60 e última interação maior que 14 dias",
    tone: "consultivo premium",
    targetStage: "MQL",
    segmentHint: "leads com fit em software sob medida"
  });

  const loadCampaignDetails = useCallback(
    async (campaignIdValue: string) => {
      if (!workspaceId || !campaignIdValue) {
        return;
      }

      const details = await marketingService.getCampaignDetails(workspaceId, campaignIdValue);
      setCampaignDetails(details);
      setSelectedCampaignId(campaignIdValue);
      setSelectedVariantId(details.variants[0]?.id ?? "");
    },
    [workspaceId]
  );

  const loadData = useCallback(async () => {
    if (!workspaceId) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const [nextDashboard, nextCampaigns, nextSegments, nextTemplates, nextAudience, nextFlows] = await Promise.all([
        marketingService.getDashboard(workspaceId),
        marketingService.listCampaigns(workspaceId, {
          status: campaignStatusFilter === "ALL" ? undefined : campaignStatusFilter,
          search: campaignSearch || undefined,
          limit: 150
        }),
        marketingService.listSegments(workspaceId),
        marketingService.listTemplates(workspaceId),
        marketingService.listAudienceContacts(workspaceId, {
          search: audienceSearch || undefined,
          limit: 200
        }),
        marketingService.listAutomationFlows(workspaceId)
      ]);

      setDashboard(nextDashboard);
      setCampaigns(nextCampaigns.items);
      setSegments(nextSegments.items);
      setTemplates(nextTemplates.items);
      setAudience(nextAudience.items);
      setFlows(nextFlows.items);

      if (!selectedCampaignId && nextCampaigns.items.length > 0) {
        const campaignIdValue = nextCampaigns.items[0]?.id ?? "";
        if (campaignIdValue) {
          await loadCampaignDetails(campaignIdValue);
        }
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar módulo de marketing.");
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, campaignStatusFilter, campaignSearch, audienceSearch, selectedCampaignId, loadCampaignDetails]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const loadSignals = useCallback(async () => {
    if (!workspaceId) return;
    setIsLoadingSignals(true);
    setSignalsError("");
    try {
      const result = await marketingService.listSignalsInbox(workspaceId, {
        includeDismissed: signalShowDismissed,
        limit: 100
      });
      setSignals(result.items);
      setSignalUnreadCount(result.unreadCount);
    } catch {
    } finally {
      setIsLoadingSignals(false);
    }
  }, [workspaceId, signalShowDismissed]);

  useEffect(() => {
    if (tab === "inbox" || tab === "overview") {
      void loadSignals();
    }
  }, [tab, loadSignals]);

  const handleSignalAction = useCallback(
    async (signal: MarketingSignal, action: "seen" | "dismissed") => {
      if (!workspaceId) return;
      await marketingService.markSignal(workspaceId, signal.id, action);
      setSignals((prev) =>
        prev
          .map((s) =>
            s.id === signal.id
              ? {
                  ...s,
                  seenAt: action === "seen" ? new Date().toISOString() : s.seenAt,
                  dismissedAt: action === "dismissed" ? new Date().toISOString() : s.dismissedAt
                }
              : s
          )
          .filter((s) => signalShowDismissed || s.dismissedAt === null)
      );
      if (action === "seen") {
        setSignalUnreadCount((n) => Math.max(0, n - 1));
      }
    },
    [workspaceId, signalShowDismissed]
  );

  useEffect(() => {
    if (tab !== "analytics" || !workspaceId || campaigns.length === 0) return;
    const cacheKey = `${workspaceId}:${campaigns.map((c) => c.id).join(",")}`;
    if (analyticsLoadedRef.current === cacheKey) return;
    analyticsLoadedRef.current = cacheKey;

    const load = async () => {
      setIsLoadingAnalytics(true);
      try {
        const entries = await Promise.all(
          campaigns.map(async (c) => {
            try {
              const a = await marketingService.getAnalytics(workspaceId, c.id);
              return [c.id, a] as const;
            } catch {
              return [c.id, { byType: [], byStatus: [] } as MarketingCampaignAnalytics] as const;
            }
          })
        );
        setCampaignAnalyticsMap(Object.fromEntries(entries));
      } finally {
        setIsLoadingAnalytics(false);
      }
    };

    void load();
  }, [tab, workspaceId, campaigns]);

  const enrichedCampaigns = useMemo(() => {
    return campaigns
      .filter((c) => analyticsObjectiveFilter === "ALL" || c.objective === analyticsObjectiveFilter)
      .map((c) => {
        const a = campaignAnalyticsMap[c.id];
        const sent = analyticsEventTotal(a, "SENT");
        const opened = analyticsEventTotal(a, "OPENED");
        const clicked = analyticsEventTotal(a, "CLICKED");
        const bounced = analyticsEventTotal(a, "BOUNCED");
        return {
          ...c,
          sent,
          opened,
          clicked,
          bounced,
          openRate: sent > 0 ? opened / sent : null,
          clickRate: sent > 0 ? clicked / sent : null
        };
      });
  }, [campaigns, campaignAnalyticsMap, analyticsObjectiveFilter]);

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
      insights.push(`Open rate em ${fmtPct(dashboard.openRate)} — testar variação de assunto por estágio e score.`);
    } else {
      insights.push(`Open rate saudável (${fmtPct(dashboard.openRate)}) — foque em converter aberturas em cliques.`);
    }

    if (dashboard.clickRate < 0.05) {
      insights.push("Click rate abaixo de 5% — revisar CTA e alinhamento entre assunto e conteúdo do corpo.");
    } else {
      insights.push(`Click rate de ${fmtPct(dashboard.clickRate)} — considere aumentar frequência para leads engajados.`);
    }

    if (dashboard.influencedRevenue > 0 && dashboard.influencedCustomers > 0) {
      const ltv = dashboard.influencedRevenue / dashboard.influencedCustomers;
      insights.push(`Ticket médio por cliente influenciado: ${fmtRevenue(ltv)}.`);
    }

    const topClick = enrichedCampaigns.filter((c) => c.sent > 0).sort((a, b) => (b.clickRate ?? 0) - (a.clickRate ?? 0))[0];
    if (topClick) {
      insights.push(`"${topClick.name}" lidera em click rate: ${fmtPct(topClick.clickRate)}.`);
    }

    const highBounce = enrichedCampaigns.filter((c) => c.sent > 0 && c.bounced / c.sent > 0.05)[0];
    if (highBounce) {
      insights.push(`"${highBounce.name}" com bounce rate elevado — limpar lista antes do próximo envio.`);
    } else if (dashboard.activeCampaigns > 0) {
      insights.push(`${fmtNum(dashboard.influencedLeads)} leads influenciados por campanhas ativas — qualificar e distribuir.`);
    }

    return insights;
  }, [dashboard, enrichedCampaigns, hasEnoughAnalyticsData]);

  const runAction = useCallback(
    async (handler: () => Promise<void>, successMessage: string) => {
      setIsSubmitting(true);
      setError("");
      setMessage("");

      try {
        await handler();
        setMessage(successMessage);
        await loadData();
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "Não foi possível executar a ação de marketing.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [loadData]
  );

  const createCampaign = async () => {
    if (!workspaceId) {
      return;
    }

    if (!campaignForm.name.trim() || !campaignForm.subject.trim() || !campaignForm.bodyMarkdown.trim()) {
      setError("Preencha nome, assunto e conteúdo para criar a campanha.");
      return;
    }

    await runAction(async () => {
      const created = await marketingService.createCampaign(workspaceId, {
        name: campaignForm.name,
        description: campaignForm.description || undefined,
        objective: campaignForm.objective,
        segmentId: campaignForm.segmentId || undefined,
        templateId: campaignForm.templateId || undefined,
        variants: [
          {
            name: "Controle",
            subject: campaignForm.subject,
            bodyMarkdown: campaignForm.bodyMarkdown,
            weight: 100,
            isControl: true
          }
        ]
      });

      const createdCampaignId = campaignId(created.campaign as Record<string, unknown>);
      if (createdCampaignId) {
        setSelectedCampaignId(createdCampaignId);
        setCampaignDetails(created);
        setSelectedVariantId(created.variants[0]?.id ?? "");
      }

      setTab("campaigns");
      setCampaignForm((current) => ({
        ...current,
        name: "",
        description: "",
        subject: "",
        bodyMarkdown: "Olá {{lead.firstName}},\n\nQuero compartilhar um update rápido com contexto da sua operação.\n\n[]"
      }));
    }, "Campanha criada e conectada ao contexto operacional.");
  };

  const submitForReview = async () => {
    if (!workspaceId || !selectedCampaignId) {
      return;
    }

    await runAction(async () => {
      const updated = await marketingService.submitForReview(workspaceId, selectedCampaignId);
      setCampaignDetails(updated);
    }, "Campanha enviada para revisão.");
  };

  const approveCampaign = async () => {
    if (!workspaceId || !selectedCampaignId) {
      return;
    }

    await runAction(async () => {
      const updated = await marketingService.approveCampaign(workspaceId, selectedCampaignId);
      setCampaignDetails(updated);
    }, "Campanha aprovada para agendamento/envio.");
  };

  const scheduleCampaign = async () => {
    if (!workspaceId || !selectedCampaignId || !scheduleAt) {
      setError("Informe data/hora para agendar.");
      return;
    }

    const parsed = new Date(scheduleAt);
    if (Number.isNaN(parsed.getTime())) {
      setError("Data de agendamento invalida.");
      return;
    }

    await runAction(async () => {
      const updated = await marketingService.scheduleCampaign(workspaceId, selectedCampaignId, parsed.toISOString());
      setCampaignDetails(updated);
    }, "Campanha agendada.");
  };

  const launchCampaign = async (dryRun?: boolean) => {
    if (!workspaceId || !selectedCampaignId) {
      return;
    }

    await runAction(async () => {
      const result = await marketingService.launchCampaign(workspaceId, selectedCampaignId, { dryRun });
      setMessage(
        dryRun
          ? `Simulação concluída: ${result.queued} envios elegíveis, ${result.skipped} ignorados.`
          : `Campanha lançada: ${result.queued} envios enfileirados, ${result.skipped} ignorados.`
      );
      if (!dryRun) {
        await loadCampaignDetails(selectedCampaignId);
      }
    }, dryRun ? "Simulação de envio executada." : "Campanha enviada para fila de disparo.");
  };

  const sendTest = async () => {
    if (!workspaceId || !selectedCampaignId || !testEmail.trim()) {
      setError("Informe e-mail de teste para validar conteúdo.");
      return;
    }

    await runAction(async () => {
      const result = await marketingService.sendTestEmail(workspaceId, selectedCampaignId, {
        to: testEmail.trim()
      });
      setMessage(`Teste enviado via ${result.providerKey} (${result.providerMessageId}).`);
    }, "Envio de teste concluido.");
  };

  const generateWithAI = async () => {
    if (!workspaceId || !aiForm.objective.trim()) {
      setError("Informe objetivo para gerar campanha orientada por contexto.");
      return;
    }

    await runAction(async () => {
      const generated = await marketingService.aiGenerateCampaign(workspaceId, {
        objective: aiForm.objective,
        tone: aiForm.tone || undefined,
        targetStage: aiForm.targetStage || undefined,
        segmentHint: aiForm.segmentHint || undefined,
        documentLimit: 6
      });

      const generatedCampaignId = campaignId(generated.campaign as Record<string, unknown>);
      if (generatedCampaignId) {
        setSelectedCampaignId(generatedCampaignId);
        setSelectedVariantId(generated.variants[0]?.id ?? "");
      }
      setCampaignDetails(generated);
      setTab("campaigns");
    }, "Campanha gerada por IA com contexto real do workspace.");
  };

  const improveVariantWithAI = async () => {
    if (!workspaceId || !selectedCampaignId || !selectedVariantId) {
      setError("Selecione uma variante para melhorar com IA.");
      return;
    }

    await runAction(async () => {
      const improved = await marketingService.aiImproveVariant(workspaceId, selectedCampaignId, selectedVariantId, {
        objective: aiForm.objective,
        tone: aiForm.tone
      });
      setCampaignDetails(improved);
    }, "Variante ajustada pela IA com base no contexto.");
  };

  const createSegment = async () => {
    if (!workspaceId || !segmentForm.name.trim()) {
      setError("Informe nome para o segmento.");
      return;
    }

    await runAction(async () => {
      const filters = sanitizeJson(segmentForm.filtersText);
      await marketingService.createSegment(workspaceId, {
        name: segmentForm.name,
        description: segmentForm.description || undefined,
        kind: segmentForm.kind,
        filters: filters as MarketingSegment["filters"]
      });

      setSegmentForm({
        name: "",
        description: "",
        kind: "DYNAMIC",
        filtersText: INITIAL_SEGMENT_FILTERS
      });
    }, "Segmento criado com filtros dinâmicos.");
  };

  const previewSegment = async (segmentId: string) => {
    if (!workspaceId) {
      return;
    }

    setError("");
    try {
      const preview = await marketingService.previewSegment(workspaceId, segmentId, 30);
      setSegmentPreview({
        segmentName: preview.segment.name,
        estimatedContacts: preview.estimatedContacts,
        sample: preview.sample
      });
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Não foi possível simular o segmento.");
    }
  };

  const createTemplate = async () => {
    if (!workspaceId || !templateForm.name.trim() || !templateForm.subject.trim()) {
      setError("Preencha nome e assunto para criar o template.");
      return;
    }

    await runAction(async () => {
      await marketingService.createTemplate(workspaceId, {
        name: templateForm.name,
        category: templateForm.category,
        objective: templateForm.objective,
        funnelStage: templateForm.funnelStage,
        subject: templateForm.subject,
        bodyMarkdown: templateForm.bodyMarkdown
      });

      setTemplateForm((current) => ({
        ...current,
        name: "",
        subject: ""
      }));
    }, "Template salvo na biblioteca.");
  };

  const handleJourneySave = async (name: string, nodes: JourneyNode[], edges: JourneyEdge[]) => {
    if (!workspaceId) return;
    setIsSavingFlow(true);
    try {
      const triggerDefinition = { nodes, edges };
      if (activeFlowId) {
        await marketingService.updateAutomationFlow(workspaceId, activeFlowId, { name, triggerDefinition });
      } else {
        const newFlow = await marketingService.createAutomationFlow(workspaceId, {
          name,
          status: "DRAFT",
          triggerDefinition,
          steps: []
        });
        setActiveFlowId(String(newFlow.id));
      }
      const refreshed = await marketingService.listAutomationFlows(workspaceId);
      setFlows(refreshed.items);
    } finally {
      setIsSavingFlow(false);
    }
  };

  const handleJourneyActivate = async (flowId: string) => {
    if (!workspaceId) return;
    await marketingService.updateAutomationFlow(workspaceId, flowId, { status: "ACTIVE" });
    const refreshed = await marketingService.listAutomationFlows(workspaceId);
    setFlows(refreshed.items);
  };

  const handleJourneyDeactivate = async (flowId: string) => {
    if (!workspaceId) return;
    await marketingService.updateAutomationFlow(workspaceId, flowId, { status: "PAUSED" });
    const refreshed = await marketingService.listAutomationFlows(workspaceId);
    setFlows(refreshed.items);
  };

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
    } catch (signalsLoadError) {
      setSignalsError(
        signalsLoadError instanceof Error
          ? signalsLoadError.message
          : "Não foi possível carregar os sinais agora."
      );
      return { field: "score", operator: "gte", value: "60" };
    }
  }, [segmentForm.filtersText]);

  const updateSegmentFilterRule = useCallback((updates: Partial<{ field: string; operator: string; value: string }>) => {
    setSegmentForm((current) => {
      const next = { ...segmentFilterRule, ...updates };
      const normalizedValue = next.field === "score" ? Number(next.value) || 0 : next.value;
      return {
        ...current,
        filtersText: buildSegmentFilters(next.field, next.operator, normalizedValue)
      };
    });
  }, [segmentFilterRule]);

  return {
    dashboard,
    error,
    isLoading,
    isSubmitting,
    message,
    metrics,
    signalUnreadCount,
    tab,
    tabsProps: {
      tab,
      onTabChange: setTab,
      onRefresh: () => void loadData(),
      isRefreshDisabled: isLoading || isSubmitting,
      signalUnreadCount
    },
    signalsTabProps: {
      signalUnreadCount,
      signals,
      isLoadingSignals,
      signalsError,
      signalTypeFilter,
      signalShowDismissed,
      signalGroupByLead,
      setSignalTypeFilter,
      setSignalShowDismissed,
      setSignalGroupByLead,
      setMessage,
      setTab,
      loadSignals,
      handleSignalAction
    },
    analyticsTabProps: {
      dashboard,
      campaigns,
      enrichedCampaigns,
      analyticsInsights,
      analyticsObjectiveFilter,
      isLoadingAnalytics,
      hasEnoughAnalyticsData,
      analyticsLoadedRef,
      setCampaignAnalyticsMap,
      setAnalyticsObjectiveFilter,
      setTab,
      loadCampaignDetails
    },
    overviewTabProps: {
      dashboard,
      signalUnreadCount,
      campaigns,
      audience,
      flows,
      reviewCampaigns,
      scheduledCampaigns,
      signals,
      analyticsInsights,
      setTab,
      loadCampaignDetails
    },
    campaignsTabProps: {
      dashboard,
      campaigns,
      scheduledCampaigns,
      activeCampaigns,
      audience,
      segments,
      templates,
      isAiAssistantOpen,
      setIsAiAssistantOpen,
      aiForm,
      setAiForm,
      campaignForm,
      setCampaignForm,
      campaignSearch,
      setCampaignSearch,
      campaignStatusFilter,
      setCampaignStatusFilter,
      selectedCampaignId,
      campaignDetails,
      testEmail,
      setTestEmail,
      scheduleAt,
      setScheduleAt,
      selectedVariantId,
      setSelectedVariantId,
      isSubmitting,
      createCampaign,
      loadCampaignDetails,
      generateWithAI,
      submitForReview,
      approveCampaign,
      scheduleCampaign,
      sendTest,
      improveVariantWithAI,
      launchCampaign
    },
    audienceTabProps: {
      audience,
      segments,
      audienceSearch,
      setAudienceSearch,
      segmentForm,
      setSegmentForm,
      segmentPreview,
      segmentFilterRule,
      updateSegmentFilterRule,
      isLoading,
      isSubmitting,
      loadData,
      createSegment,
      previewSegment
    },
    journeysTabProps: {
      flows,
      activeFlowId,
      setActiveFlowId,
      handleJourneySave,
      handleJourneyActivate,
      handleJourneyDeactivate,
      isSavingFlow
    },
    templatesTabProps: {
      templates,
      filteredTemplates,
      templateGoalFilter,
      setTemplateGoalFilter,
      templateForm,
      setTemplateForm,
      isSubmitting,
      createTemplate
    }
  };
}
