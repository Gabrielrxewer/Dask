import { Button, StatusBadge } from "@/shared/ui";
import type {
  MarketingAudienceContact,
  MarketingAutomationFlow,
  MarketingCampaignDetails,
  MarketingCampaignListItem,
  MarketingDashboard,
  MarketingSignal
} from "@/modules/marketing";
import {
  SIGNAL_TYPE_LABELS,
  campaignObjectiveLabel,
  campaignStatusLabel,
  fmtNum,
  fmtPct,
  signalPriority,
  signalPriorityLabel,
  statusTone,
  timeAgo,
  toLocalDate,
  type MarketingTab
} from "./marketing-page.model";

interface MarketingOverviewTabProps {
  dashboard: MarketingDashboard | null;
  signalUnreadCount: number;
  campaigns: MarketingCampaignListItem[];
  audience: MarketingAudienceContact[];
  flows: MarketingAutomationFlow[];
  reviewCampaigns: MarketingCampaignListItem[];
  scheduledCampaigns: MarketingCampaignListItem[];
  signals: MarketingSignal[];
  analyticsInsights: string[];
  setTab: (tab: MarketingTab) => void;
  loadCampaignDetails: (campaignIdValue: string) => Promise<void>;
}

export function MarketingOverviewTab({
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
}: MarketingOverviewTabProps) {
  return (
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
  );
}