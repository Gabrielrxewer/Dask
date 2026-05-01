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
  MarketingSignalPriority,
  MarketingTemplate
} from "@/modules/marketing";
import { useWorkspace } from "@/modules/workspace";
import {
  Button,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHeader,
  DataTableRow,
  FormField,
  LoadingState,
  Select,
  StatusBadge,
  Tabs,
  TextInput,
  Textarea,
  WorkspaceActionButton,
  WorkspaceFrame
} from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { JourneyBuilder } from "../journey-builder";
import type { JourneyNode, JourneyEdge } from "../journey-builder/types";
import "./marketing-page.css";

type MarketingTab = "overview" | "inbox" | "campaigns" | "audience" | "journeys" | "templates" | "analytics";

const MARKETING_TABS: Array<{ id: MarketingTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "inbox", label: "Sinais" },
  { id: "campaigns", label: "Campanhas" },
  { id: "audience", label: "Audiência" },
  { id: "journeys", label: "Jornadas" },
  { id: "templates", label: "Templates" },
  { id: "analytics", label: "Analytics" }
];

const OBJECTIVE_OPTIONS: Array<{ value: MarketingCampaignObjective; label: string }> = [
  { value: "LEAD_NURTURE", label: "Nutrição de leads" },
  { value: "ONBOARDING", label: "Onboarding" },
  { value: "REACTIVATION", label: "Reativação" },
  { value: "BILLING_REMINDER", label: "Lembrete de cobrança" },
  { value: "RENEWAL", label: "Renovação" },
  { value: "EXPANSION", label: "Expansão" },
  { value: "PRODUCT_UPDATE", label: "Atualização de produto" },
  { value: "NEWSLETTER", label: "Newsletter" },
  { value: "CUSTOM", label: "Personalizado" }
];

const STATUS_OPTIONS: Array<MarketingCampaignStatus | "ALL"> = [
  "ALL",
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "SCHEDULED",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED"
];

const STATUS_LABELS: Record<MarketingCampaignStatus, string> = {
  DRAFT: "Rascunho",
  IN_REVIEW: "Em revisão",
  APPROVED: "Aprovada",
  SCHEDULED: "Agendada",
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  COMPLETED: "Concluída",
  ARCHIVED: "Arquivada"
};

const TEMPLATE_GOAL_FILTERS = [
  "Todos",
  "Onboarding",
  "Reativação",
  "Conversão",
  "Renovação",
  "Expansão",
  "Cobrança",
  "Atualização de produto"
] as const;

const REFRESH_ICON = (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M20 12a8 8 0 1 1-2.34-5.66" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M20 4v5h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const INITIAL_SEGMENT_FILTERS = JSON.stringify(
  {
    logic: "AND",
    rules: [{ field: "score", operator: "gte", value: 60 }]
  },
  null,
  2
);

const SEGMENT_FILTER_FIELDS = [
  { value: "score", label: "Score" },
  { value: "status", label: "Status do lead" },
  { value: "captureSource", label: "Origem" },
  { value: "companyName", label: "Empresa" }
];

const SEGMENT_FILTER_OPERATORS = [
  { value: "gte", label: "maior ou igual" },
  { value: "lte", label: "menor ou igual" },
  { value: "eq", label: "igual a" },
  { value: "contains", label: "contem" }
];

function stringifyObject(value: Record<string, unknown>): string {
  return JSON.stringify(value, null, 2);
}

function buildSegmentFilters(field: string, operator: string, value: string | number | boolean): string {
  return stringifyObject({
    logic: "AND",
    rules: [{ field, operator, value }]
  });
}

function toLocalDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("pt-BR");
}

function statusTone(
  status: string
): "default" | "success" | "warning" {
  if (status === "ACTIVE" || status === "APPROVED" || status === "COMPLETED") {
    return "success";
  }
  if (status === "PAUSED" || status === "ARCHIVED") {
    return "warning";
  }
  return "default";
}

function campaignStatusLabel(status: string | null | undefined): string {
  return STATUS_LABELS[status as MarketingCampaignStatus] ?? status ?? "-";
}

function campaignObjectiveLabel(objective: string | null | undefined): string {
  return OBJECTIVE_OPTIONS.find((option) => option.value === objective)?.label ?? objective?.replace(/_/g, " ") ?? "-";
}

function safeString(input: unknown): string {
  return typeof input === "string" ?input : "";
}

function fmtRevenue(value: number | undefined | null): string {
  if (value == null || value === 0) return "—";
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(1)}k`;
  return `R$ ${value.toFixed(0)}`;
}

function fmtPct(value: number | undefined | null, decimals = 1): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(decimals)}%`;
}

function fmtNum(value: number | undefined | null): string {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR");
}

const SIGNAL_INBOX_TYPES = [
  "EMAIL_CLICKED",
  "EMAIL_OPENED",
  "EMAIL_BOUNCED",
  "EMAIL_COMPLAINT",
  "EMAIL_UNSUBSCRIBED",
  "LEAD_SCORE_CHANGED"
] as const;

const SIGNAL_TYPE_LABELS: Record<string, string> = {
  EMAIL_CLICKED: "Clicou no email",
  EMAIL_OPENED: "Abriu o email",
  EMAIL_BOUNCED: "Bounce",
  EMAIL_COMPLAINT: "Marcou como spam",
  EMAIL_UNSUBSCRIBED: "Descadastrou",
  LEAD_SCORE_CHANGED: "Score alterado"
};

const SIGNAL_TYPE_FILTER_LABELS: Record<string, string> = {
  ALL: "Todos",
  EMAIL_CLICKED: "Cliques",
  EMAIL_OPENED: "Aberturas",
  EMAIL_BOUNCED: "Bounces",
  EMAIL_COMPLAINT: "Reclamações",
  EMAIL_UNSUBSCRIBED: "Cancelamentos",
  LEAD_SCORE_CHANGED: "Score"
};

function signalPriority(signal: MarketingSignal): MarketingSignalPriority {
  if (signal.type === "EMAIL_COMPLAINT" || signal.type === "EMAIL_BOUNCED") return "urgent";
  if (signal.type === "EMAIL_UNSUBSCRIBED") return "high";
  if (signal.type === "LEAD_SCORE_CHANGED") {
    const nextScore = typeof signal.payload?.nextScore === "number" ?signal.payload.nextScore : 0;
    if (nextScore >= 75) return "high";
    return "medium";
  }
  if (signal.type === "EMAIL_CLICKED") return "medium";
  return "low";
}

function signalPriorityLabel(priority: MarketingSignalPriority): string {
  if (priority === "urgent") return "Urgente";
  if (priority === "high") return "Alta";
  if (priority === "medium") return "Média";
  return "Info";
}

function signalSuggestion(signal: MarketingSignal): string {
  const name = signal.lead?.fullName ?? signal.lead?.email ?? "Lead";
  switch (signal.type) {
    case "EMAIL_CLICKED":
      return `${name} demonstrou interesse — crie uma tarefa de follow-up agora.`;
    case "EMAIL_OPENED":
      return `${name} está engajado — boa hora para um contato direto.`;
    case "EMAIL_BOUNCED":
      return `Email de ${name} com bounce — atualize o contato ou remova do funil.`;
    case "EMAIL_COMPLAINT":
      return `${name} marcou como spam — remova do funil e verifique o segmento.`;
    case "EMAIL_UNSUBSCRIBED":
      return `${name} descadastrou — respeite a preferência e atualize o CRM.`;
    case "LEAD_SCORE_CHANGED": {
      const score = typeof signal.payload?.nextScore === "number" ?signal.payload.nextScore : "?";
      return `Score de ${name} chegou a ${score} — qualifique e distribua para o comercial.`;
    }
    default:
      return `Verifique a atividade de ${name}.`;
  }
}

function timeAgo(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

function analyticsEventTotal(analytics: MarketingCampaignAnalytics | undefined, type: string): number {
  return analytics?.byType.find((e) => e.type === type)?.total ?? 0;
}

function campaignName(input: Record<string, unknown> | null | undefined): string {
  return safeString(input?.name) || "Campanha";
}

function campaignStatus(input: Record<string, unknown> | null | undefined): string {
  return safeString(input?.status) || "-";
}

function campaignId(input: Record<string, unknown> | null | undefined): string {
  return safeString(input?.id);
}

function sanitizeJson(input: string): Record<string, unknown> {
  const parsed = JSON.parse(input) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("JSON payload precisa ser um objeto.");
  }

  return parsed as Record<string, unknown>;
}

export function MarketingPage() {
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

  const [campaignForm, setCampaignForm] = useState<{
    name: string;
    description: string;
    objective: MarketingCampaignObjective;
    segmentId: string;
    templateId: string;
    subject: string;
    bodyMarkdown: string;
  }>({
    name: "",
    description: "",
    objective: "LEAD_NURTURE",
    segmentId: "",
    templateId: "",
    subject: "",
    bodyMarkdown: "Olá {{lead.firstName}},\n\nQuero compartilhar um update rápido com contexto da sua operação.\n\n[]"
  });

  const [segmentForm, setSegmentForm] = useState({
    name: "",
    description: "",
    kind: "DYNAMIC" as "STATIC" | "DYNAMIC",
    filtersText: INITIAL_SEGMENT_FILTERS
  });
  const [segmentPreview, setSegmentPreview] = useState<{
    segmentName: string;
    estimatedContacts: number;
    sample: Array<{ id: string; fullName: string | null; email: string | null; companyName: string | null }>;
  } | null>(null);

  const [templateForm, setTemplateForm] = useState({
    name: "",
    category: "newsletter",
    objective: "LEAD_NURTURE",
    funnelStage: "mql",
    subject: "",
    bodyMarkdown: "## Assunto principal\n\nMensagem com contexto operacional.\n\n- ponto 1\n- ponto 2"
  });


  const [aiForm, setAiForm] = useState({
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
          status: campaignStatusFilter === "ALL" ?undefined : campaignStatusFilter,
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
      setError(loadError instanceof Error ?loadError.message : "Falha ao carregar módulo de marketing.");
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
    async (signal: MarketingSignal, action: 'seen' | 'dismissed') => {
      if (!workspaceId) return;
      await marketingService.markSignal(workspaceId, signal.id, action);
      setSignals((prev) =>
        prev.map((s) =>
          s.id === signal.id
            ?{ ...s, seenAt: action === 'seen' ?new Date().toISOString() : s.seenAt, dismissedAt: action === 'dismissed' ?new Date().toISOString() : s.dismissedAt }
            : s
        ).filter((s) => signalShowDismissed || s.dismissedAt === null)
      );
      if (action === 'seen') {
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
          openRate: sent > 0 ?opened / sent : null,
          clickRate: sent > 0 ?clicked / sent : null,
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
      setError(actionError instanceof Error ?actionError.message : "Não foi possível executar a ação de marketing.");
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
          ?`Simulação concluída: ${result.queued} envios elegíveis, ${result.skipped} ignorados.`
          : `Campanha lançada: ${result.queued} envios enfileirados, ${result.skipped} ignorados.`
      );
      if (!dryRun) {
        await loadCampaignDetails(selectedCampaignId);
      }
    }, dryRun ?"Simulação de envio executada." : "Campanha enviada para fila de disparo.");
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
      setError(previewError instanceof Error ?previewError.message : "Não foi possível simular o segmento.");
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

  const segmentFilterRule = useMemo(() => {
    try {
      const parsed = sanitizeJson(segmentForm.filtersText);
      const rules = Array.isArray(parsed.rules) ?parsed.rules : [];
      const firstRule = rules[0] as Record<string, unknown> | undefined;
      return {
        field: safeString(firstRule?.field) || "score",
        operator: safeString(firstRule?.operator) || "gte",
        value: firstRule?.value == null ?"60" : String(firstRule.value)
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
      const normalizedValue = next.field === "score" ?Number(next.value) || 0 : next.value;
      return {
        ...current,
        filtersText: buildSegmentFilters(next.field, next.operator, normalizedValue)
      };
    });
  }, [segmentFilterRule]);

  const topNavigation = (
    <section className="marketing-top-nav" aria-label="Navegação de marketing">
      <Tabs<MarketingTab> value={tab} items={MARKETING_TABS} onChange={setTab} className="marketing-page__tabs" />
      <div className="marketing-top-nav__actions">
        <WorkspaceActionButton
          className="marketing-top-nav__btn"
          label="Atualizar marketing"
          icon={REFRESH_ICON}
          onClick={() => void loadData()}
          disabled={isLoading || isSubmitting}
        />
        {signalUnreadCount > 0 ?(
          <button
            type="button"
            className="marketing-top-nav__signal-badge"
            onClick={() => setTab("inbox")}
            title={`${signalUnreadCount} sinais não lidos`}
          >
            {signalUnreadCount}
          </button>
        ) : null}
        <WorkspaceActionButton
          className="marketing-top-nav__btn"
          tone="accent"
          label="Nova campanha"
          icon="+"
          onClick={() => setTab("campaigns")}
        />
      </div>
    </section>
  );

  return (
    <AppShell metrics={metrics} noPageScroll hideSidebarBrandMark hidePageHeader topNavigation={topNavigation}>
      <WorkspaceFrame className="marketing-page">
        <LoadingState
          text="Carregando marketing..."
          animation="marketing"
          variant="frame"
          visible={isLoading && !dashboard}
        />

        <div className="marketing-page__content">
          <div className="marketing-page__stack">
            {message ?<div className="marketing-page__feedback marketing-page__feedback--ok">{message}</div> : null}
            {error ?<div className="marketing-page__feedback marketing-page__feedback--error">{error}</div> : null}

            {tab === "inbox" ?(
              <div className="mkt-inbox">
                <section className="mkt-screen-hero mkt-screen-hero--signals">
                  <div className="mkt-screen-hero__copy">
                    <h2>Inbox de sinais</h2>
                    <p>Radar inteligente para priorizar aberturas, cliques, bounces e mudanças de score que pedem ação.</p>
                  </div>
                  <div className="mkt-screen-hero__stats">
                    <div><strong>{fmtNum(signalUnreadCount)}</strong><span>não lidos</span></div>
                    <div><strong>{fmtNum(signals.length)}</strong><span>sinais no radar</span></div>
                    <div><strong>{signalGroupByLead ?"por lead" : "evento"}</strong><span>visualização</span></div>
                  </div>
                </section>

                {/* Toolbar */}
                <div className="mkt-inbox__toolbar">
                  <div className="mkt-inbox__filters">
                    <div className="mkt-inbox__filter-group">
                      {(["ALL", ...SIGNAL_INBOX_TYPES] as string[]).map((type) => (
                        <button
                          key={type}
                          type="button"
                          className={`mkt-inbox__filter-chip${signalTypeFilter === type ?" mkt-inbox__filter-chip--active" : ""}`}
                          onClick={() => setSignalTypeFilter(type)}
                        >
                          {SIGNAL_TYPE_FILTER_LABELS[type] ?? type}
                        </button>
                      ))}
                    </div>
                    <label className="mkt-inbox__toggle">
                      <input
                        type="checkbox"
                        checked={signalGroupByLead}
                        onChange={(e) => setSignalGroupByLead(e.target.checked)}
                      />
                      Agrupar por lead
                    </label>
                    <label className="mkt-inbox__toggle">
                      <input
                        type="checkbox"
                        checked={signalShowDismissed}
                        onChange={(e) => {
                          setSignalShowDismissed(e.target.checked);
                        }}
                      />
                      Mostrar ignorados
                    </label>
                  </div>
                  <div className="mkt-inbox__meta">
                    {signalUnreadCount > 0 ?(
                      <span className="mkt-inbox__unread-badge">{signalUnreadCount} não lidos</span>
                    ) : null}
                    <button
                      type="button"
                      className="mkt-inbox__refresh"
                      onClick={() => void loadSignals()}
                      disabled={isLoadingSignals}
                    >
                      {isLoadingSignals ?"Carregando..." : "Atualizar"}
                    </button>
                  </div>
                </div>

                {signalsError && signals.length > 0 ?(
                  <div className="mkt-state mkt-state--inline mkt-state--error">
                    <strong>Falha ao atualizar sinais</strong>
                    <span>{signalsError}</span>
                    <button type="button" onClick={() => void loadSignals()}>Tentar novamente</button>
                  </div>
                ) : null}

                {/* Feed */}
                {(() => {
                  const filtered = signals.filter(
                    (s) => signalTypeFilter === "ALL" || s.type === signalTypeFilter
                  );

                  if (isLoadingSignals && signals.length === 0) {
                    return (
                      <div className="mkt-state mkt-state--loading">
                        <span className="mkt-state__icon" aria-hidden="true" />
                        <strong>Carregando sinais</strong>
                        <p>Buscando oportunidades, riscos e eventos acionáveis do workspace.</p>
                        <div className="mkt-skeleton-list" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                        </div>
                      </div>
                    );
                  }

                  if (signalsError && signals.length === 0) {
                    return (
                      <div className="mkt-state mkt-state--error">
                        <span className="mkt-state__icon" aria-hidden="true" />
                        <strong>Não foi possível carregar os sinais</strong>
                        <p>A caixa de sinais encontrou uma falha. Isso não significa que o inbox esteja vazio.</p>
                        <button type="button" onClick={() => void loadSignals()}>Tentar novamente</button>
                        <small>{signalsError}</small>
                      </div>
                    );
                  }

                  if (filtered.length === 0) {
                    return (
                      <div className="mkt-state">
                        <span className="mkt-state__icon" aria-hidden="true" />
                        <strong>{signals.length === 0 ?"Nenhum sinal encontrado" : "Nenhum sinal neste filtro"}</strong>
                        <p>
                          {signals.length === 0
                            ?"Quando houver cliques, aberturas, bounces ou mudanças de score, eles aparecerão aqui."
                            : "Ajuste os filtros para ver outros tipos de evento."}
                        </p>
                      </div>
                    );
                  }

                  if (signalGroupByLead) {
                    const byLead = new Map<string, MarketingSignal[]>();
                    for (const s of filtered) {
                      const key = s.leadId ?? "__no_lead__";
                      const group = byLead.get(key) ?? [];
                      group.push(s);
                      byLead.set(key, group);
                    }

                    return (
                      <div className="mkt-inbox__feed">
                        {Array.from(byLead.entries()).map(([leadKey, group]) => {
                          const topSignal = group[0]!;
                          const lead = topSignal.lead;
                          const topPriority = group.reduce<MarketingSignalPriority>((best, s) => {
                            const p = signalPriority(s);
                            const rank: Record<MarketingSignalPriority, number> = { urgent: 3, high: 2, medium: 1, low: 0 };
                            return rank[p] > rank[best] ?p : best;
                          }, "low");

                          return (
                            <div key={leadKey} className={`mkt-inbox__group mkt-inbox__group--${topPriority}`}>
                              <div className="mkt-inbox__group-head">
                                <div className="mkt-inbox__lead-info">
                                  <span className="mkt-inbox__lead-avatar">{(lead?.fullName ?? "?")[0]?.toUpperCase()}</span>
                                  <div>
                                    <strong className="mkt-inbox__lead-name">{lead?.fullName ?? lead?.email ?? "Lead desconhecido"}</strong>
                                    {lead?.companyName ?<span className="mkt-inbox__lead-company">{lead.companyName}</span> : null}
                                  </div>
                                </div>
                                <div className="mkt-inbox__group-meta">
                                  <span className={`mkt-inbox__priority mkt-inbox__priority--${topPriority}`}>{signalPriorityLabel(topPriority)}</span>
                                  <span className="mkt-inbox__lead-score">Score {lead?.score ?? "-"}</span>
                                  <span className="mkt-inbox__count">{group.length} sinal{group.length > 1 ?"is" : ""}</span>
                                </div>
                              </div>
                              <div className="mkt-inbox__group-events">
                                {group.map((s) => (
                                  <div key={s.id} className={`mkt-inbox__group-event${s.seenAt ?" mkt-inbox__group-event--seen" : ""}`}>
                                    <span className="mkt-inbox__event-type">{SIGNAL_TYPE_LABELS[s.type] ?? s.type}</span>
                                    {s.campaign ?<span className="mkt-inbox__event-campaign">via {s.campaign.name}</span> : null}
                                    <span className="mkt-inbox__event-time">{timeAgo(s.occurredAt)}</span>
                                    <div className="mkt-inbox__event-actions">
                                      {!s.seenAt ?(
                                        <button type="button" className="mkt-inbox__action mkt-inbox__action--seen" onClick={() => void handleSignalAction(s, 'seen')}>
                                          Marcar visto
                                        </button>
                                      ) : null}
                                      {!s.dismissedAt ?(
                                        <button type="button" className="mkt-inbox__action mkt-inbox__action--dismiss" onClick={() => void handleSignalAction(s, 'dismissed')}>
                                          Ignorar
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="mkt-inbox__suggestion">
                                <span className="mkt-inbox__suggestion-icon" aria-hidden="true" />
                                <span>{signalSuggestion(topSignal)}</span>
                              </div>
                              <div className="mkt-inbox__card-actions">
                                <button type="button" className="mkt-inbox__cta" onClick={() => setTab("audience")}>
                                  Abrir lead
                                </button>
                                <button
                                  type="button"
                                  className="mkt-inbox__cta mkt-inbox__cta--primary"
                                  onClick={() => {
                                    setMessage(`Tarefa criada para ${lead?.fullName ?? "lead"} — acesse o board para gerenciar.`);
                                    setTab("overview");
                                  }}
                                >
                                  Criar tarefa de follow-up
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }

                  return (
                    <div className="mkt-inbox__feed">
                      {filtered.map((signal) => {
                        const priority = signalPriority(signal);
                        return (
                          <article key={signal.id} className={`mkt-inbox__card mkt-inbox__card--${priority}${signal.seenAt ?" mkt-inbox__card--seen" : ""}${signal.dismissedAt ?" mkt-inbox__card--dismissed" : ""}`}>
                            <div className="mkt-inbox__card-head">
                              <div className="mkt-inbox__card-who">
                                <span className="mkt-inbox__lead-avatar">{(signal.lead?.fullName ?? signal.lead?.email ?? "?")[0]?.toUpperCase()}</span>
                                <div className="mkt-inbox__card-identity">
                                  <strong className="mkt-inbox__lead-name">
                                    {signal.lead?.fullName ?? signal.lead?.email ?? "Lead desconhecido"}
                                  </strong>
                                  {signal.lead?.companyName ?(
                                    <span className="mkt-inbox__lead-company">{signal.lead.companyName}</span>
                                  ) : null}
                                </div>
                              </div>
                              <div className="mkt-inbox__card-meta">
                                <span className={`mkt-inbox__priority mkt-inbox__priority--${priority}`}>
                                  {signalPriorityLabel(priority)}
                                </span>
                                {!signal.seenAt ?<span className="mkt-inbox__unread-dot" aria-label="Não lido" /> : null}
                              </div>
                            </div>

                            <div className="mkt-inbox__card-body">
                              <div className="mkt-inbox__what">
                                <span className="mkt-inbox__event-label">{SIGNAL_TYPE_LABELS[signal.type] ?? signal.type}</span>
                                {signal.campaign ?(
                                  <span className="mkt-inbox__event-context">via {signal.campaign.name}</span>
                                ) : null}
                              </div>
                              {signal.headline ?(
                                <p className="mkt-inbox__headline">{signal.headline}</p>
                              ) : null}
                              {signal.type === "LEAD_SCORE_CHANGED" && signal.payload ?(
                                <div className="mkt-inbox__score-delta">
                                  <span className="mkt-inbox__score-prev">{String(signal.payload.previousScore ?? "?")} pts</span>
                                  <span className="mkt-inbox__score-arrow" aria-hidden="true">→</span>
                                  <span className="mkt-inbox__score-next">{String(signal.payload.nextScore ?? "?")} pts</span>
                                  <span className={`mkt-inbox__score-badge${Number(signal.payload.delta ?? 0) > 0 ?" mkt-inbox__score-badge--up" : " mkt-inbox__score-badge--down"}`}>
                                    {Number(signal.payload.delta ?? 0) > 0 ?"+" : ""}{String(signal.payload.delta ?? "?")}
                                  </span>
                                </div>
                              ) : null}
                              <div className="mkt-inbox__suggestion">
                                <span className="mkt-inbox__suggestion-icon" aria-hidden="true" />
                                <span>{signalSuggestion(signal)}</span>
                              </div>
                            </div>

                            <div className="mkt-inbox__card-foot">
                              <span className="mkt-inbox__time">{timeAgo(signal.occurredAt)}</span>
                              <div className="mkt-inbox__card-actions">
                                {!signal.seenAt ?(
                                  <button type="button" className="mkt-inbox__action" onClick={() => void handleSignalAction(signal, 'seen')}>
                                    Marcar visto
                                  </button>
                                ) : null}
                                {!signal.dismissedAt ?(
                                  <button type="button" className="mkt-inbox__action" onClick={() => void handleSignalAction(signal, 'dismissed')}>
                                    Ignorar
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="mkt-inbox__action mkt-inbox__action--primary"
                                  onClick={() => {
                                    void handleSignalAction(signal, 'seen');
                                    setMessage(`Tarefa criada para ${signal.lead?.fullName ?? "lead"} — acesse o board para gerenciar.`);
                                    setTab("overview");
                                  }}
                                >
                                  Criar follow-up
                                </button>
                                <button
                                  type="button"
                                  className="mkt-inbox__action"
                                  onClick={() => {
                                    void handleSignalAction(signal, 'seen');
                                    setTab("audience");
                                  }}
                                >
                                  Abrir lead
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            ) : null}

            {tab === "analytics" ?(
              <div className="mkt-analytics">
                <section className="mkt-screen-hero mkt-screen-hero--analytics">
                  <div className="mkt-screen-hero__copy">
                    <h2>Analytics de marketing</h2>
                    <p>Leitura executiva de receita influenciada, engajamento e performance por campanha com dados reais do workspace.</p>
                  </div>
                  <div className="mkt-screen-hero__stats">
                    <div><strong>{fmtRevenue(dashboard?.influencedRevenue)}</strong><span>receita influenciada</span></div>
                    <div><strong>{fmtPct(dashboard?.openRate)}</strong><span>abertura média</span></div>
                    <div><strong>{fmtPct(dashboard?.clickRate)}</strong><span>clique médio</span></div>
                  </div>
                </section>

                {/* Filtros */}
                <div className="mkt-analytics__filters">
                  <label className="mkt-analytics__filter-label">
                    Objetivo
                    <select
                      className="mkt-analytics__filter-select"
                      value={analyticsObjectiveFilter}
                      onChange={(e) => setAnalyticsObjectiveFilter(e.target.value as MarketingCampaignObjective | "ALL")}
                    >
                      <option value="ALL">Todos</option>
                      {OBJECTIVE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </label>
                  {isLoadingAnalytics ?(
                    <span className="mkt-analytics__loading">Carregando métricas...</span>
                  ) : null}
                  <button
                    type="button"
                    className="mkt-analytics__refresh"
                    onClick={() => {
                      analyticsLoadedRef.current = "";
                      setCampaignAnalyticsMap({});
                    }}
                    disabled={isLoadingAnalytics}
                  >
                    Atualizar
                  </button>
                </div>

                {!isLoadingAnalytics && !hasEnoughAnalyticsData ?(
                  <div className="mkt-state mkt-state--insufficient">
                    <span className="mkt-state__icon" aria-hidden="true" />
                    <strong>Dados insuficientes para análise</strong>
                    <p>Execute pelo menos uma campanha e aguarde eventos de envio, abertura ou clique para gerar métricas e recomendações reais.</p>
                    <button type="button" onClick={() => setTab("campaigns")}>Criar ou lançar campanha</button>
                  </div>
                ) : null}

                {/* KPIs */}
                <div className="mkt-analytics__kpis">
                  <div className="mkt-kpi mkt-kpi--revenue">
                    <span className="mkt-kpi__value">{fmtRevenue(dashboard?.influencedRevenue)}</span>
                    <span className="mkt-kpi__label">Receita influenciada</span>
                    <span className="mkt-kpi__sub">por campanhas ativas</span>
                  </div>
                  <div className="mkt-kpi">
                    <span className="mkt-kpi__value">{fmtNum(dashboard?.influencedLeads)}</span>
                    <span className="mkt-kpi__label">Leads gerados</span>
                    <span className="mkt-kpi__sub">atribuídos a campanhas</span>
                  </div>
                  <div className="mkt-kpi">
                    <span className="mkt-kpi__value">{fmtNum(dashboard?.influencedCustomers)}</span>
                    <span className="mkt-kpi__label">Clientes convertidos</span>
                    <span className="mkt-kpi__sub">com toque de campanha</span>
                  </div>
                  <div className="mkt-kpi">
                    <span className="mkt-kpi__value">{fmtPct(dashboard?.conversionRate)}</span>
                    <span className="mkt-kpi__label">Conversão geral</span>
                    <span className="mkt-kpi__sub">lead → cliente</span>
                  </div>
                  <div className="mkt-kpi">
                    <span className="mkt-kpi__value">{fmtNum(dashboard?.activeCampaigns)}</span>
                    <span className="mkt-kpi__label">Campanhas ativas</span>
                    <span className="mkt-kpi__sub">{fmtNum(dashboard?.sendsQueuedToday)} envios hoje</span>
                  </div>
                </div>

                {/* Funil real */}
                <div className="mkt-analytics__section">
                  <h3 className="mkt-analytics__section-title">Funil de receita</h3>
                  <div className="mkt-funnel">
                    {[
                      { label: "Campanhas", value: campaigns.length, sub: "criadas", accent: false },
                      { label: "Leads gerados", value: dashboard?.influencedLeads ?? 0, sub: "atribuídos", accent: false },
                      { label: "Clientes", value: dashboard?.influencedCustomers ?? 0, sub: "convertidos", accent: true },
                      { label: "Receita", value: null, formatted: fmtRevenue(dashboard?.influencedRevenue), sub: "influenciada", accent: true },
                    ].map((stage, i) => {
                      const max = Math.max(campaigns.length, dashboard?.influencedLeads ?? 0, 1);
                      const pct = stage.value != null ?Math.max(22, (stage.value / max) * 100) : 22;
                      return (
                        <div key={stage.label} className={`mkt-funnel__stage${stage.accent ?" mkt-funnel__stage--accent" : ""}`} style={{ "--funnel-w": `${pct}%` } as React.CSSProperties}>
                          {i > 0 ?<div className="mkt-funnel__arrow" aria-hidden="true" /> : null}
                          <div className="mkt-funnel__body">
                            <strong className="mkt-funnel__value">
                              {stage.formatted ?? fmtNum(stage.value)}
                            </strong>
                            <span className="mkt-funnel__label">{stage.label}</span>
                            <span className="mkt-funnel__sub">{stage.sub}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Grid principal */}
                <div className="mkt-analytics__main">
                  {/* Performance por campanha */}
                  <div className="mkt-analytics__section mkt-analytics__section--perf">
                    <h3 className="mkt-analytics__section-title">Performance por campanha</h3>
                    <div className="mkt-perf-table">
                      <div className="mkt-perf-table__head">
                        <span>Campanha</span>
                        <span>Status</span>
                        <span>Enviados</span>
                        <span>Abertura</span>
                        <span>Clique</span>
                        <span>Impacto</span>
                      </div>
                      {enrichedCampaigns.length === 0 ?(
                        <div className="mkt-perf-table__empty">Nenhuma campanha encontrada.</div>
                      ) : null}
                      {enrichedCampaigns.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="mkt-perf-table__row"
                          onClick={() => {
                            void loadCampaignDetails(c.id);
                            setTab("campaigns");
                          }}
                        >
                          <span className="mkt-perf-table__name">
                            <strong>{c.name}</strong>
                            <span>{campaignObjectiveLabel(c.objective)}</span>
                          </span>
                          <span>
                            <span className={`mkt-badge mkt-badge--${statusTone(c.status)}`}>{c.status}</span>
                          </span>
                          <span className="mkt-perf-table__num">{c.sent > 0 ?fmtNum(c.sent) : "—"}</span>
                          <span className={`mkt-perf-table__num${c.openRate != null && c.openRate < 0.2 ?" mkt-perf-table__num--warn" : ""}`}>
                            {fmtPct(c.openRate)}
                          </span>
                          <span className={`mkt-perf-table__num${c.clickRate != null && c.clickRate < 0.04 ?" mkt-perf-table__num--warn" : ""}`}>
                            {fmtPct(c.clickRate)}
                          </span>
                          <span className="mkt-perf-table__impact">
                            {c.status === "ACTIVE" ?<span className="mkt-badge mkt-badge--success">Ativo</span> : null}
                            {c.status === "COMPLETED" ?<span className="mkt-badge mkt-badge--default">Concluído</span> : null}
                            {c.status === "SCHEDULED" ?<span className="mkt-badge mkt-badge--warning">Agendado</span> : null}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Coluna direita */}
                  <div className="mkt-analytics__sidebar">
                    {/* Insights */}
                    <div className="mkt-analytics__section">
                      <h3 className="mkt-analytics__section-title">Insights automáticos</h3>
                      {!hasEnoughAnalyticsData ?(
                        <div className="mkt-empty-inline">
                          <strong>Dados insuficientes</strong>
                          <span>Ainda estamos coletando informações. Crie ou execute campanhas para gerar análises reais.</span>
                        </div>
                      ) : analyticsInsights.length === 0 ?(
                        <p className="mkt-analytics__empty">Nenhum insight relevante encontrado para o volume atual.</p>
                      ) : null}
                      {hasEnoughAnalyticsData ?(
                        <ul className="mkt-insights">
                          {analyticsInsights.map((insight, i) => (
                            <li key={i} className="mkt-insights__item">
                              <span className="mkt-insights__dot" aria-hidden="true" />
                              <span>{insight}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>

                    {/* Atribuição por objetivo */}
                    <div className="mkt-analytics__section">
                      <h3 className="mkt-analytics__section-title">Atribuição por objetivo</h3>
                      <div className="mkt-attribution">
                        {!hasEnoughAnalyticsData ?(
                          <p className="mkt-analytics__empty">Sem eventos suficientes para atribuição.</p>
                        ) : Object.entries(
                          enrichedCampaigns.reduce<Record<string, { count: number; sent: number }>>((acc, c) => {
                            const key = c.objective;
                            if (!acc[key]) acc[key] = { count: 0, sent: 0 };
                            acc[key].count += 1;
                            acc[key].sent += c.sent;
                            return acc;
                          }, {})
                        )
                          .sort((a, b) => b[1].sent - a[1].sent)
                          .slice(0, 6)
                          .map(([obj, data]) => {
                            const maxSent = Math.max(...enrichedCampaigns.map((c) => c.sent), 1);
                            const barPct = Math.max(4, (data.sent / maxSent) * 100);
                            return (
                              <div key={obj} className="mkt-attribution__row">
                                <span className="mkt-attribution__label">{campaignObjectiveLabel(obj)}</span>
                                <div className="mkt-attribution__bar-wrap">
                                  <div className="mkt-attribution__bar" style={{ width: `${barPct}%` }} />
                                </div>
                                <span className="mkt-attribution__count">{data.count}c · {fmtNum(data.sent)}</span>
                              </div>
                            );
                          })}
                        {hasEnoughAnalyticsData && enrichedCampaigns.length === 0 ?(
                          <p className="mkt-analytics__empty">Sem dados de atribuição.</p>
                        ) : null}
                      </div>
                    </div>

                    {/* Engajamento geral */}
                    <div className="mkt-analytics__section">
                      <h3 className="mkt-analytics__section-title">Engajamento geral</h3>
                      {!hasEnoughAnalyticsData ?(
                        <div className="mkt-empty-inline">
                          <strong>Aguardando volume</strong>
                          <span>As taxas aparecem depois de envios e eventos reais.</span>
                        </div>
                      ) : (
                      <div className="mkt-engagement">
                        {[
                          { label: "Abertura", value: dashboard?.openRate, target: 0.22 },
                          { label: "Clique", value: dashboard?.clickRate, target: 0.05 },
                          { label: "Conversão", value: dashboard?.conversionRate, target: 0.03 },
                        ].map(({ label, value, target }) => {
                          const pct = value != null ?Math.min(100, (value / Math.max(target * 2, 0.01)) * 100) : 0;
                          const isOk = value != null && value >= target;
                          return (
                            <div key={label} className="mkt-engagement__row">
                              <div className="mkt-engagement__head">
                                <span className="mkt-engagement__label">{label}</span>
                                <span className={`mkt-engagement__value${isOk ?" mkt-engagement__value--ok" : " mkt-engagement__value--warn"}`}>
                                  {fmtPct(value)}
                                </span>
                              </div>
                              <div className="mkt-engagement__track">
                                <div
                                  className={`mkt-engagement__fill${isOk ?" mkt-engagement__fill--ok" : ""}`}
                                  style={{ width: `${pct}%` }}
                                />
                                <div className="mkt-engagement__target" style={{ left: `50%` }} title={`Meta: ${fmtPct(target)}`} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {tab === "overview" ?(
              <div className="mkt-workbench">
                <section className="mkt-overview-hero">
                  <div className="mkt-overview-hero__copy">
                    <h2>Operação de marketing</h2>
                    <p>Um painel para priorizar sinais, acompanhar campanhas, revisar próximos envios e entrar rapidamente nas áreas de ação.</p>
                  </div>
                  <div className="mkt-overview-hero__metrics">
                    <div><strong>{fmtNum(dashboard?.activeCampaigns)}</strong><span>campanhas ativas</span></div>
                    <div><strong>{fmtNum(dashboard?.sendsQueuedToday)}</strong><span>envios hoje</span></div>
                    <div><strong>{fmtNum(signalUnreadCount)}</strong><span>sinais novos</span></div>
                  </div>
                </section>

                <section className="mkt-command-strip">
                  <button type="button" className="mkt-command" onClick={() => setTab("campaigns")}>
                    <span className="mkt-command__label">Nova campanha</span>
                    <strong>{campaigns.filter((campaign) => campaign.status === "DRAFT").length} rascunhos</strong>
                  </button>
                  <button type="button" className="mkt-command" onClick={() => setTab("audience")}>
                    <span className="mkt-command__label">Audiência</span>
                    <strong>{fmtNum(audience.length)} contatos</strong>
                  </button>
                  <button type="button" className="mkt-command" onClick={() => setTab("journeys")}>
                    <span className="mkt-command__label">Jornadas</span>
                    <strong>{flows.filter((flow) => flow.status === "ACTIVE").length} ativas</strong>
                  </button>
                  <button type="button" className="mkt-command" onClick={() => setTab("analytics")}>
                    <span className="mkt-command__label">Performance</span>
                    <strong>{fmtPct(dashboard?.clickRate)} clique</strong>
                  </button>
                </section>

                <div className="mkt-workbench__grid">
                  <article className="mkt-analytics__section">
                    <div className="marketing-page__section-head">
                      <div>
                        <h3 className="mkt-analytics__section-title">Prioridades de hoje</h3>
                        <p className="marketing-page__hint">Campanhas e sinais que pedem decisão.</p>
                      </div>
                      {signalUnreadCount > 0 ?<span className="mkt-badge mkt-badge--warning">{signalUnreadCount} sinais</span> : null}
                    </div>

                    <div className="mkt-priority-list">
                      {reviewCampaigns.slice(0, 5).map((campaign) => (
                        <button
                          key={campaign.id}
                          type="button"
                          className="mkt-priority-row"
                          onClick={() => {
                            void loadCampaignDetails(campaign.id);
                            setTab("campaigns");
                          }}
                        >
                          <span className="mkt-priority-row__main">
                            <strong>{campaign.name}</strong>
                            <span>{campaignObjectiveLabel(campaign.objective)} · atualizado {toLocalDate(campaign.updatedAt)}</span>
                          </span>
                          <StatusBadge tone={statusTone(campaign.status)}>{campaignStatusLabel(campaign.status)}</StatusBadge>
                        </button>
                      ))}
                      {reviewCampaigns.length === 0 ?(
                        <button type="button" className="mkt-priority-row" onClick={() => setTab("campaigns")}>
                          <span className="mkt-priority-row__main">
                            <strong>Nenhuma campanha aguardando revisão</strong>
                            <span>Crie um rascunho ou gere uma campanha com IA.</span>
                          </span>
                          <span className="mkt-badge mkt-badge--default">ok</span>
                        </button>
                      ) : null}
                    </div>
                  </article>

                  <article className="mkt-analytics__section">
                    <h3 className="mkt-analytics__section-title">Leitura rápida</h3>
                    <div className="mkt-insight-feed">
                      {analyticsInsights.length > 0 ?(
                        analyticsInsights.slice(0, 4).map((insight, index) => (
                          <div key={`${insight}-${index}`} className="mkt-insight-feed__item">
                            <span className="mkt-insights__dot" aria-hidden="true" />
                            <p>{insight}</p>
                          </div>
                        ))
                      ) : (
                        <div className="mkt-empty-inline">
                          <strong>Dados insuficientes</strong>
                          <span>As leituras automáticas aparecem depois dos primeiros eventos de campanha.</span>
                        </div>
                      )}
                    </div>
                  </article>

                  <article className="mkt-analytics__section">
                    <div className="marketing-page__section-head">
                      <div>
                        <h3 className="mkt-analytics__section-title">Próximos envios</h3>
                        <p className="marketing-page__hint">Agenda absorvida das campanhas programadas.</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setTab("campaigns")}>Agendar</Button>
                    </div>
                    <div className="mkt-history mkt-history--calendar">
                      {scheduledCampaigns.slice(0, 4).map((campaign) => (
                        <button
                          key={campaign.id}
                          type="button"
                          className="mkt-calendar-item"
                          onClick={() => {
                            void loadCampaignDetails(campaign.id);
                            setTab("campaigns");
                          }}
                        >
                          <time>{toLocalDate(campaign.scheduledAt)}</time>
                          <strong>{campaign.name}</strong>
                          <span>{campaignObjectiveLabel(campaign.objective)}</span>
                        </button>
                      ))}
                      {scheduledCampaigns.length === 0 ?(
                        <div className="mkt-empty-inline">
                          <strong>Sem campanhas agendadas</strong>
                          <span>Quando houver uma data de envio, ela aparece aqui.</span>
                        </div>
                      ) : null}
                    </div>
                  </article>

                  <article className="mkt-analytics__section">
                    <div className="marketing-page__section-head">
                      <div>
                        <h3 className="mkt-analytics__section-title">Sinais recentes</h3>
                        <p className="marketing-page__hint">Eventos acionáveis capturados no radar.</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setTab("inbox")}>Abrir sinais</Button>
                    </div>
                    <div className="mkt-priority-list">
                      {signals.slice(0, 4).map((signal) => (
                        <button key={signal.id} type="button" className="mkt-priority-row" onClick={() => setTab("inbox")}>
                          <span className="mkt-priority-row__main">
                            <strong>{SIGNAL_TYPE_LABELS[signal.type] ?? signal.type}</strong>
                            <span>{signal.lead?.fullName ?? signal.lead?.email ?? "Lead desconhecido"} · {timeAgo(signal.occurredAt)}</span>
                          </span>
                          <span className={`mkt-badge mkt-badge--${signalPriority(signal)}`}>{signalPriorityLabel(signalPriority(signal))}</span>
                        </button>
                      ))}
                      {signals.length === 0 ?(
                        <div className="mkt-empty-inline">
                          <strong>Nenhum sinal recente</strong>
                          <span>O radar mostra eventos quando houver atividade de campanhas.</span>
                        </div>
                      ) : null}
                    </div>
                  </article>
                </div>

                <article className="mkt-analytics__section">
                  <div className="marketing-page__section-head">
                    <div>
                      <h3 className="mkt-analytics__section-title">Campanhas em movimento</h3>
                      <p className="marketing-page__hint">Clique em qualquer linha para operar detalhes, testes e agenda.</p>
                    </div>
                  </div>
                  <div className="mkt-perf-table">
                    <div className="mkt-perf-table__head">
                      <span>Campanha</span>
                      <span>Status</span>
                      <span>Agenda</span>
                      <span>Canal</span>
                      <span>Segmento</span>
                      <span>Ação</span>
                    </div>
                    {campaigns.slice(0, 8).map((campaign) => (
                      <button
                        key={campaign.id}
                        type="button"
                        className="mkt-perf-table__row"
                        onClick={() => {
                          void loadCampaignDetails(campaign.id);
                          setTab("campaigns");
                        }}
                      >
                        <span className="mkt-perf-table__name">
                          <strong>{campaign.name}</strong>
                          <span>{campaignObjectiveLabel(campaign.objective)}</span>
                        </span>
                        <span><span className={`mkt-badge mkt-badge--${statusTone(campaign.status)}`}>{campaignStatusLabel(campaign.status)}</span></span>
                        <span className="mkt-perf-table__num">{toLocalDate(campaign.scheduledAt)}</span>
                        <span className="mkt-perf-table__num">{campaign.channel}</span>
                        <span className="mkt-perf-table__num">{campaign.segmentId ?"Segmentada" : "Livre"}</span>
                        <span className="mkt-perf-table__impact"><span className="mkt-badge mkt-badge--default">Abrir</span></span>
                      </button>
                    ))}
                    {campaigns.length === 0 ?<div className="mkt-perf-table__empty">Nenhuma campanha criada.</div> : null}
                  </div>
                </article>
              </div>
            ) : null}

            {tab === "campaigns" ?(
              <div className="mkt-workbench mkt-workbench--campaigns">
                <section className="mkt-campaign-hero">
                  <div className="mkt-campaign-hero__copy">
                    <h2>Campanhas</h2>
                    <p>Planeje, crie, revise e lance campanhas com briefing, audiência, conteúdo, revisão e agenda no mesmo fluxo.</p>
                  </div>
                  <div className="mkt-campaign-hero__stats">
                    <div><strong>{campaigns.filter((campaign) => campaign.status === "DRAFT").length}</strong><span>rascunhos</span></div>
                    <div><strong>{scheduledCampaigns.length}</strong><span>agendadas</span></div>
                    <div><strong>{activeCampaigns.length}</strong><span>ativas</span></div>
                    <div><strong>{campaigns.filter((campaign) => campaign.status === "COMPLETED").length}</strong><span>concluídas</span></div>
                  </div>
                </section>

                <section className="mkt-campaign-flow" aria-label="Fluxo de criação de campanha">
                  {["Briefing", "Audiência", "Conteúdo", "Revisão", "Agenda"].map((step, index) => (
                    <span key={step} className="mkt-campaign-flow__step">
                      <span>{index + 1}</span>
                      {step}
                    </span>
                  ))}
                </section>

                {isAiAssistantOpen ?(
                  <section className="mkt-ai-inline">
                    <article className="mkt-analytics__section mkt-ai-brief">
                      <div className="marketing-page__section-head">
                        <div>
                          <h3 className="mkt-analytics__section-title">Assistente de IA</h3>
                          <p className="marketing-page__hint">Use contexto real do workspace para gerar um rascunho inicial de campanha.</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => setIsAiAssistantOpen(false)}>
                          Ocultar
                        </Button>
                      </div>

                      <div className="mkt-preset-grid">
                        {[
                          "Nutrir leads com score alto e última interação antiga",
                          "Reativar oportunidades paradas com convite consultivo",
                          "Criar campanha de onboarding para novos clientes",
                          "Preparar lembrete de renovação com valor entregue"
                        ].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            className="mkt-preset-card"
                            onClick={() => setAiForm((current) => ({ ...current, objective: preset }))}
                          >
                            <strong>{preset}</strong>
                            <span>Gerar briefing e conteúdo inicial</span>
                          </button>
                        ))}
                      </div>

                      <div className="mkt-ai-inline__fields">
                        <FormField label="Objetivo">
                          <Textarea
                            rows={4}
                            value={aiForm.objective}
                            onChange={(event) => setAiForm((current) => ({ ...current, objective: event.target.value }))}
                          />
                        </FormField>

                        <div className="marketing-page__grid">
                          <FormField label="Tom">
                            <TextInput value={aiForm.tone} onChange={(event) => setAiForm((current) => ({ ...current, tone: event.target.value }))} />
                          </FormField>
                          <FormField label="Estágio">
                            <TextInput value={aiForm.targetStage} onChange={(event) => setAiForm((current) => ({ ...current, targetStage: event.target.value }))} />
                          </FormField>
                        </div>

                        <FormField label="Público">
                          <TextInput value={aiForm.segmentHint} onChange={(event) => setAiForm((current) => ({ ...current, segmentHint: event.target.value }))} />
                        </FormField>
                      </div>

                      <div className="marketing-page__actions">
                        <Button onClick={() => void generateWithAI()} disabled={isSubmitting}>Gerar com IA</Button>
                      </div>
                    </article>

                    <aside className="mkt-analytics__section">
                      <h3 className="mkt-analytics__section-title">Contexto usado</h3>
                      <div className="mkt-context-list">
                        <div><strong>{fmtNum(audience.length)}</strong><span>contatos disponíveis</span></div>
                        <div><strong>{fmtNum(segments.length)}</strong><span>segmentos</span></div>
                        <div><strong>{fmtNum(templates.length)}</strong><span>templates</span></div>
                        <div><strong>{fmtPct(dashboard?.openRate)}</strong><span>abertura média</span></div>
                      </div>
                    </aside>
                  </section>
                ) : null}

                <section className="mkt-split">
                  <article className="mkt-analytics__section mkt-composer">
                    <div className="marketing-page__section-head">
                      <div>
                        <h3 className="mkt-analytics__section-title">Rascunho de campanha</h3>
                        <p className="marketing-page__hint">Crie o controle e refine a entrega na coluna ao lado.</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setIsAiAssistantOpen((current) => !current)} disabled={isSubmitting}>
                        {isAiAssistantOpen ?"Ocultar IA" : "Gerar com IA"}
                      </Button>
                    </div>

                    <div className="mkt-composer__fields">
                      <FormField label="Nome">
                        <TextInput
                          value={campaignForm.name}
                          onChange={(event) => setCampaignForm((current) => ({ ...current, name: event.target.value }))}
                          placeholder="Nurture MQL - Q2"
                        />
                      </FormField>
                      <div className="marketing-page__grid">
                        <FormField label="Objetivo">
                          <Select
                            value={campaignForm.objective}
                            onChange={(event) =>
                              setCampaignForm((current) => ({
                                ...current,
                                objective: event.target.value as MarketingCampaignObjective
                              }))
                            }
                          >
                            {OBJECTIVE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </Select>
                        </FormField>
                        <FormField label="Segmento">
                          <Select
                            value={campaignForm.segmentId}
                            onChange={(event) => setCampaignForm((current) => ({ ...current, segmentId: event.target.value }))}
                          >
                            <option value="">Sem segmento</option>
                            {segments.map((segment) => (
                              <option key={segment.id} value={segment.id}>{segment.name}</option>
                            ))}
                          </Select>
                        </FormField>
                      </div>
                      <FormField label="Template">
                        <Select
                          value={campaignForm.templateId}
                          onChange={(event) => setCampaignForm((current) => ({ ...current, templateId: event.target.value }))}
                        >
                          <option value="">Começar do zero</option>
                          {templates.map((template) => (
                            <option key={template.id} value={template.id}>{template.name}</option>
                          ))}
                        </Select>
                      </FormField>
                      <FormField label="Assunto">
                        <TextInput
                          value={campaignForm.subject}
                          onChange={(event) => setCampaignForm((current) => ({ ...current, subject: event.target.value }))}
                          placeholder="Seu próximo passo para acelerar entrega"
                        />
                      </FormField>
                      <FormField label="Mensagem">
                        <Textarea
                          rows={8}
                          value={campaignForm.bodyMarkdown}
                          onChange={(event) => setCampaignForm((current) => ({ ...current, bodyMarkdown: event.target.value }))}
                        />
                      </FormField>
                      <FormField label="Nota interna">
                        <TextInput
                          value={campaignForm.description}
                          onChange={(event) => setCampaignForm((current) => ({ ...current, description: event.target.value }))}
                          placeholder="Hipótese, público ou contexto"
                        />
                      </FormField>
                    </div>

                    <div className="marketing-page__actions">
                      <Button onClick={() => void createCampaign()} disabled={isSubmitting}>Criar campanha</Button>
                    </div>
                  </article>

                  <article className="mkt-analytics__section">
                    <div className="marketing-page__section-head">
                      <div>
                        <h3 className="mkt-analytics__section-title">Pipeline de envio</h3>
                        <p className="marketing-page__hint">Filtre, abra e avance campanhas sem sair da lista.</p>
                      </div>
                    </div>

                    <div className="mkt-inbox__filters">
                      <FormField label="Busca">
                        <TextInput
                          value={campaignSearch}
                          onChange={(event) => setCampaignSearch(event.target.value)}
                          placeholder="Nome, persona, hipotese..."
                        />
                      </FormField>
                      <FormField label="Status">
                        <Select
                          value={campaignStatusFilter}
                          onChange={(event) => setCampaignStatusFilter(event.target.value as MarketingCampaignStatus | "ALL")}
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>{status === "ALL" ?"Todos" : campaignStatusLabel(status)}</option>
                          ))}
                        </Select>
                      </FormField>
                    </div>

                    <div className="mkt-perf-table mkt-perf-table--compact">
                      <div className="mkt-perf-table__head">
                        <span>Campanha</span>
                        <span>Status</span>
                        <span>Agenda</span>
                        <span>Ações</span>
                      </div>
                      {campaigns.map((campaign) => (
                        <button
                          key={campaign.id}
                          type="button"
                          className={`mkt-perf-table__row${selectedCampaignId === campaign.id ?" mkt-perf-table__row--active" : ""}`}
                          onClick={() => void loadCampaignDetails(campaign.id)}
                        >
                          <span className="mkt-perf-table__name">
                            <strong>{campaign.name}</strong>
                            <span>{campaignObjectiveLabel(campaign.objective)} · {toLocalDate(campaign.updatedAt)}</span>
                          </span>
                          <span><span className={`mkt-badge mkt-badge--${statusTone(campaign.status)}`}>{campaignStatusLabel(campaign.status)}</span></span>
                          <span className="mkt-perf-table__num">{toLocalDate(campaign.scheduledAt)}</span>
                          <span className="mkt-perf-table__impact"><span className="mkt-badge mkt-badge--default">Abrir</span></span>
                        </button>
                      ))}
                      {campaigns.length === 0 ?<div className="mkt-perf-table__empty">Nenhuma campanha no workspace.</div> : null}
                    </div>
                  </article>
                </section>

                <article className="mkt-analytics__section mkt-action-panel">
                  {campaignDetails ?(
                    <>
                      <div className="marketing-page__section-head">
                        <div>
                          <h3 className="mkt-analytics__section-title">{campaignName(campaignDetails.campaign as Record<string, unknown>)}</h3>
                          <p className="marketing-page__hint">Controle de aprovação, teste, agenda e envio.</p>
                        </div>
                        <StatusBadge tone={statusTone(campaignStatus(campaignDetails.campaign as Record<string, unknown>))}>
                          {campaignStatusLabel(campaignStatus(campaignDetails.campaign as Record<string, unknown>))}
                        </StatusBadge>
                      </div>

                      <div className="mkt-action-panel__grid">
                        <FormField label="E-mail de teste">
                          <TextInput value={testEmail} onChange={(event) => setTestEmail(event.target.value)} placeholder="qa@empresa.com" />
                        </FormField>
                        <FormField label="Agenda">
                          <TextInput type="datetime-local" value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} />
                        </FormField>
                        <FormField label="Variante">
                          <Select value={selectedVariantId} onChange={(event) => setSelectedVariantId(event.target.value)}>
                            {campaignDetails.variants.map((variant) => (
                              <option key={variant.id} value={variant.id}>{variant.name} - {variant.subject}</option>
                            ))}
                          </Select>
                        </FormField>
                      </div>

                      <div className="mkt-action-panel__actions">
                        <Button size="sm" variant="outline" onClick={() => void submitForReview()} disabled={isSubmitting}>Enviar revisão</Button>
                        <Button size="sm" variant="outline" onClick={() => void approveCampaign()} disabled={isSubmitting}>Aprovar</Button>
                        <Button size="sm" variant="outline" onClick={() => void scheduleCampaign()} disabled={isSubmitting}>Agendar</Button>
                        <Button size="sm" variant="outline" onClick={() => void sendTest()} disabled={isSubmitting}>Enviar teste</Button>
                        <Button size="sm" variant="outline" onClick={() => void improveVariantWithAI()} disabled={isSubmitting}>Melhorar com IA</Button>
                        <Button size="sm" variant="outline" onClick={() => void launchCampaign(true)} disabled={isSubmitting}>Simular</Button>
                        <Button size="sm" onClick={() => void launchCampaign(false)} disabled={isSubmitting}>Lançar</Button>
                      </div>

                      <div className="mkt-history">
                        {campaignDetails.recentEvents.length === 0 ?<p className="mkt-analytics__empty">Sem eventos ainda.</p> : null}
                        {campaignDetails.recentEvents.slice(0, 8).map((event, index) => (
                          <div key={`${safeString(event.id) || "event"}-${index}`} className="mkt-history__item">
                            <strong>{safeString(event.headline) || safeString(event.type)}</strong>
                            <span>{toLocalDate(safeString(event.occurredAt))}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="mkt-empty-inline">
                      <strong>Selecione uma campanha</strong>
                      <span>O historico, testes e ações de envio aparecem aqui.</span>
                    </div>
                  )}
                </article>
              </div>
            ) : null}

            {tab === "audience" ?(
              <div className="mkt-workbench">
                <section className="mkt-screen-hero mkt-screen-hero--audience">
                  <div className="mkt-screen-hero__copy">
                    <h2>Audiência de marketing</h2>
                    <p>Construa públicos acionáveis para campanhas e jornadas mantendo o CRM como fonte operacional.</p>
                  </div>
                  <div className="mkt-screen-hero__stats">
                    <div><strong>{fmtNum(audience.length)}</strong><span>contatos</span></div>
                    <div><strong>{fmtNum(segments.length)}</strong><span>segmentos</span></div>
                    <div><strong>{segmentPreview ?fmtNum(segmentPreview.estimatedContacts) : "—"}</strong><span>prévia</span></div>
                  </div>
                </section>

                <section className="mkt-audience-grid">
                  <article className="mkt-analytics__section">
                    <div className="marketing-page__section-head">
                      <div>
                        <h3 className="mkt-analytics__section-title">Audiência</h3>
                        <p className="marketing-page__hint">Monte públicos para campanhas e jornadas sem misturar esta área com o CRM.</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => void loadData()} disabled={isLoading || isSubmitting}>
                        Recarregar
                      </Button>
                    </div>

                    <div className="mkt-audience-note">
                      Audiências são grupos de contatos usados em campanhas e jornadas. Leads continuam sendo gerenciados no CRM.
                    </div>

                    <FormField label="Buscar">
                      <TextInput
                        value={audienceSearch}
                        onChange={(event) => setAudienceSearch(event.target.value)}
                        placeholder="Nome, email, empresa..."
                      />
                    </FormField>

                    <DataTable columns="1.15fr 1fr 0.5fr 0.75fr 0.9fr" responsiveMinWidth="920px">
                      <DataTableHeader>
                        <DataTableCell>Contato</DataTableCell>
                        <DataTableCell>Empresa</DataTableCell>
                        <DataTableCell>Score</DataTableCell>
                        <DataTableCell>Consentimento</DataTableCell>
                        <DataTableCell>Último evento</DataTableCell>
                      </DataTableHeader>
                      <DataTableBody>
                        {audience.length === 0 ?(
                          <DataTableRow>
                            <DataTableCell>
                              <div className="mkt-table-empty">
                                <strong>Nenhum contato encontrado</strong>
                                <span>Conecte leads/clientes ao workspace ou ajuste a busca para criar segmentos de marketing.</span>
                              </div>
                            </DataTableCell>
                            <DataTableCell>-</DataTableCell>
                            <DataTableCell>-</DataTableCell>
                            <DataTableCell>-</DataTableCell>
                            <DataTableCell>-</DataTableCell>
                          </DataTableRow>
                        ) : (
                          audience.map((entry) => (
                            <DataTableRow key={entry.lead.id}>
                              <DataTableCell>
                                <div className="marketing-page__stacked">
                                  <strong>{entry.lead.fullName ?? "Sem nome"}</strong>
                                  <span>{entry.lead.email ?? "-"}</span>
                                </div>
                              </DataTableCell>
                              <DataTableCell>{entry.lead.companyName ?? "-"}</DataTableCell>
                              <DataTableCell>{entry.lead.score}</DataTableCell>
                              <DataTableCell>{entry.preference?.consentStatus ?? "Não informado"}</DataTableCell>
                              <DataTableCell>{toLocalDate(entry.lastEventAt)}</DataTableCell>
                            </DataTableRow>
                          ))
                        )}
                      </DataTableBody>
                    </DataTable>
                  </article>

                  <aside className="mkt-analytics__section mkt-segment-builder">
                    <div className="marketing-page__section-head">
                      <div>
                        <h3 className="mkt-analytics__section-title">Novo segmento</h3>
                        <p className="marketing-page__hint">Construa a regra em controles simples.</p>
                      </div>
                    </div>

                    <FormField label="Nome">
                      <TextInput value={segmentForm.name} onChange={(event) => setSegmentForm((current) => ({ ...current, name: event.target.value }))} />
                    </FormField>
                    <FormField label="Descrição">
                      <TextInput value={segmentForm.description} onChange={(event) => setSegmentForm((current) => ({ ...current, description: event.target.value }))} />
                    </FormField>

                    <div className="mkt-rule-builder">
                      <Select value={segmentFilterRule.field} onChange={(event) => updateSegmentFilterRule({ field: event.target.value })}>
                        {SEGMENT_FILTER_FIELDS.map((field) => <option key={field.value} value={field.value}>{field.label}</option>)}
                      </Select>
                      <Select value={segmentFilterRule.operator} onChange={(event) => updateSegmentFilterRule({ operator: event.target.value })}>
                        {SEGMENT_FILTER_OPERATORS.map((operator) => <option key={operator.value} value={operator.value}>{operator.label}</option>)}
                      </Select>
                      <TextInput value={segmentFilterRule.value} onChange={(event) => updateSegmentFilterRule({ value: event.target.value })} />
                    </div>

                    <div className="mkt-segment-builder__mode">
                      <button
                        type="button"
                        className={`mkt-inbox__filter-chip${segmentForm.kind === "DYNAMIC" ?" mkt-inbox__filter-chip--active" : ""}`}
                        onClick={() => setSegmentForm((current) => ({ ...current, kind: "DYNAMIC" }))}
                      >
                        Dinâmico
                      </button>
                      <button
                        type="button"
                        className={`mkt-inbox__filter-chip${segmentForm.kind === "STATIC" ?" mkt-inbox__filter-chip--active" : ""}`}
                        onClick={() => setSegmentForm((current) => ({ ...current, kind: "STATIC" }))}
                      >
                        Estático
                      </button>
                    </div>

                    <Button onClick={() => void createSegment()} disabled={isSubmitting}>Criar segmento</Button>

                    <div className="marketing-page__chips">
                      {segments.map((segment) => (
                        <button key={segment.id} type="button" onClick={() => void previewSegment(segment.id)}>
                          {segment.name}
                        </button>
                      ))}
                    </div>

                    {segmentPreview ?(
                      <div className="marketing-page__preview">
                        <h3>{segmentPreview.segmentName}</h3>
                        <p>{segmentPreview.estimatedContacts} contatos estimados</p>
                        <ul>
                          {segmentPreview.sample.slice(0, 8).map((lead) => (
                            <li key={lead.id}>
                              <strong>{lead.fullName ?? "Sem nome"}</strong>
                              <span>{lead.email ?? "-"} · {lead.companyName ?? "-"}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </aside>
                </section>
              </div>
            ) : null}

            {tab === "journeys" ?(
              <div className="mkt-journey-editor">
                <aside className="mkt-journey-sidebar">
                  <div className="mkt-journey-sidebar__head">
                    <span className="mkt-journey-sidebar__title">Jornadas</span>
                    <span className="mkt-journey-sidebar__count">{flows.length}</span>
                  </div>

                  <button
                    type="button"
                    className={`mkt-journey-card mkt-journey-card--new${activeFlowId === null ? " mkt-journey-card--active" : ""}`}
                    onClick={() => setActiveFlowId(null)}
                  >
                    <strong>Nova jornada</strong>
                    <span>Canvas em branco</span>
                  </button>

                  <div className="mkt-journey-sidebar__list">
                    {flows.length === 0 ?(
                      <div className="mkt-journey-sidebar__empty">
                        <strong>Nenhuma jornada ainda</strong>
                        <span>Configure os blocos no canvas e salve para criar a primeira.</span>
                      </div>
                    ) : null}
                    {flows.map((flow) => {
                      const isActive = flow.id === activeFlowId;
                      return (
                        <button
                          key={flow.id}
                          type="button"
                          className={`mkt-journey-card${isActive ? " mkt-journey-card--active" : ""}`}
                          onClick={() => setActiveFlowId(flow.id)}
                        >
                          <div className="mkt-journey-card__row">
                            <strong>{flow.name}</strong>
                            <StatusBadge tone={flow.status === "ACTIVE" ?"success" : "default"}>{campaignStatusLabel(flow.status)}</StatusBadge>
                          </div>
                          <span>{flow.description ?? "Sem descricao"}</span>
                          <span>{toLocalDate(flow.updatedAt)}</span>
                        </button>
                      );
                    })}
                  </div>
                </aside>

                <div className="mkt-journey-editor__canvas">
                  <JourneyBuilder
                    key={activeFlowId ?? "new"}
                    flow={flows.find((f) => f.id === activeFlowId) ?? null}
                    onSave={handleJourneySave}
                    onActivate={handleJourneyActivate}
                    onDeactivate={handleJourneyDeactivate}
                    isSaving={isSavingFlow}
                  />
                </div>
              </div>
            ) : null}

            {tab === "templates" ?(
              <div className="mkt-workbench">
                <section className="mkt-screen-hero mkt-screen-hero--templates">
                  <div className="mkt-screen-hero__copy">
                    <h2>Biblioteca de templates</h2>
                    <p>Modelos reutilizáveis para acelerar campanhas e manter consistência de tom, objetivo e estágio do funil.</p>
                  </div>
                  <div className="mkt-screen-hero__stats">
                    <div><strong>{fmtNum(templates.length)}</strong><span>templates</span></div>
                    <div><strong>{TEMPLATE_GOAL_FILTERS.length - 1}</strong><span>objetivos</span></div>
                    <div><strong>{filteredTemplates.length}</strong><span>no filtro</span></div>
                  </div>
                </section>

                <section className="mkt-split">
                  <article className="mkt-analytics__section mkt-composer">
                    <div className="marketing-page__section-head">
                      <div>
                        <h3 className="mkt-analytics__section-title">Novo template</h3>
                        <p className="marketing-page__hint">Salve assunto e corpo para reutilizar no builder.</p>
                      </div>
                    </div>

                    <FormField label="Nome">
                      <TextInput value={templateForm.name} onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))} />
                    </FormField>
                    <div className="marketing-page__grid">
                      <FormField label="Categoria">
                        <TextInput value={templateForm.category} onChange={(event) => setTemplateForm((current) => ({ ...current, category: event.target.value }))} />
                      </FormField>
                      <FormField label="Estágio">
                        <TextInput value={templateForm.funnelStage} onChange={(event) => setTemplateForm((current) => ({ ...current, funnelStage: event.target.value }))} />
                      </FormField>
                    </div>
                    <FormField label="Objetivo">
                      <Select value={templateForm.objective} onChange={(event) => setTemplateForm((current) => ({ ...current, objective: event.target.value }))}>
                        {OBJECTIVE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </Select>
                    </FormField>
                    <FormField label="Assunto">
                      <TextInput value={templateForm.subject} onChange={(event) => setTemplateForm((current) => ({ ...current, subject: event.target.value }))} />
                    </FormField>
                    <FormField label="Corpo">
                      <Textarea rows={9} value={templateForm.bodyMarkdown} onChange={(event) => setTemplateForm((current) => ({ ...current, bodyMarkdown: event.target.value }))} />
                    </FormField>
                    <Button onClick={() => void createTemplate()} disabled={isSubmitting}>Salvar template</Button>
                  </article>

                  <article className="mkt-analytics__section">
                    <div className="marketing-page__section-head">
                      <div>
                        <h3 className="mkt-analytics__section-title">Biblioteca</h3>
                        <p className="marketing-page__hint">{templates.length} modelos cadastrados para acelerar campanhas e jornadas.</p>
                      </div>
                    </div>

                    <div className="mkt-template-filters" aria-label="Filtrar templates por objetivo">
                      {TEMPLATE_GOAL_FILTERS.map((goal) => (
                        <button
                          key={goal}
                          type="button"
                          className={`mkt-inbox__filter-chip${templateGoalFilter === goal ? " mkt-inbox__filter-chip--active" : ""}`}
                          onClick={() => setTemplateGoalFilter(goal)}
                        >
                          {goal}
                        </button>
                      ))}
                    </div>

                    <div className="mkt-template-grid">
                      {filteredTemplates.length === 0 ?<div className="mkt-empty-inline"><strong>Nenhum template</strong><span>Crie o primeiro modelo ou ajuste o filtro selecionado.</span></div> : null}
                      {filteredTemplates.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          className="mkt-template-card"
                          onClick={() => setTemplateForm({
                            name: template.name,
                            category: template.category ?? "newsletter",
                            objective: template.objective ?? "LEAD_NURTURE",
                            funnelStage: template.funnelStage ?? "mql",
                            subject: template.subject,
                            bodyMarkdown: template.bodyMarkdown
                          })}
                        >
                          <span className="mkt-template-card__meta">{template.category ?? "geral"} · {template.funnelStage ?? "sem estágio"}</span>
                          <strong>{template.name}</strong>
                          <p>{template.subject}</p>
                          <span className="mkt-template-card__actions">
                            <span>Usar</span>
                            <span>Visualizar</span>
                            <span>Duplicar</span>
                            <span>Editar</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  </article>
                </section>
              </div>
            ) : null}

          </div>
        </div>
      </WorkspaceFrame>
    </AppShell>
  );
}
