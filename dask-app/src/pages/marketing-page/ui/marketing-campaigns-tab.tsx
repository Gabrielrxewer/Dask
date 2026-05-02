import type { Dispatch, SetStateAction } from "react";
import { Button, FormField, Select, StatusBadge, Textarea, TextInput } from "@/shared/ui";
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
  aiForm: AiFormState;
  setAiForm: Dispatch<SetStateAction<AiFormState>>;
  campaignForm: CampaignFormState;
  setCampaignForm: Dispatch<SetStateAction<CampaignFormState>>;
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
}: MarketingCampaignsTabProps) {
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

                    <div className="marketing-page__actions shared-actions-row">
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
  );
}
