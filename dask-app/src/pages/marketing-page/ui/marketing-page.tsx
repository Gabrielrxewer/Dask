import { useCallback, useEffect, useMemo, useState } from "react";
import { buildBoardMetrics } from "@/entities/task";
import { marketingService } from "@/modules/marketing";
import type {
  MarketingAudienceContact,
  MarketingAutomationFlow,
  MarketingCampaignDetails,
  MarketingCampaignListItem,
  MarketingCampaignObjective,
  MarketingCampaignStatus,
  MarketingDashboard,
  MarketingSegment,
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
  Section,
  Select,
  StatusBadge,
  Tabs,
  TextInput,
  Textarea
} from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { BoardMetrics } from "@/widgets/board-metrics";
import "./marketing-page.css";

type MarketingTab = "overview" | "campaign-builder" | "ai-studio" | "audience" | "automations" | "templates" | "calendar";

const MARKETING_TABS: Array<{ id: MarketingTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "campaign-builder", label: "Campaign Builder" },
  { id: "ai-studio", label: "AI Campaign Studio" },
  { id: "audience", label: "Audience Explorer" },
  { id: "automations", label: "Automation Builder" },
  { id: "templates", label: "Template Library" },
  { id: "calendar", label: "Marketing Calendar" }
];

const OBJECTIVE_OPTIONS: Array<{ value: MarketingCampaignObjective; label: string }> = [
  { value: "LEAD_NURTURE", label: "Lead Nurture" },
  { value: "ONBOARDING", label: "Onboarding" },
  { value: "REACTIVATION", label: "Reactivation" },
  { value: "BILLING_REMINDER", label: "Billing Reminder" },
  { value: "RENEWAL", label: "Renewal" },
  { value: "EXPANSION", label: "Expansion" },
  { value: "PRODUCT_UPDATE", label: "Product Update" },
  { value: "NEWSLETTER", label: "Newsletter" },
  { value: "CUSTOM", label: "Custom" }
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

const INITIAL_SEGMENT_FILTERS = JSON.stringify(
  {
    logic: "AND",
    rules: [{ field: "score", operator: "gte", value: 60 }]
  },
  null,
  2
);

const INITIAL_AUTOMATION_TRIGGER = JSON.stringify(
  {
    event: "lead.created",
    source: "leads",
    minScore: 60
  },
  null,
  2
);

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

function toRate(value: number): string {
  return `${Math.round(value * 100)}%`;
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

function safeString(input: unknown): string {
  return typeof input === "string" ? input : "";
}

function campaignName(input: Record<string, unknown> | null | undefined): string {
  return safeString(input?.name) || "Campaign";
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

  const [campaignSearch, setCampaignSearch] = useState("");
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<MarketingCampaignStatus | "ALL">("ALL");
  const [audienceSearch, setAudienceSearch] = useState("");

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
    bodyMarkdown: "Ola {{lead.firstName}},\n\nQuero compartilhar um update rapido com contexto da sua operacao.\n\n[]"
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

  const [automationForm, setAutomationForm] = useState({
    name: "",
    description: "",
    triggerDefinitionText: INITIAL_AUTOMATION_TRIGGER
  });

  const [aiForm, setAiForm] = useState({
    objective: "Gerar campanha de nutricao para leads com score acima de 60 e ultima interacao maior que 14 dias",
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
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar modulo de marketing.");
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, campaignStatusFilter, campaignSearch, audienceSearch, selectedCampaignId, loadCampaignDetails]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
        setError(actionError instanceof Error ? actionError.message : "Nao foi possivel executar a acao de marketing.");
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
      setError("Preencha nome, assunto e conteudo para criar a campanha.");
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

      setTab("campaign-builder");
      setCampaignForm((current) => ({
        ...current,
        name: "",
        description: "",
        subject: "",
        bodyMarkdown: "Ola {{lead.firstName}},\n\nQuero compartilhar um update rapido com contexto da sua operacao.\n\n[]"
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
    }, "Campanha enviada para revisao.");
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
          ? `Simulacao concluida: ${result.queued} envios elegiveis, ${result.skipped} ignorados.`
          : `Campanha lancada: ${result.queued} envios enfileirados, ${result.skipped} ignorados.`
      );
      if (!dryRun) {
        await loadCampaignDetails(selectedCampaignId);
      }
    }, dryRun ? "Simulacao de envio executada." : "Campanha enviada para fila de disparo.");
  };

  const sendTest = async () => {
    if (!workspaceId || !selectedCampaignId || !testEmail.trim()) {
      setError("Informe e-mail de teste para validar conteudo.");
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
      setTab("campaign-builder");
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
    }, "Segmento criado com filtros dinamicos.");
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
      setError(previewError instanceof Error ? previewError.message : "Nao foi possivel simular o segmento.");
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

  const createAutomationFlow = async () => {
    if (!workspaceId || !automationForm.name.trim()) {
      setError("Informe nome para o fluxo de automacao.");
      return;
    }

    await runAction(async () => {
      const triggerDefinition = sanitizeJson(automationForm.triggerDefinitionText);
      await marketingService.createAutomationFlow(workspaceId, {
        name: automationForm.name,
        description: automationForm.description || undefined,
        status: "DRAFT",
        triggerDefinition,
        steps: [
          {
            key: "start",
            name: "Trigger de entrada",
            kind: "TRIGGER",
            position: 0,
            config: triggerDefinition
          },
          {
            key: "send_email",
            name: "Enviar campanha",
            kind: "ACTION",
            position: 1,
            config: {
              action: "send_campaign_email"
            }
          }
        ]
      });

      setAutomationForm({
        name: "",
        description: "",
        triggerDefinitionText: INITIAL_AUTOMATION_TRIGGER
      });
    }, "Fluxo criado e pronto para evoluir no construtor visual.");
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

  const dashboardMetricCards = useMemo(
    () => [
      { label: "Campanhas ativas", value: dashboard?.activeCampaigns ?? 0 },
      { label: "Campanhas agendadas", value: dashboard?.scheduledCampaigns ?? 0 },
      { label: "Open rate", value: toRate(dashboard?.openRate ?? 0) },
      { label: "Click rate", value: toRate(dashboard?.clickRate ?? 0) },
      { label: "Conversao influenciada", value: toRate(dashboard?.conversionRate ?? 0) },
      { label: "Receita influenciada", value: `R$ ${(dashboard?.influencedRevenue ?? 0).toFixed(2)}` }
    ],
    [dashboard]
  );

  const activeTabLabel = useMemo(
    () => MARKETING_TABS.find((item) => item.id === tab)?.label ?? "Overview",
    [tab]
  );

  return (
    <AppShell metrics={metrics} hideSidebarBrandMark pageLabel="Marketing" pageTitle="Marketing Operations">
      <div className="marketing-page workspace-view">
        <BoardMetrics metrics={metrics} cards={dashboardMetricCards} className="marketing-page__metrics workspace-view__metrics" />

        <Section
          title="Marketing operations"
          subtitle="Do lead ao faturamento no mesmo contexto operacional, no mesmo visual da timeline."
          actions={
            <div className="marketing-page__section-actions workspace-view__actions">
              <Button variant="outline" onClick={() => void loadData()} disabled={isLoading || isSubmitting}>
                Atualizar
              </Button>
              <Button onClick={() => setTab("campaign-builder")}>Nova campanha</Button>
              <StatusBadge>{activeTabLabel}</StatusBadge>
            </div>
          }
          className="marketing-page__section workspace-view__section"
        >
          <div className="marketing-page__stack">
            {message ? <div className="marketing-page__feedback marketing-page__feedback--ok">{message}</div> : null}
            {error ? <div className="marketing-page__feedback marketing-page__feedback--error">{error}</div> : null}

            <div className="marketing-page__tabs-shell">
              <Tabs<MarketingTab> value={tab} items={MARKETING_TABS} onChange={setTab} className="marketing-page__tabs" />
            </div>

            {tab === "overview" ? (
              <div className="marketing-page__panel marketing-page__panel--overview">
                <div className="marketing-page__overview-grid">
                  <article className="marketing-page__card">
                    <h2>Campanhas em destaque</h2>
                    <ul>
                      {campaigns.slice(0, 6).map((campaign) => (
                        <li key={campaign.id}>
                          <button type="button" onClick={() => void loadCampaignDetails(campaign.id)}>
                            <strong>{campaign.name}</strong>
                            <span>{campaign.objective} - {campaign.status}</span>
                          </button>
                        </li>
                      ))}
                      {campaigns.length === 0 ? <li>Nenhuma campanha criada ainda.</li> : null}
                    </ul>
                  </article>

                  <article className="marketing-page__card">
                    <h2>Insights de IA</h2>
                    <div className="marketing-page__insights">
                      <p>
                        {dashboard && dashboard.clickRate < 0.12
                          ? "Click rate abaixo do alvo. Recomendado gerar versao B mais orientada a CTA."
                          : "Click rate em faixa saudavel. Foque em converter cliques para oportunidades."}
                      </p>
                      <p>
                        {dashboard && dashboard.openRate < 0.22
                          ? "Open rate baixo. Sugestao: rodar IA para variar assunto por estagio e score."
                          : "Assuntos performando bem. Ajuste segmentacao para elevar qualidade de resposta."}
                      </p>
                      <p>
                        Automacoes em execucao: <strong>{dashboard?.automationsRunning ?? 0}</strong> - Envios em fila hoje:{" "}
                        <strong>{dashboard?.sendsQueuedToday ?? 0}</strong>
                      </p>
                    </div>
                  </article>
                </div>
              </div>
            ) : null}

            {tab === "campaign-builder" ? (
              <div className="marketing-page__panel marketing-page__panel-grid">
            <article className="marketing-page__card">
              <h2>Campaign Builder</h2>
              <div className="marketing-page__grid">
                <FormField label="Nome da campanha">
                  <TextInput
                    value={campaignForm.name}
                    onChange={(event) => setCampaignForm((current) => ({ ...current, name: event.target.value }))}
                    placeholder="Ex: Nurture Q2 - Leads de consultoria"
                  />
                </FormField>
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
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>

              <div className="marketing-page__grid">
                <FormField label="Segmento">
                  <Select
                    value={campaignForm.segmentId}
                    onChange={(event) => setCampaignForm((current) => ({ ...current, segmentId: event.target.value }))}
                  >
                    <option value="">Sem segmento dedicado</option>
                    {segments.map((segment) => (
                      <option key={segment.id} value={segment.id}>
                        {segment.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Template base">
                  <Select
                    value={campaignForm.templateId}
                    onChange={(event) => setCampaignForm((current) => ({ ...current, templateId: event.target.value }))}
                  >
                    <option value="">Sem template</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>

              <FormField label="Descricao">
                <Textarea
                  rows={3}
                  value={campaignForm.description}
                  onChange={(event) => setCampaignForm((current) => ({ ...current, description: event.target.value }))}
                />
              </FormField>

              <FormField label="Assunto da variante controle">
                <TextInput
                  value={campaignForm.subject}
                  onChange={(event) => setCampaignForm((current) => ({ ...current, subject: event.target.value }))}
                  placeholder="Ex: Seu proximo passo para acelerar entrega"
                />
              </FormField>

              <FormField label="Conteudo (markdown/html controlado)">
                <Textarea
                  rows={12}
                  value={campaignForm.bodyMarkdown}
                  onChange={(event) => setCampaignForm((current) => ({ ...current, bodyMarkdown: event.target.value }))}
                />
              </FormField>

              <div className="marketing-page__actions">
                <Button onClick={() => void createCampaign()} disabled={isSubmitting}>
                  Criar campanha
                </Button>
                <Button variant="outline" onClick={() => setTab("ai-studio")} disabled={isSubmitting}>
                  Gerar com IA
                </Button>
              </div>
            </article>

            <article className="marketing-page__card">
              <h2>Controle de envio e aprovacao</h2>

              <div className="marketing-page__filters">
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
                    onChange={(event) =>
                      setCampaignStatusFilter(event.target.value as MarketingCampaignStatus | "ALL")
                    }
                  >
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status === "ALL" ? "Todos" : status}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>

              <DataTable columns="1.3fr 0.9fr 0.8fr 0.9fr 1fr" responsiveMinWidth="980px">
                <DataTableHeader>
                  <DataTableCell>Campanha</DataTableCell>
                  <DataTableCell>Objetivo</DataTableCell>
                  <DataTableCell>Status</DataTableCell>
                  <DataTableCell>Agendamento</DataTableCell>
                  <DataTableCell>Acoes</DataTableCell>
                </DataTableHeader>
                <DataTableBody>
                  {campaigns.length === 0 ? (
                    <DataTableRow>
                      <DataTableCell>Nenhuma campanha no workspace.</DataTableCell>
                      <DataTableCell>-</DataTableCell>
                      <DataTableCell>-</DataTableCell>
                      <DataTableCell>-</DataTableCell>
                      <DataTableCell>-</DataTableCell>
                    </DataTableRow>
                  ) : (
                    campaigns.map((campaign) => (
                      <DataTableRow key={campaign.id}>
                        <DataTableCell>
                          <div className="marketing-page__stacked">
                            <strong>{campaign.name}</strong>
                            <span>Atualizada em {toLocalDate(campaign.updatedAt)}</span>
                          </div>
                        </DataTableCell>
                        <DataTableCell>{campaign.objective}</DataTableCell>
                        <DataTableCell>
                          <StatusBadge tone={statusTone(campaign.status)}>{campaign.status}</StatusBadge>
                        </DataTableCell>
                        <DataTableCell>{toLocalDate(campaign.scheduledAt)}</DataTableCell>
                        <DataTableCell>
                          <div className="marketing-page__row-actions">
                            <Button size="sm" variant="outline" onClick={() => void loadCampaignDetails(campaign.id)}>
                              Detalhar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                void runAction(async () => {
                                  const analytics = await marketingService.getAnalytics(workspaceId, campaign.id);
                                  setMessage(
                                    `Eventos: ${analytics.byType.map((entry) => `${entry.type}:${entry.total}`).join(" | ")}`
                                  );
                                }, "Analytics carregado.")
                              }
                            >
                              Analytics
                            </Button>
                          </div>
                        </DataTableCell>
                      </DataTableRow>
                    ))
                  )}
                </DataTableBody>
              </DataTable>

              {campaignDetails ? (
                <div className="marketing-page__details">
                  <div className="marketing-page__details-head">
                    <h3>{campaignName(campaignDetails.campaign as Record<string, unknown>)}</h3>
                    <StatusBadge tone={statusTone(campaignStatus(campaignDetails.campaign as Record<string, unknown>))}>
                      {campaignStatus(campaignDetails.campaign as Record<string, unknown>)}
                    </StatusBadge>
                  </div>

                  <div className="marketing-page__grid">
                    <FormField label="Envio de teste">
                      <TextInput
                        value={testEmail}
                        onChange={(event) => setTestEmail(event.target.value)}
                        placeholder="qa@empresa.com"
                      />
                    </FormField>
                    <FormField label="Agendar (local)">
                      <TextInput
                        type="datetime-local"
                        value={scheduleAt}
                        onChange={(event) => setScheduleAt(event.target.value)}
                      />
                    </FormField>
                  </div>

                  <div className="marketing-page__actions">
                    <Button size="sm" variant="outline" onClick={() => void submitForReview()} disabled={isSubmitting}>
                      Enviar revisao
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void approveCampaign()} disabled={isSubmitting}>
                      Aprovar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void scheduleCampaign()} disabled={isSubmitting}>
                      Agendar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void sendTest()} disabled={isSubmitting}>
                      Enviar teste
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void launchCampaign(true)} disabled={isSubmitting}>
                      Simular envio
                    </Button>
                    <Button size="sm" onClick={() => void launchCampaign(false)} disabled={isSubmitting}>
                      Lancar campanha
                    </Button>
                  </div>

                  <div className="marketing-page__variants">
                    <FormField label="Variante para IA">
                      <Select value={selectedVariantId} onChange={(event) => setSelectedVariantId(event.target.value)}>
                        {campaignDetails.variants.map((variant) => (
                          <option key={variant.id} value={variant.id}>
                            {variant.name} - {variant.subject}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                    <Button size="sm" variant="outline" onClick={() => void improveVariantWithAI()} disabled={isSubmitting}>
                      Melhorar variante com IA
                    </Button>
                  </div>

                  <h4>Timeline da campanha</h4>
                  <ul className="marketing-page__timeline">
                    {campaignDetails.recentEvents.length === 0 ? <li>Sem eventos ainda.</li> : null}
                    {campaignDetails.recentEvents.slice(0, 14).map((event, index) => (
                      <li key={`${safeString(event.id) || "event"}-${index}`}>
                        <strong>{safeString(event.headline) || safeString(event.type)}</strong>
                        <span>{toLocalDate(safeString(event.occurredAt))}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="marketing-page__hint">Selecione uma campanha para acompanhar detalhes, timeline e envios.</p>
              )}
            </article>
              </div>
            ) : null}

            {tab === "ai-studio" ? (
              <div className="marketing-page__panel marketing-page__panel-grid">
            <article className="marketing-page__card">
              <h2>AI Campaign Studio</h2>
              <p>
                Use contexto real do workspace (leads, docs, interacoes e sinais financeiros) para gerar campanha orientada
                ao funil completo.
              </p>

              <FormField label="Objetivo operacional">
                <Textarea
                  rows={4}
                  value={aiForm.objective}
                  onChange={(event) => setAiForm((current) => ({ ...current, objective: event.target.value }))}
                />
              </FormField>

              <div className="marketing-page__grid">
                <FormField label="Tom">
                  <TextInput
                    value={aiForm.tone}
                    onChange={(event) => setAiForm((current) => ({ ...current, tone: event.target.value }))}
                  />
                </FormField>
                <FormField label="Estagio alvo">
                  <TextInput
                    value={aiForm.targetStage}
                    onChange={(event) => setAiForm((current) => ({ ...current, targetStage: event.target.value }))}
                  />
                </FormField>
              </div>

              <FormField label="Segment hint">
                <TextInput
                  value={aiForm.segmentHint}
                  onChange={(event) => setAiForm((current) => ({ ...current, segmentHint: event.target.value }))}
                />
              </FormField>

              <div className="marketing-page__actions">
                <Button onClick={() => void generateWithAI()} disabled={isSubmitting}>
                  Gerar campanha orientada por contexto
                </Button>
                <Button variant="outline" onClick={() => setTab("campaign-builder")}>
                  Voltar ao builder
                </Button>
              </div>
            </article>

            <article className="marketing-page__card">
              <h2>Direcionamento sugerido</h2>
              <ul className="marketing-page__bullet-list">
                <li>Preferir segmento com score alto e baixa atividade recente para nutricao.</li>
                <li>Para billing reminder, separar comunicacao relacional de operacional.</li>
                <li>Gerar A/B para assunto com foco em clareza de valor e proximo passo.</li>
                <li>Adicionar CTA alinhado ao estagio (diagnostico, demo, onboarding ou renovacao).</li>
              </ul>
            </article>
              </div>
            ) : null}

            {tab === "audience" ? (
              <div className="marketing-page__panel marketing-page__panel-grid">
            <article className="marketing-page__card">
              <h2>Audience Explorer</h2>
              <div className="marketing-page__filters">
                <FormField label="Buscar contato">
                  <TextInput
                    value={audienceSearch}
                    onChange={(event) => setAudienceSearch(event.target.value)}
                    placeholder="Nome, email, empresa..."
                  />
                </FormField>
                <FormField label="Atualizacao rapida">
                  <Button variant="outline" onClick={() => void loadData()} disabled={isLoading || isSubmitting}>
                    Recarregar audiencia
                  </Button>
                </FormField>
              </div>

              <DataTable columns="1.1fr 1fr 0.7fr 0.7fr 1fr" responsiveMinWidth="980px">
                <DataTableHeader>
                  <DataTableCell>Contato</DataTableCell>
                  <DataTableCell>Empresa</DataTableCell>
                  <DataTableCell>Score</DataTableCell>
                  <DataTableCell>Consentimento</DataTableCell>
                  <DataTableCell>Ultimo evento</DataTableCell>
                </DataTableHeader>
                <DataTableBody>
                  {audience.length === 0 ? (
                    <DataTableRow>
                      <DataTableCell>Nenhum contato encontrado.</DataTableCell>
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
                        <DataTableCell>{entry.preference?.consentStatus ?? "UNKNOWN"}</DataTableCell>
                        <DataTableCell>{toLocalDate(entry.lastEventAt)}</DataTableCell>
                      </DataTableRow>
                    ))
                  )}
                </DataTableBody>
              </DataTable>
            </article>

            <article className="marketing-page__card">
              <h2>Segmentos dinamicos</h2>
              <FormField label="Nome do segmento">
                <TextInput
                  value={segmentForm.name}
                  onChange={(event) => setSegmentForm((current) => ({ ...current, name: event.target.value }))}
                />
              </FormField>
              <FormField label="Descricao">
                <TextInput
                  value={segmentForm.description}
                  onChange={(event) => setSegmentForm((current) => ({ ...current, description: event.target.value }))}
                />
              </FormField>
              <FormField label="Tipo">
                <Select
                  value={segmentForm.kind}
                  onChange={(event) =>
                    setSegmentForm((current) => ({
                      ...current,
                      kind: event.target.value as "STATIC" | "DYNAMIC"
                    }))
                  }
                >
                  <option value="DYNAMIC">DYNAMIC</option>
                  <option value="STATIC">STATIC</option>
                </Select>
              </FormField>
              <FormField label="Filtros (JSON)">
                <Textarea
                  rows={9}
                  value={segmentForm.filtersText}
                  onChange={(event) => setSegmentForm((current) => ({ ...current, filtersText: event.target.value }))}
                />
              </FormField>
              <div className="marketing-page__actions">
                <Button onClick={() => void createSegment()} disabled={isSubmitting}>
                  Criar segmento
                </Button>
              </div>

              <div className="marketing-page__chips">
                {segments.map((segment) => (
                  <button key={segment.id} type="button" onClick={() => void previewSegment(segment.id)}>
                    {segment.name}
                  </button>
                ))}
              </div>

              {segmentPreview ? (
                <div className="marketing-page__preview">
                  <h3>Preview: {segmentPreview.segmentName}</h3>
                  <p>Estimado: {segmentPreview.estimatedContacts} contatos</p>
                  <ul>
                    {segmentPreview.sample.map((lead) => (
                      <li key={lead.id}>
                        <strong>{lead.fullName ?? "Sem nome"}</strong> - {lead.email ?? "-"} - {lead.companyName ?? "-"}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
              </div>
            ) : null}

            {tab === "automations" ? (
              <div className="marketing-page__panel marketing-page__panel-grid">
            <article className="marketing-page__card">
              <h2>Automation Builder</h2>
              <FormField label="Nome do fluxo">
                <TextInput
                  value={automationForm.name}
                  onChange={(event) => setAutomationForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Ex: Nurture MQL + follow-up comercial"
                />
              </FormField>
              <FormField label="Descricao">
                <TextInput
                  value={automationForm.description}
                  onChange={(event) => setAutomationForm((current) => ({ ...current, description: event.target.value }))}
                />
              </FormField>
              <FormField label="Trigger definition (JSON)">
                <Textarea
                  rows={8}
                  value={automationForm.triggerDefinitionText}
                  onChange={(event) =>
                    setAutomationForm((current) => ({
                      ...current,
                      triggerDefinitionText: event.target.value
                    }))
                  }
                />
              </FormField>
              <div className="marketing-page__actions">
                <Button onClick={() => void createAutomationFlow()} disabled={isSubmitting}>
                  Criar fluxo
                </Button>
              </div>
            </article>

            <article className="marketing-page__card">
              <h2>Jornadas existentes</h2>
              <ul className="marketing-page__flow-list">
                {flows.length === 0 ? <li>Nenhum fluxo criado no workspace.</li> : null}
                {flows.map((flow) => (
                  <li key={flow.id}>
                    <div>
                      <strong>{flow.name}</strong>
                      <span>{flow.description ?? "Sem descricao"}</span>
                    </div>
                    <StatusBadge tone={flow.status === "ACTIVE" ? "success" : "default"}>{flow.status}</StatusBadge>
                  </li>
                ))}
              </ul>
            </article>
              </div>
            ) : null}

            {tab === "templates" ? (
              <div className="marketing-page__panel marketing-page__panel-grid">
            <article className="marketing-page__card">
              <h2>Template Library</h2>
              <FormField label="Nome">
                <TextInput
                  value={templateForm.name}
                  onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))}
                />
              </FormField>
              <div className="marketing-page__grid">
                <FormField label="Categoria">
                  <TextInput
                    value={templateForm.category}
                    onChange={(event) => setTemplateForm((current) => ({ ...current, category: event.target.value }))}
                  />
                </FormField>
                <FormField label="Funnel stage">
                  <TextInput
                    value={templateForm.funnelStage}
                    onChange={(event) =>
                      setTemplateForm((current) => ({ ...current, funnelStage: event.target.value }))
                    }
                  />
                </FormField>
              </div>
              <FormField label="Objetivo">
                <TextInput
                  value={templateForm.objective}
                  onChange={(event) => setTemplateForm((current) => ({ ...current, objective: event.target.value }))}
                />
              </FormField>
              <FormField label="Assunto">
                <TextInput
                  value={templateForm.subject}
                  onChange={(event) => setTemplateForm((current) => ({ ...current, subject: event.target.value }))}
                />
              </FormField>
              <FormField label="Corpo">
                <Textarea
                  rows={10}
                  value={templateForm.bodyMarkdown}
                  onChange={(event) =>
                    setTemplateForm((current) => ({ ...current, bodyMarkdown: event.target.value }))
                  }
                />
              </FormField>
              <div className="marketing-page__actions">
                <Button onClick={() => void createTemplate()} disabled={isSubmitting}>
                  Salvar template
                </Button>
              </div>
            </article>

            <article className="marketing-page__card">
              <h2>Galeria</h2>
              <ul className="marketing-page__template-list">
                {templates.length === 0 ? <li>Nenhum template cadastrado.</li> : null}
                {templates.map((template) => (
                  <li key={template.id}>
                    <strong>{template.name}</strong>
                    <span>{template.category ?? "geral"} - {template.objective ?? "custom"}</span>
                    <p>{template.subject}</p>
                  </li>
                ))}
              </ul>
            </article>
              </div>
            ) : null}

            {tab === "calendar" ? (
              <div className="marketing-page__panel marketing-page__panel-grid">
            <article className="marketing-page__card">
              <h2>Calendario editorial</h2>
              <ul className="marketing-page__calendar-list">
                {scheduledCampaigns.length === 0 ? <li>Nenhuma campanha agendada.</li> : null}
                {scheduledCampaigns.map((campaign) => (
                  <li key={campaign.id}>
                    <div>
                      <strong>{campaign.name}</strong>
                      <span>{campaign.objective}</span>
                    </div>
                    <time>{toLocalDate(campaign.scheduledAt)}</time>
                  </li>
                ))}
              </ul>
            </article>

            <article className="marketing-page__card">
              <h2>Execucao ativa</h2>
              <ul className="marketing-page__calendar-list">
                {activeCampaigns.length === 0 ? <li>Nenhuma campanha ativa no momento.</li> : null}
                {activeCampaigns.map((campaign) => (
                  <li key={campaign.id}>
                    <div>
                      <strong>{campaign.name}</strong>
                      <span>Desde {toLocalDate(campaign.launchedAt)}</span>
                    </div>
                    <StatusBadge tone="success">ACTIVE</StatusBadge>
                  </li>
                ))}
              </ul>
            </article>
              </div>
            ) : null}
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
