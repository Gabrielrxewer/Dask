import type { Dispatch, SetStateAction } from "react";
import type { MarketingSignal, MarketingSignalPriority } from "@/modules/marketing";
import {
  SIGNAL_INBOX_TYPES,
  SIGNAL_TYPE_FILTER_LABELS,
  SIGNAL_TYPE_LABELS,
  fmtNum,
  signalPriority,
  signalPriorityLabel,
  signalSuggestion,
  timeAgo,
  type MarketingTab
} from "./marketing-page.model";

interface MarketingSignalsTabProps {
  signalUnreadCount: number;
  signals: MarketingSignal[];
  isLoadingSignals: boolean;
  signalsError: string;
  signalTypeFilter: string;
  signalShowDismissed: boolean;
  signalGroupByLead: boolean;
  setSignalTypeFilter: (type: string) => void;
  setSignalShowDismissed: (showDismissed: boolean) => void;
  setSignalGroupByLead: (groupByLead: boolean) => void;
  setMessage: Dispatch<SetStateAction<string>>;
  setTab: (tab: MarketingTab) => void;
  loadSignals: () => Promise<void>;
  handleSignalAction: (signal: MarketingSignal, action: "seen" | "dismissed") => Promise<void>;
}

export function MarketingSignalsTab({
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
}: MarketingSignalsTabProps) {
  return (
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
                <div className="mkt-inbox__toolbar shared-surface-panel">
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
                                  <span className="mkt-inbox__score-arrow" aria-hidden="true">?</span>
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
  );
}
