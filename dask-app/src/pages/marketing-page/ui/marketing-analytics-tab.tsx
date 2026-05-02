import type { CSSProperties, Dispatch, MutableRefObject, SetStateAction } from "react";
import type {
  MarketingCampaignAnalytics,
  MarketingCampaignListItem,
  MarketingCampaignObjective,
  MarketingDashboard
} from "@/modules/marketing";
import {
  OBJECTIVE_OPTIONS,
  campaignObjectiveLabel,
  campaignStatusLabel,
  fmtNum,
  fmtPct,
  fmtRevenue,
  statusTone,
  type MarketingTab
} from "./marketing-page.model";

type EnrichedCampaign = MarketingCampaignListItem & {
  sent: number;
  opened: number;
  clicked: number;
  bounced: number;
  openRate: number | null;
  clickRate: number | null;
};

interface MarketingAnalyticsTabProps {
  dashboard: MarketingDashboard | null;
  campaigns: MarketingCampaignListItem[];
  enrichedCampaigns: EnrichedCampaign[];
  analyticsInsights: string[];
  analyticsObjectiveFilter: MarketingCampaignObjective | "ALL";
  isLoadingAnalytics: boolean;
  hasEnoughAnalyticsData: boolean;
  analyticsLoadedRef: MutableRefObject<string>;
  setCampaignAnalyticsMap: Dispatch<SetStateAction<Record<string, MarketingCampaignAnalytics>>>;
  setAnalyticsObjectiveFilter: (objective: MarketingCampaignObjective | "ALL") => void;
  setTab: (tab: MarketingTab) => void;
  loadCampaignDetails: (campaignIdValue: string) => Promise<void>;
}

export function MarketingAnalyticsTab({
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
}: MarketingAnalyticsTabProps) {
  return (
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
                <div className="mkt-analytics__filters shared-surface-panel">
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
                        <div key={stage.label} className={`mkt-funnel__stage${stage.accent ?" mkt-funnel__stage--accent" : ""}`} style={{ "--funnel-w": `${pct}%` } as CSSProperties}>
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
  );
}
