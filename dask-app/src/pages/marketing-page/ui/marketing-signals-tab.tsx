import type { Dispatch, SetStateAction } from "react";
import type { MarketingSignal, MarketingSignalPriority } from "@/modules/marketing";
import { Button, EmptyState, InlineAlert, LoadingState, ModuleTabs, StatusBadge } from "@/shared/ui";
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

const SIGNAL_FILTER_ITEMS = (["ALL", ...SIGNAL_INBOX_TYPES] as string[]).map((type) => ({
  id: type,
  label: SIGNAL_TYPE_FILTER_LABELS[type] ?? type
}));

function priorityBadgeTone(priority: MarketingSignalPriority) {
  if (priority === "urgent") return "danger";
  if (priority === "high") return "warning";
  if (priority === "medium") return "info";
  return "muted";
}

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
                    <ModuleTabs
                      value={signalTypeFilter}
                      items={SIGNAL_FILTER_ITEMS}
                      onChange={setSignalTypeFilter}
                      className="mkt-inbox__filter-tabs"
                      variant="pill"
                      ariaLabel="Filtrar sinais"
                    />
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
                      <StatusBadge tone="danger" size="sm">{signalUnreadCount} nao lidos</StatusBadge>
                    ) : null}
                    <Button size="sm" variant="outline" onClick={() => void loadSignals()} disabled={isLoadingSignals}>
                      {isLoadingSignals ?"Carregando..." : "Atualizar"}
                    </Button>
                  </div>
                </div>

                {signalsError && signals.length > 0 ?(
                  <InlineAlert
                    tone="danger"
                    title="Falha ao atualizar sinais"
                    action={<Button size="sm" variant="outline" onClick={() => void loadSignals()}>Tentar novamente</Button>}
                  >
                    {signalsError}
                  </InlineAlert>
                ) : null}

                {/* Feed */}
                {(() => {
                  const filtered = signals.filter(
                    (s) => signalTypeFilter === "ALL" || s.type === signalTypeFilter
                  );

                  if (isLoadingSignals && signals.length === 0) {
                    return (
                      <LoadingState
                        className="mkt-state mkt-state--loading"
                        text="Carregando sinais"
                        animation="marketing"
                      />
                    );
                  }

                  if (signalsError && signals.length === 0) {
                    return (
                      <EmptyState
                        className="mkt-state mkt-state--error"
                        icon={<span className="mkt-state__icon" />}
                        title="Não foi possível carregar os sinais"
                        description="A caixa de sinais encontrou uma falha. Isso não significa que o inbox esteja vazio."
                        action={<Button size="sm" variant="outline" onClick={() => void loadSignals()}>Tentar novamente</Button>}
                      >
                        <small>{signalsError}</small>
                      </EmptyState>
                    );
                  }

                  if (filtered.length === 0) {
                    return (
                      <EmptyState
                        className="mkt-state"
                        icon={<span className="mkt-state__icon" />}
                        title={signals.length === 0 ?"Nenhum sinal encontrado" : "Nenhum sinal neste filtro"}
                        description={
                          signals.length === 0
                            ?"Quando houver cliques, aberturas, bounces ou mudanças de score, eles aparecerão aqui."
                            : "Ajuste os filtros para ver outros tipos de evento."
                        }
                      />
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
                                  <StatusBadge tone={priorityBadgeTone(topPriority)} size="sm">{signalPriorityLabel(topPriority)}</StatusBadge>
                                  <StatusBadge tone="info" size="sm">Score {lead?.score ?? "-"}</StatusBadge>
                                  <StatusBadge tone="muted" size="sm">{group.length} sinal{group.length > 1 ?"is" : ""}</StatusBadge>
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
                                        <Button size="sm" variant="outline" onClick={() => void handleSignalAction(s, 'seen')}>
                                          Marcar visto
                                        </Button>
                                      ) : null}
                                      {!s.dismissedAt ?(
                                        <Button size="sm" variant="ghost" onClick={() => void handleSignalAction(s, 'dismissed')}>
                                          Ignorar
                                        </Button>
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
                                <Button size="sm" variant="outline" onClick={() => setTab("audience")}>
                                  Abrir lead
                                </Button>
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => {
                                    setMessage(`Tarefa criada para ${lead?.fullName ?? "lead"} — acesse o board para gerenciar.`);
                                    setTab("overview");
                                  }}
                                >
                                  Criar tarefa de follow-up
                                </Button>
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
                                <StatusBadge tone={priorityBadgeTone(priority)} size="sm">
                                  {signalPriorityLabel(priority)}
                                </StatusBadge>
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
                                  <StatusBadge tone={Number(signal.payload.delta ?? 0) > 0 ? "success" : "danger"} size="sm">
                                    {Number(signal.payload.delta ?? 0) > 0 ?"+" : ""}{String(signal.payload.delta ?? "?")}
                                  </StatusBadge>
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
                                  <Button size="sm" variant="outline" onClick={() => void handleSignalAction(signal, 'seen')}>
                                    Marcar visto
                                  </Button>
                                ) : null}
                                {!signal.dismissedAt ?(
                                  <Button size="sm" variant="ghost" onClick={() => void handleSignalAction(signal, 'dismissed')}>
                                    Ignorar
                                  </Button>
                                ) : null}
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => {
                                    void handleSignalAction(signal, 'seen');
                                    setMessage(`Tarefa criada para ${signal.lead?.fullName ?? "lead"} — acesse o board para gerenciar.`);
                                    setTab("overview");
                                  }}
                                >
                                  Criar follow-up
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    void handleSignalAction(signal, 'seen');
                                    setTab("audience");
                                  }}
                                >
                                  Abrir lead
                                </Button>
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
