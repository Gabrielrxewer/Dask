import { useState } from "react";
import type { CreateMarketingFollowUpValues, MarketingSignal, MarketingSignalPriority } from "@/modules/marketing";
import { Button, EmptyState, InlineAlert, LoadingState, ModuleTabs, StatusBadge } from "@/shared/ui";
import { CreateFollowUpDialog } from "./create-follow-up-dialog";
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
  isCreatingFollowUp: boolean;
  signalsError: string;
  signalTypeFilter: string;
  signalShowDismissed: boolean;
  signalGroupByWorkItem: boolean;
  setSignalTypeFilter: (type: string) => void;
  setSignalShowDismissed: (showDismissed: boolean) => void;
  setSignalGroupByWorkItem: (groupByWorkItem: boolean) => void;
  setTab: (tab: MarketingTab) => void;
  loadSignals: () => Promise<void>;
  handleSignalAction: (signal: MarketingSignal, action: "seen" | "dismissed") => Promise<void>;
  createFollowUp: (input: CreateMarketingFollowUpValues) => Promise<void>;
}

export function MarketingSignalsTab({
  signalUnreadCount,
  signals,
  isLoadingSignals,
  isCreatingFollowUp,
  signalsError,
  signalTypeFilter,
  signalShowDismissed,
  signalGroupByWorkItem,
  setSignalTypeFilter,
  setSignalShowDismissed,
  setSignalGroupByWorkItem,
  setTab,
  loadSignals,
  handleSignalAction,
  createFollowUp
}: MarketingSignalsTabProps) {
  const [followUpSignal, setFollowUpSignal] = useState<MarketingSignal | null>(null);
  const filtered = signals.filter((signal) => signalTypeFilter === "ALL" || signal.type === signalTypeFilter);

  return (
    <div className="mkt-inbox">
      <CreateFollowUpDialog
        signal={followUpSignal}
        open={Boolean(followUpSignal)}
        isSubmitting={isCreatingFollowUp}
        onOpenChange={(open) => {
          if (!open) setFollowUpSignal(null);
        }}
        onCreate={createFollowUp}
      />

      <section className="mkt-screen-hero mkt-screen-hero--signals">
        <div className="mkt-screen-hero__copy">
          <h2>Inbox de sinais</h2>
          <p>Radar inteligente para priorizar aberturas, cliques, bounces e mudancas de score que pedem acao.</p>
        </div>
        <div className="mkt-screen-hero__stats">
          <div><strong>{fmtNum(signalUnreadCount)}</strong><span>nao lidos</span></div>
          <div><strong>{fmtNum(signals.length)}</strong><span>sinais no radar</span></div>
          <div><strong>{signalGroupByWorkItem ? "por workItem" : "evento"}</strong><span>visualizacao</span></div>
        </div>
      </section>

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
              checked={signalGroupByWorkItem}
              onChange={(event) => setSignalGroupByWorkItem(event.target.checked)}
            />
            Agrupar por workItem
          </label>
          <label className="mkt-inbox__toggle">
            <input
              type="checkbox"
              checked={signalShowDismissed}
              onChange={(event) => setSignalShowDismissed(event.target.checked)}
            />
            Mostrar ignorados
          </label>
        </div>
        <div className="mkt-inbox__meta">
          {signalUnreadCount > 0 ? (
            <StatusBadge tone="danger" size="sm">{signalUnreadCount} nao lidos</StatusBadge>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => void loadSignals()} disabled={isLoadingSignals}>
            {isLoadingSignals ? "Carregando..." : "Atualizar"}
          </Button>
        </div>
      </div>

      {signalsError && signals.length > 0 ? (
        <InlineAlert
          tone="danger"
          title="Falha ao atualizar sinais"
          action={<Button size="sm" variant="outline" onClick={() => void loadSignals()}>Tentar novamente</Button>}
        >
          {signalsError}
        </InlineAlert>
      ) : null}

      {isLoadingSignals && signals.length === 0 ? (
        <LoadingState className="mkt-state mkt-state--loading" text="Carregando sinais" animation="marketing" />
      ) : null}

      {signalsError && signals.length === 0 ? (
        <EmptyState
          className="mkt-state mkt-state--error"
          icon={<span className="mkt-state__icon" />}
          title="Nao foi possivel carregar os sinais"
          description="A caixa de sinais encontrou uma falha. Isso nao significa que o inbox esteja vazio."
          action={<Button size="sm" variant="outline" onClick={() => void loadSignals()}>Tentar novamente</Button>}
        >
          <small>{signalsError}</small>
        </EmptyState>
      ) : null}

      {!isLoadingSignals && !signalsError && filtered.length === 0 ? (
        <EmptyState
          className="mkt-state"
          icon={<span className="mkt-state__icon" />}
          title={signals.length === 0 ? "Nenhum sinal encontrado" : "Nenhum sinal neste filtro"}
          description={
            signals.length === 0
              ? "Quando houver cliques, aberturas, bounces ou mudancas de score, eles aparecerao aqui."
              : "Ajuste os filtros para ver outros tipos de evento."
          }
        />
      ) : null}

      {filtered.length > 0 && signalGroupByWorkItem ? (
        <GroupedSignalsFeed
          signals={filtered}
          isCreatingFollowUp={isCreatingFollowUp}
          onOpenWorkItem={() => setTab("audience")}
          onCreateFollowUp={setFollowUpSignal}
          onSignalAction={handleSignalAction}
        />
      ) : null}

      {filtered.length > 0 && !signalGroupByWorkItem ? (
        <SignalsFeed
          signals={filtered}
          isCreatingFollowUp={isCreatingFollowUp}
          onOpenWorkItem={(signal) => {
            void handleSignalAction(signal, "seen");
            setTab("audience");
          }}
          onCreateFollowUp={(signal) => {
            void handleSignalAction(signal, "seen");
            setFollowUpSignal(signal);
          }}
          onSignalAction={handleSignalAction}
        />
      ) : null}
    </div>
  );
}

function GroupedSignalsFeed({
  signals,
  isCreatingFollowUp,
  onOpenWorkItem,
  onCreateFollowUp,
  onSignalAction
}: {
  signals: MarketingSignal[];
  isCreatingFollowUp: boolean;
  onOpenWorkItem: () => void;
  onCreateFollowUp: (signal: MarketingSignal) => void;
  onSignalAction: (signal: MarketingSignal, action: "seen" | "dismissed") => Promise<void>;
}) {
  const byWorkItem = new Map<string, MarketingSignal[]>();
  for (const signal of signals) {
    const key = signal.workItemId ?? "__no_work_item__";
    byWorkItem.set(key, [...(byWorkItem.get(key) ?? []), signal]);
  }

  return (
    <div className="mkt-inbox__feed">
      {Array.from(byWorkItem.entries()).map(([workItemKey, group]) => {
        const topSignal = group[0]!;
        const workItem = topSignal.workItem;
        const topPriority = group.reduce<MarketingSignalPriority>((best, signal) => {
          const priority = signalPriority(signal);
          const rank: Record<MarketingSignalPriority, number> = { urgent: 3, high: 2, medium: 1, low: 0 };
          return rank[priority] > rank[best] ? priority : best;
        }, "low");

        return (
          <div key={workItemKey} className={`mkt-inbox__group mkt-inbox__group--${topPriority}`}>
            <div className="mkt-inbox__group-head">
              <div className="mkt-inbox__workItem-info">
                <span className="mkt-inbox__workItem-avatar">{(workItem?.contactName ?? "?")[0]?.toUpperCase()}</span>
                <div>
                  <strong className="mkt-inbox__workItem-name">{workItem?.contactName ?? workItem?.email ?? "Contato desconhecido"}</strong>
                  {workItem?.companyName ? <span className="mkt-inbox__workItem-company">{workItem.companyName}</span> : null}
                </div>
              </div>
              <div className="mkt-inbox__group-meta">
                <StatusBadge tone={priorityBadgeTone(topPriority)} size="sm">{signalPriorityLabel(topPriority)}</StatusBadge>
                <StatusBadge tone="info" size="sm">Score {workItem?.score ?? "-"}</StatusBadge>
                <StatusBadge tone="muted" size="sm">{group.length} sinal{group.length > 1 ? "is" : ""}</StatusBadge>
              </div>
            </div>
            <div className="mkt-inbox__group-events">
              {group.map((signal) => (
                <div key={signal.id} className={`mkt-inbox__group-event${signal.seenAt ? " mkt-inbox__group-event--seen" : ""}`}>
                  <span className="mkt-inbox__event-type">{SIGNAL_TYPE_LABELS[signal.type] ?? signal.type}</span>
                  {signal.campaign ? <span className="mkt-inbox__event-campaign">via {signal.campaign.name}</span> : null}
                  <span className="mkt-inbox__event-time">{timeAgo(signal.occurredAt)}</span>
                  <div className="mkt-inbox__event-actions">
                    {!signal.seenAt ? (
                      <Button size="sm" variant="outline" onClick={() => void onSignalAction(signal, "seen")}>
                        Marcar visto
                      </Button>
                    ) : null}
                    {!signal.dismissedAt ? (
                      <Button size="sm" variant="ghost" onClick={() => void onSignalAction(signal, "dismissed")}>
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
              <Button size="sm" variant="outline" onClick={onOpenWorkItem}>
                Abrir item
              </Button>
              <Button
                size="sm"
                variant="primary"
                onClick={() => onCreateFollowUp(topSignal)}
                disabled={!topSignal.workItemId || isCreatingFollowUp}
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

function SignalsFeed({
  signals,
  isCreatingFollowUp,
  onOpenWorkItem,
  onCreateFollowUp,
  onSignalAction
}: {
  signals: MarketingSignal[];
  isCreatingFollowUp: boolean;
  onOpenWorkItem: (signal: MarketingSignal) => void;
  onCreateFollowUp: (signal: MarketingSignal) => void;
  onSignalAction: (signal: MarketingSignal, action: "seen" | "dismissed") => Promise<void>;
}) {
  return (
    <div className="mkt-inbox__feed">
      {signals.map((signal) => {
        const priority = signalPriority(signal);
        return (
          <article key={signal.id} className={`mkt-inbox__card mkt-inbox__card--${priority}${signal.seenAt ? " mkt-inbox__card--seen" : ""}${signal.dismissedAt ? " mkt-inbox__card--dismissed" : ""}`}>
            <div className="mkt-inbox__card-head">
              <div className="mkt-inbox__card-who">
                <span className="mkt-inbox__workItem-avatar">{(signal.workItem?.contactName ?? signal.workItem?.email ?? "?")[0]?.toUpperCase()}</span>
                <div className="mkt-inbox__card-identity">
                  <strong className="mkt-inbox__workItem-name">{signal.workItem?.contactName ?? signal.workItem?.email ?? "Contato desconhecido"}</strong>
                  {signal.workItem?.companyName ? <span className="mkt-inbox__workItem-company">{signal.workItem.companyName}</span> : null}
                </div>
              </div>
              <div className="mkt-inbox__card-meta">
                <StatusBadge tone={priorityBadgeTone(priority)} size="sm">{signalPriorityLabel(priority)}</StatusBadge>
                {!signal.seenAt ? <span className="mkt-inbox__unread-dot" aria-label="Nao lido" /> : null}
              </div>
            </div>

            <div className="mkt-inbox__card-body">
              <div className="mkt-inbox__what">
                <span className="mkt-inbox__event-label">{SIGNAL_TYPE_LABELS[signal.type] ?? signal.type}</span>
                {signal.campaign ? <span className="mkt-inbox__event-context">via {signal.campaign.name}</span> : null}
              </div>
              {signal.headline ? <p className="mkt-inbox__headline">{signal.headline}</p> : null}
              {signal.type === "COMMERCIAL_SCORE_CHANGED" && signal.payload ? (
                <div className="mkt-inbox__score-delta">
                  <span className="mkt-inbox__score-prev">{String(signal.payload.previousScore ?? "?")} pts</span>
                  <span className="mkt-inbox__score-arrow" aria-hidden="true">?</span>
                  <span className="mkt-inbox__score-next">{String(signal.payload.nextScore ?? "?")} pts</span>
                  <StatusBadge tone={Number(signal.payload.delta ?? 0) > 0 ? "success" : "danger"} size="sm">
                    {Number(signal.payload.delta ?? 0) > 0 ? "+" : ""}{String(signal.payload.delta ?? "?")}
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
                {!signal.seenAt ? (
                  <Button size="sm" variant="outline" onClick={() => void onSignalAction(signal, "seen")}>
                    Marcar visto
                  </Button>
                ) : null}
                {!signal.dismissedAt ? (
                  <Button size="sm" variant="ghost" onClick={() => void onSignalAction(signal, "dismissed")}>
                    Ignorar
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => onCreateFollowUp(signal)}
                  disabled={!signal.workItemId || isCreatingFollowUp}
                >
                  Criar follow-up
                </Button>
                <Button size="sm" variant="outline" onClick={() => onOpenWorkItem(signal)}>
                  Abrir item
                </Button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
