import type { Dispatch, SetStateAction } from "react";
import { type Control, type FieldErrors } from "react-hook-form";
import {
  AppDateTimePicker,
  AppFormGrid,
  AppSelect,
  AppSelectField,
  AppTextField,
  AppTextareaField,
  Button,
  DataTable,
  EmptyState,
  FormField,
  StatusBadge,
  TextInput,
  type DataTableColumn
} from "@/shared/ui";
import type {
  MarketingAudienceContact,
  MarketingCampaignDetails,
  MarketingCampaignListItem,
  MarketingCampaignObjective,
  MarketingCampaignStatus,
  MarketingDashboard,
  MarketingSegment,
  MarketingTemplate
} from "@/modules/marketing";
import {
  OBJECTIVE_OPTIONS,
  STATUS_OPTIONS,
  campaignName,
  campaignObjectiveLabel,
  campaignStatus,
  campaignStatusLabel,
  fmtNum,
  fmtPct,
  safeString,
  statusTone,
  toLocalDate,
  type AiFormState,
  type CampaignFormState
} from "./marketing-page.model";

interface MarketingCampaignsTabProps {
  dashboard: MarketingDashboard | null;
  campaigns: MarketingCampaignListItem[];
  scheduledCampaigns: MarketingCampaignListItem[];
  activeCampaigns: MarketingCampaignListItem[];
  audience: MarketingAudienceContact[];
  segments: MarketingSegment[];
  templates: MarketingTemplate[];
  isAiAssistantOpen: boolean;
  setIsAiAssistantOpen: Dispatch<SetStateAction<boolean>>;
  setAiForm: Dispatch<SetStateAction<AiFormState>>;
  aiFormControl: Control<AiFormState>;
  aiFormErrors: FieldErrors<AiFormState>;
  campaignFormControl: Control<CampaignFormState>;
  campaignFormErrors: FieldErrors<CampaignFormState>;
  campaignSearch: string;
  setCampaignSearch: Dispatch<SetStateAction<string>>;
  campaignStatusFilter: MarketingCampaignStatus | "ALL";
  setCampaignStatusFilter: Dispatch<SetStateAction<MarketingCampaignStatus | "ALL">>;
  selectedCampaignId: string | null;
  campaignDetails: MarketingCampaignDetails | null;
  testEmail: string;
  setTestEmail: Dispatch<SetStateAction<string>>;
  scheduleAt: string;
  setScheduleAt: Dispatch<SetStateAction<string>>;
  selectedVariantId: string;
  setSelectedVariantId: Dispatch<SetStateAction<string>>;
  isLoading: boolean;
  error: unknown;
  isSubmitting: boolean;
  createCampaign: () => Promise<void>;
  loadCampaignDetails: (campaignIdValue: string) => Promise<void>;
  generateWithAI: () => Promise<void>;
  submitForReview: () => Promise<void>;
  approveCampaign: () => Promise<void>;
  scheduleCampaign: () => Promise<void>;
  sendTest: () => Promise<void>;
  improveVariantWithAI: () => Promise<void>;
  launchCampaign: (dryRun?: boolean) => Promise<void>;
}

const pipelineCampaignColumns: Array<DataTableColumn<MarketingCampaignListItem>> = [
  {
    id: "campaign",
    header: "Campanha",
    width: "minmax(240px, 1.6fr)",
    render: (campaign) => (
      <span className="mkt-perf-table__name">
        <strong>{campaign.name}</strong>
        <span>{campaignObjectiveLabel(campaign.objective)} - {toLocalDate(campaign.updatedAt)}</span>
      </span>
    )
  },
  {
    id: "status",
    header: "Status",
    width: "0.85fr",
    render: (campaign) => (
      <StatusBadge tone={statusTone(campaign.status)}>
        {campaignStatusLabel(campaign.status)}
      </StatusBadge>
    )
  },
  {
    id: "scheduled",
    header: "Agenda",
    width: "0.95fr",
    render: (campaign) => toLocalDate(campaign.scheduledAt)
  }
];

export function MarketingCampaignsTab({
  dashboard,
  campaigns,
  scheduledCampaigns,
  activeCampaigns,
  audience,
  segments,
  templates,
  isAiAssistantOpen,
  setIsAiAssistantOpen,
  setAiForm,
  aiFormControl,
  aiFormErrors,
  campaignFormControl,
  campaignFormErrors,
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
  isLoading,
  error,
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
}: MarketingCampaignsTabProps) {
  const noSegmentValue = "__no_segment__";
  const noTemplateValue = "__no_template__";
  const noVariantValue = "__no_variant__";

  return (
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
                          "Nutrir commercial com score alto e última interação antiga",
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
                        <AppTextareaField control={aiFormControl} name="objective" label="Objetivo" rows={4} />

                        <AppFormGrid className="marketing-page__grid" columns={2}>
                          <AppTextField control={aiFormControl} name="tone" label="Tom" />
                          <AppTextField control={aiFormControl} name="targetStage" label="Estagio" />
                        </AppFormGrid>

                        <AppTextField control={aiFormControl} name="segmentHint" label="Publico" />
                      </div>
                      <div className="marketing-page__actions shared-actions-row">
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

                <section className="mkt-campaign-composer-grid">
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
                      <AppTextField control={campaignFormControl} name="name" label="Nome" placeholder="Nurture MQL - Q2" />
                      <AppFormGrid className="marketing-page__grid" columns={2}>
                        <AppSelectField<CampaignFormState, "objective", MarketingCampaignObjective>
                          control={campaignFormControl}
                          name="objective"
                          label="Objetivo"
                          options={OBJECTIVE_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                        />
                        <AppSelectField
                          control={campaignFormControl}
                          name="segmentId"
                          label="Segmento"
                          options={[
                            { value: noSegmentValue, label: "Sem segmento" },
                            ...segments.map((segment) => ({ value: segment.id, label: segment.name }))
                          ]}
                          formatValue={(value) => (typeof value === "string" && value.length > 0 ? value : noSegmentValue)}
                          parseValue={(value) => (value === noSegmentValue ? "" : value)}
                        />
                      </AppFormGrid>
                      <AppSelectField
                        control={campaignFormControl}
                        name="templateId"
                        label="Template"
                        options={[
                          { value: noTemplateValue, label: "Comecar do zero" },
                          ...templates.map((template) => ({ value: template.id, label: template.name }))
                        ]}
                        formatValue={(value) => (typeof value === "string" && value.length > 0 ? value : noTemplateValue)}
                        parseValue={(value) => (value === noTemplateValue ? "" : value)}
                      />
                      <AppTextField control={campaignFormControl} name="subject" label="Assunto" placeholder="Seu proximo passo para acelerar entrega" />
                      <AppTextareaField control={campaignFormControl} name="bodyMarkdown" label="Mensagem" rows={8} />
                      <AppTextField control={campaignFormControl} name="description" label="Nota interna" placeholder="Hipotese, publico ou contexto" />
                    </div>
                    <div className="marketing-page__actions shared-actions-row">
                      <Button onClick={() => void createCampaign()} disabled={isSubmitting}>Criar campanha</Button>
                    </div>
                  </article>

                </section>

                <section className="mkt-table-section mkt-table-section--pipeline">
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
                        <AppSelect
                          value={campaignStatusFilter}
                          onValueChange={(value) => setCampaignStatusFilter(value as MarketingCampaignStatus | "ALL")}
                          aria-label="Status"
                          items={STATUS_OPTIONS.map((status) => ({
                            value: status,
                            label: status === "ALL" ? "Todos" : campaignStatusLabel(status)
                          }))}
                        />
                      </FormField>
                    </div>

                    <DataTable<MarketingCampaignListItem>
                      data={campaigns}
                      getRowId={(campaign) => campaign.id}
                      className="mkt-resource-table"
                      responsiveMinWidth="760px"
                      loading={isLoading}
                      loadingState="Carregando campanhas..."
                      error={error}
                      rowClassName={(campaign) => (selectedCampaignId === campaign.id ? "mkt-perf-table__row--active" : undefined)}
                      emptyState={<EmptyState size="compact">Nenhuma campanha no workspace.</EmptyState>}
                      columns={pipelineCampaignColumns}
                      rowActions={{
                        header: "Acoes",
                        width: "0.7fr",
                        render: (campaign) => (
                          <Button size="sm" variant="outline" onClick={() => void loadCampaignDetails(campaign.id)}>
                            Abrir
                          </Button>
                        )
                      }}
                    />
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
                          <AppDateTimePicker value={scheduleAt || null} onChange={(value) => setScheduleAt(value ?? "")} />
                        </FormField>
                        <FormField label="Variante">
                          <AppSelect
                            value={selectedVariantId || noVariantValue}
                            onValueChange={(value) => setSelectedVariantId(value === noVariantValue ? "" : value)}
                            disabled={campaignDetails.variants.length === 0}
                            aria-label="Variante"
                            items={[
                              { value: noVariantValue, label: "Sem variantes", disabled: campaignDetails.variants.length > 0 },
                              ...campaignDetails.variants.map((variant) => ({
                                value: variant.id,
                                label: `${variant.name} - ${variant.subject}`
                              }))
                            ]}
                          />
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
                        {campaignDetails.recentEvents.length === 0 ?(
                          <EmptyState className="mkt-analytics__empty" size="compact">Sem eventos ainda.</EmptyState>
                        ) : null}
                        {campaignDetails.recentEvents.slice(0, 8).map((event, index) => (
                          <div key={`${safeString(event.id) || "event"}-${index}`} className="mkt-history__item">
                            <strong>{safeString(event.headline) || safeString(event.type)}</strong>
                            <span>{toLocalDate(safeString(event.occurredAt))}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <EmptyState
                      className="mkt-empty-inline"
                      title="Selecione uma campanha"
                      description="O historico, testes e ações de envio aparecem aqui."
                      size="compact"
                    />
                  )}
                </article>
              </div>
  );
}
