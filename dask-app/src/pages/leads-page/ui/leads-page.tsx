import { useCallback, useEffect, useMemo, useState } from "react";
import { buildBoardMetrics } from "@/entities/task";
import { leadsService } from "@/modules/leads";
import type { CaptureLeadInput, Lead, LeadDetails, LeadQualificationStatus } from "@/modules/leads";
import { useWorkspace } from "@/modules/workspace";
import {
  Button,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHeader,
  DataTableRow,
  EmptyState,
  FormField,
  LoadingState,
  ModalShell,
  Section,
  Select,
  StatusBadge,
  Tabs,
  TextInput,
  Textarea,
  WorkspaceFrame
} from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { BoardMetrics } from "@/widgets/board-metrics";
import "./leads-page.css";

type LeadsTab = "dashboard" | "pipeline" | "capture" | "automations";

const TABS: Array<{ id: LeadsTab; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "pipeline", label: "Pipeline" },
  { id: "capture", label: "Captura" },
  { id: "automations", label: "Automacoes" }
];

const STATUS_LABELS: Record<string, string> = {
  CAPTURED: "Capturado",
  QUALIFIED: "Qualificado",
  DISTRIBUTED: "Distribuido",
  FOLLOW_UP: "Acompanhamento",
  NURTURING: "Nutricao",
  CONVERTED: "Convertido",
  LOST: "Perdido"
};

function statusTone(status: string): "default" | "success" | "warning" {
  if (status === "CONVERTED") {
    return "success";
  }

  if (status === "LOST") {
    return "warning";
  }

  return "default";
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString("pt-BR");
}

export function LeadsPage() {
  const { snapshot } = useWorkspace();
  const workspaceId = snapshot?.id ?? "";
  const metrics = useMemo(() => buildBoardMetrics(snapshot?.tasks ?? []), [snapshot?.tasks]);

  const [tab, setTab] = useState<LeadsTab>("dashboard");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [dashboard, setDashboard] = useState<{
    captured: number;
    qualified: number;
    distributed: number;
    followUp: number;
    nurturing: number;
    converted: number;
    lost: number;
    conversionRate: number;
  } | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | Lead["status"]>("ALL");
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [details, setDetails] = useState<LeadDetails | null>(null);

  const [captureForm, setCaptureForm] = useState<CaptureLeadInput>({
    source: "MANUAL",
    fullName: "",
    email: "",
    phone: "",
    companyName: "",
    interest: "",
    notes: "",
    score: 50
  });

  const dashboardMetricCards = useMemo(
    () => [
      { label: "Capturados", value: dashboard?.captured ?? 0 },
      { label: "Qualificados", value: dashboard?.qualified ?? 0 },
      { label: "Distribuidos", value: dashboard?.distributed ?? 0 },
      { label: "Acompanhamento", value: dashboard?.followUp ?? 0 },
      { label: "Nutricao", value: dashboard?.nurturing ?? 0 },
      { label: "Convertidos", value: dashboard?.converted ?? 0 },
      { label: "Perdidos", value: dashboard?.lost ?? 0 },
      { label: "Taxa de conversao", value: `${Math.round((dashboard?.conversionRate ?? 0) * 100)}%` }
    ],
    [dashboard]
  );

  const loadLeadsData = useCallback(async () => {
    if (!workspaceId) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const [nextDashboard, nextLeads] = await Promise.all([
        leadsService.getDashboard(workspaceId),
        leadsService.listLeads(workspaceId, {
          status: statusFilter === "ALL" ? undefined : statusFilter,
          search: search || undefined,
          limit: 200
        })
      ]);

      setDashboard(nextDashboard);
      setLeads(nextLeads.items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar modulo de leads.");
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, workspaceId]);

  useEffect(() => {
    void loadLeadsData();
  }, [loadLeadsData]);

  const runAction = useCallback(
    async (action: () => Promise<unknown>, successMessage: string) => {
      setIsSubmitting(true);
      setError("");
      setMessage("");

      try {
        await action();
        setMessage(successMessage);
        await loadLeadsData();
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "Falha ao executar acao em leads.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [loadLeadsData]
  );

  const openLeadDetails = async (leadId: string) => {
    if (!workspaceId) {
      return;
    }

    setDetailsId(leadId);
    setDetails(null);
    try {
      const response = await leadsService.getLeadDetails(workspaceId, leadId);
      setDetails(response);
    } catch (detailsError) {
      setError(detailsError instanceof Error ? detailsError.message : "Falha ao carregar detalhe do lead.");
    }
  };

  const submitCapture = async () => {
    if (!workspaceId || !captureForm.fullName?.trim()) {
      setError("Informe ao menos o nome do lead para capturar.");
      return;
    }

    await runAction(async () => {
      await leadsService.captureLead(workspaceId, captureForm);
      setCaptureForm({
        source: "MANUAL",
        fullName: "",
        email: "",
        phone: "",
        companyName: "",
        interest: "",
        notes: "",
        score: 50
      });
      setTab("pipeline");
    }, "Lead capturado com sucesso.");
  };

  const qualifyQuick = async (lead: Lead, qualificationStatus: LeadQualificationStatus) => {
    await runAction(
      () =>
        leadsService.qualifyLead(workspaceId, lead.id, {
          qualificationStatus,
          score: lead.score
        }),
      "Lead atualizado na qualificacao."
    );
  };

  return (
    <AppShell metrics={metrics} hideSidebarBrandMark pageLabel="Leads" pageTitle="Modulo de Leads">
      <WorkspaceFrame className="leads-page">
        <BoardMetrics metrics={metrics} cards={dashboardMetricCards} className="leads-page__metrics workspace-view__metrics" />

        {message ? <div className="leads-page__feedback leads-page__feedback--ok">{message}</div> : null}
        {error ? <div className="leads-page__feedback leads-page__feedback--error">{error}</div> : null}

        <Section
          title="Operacao de leads"
          subtitle="Acompanhe captacao, qualificacao e proximos contatos com a mesma linguagem visual da timeline."
          actions={
            <div className="leads-page__section-actions workspace-view__actions">
              <StatusBadge>{`${leads.length} lead${leads.length === 1 ? "" : "s"}`}</StatusBadge>
              <Button variant="outline" onClick={() => void loadLeadsData()} disabled={isLoading || isSubmitting}>
                Atualizar
              </Button>
              <Button onClick={() => setTab("capture")}>Novo lead</Button>
            </div>
          }
          className="leads-page__section workspace-view__section"
        >
          <div className="leads-page__stack">
            <Tabs<LeadsTab> value={tab} items={TABS} onChange={setTab} className="leads-page__tabs" />

            {tab === "dashboard" ? (
              <div className="leads-page__dashboard">
                <div className="leads-page__summary-card">
                  <span className="leads-page__eyebrow">Funil ativo</span>
                  <strong>{dashboard?.captured ?? 0} leads em acompanhamento</strong>
                  <p>
                    {dashboard?.qualified ?? 0} qualificados, {dashboard?.converted ?? 0} convertidos e taxa atual de{" "}
                    {`${Math.round((dashboard?.conversionRate ?? 0) * 100)}%`}.
                  </p>
                </div>
                <div className="leads-page__summary-card">
                  <span className="leads-page__eyebrow">Automacao pronta</span>
                  <strong>Webhook e eventos de dominio disponiveis</strong>
                  <p>Centralize a entrada por integracoes e mantenha o historico do funil sincronizado no workspace.</p>
                </div>
              </div>
            ) : null}

            {tab === "pipeline" ? (
              <>
                <div className="leads-page__filters">
                  <FormField label="Buscar">
                    <TextInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, email, empresa, interesse" />
                  </FormField>
                  <FormField label="Status">
                    <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
                      <option value="ALL">Todos</option>
                      <option value="CAPTURED">Capturado</option>
                      <option value="QUALIFIED">Qualificado</option>
                      <option value="DISTRIBUTED">Distribuido</option>
                      <option value="FOLLOW_UP">Acompanhamento</option>
                      <option value="NURTURING">Nutricao</option>
                      <option value="CONVERTED">Convertido</option>
                      <option value="LOST">Perdido</option>
                    </Select>
                  </FormField>
                </div>

                <DataTable columns="1.2fr 1fr 0.7fr 0.8fr 1fr 1.1fr" responsiveMinWidth="980px" className="leads-page__table">
                  <DataTableHeader>
                    <DataTableCell>Lead</DataTableCell>
                    <DataTableCell>Empresa</DataTableCell>
                    <DataTableCell>Score</DataTableCell>
                    <DataTableCell>Status</DataTableCell>
                    <DataTableCell>Proximo contato</DataTableCell>
                    <DataTableCell>Acoes</DataTableCell>
                  </DataTableHeader>
                  <DataTableBody>
                    {isLoading && leads.length === 0 ? (
                      <LoadingState text="Carregando leads..." />
                    ) : leads.length === 0 ? (
                      <EmptyState>Nenhum lead encontrado.</EmptyState>
                    ) : (
                      leads.map((lead) => (
                        <DataTableRow key={lead.id}>
                          <DataTableCell>
                            <div className="leads-page__lead-main">
                              <strong>{lead.fullName ?? "Sem nome"}</strong>
                              <span>{lead.email ?? lead.phone ?? "Sem contato"}</span>
                            </div>
                          </DataTableCell>
                          <DataTableCell>{lead.companyName ?? "-"}</DataTableCell>
                          <DataTableCell>{lead.score}</DataTableCell>
                          <DataTableCell>
                            <StatusBadge tone={statusTone(lead.status)}>{STATUS_LABELS[lead.status] ?? lead.status}</StatusBadge>
                          </DataTableCell>
                          <DataTableCell>{formatDate(lead.nextFollowUpAt)}</DataTableCell>
                          <DataTableCell>
                            <div className="leads-page__row-actions">
                              <Button size="sm" variant="outline" onClick={() => void openLeadDetails(lead.id)}>
                                Detalhe
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => void qualifyQuick(lead, "MQL")} disabled={isSubmitting}>
                                MQL
                              </Button>
                              <Button
                                size="sm"
                                onClick={() =>
                                  void runAction(
                                    () => leadsService.registerFollowUp(workspaceId, lead.id, { note: "Follow-up manual registrado" }),
                                    "Follow-up registrado."
                                  )
                                }
                                disabled={isSubmitting}
                              >
                                Follow-up
                              </Button>
                            </div>
                          </DataTableCell>
                        </DataTableRow>
                      ))
                    )}
                  </DataTableBody>
                </DataTable>
              </>
            ) : null}

            {tab === "capture" ? (
              <div className="leads-page__capture">
                <div className="leads-page__form-grid">
                  <FormField label="Nome">
                    <TextInput
                      value={captureForm.fullName ?? ""}
                      onChange={(event) => setCaptureForm((current) => ({ ...current, fullName: event.target.value }))}
                    />
                  </FormField>
                  <FormField label="Email">
                    <TextInput
                      value={captureForm.email ?? ""}
                      onChange={(event) => setCaptureForm((current) => ({ ...current, email: event.target.value }))}
                    />
                  </FormField>
                  <FormField label="Telefone">
                    <TextInput
                      value={captureForm.phone ?? ""}
                      onChange={(event) => setCaptureForm((current) => ({ ...current, phone: event.target.value }))}
                    />
                  </FormField>
                </div>
                <div className="leads-page__form-grid">
                  <FormField label="Empresa">
                    <TextInput
                      value={captureForm.companyName ?? ""}
                      onChange={(event) => setCaptureForm((current) => ({ ...current, companyName: event.target.value }))}
                    />
                  </FormField>
                  <FormField label="Interesse">
                    <TextInput
                      value={captureForm.interest ?? ""}
                      onChange={(event) => setCaptureForm((current) => ({ ...current, interest: event.target.value }))}
                    />
                  </FormField>
                  <FormField label="Score inicial">
                    <TextInput
                      value={String(captureForm.score ?? 50)}
                      onChange={(event) => setCaptureForm((current) => ({ ...current, score: Number(event.target.value) }))}
                    />
                  </FormField>
                </div>
                <FormField label="Notas">
                  <Textarea
                    rows={4}
                    value={captureForm.notes ?? ""}
                    onChange={(event) => setCaptureForm((current) => ({ ...current, notes: event.target.value }))}
                  />
                </FormField>
                <div className="leads-page__row-actions">
                  <Button onClick={() => void submitCapture()} disabled={isSubmitting}>Capturar lead</Button>
                </div>
              </div>
            ) : null}

            {tab === "automations" ? (
              <div className="leads-page__automation">
                <div className="leads-page__summary-card">
                  <span className="leads-page__eyebrow">Endpoint de entrada</span>
                  <strong>
                    <code>/integrations/leads/webhook/:source</code>
                  </strong>
                  <p>Use este endpoint para ingestao automatica com idempotencia por evento e rastreio completo do funil.</p>
                </div>
                <div className="leads-page__summary-card">
                  <span className="leads-page__eyebrow">Fluxo suportado</span>
                  <strong>Captura, qualificacao, distribuicao e conversao</strong>
                  <p>Os eventos de dominio ficam prontos para alimentar o motor de automacoes e os modulos seguintes.</p>
                </div>
              </div>
            ) : null}
          </div>
        </Section>
      </WorkspaceFrame>

      {detailsId ? (
        <ModalShell
          titleId="lead-details-modal"
          className="leads-page__modal"
          onClose={() => {
            setDetailsId(null);
            setDetails(null);
          }}
        >
          <header className="leads-page__modal-header">
            <h2 id="lead-details-modal">Detalhes do lead</h2>
            <button type="button" onClick={() => setDetailsId(null)}>x</button>
          </header>

          {!details ? (
            <p className="leads-page__empty">Carregando detalhes...</p>
          ) : (
            <div className="leads-page__modal-content">
              <p><strong>Lead:</strong> {details.fullName ?? "-"}</p>
              <p><strong>Status:</strong> {STATUS_LABELS[details.status] ?? details.status}</p>
              <p><strong>Empresa:</strong> {details.companyName ?? "-"}</p>
              <p><strong>Email:</strong> {details.email ?? "-"}</p>
              <p><strong>Score:</strong> {details.score}</p>

              <h3>Atividades recentes</h3>
              <ul className="leads-page__timeline">
                {details.activities.length === 0 ? <li>Nenhuma atividade registrada.</li> : null}
                {details.activities.slice(0, 8).map((activity) => (
                  <li key={activity.id}>
                    <strong>{activity.title}</strong>
                    <span>{formatDate(activity.occurredAt)}</span>
                    {activity.description ? <p>{activity.description}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ModalShell>
      ) : null}
    </AppShell>
  );
}
