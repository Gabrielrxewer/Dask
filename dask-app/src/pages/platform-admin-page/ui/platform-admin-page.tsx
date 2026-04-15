import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { routePaths } from "@/app/router/route-paths";
import { useAuth } from "@/features/auth";
import { adminTelemetryService } from "@/pages/platform-admin-page/api/admin-telemetry-service";
import type { AdminTelemetryOverview } from "@/pages/platform-admin-page/model/types";
import "./platform-admin-page.css";

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatHour(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

type LatencyTone = "good" | "fair" | "poor" | "bad";

function getLatencyTone(valueMs: number): LatencyTone {
  if (!Number.isFinite(valueMs) || valueMs <= 0) {
    return "fair";
  }

  // Practical API observability baseline:
  // <=200ms good, <=500ms fair, <=1000ms poor, >1000ms bad.
  if (valueMs <= 200) {
    return "good";
  }
  if (valueMs <= 500) {
    return "fair";
  }
  if (valueMs <= 1000) {
    return "poor";
  }
  return "bad";
}

function formatLatencyMs(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "0ms";
  }

  if (value < 1) {
    return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 12 })}ms`;
  }

  if (value < 100) {
    return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}ms`;
  }

  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}ms`;
}

function maxOf(values: number[]): number {
  return values.length > 0 ? Math.max(...values) : 0;
}

function EmptyState({ text }: { text: string }) {
  return <div className="platform-admin-page__empty">{text}</div>;
}

function InfoHint({ label, detail }: { label: string; detail: string }) {
  return (
    <span className="platform-admin-page__info-wrap">
      <button
        type="button"
        className="platform-admin-page__info-button"
        aria-label={`Informacoes sobre ${label}`}
      >
        i
      </button>
      <span className="platform-admin-page__info-tooltip" role="tooltip">
        {detail}
      </span>
    </span>
  );
}

export function PlatformAdminPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<AdminTelemetryOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const authHealthTone = useMemo(() => {
    const refreshFailures = overview?.auth.refreshFailures24h ?? 0;
    const lockedUsers = overview?.users.lockedNow ?? 0;

    if (refreshFailures > 40 || lockedUsers > 10) {
      return "alert";
    }
    if (refreshFailures > 10 || lockedUsers > 3) {
      return "warn";
    }
    return "ok";
  }, [overview?.auth.refreshFailures24h, overview?.users.lockedNow]);

  useEffect(() => {
    if (!user?.isPlatformAdmin) {
      setIsLoading(false);
      return;
    }

    let active = true;

    const fetchOverview = async (silent = false) => {
      if (silent) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const next = await adminTelemetryService.getOverview();
        if (!active) {
          return;
        }
        setOverview(next);
        setErrorMessage(null);
      } catch {
        if (!active) {
          return;
        }
        setErrorMessage("Nao foi possivel carregar a telemetria agora.");
      } finally {
        if (!active) {
          return;
        }
        setIsLoading(false);
        setIsRefreshing(false);
      }
    };

    void fetchOverview();
    const interval = window.setInterval(() => {
      void fetchOverview(true);
    }, 30000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [user?.isPlatformAdmin]);

  if (!user?.isPlatformAdmin) {
    return (
      <section className="platform-admin-page platform-admin-page--blocked">
        <div className="platform-admin-page__card">
          <p className="platform-admin-page__badge">Acesso restrito</p>
          <h1>Pagina administrativa da plataforma Dask</h1>
          <p>
            Seu usuario esta autenticado, mas nao possui permissao de admin da plataforma.
            Esta area e exclusiva para operacoes administrativas globais.
          </p>
          <div className="platform-admin-page__actions">
            <Link to={routePaths.workspaceEntry}>Voltar para o app</Link>
          </div>
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="platform-admin-page">
        <div className="platform-admin-page__card">
          <p className="platform-admin-page__badge">Admin da plataforma</p>
          <h1>Carregando painel de telemetria...</h1>
        </div>
      </section>
    );
  }

  if (!overview) {
    return (
      <section className="platform-admin-page">
        <div className="platform-admin-page__card">
          <p className="platform-admin-page__badge">Admin da plataforma</p>
          <h1>Painel administrativo Dask</h1>
          <p>{errorMessage ?? "Sem dados para exibir no momento."}</p>
        </div>
      </section>
    );
  }

  const authChannels = [
    { label: "Senha", value: overview.auth.channel.password },
    { label: "Social", value: overview.auth.channel.social }
  ];
  const authChannelMax = maxOf(authChannels.map(item => item.value));
  const peakMax = maxOf(overview.traffic.peakHours24h.map(item => item.total));
  const statusMax = maxOf(overview.backend.statusBuckets24h.map(item => item.total));
  const domainMax = maxOf(overview.product.topDomainEvents7d.map(item => item.total));
  const latencyP95Tone = getLatencyTone(overview.backend.latency24h.p95Ms);
  const latencyAvgTone = getLatencyTone(overview.backend.latency24h.avgMs);
  const latencyP99Tone = getLatencyTone(overview.backend.latency24h.p99Ms);

  return (
    <section className="platform-admin-page">
      <div className="platform-admin-page__shell">
        <header className="platform-admin-page__hero">
          <div>
            <p className="platform-admin-page__badge">Dask Platform Observatory</p>
            <h1>Telemetria operacional em tempo real</h1>
            <p>
              Painel administrativo com sinais de autenticacao, uso, estabilidade, filas e AI para
              leitura rapida e tomada de decisao.
            </p>
          </div>
          <div className="platform-admin-page__hero-actions">
            <span className={`platform-admin-page__status-chip platform-admin-page__status-chip--${authHealthTone}`}>
              {authHealthTone === "ok" ? "Auth estavel" : authHealthTone === "warn" ? "Auth em atencao" : "Auth critica"}
            </span>
            <button
              type="button"
              className="platform-admin-page__refresh"
              onClick={() => {
                setIsRefreshing(true);
                adminTelemetryService
                  .getOverview()
                  .then(setOverview)
                  .catch(() => setErrorMessage("Nao foi possivel atualizar agora."))
                  .finally(() => setIsRefreshing(false));
              }}
              disabled={isRefreshing}
            >
              {isRefreshing ? "Atualizando..." : "Atualizar agora"}
            </button>
          </div>
        </header>

        <section className="platform-admin-page__kpi-grid">
          <article className="platform-admin-page__kpi-card">
            <div className="platform-admin-page__kpi-head">
              <span>Usuarios totais</span>
              <InfoHint
                label="Usuarios totais"
                detail="Numero total de usuarios cadastrados na plataforma, incluindo ativos e inativos."
              />
            </div>
            <strong>{formatCompact(overview.users.total)}</strong>
            <small>{overview.users.verified} verificados</small>
          </article>
          <article className="platform-admin-page__kpi-card">
            <div className="platform-admin-page__kpi-head">
              <span>Ativos (7d)</span>
              <InfoHint
                label="Ativos 7 dias"
                detail="Usuarios unicos que tiveram atividade recente. A linha inferior mostra os ativos nas ultimas 24h."
              />
            </div>
            <strong>{formatCompact(overview.users.activeByPeriod.week)}</strong>
            <small>{overview.users.activeByPeriod.day} no dia</small>
          </article>
          <article className="platform-admin-page__kpi-card">
            <div className="platform-admin-page__kpi-head">
              <span>Logins (30d)</span>
              <InfoHint
                label="Logins 30 dias"
                detail="Volume de autenticacoes bem-sucedidas no mes. A linha inferior exibe o recorte de 24h."
              />
            </div>
            <strong>{formatCompact(overview.auth.loginByPeriod.month)}</strong>
            <small>{overview.auth.loginByPeriod.day} nas ultimas 24h</small>
          </article>
          <article className={`platform-admin-page__kpi-card platform-admin-page__kpi-card--latency-${latencyP95Tone}`}>
            <div className="platform-admin-page__kpi-head">
              <span>Latencia p95</span>
              <InfoHint
                label="Latencia p95"
                detail="Tempo em milissegundos abaixo do qual 95% das requisicoes finalizaram no periodo de 24h."
              />
            </div>
            <strong>{formatLatencyMs(overview.backend.latency24h.p95Ms)}</strong>
            <small>p99 {formatLatencyMs(overview.backend.latency24h.p99Ms)}</small>
          </article>
          <article className="platform-admin-page__kpi-card">
            <div className="platform-admin-page__kpi-head">
              <span>IA (falha 24h)</span>
              <InfoHint
                label="Falha de IA 24h"
                detail="Taxa de execucoes com erro nos fluxos de IA. A linha inferior mostra falhas absolutas e total de runs."
              />
            </div>
            <strong>{formatPct(overview.ai.failureRate24h)}</strong>
            <small>{overview.ai.failed24h} falhas / {overview.ai.runs24h} runs</small>
          </article>
          <article className="platform-admin-page__kpi-card">
            <div className="platform-admin-page__kpi-head">
              <span>Outbox pendente</span>
              <InfoHint
                label="Outbox pendente"
                detail="Eventos aguardando processamento/entrega. A linha inferior destaca itens atualmente em retry."
              />
            </div>
            <strong>{formatCompact(overview.outbox.pending)}</strong>
            <small>{overview.outbox.retryPending} em retry</small>
          </article>
        </section>

        <section className="platform-admin-page__grid-two">
          <article className="platform-admin-page__panel platform-admin-page__panel--backend">
            <header>
              <div className="platform-admin-page__panel-title">
                <h2>Autenticacao</h2>
                <InfoHint
                  label="Autenticacao"
                  detail="Compara volume por canal de login e mostra sinais de risco operacional, como lock, refresh invalido e sessoes simultaneas."
                />
              </div>
              <p>Canais de acesso e friccao de login</p>
            </header>
            <div className="platform-admin-page__bar-list">
              {authChannels.map(channel => {
                const width = authChannelMax > 0 ? Math.max((channel.value / authChannelMax) * 100, 4) : 0;
                return (
                  <div key={channel.label} className="platform-admin-page__bar-row">
                    <span>{channel.label}</span>
                    <div className="platform-admin-page__bar-track">
                      <i style={{ width: `${width}%` }} />
                    </div>
                    <strong>{channel.value}</strong>
                  </div>
                );
              })}
            </div>
            <div className="platform-admin-page__mini-metrics">
              <p>Refresh com falha (24h): <strong>{overview.auth.refreshFailures24h}</strong></p>
              <p>Locks ativos: <strong>{overview.users.lockedNow}</strong></p>
              <p>Logouts (24h): <strong>{overview.auth.logout24h}</strong></p>
              <p>Sessoes simultaneas max: <strong>{overview.auth.concurrentSessions.max}</strong></p>
            </div>
          </article>

          <article className="platform-admin-page__panel">
            <header>
              <div className="platform-admin-page__panel-title">
                <h2>Pico de trafego (24h)</h2>
                <InfoHint
                  label="Pico de trafego"
                  detail="Lista as horas com maior numero de requisicoes HTTP nas ultimas 24h, ja convertidas para o fuso configurado do painel."
                />
              </div>
              <p>Horas com maior volume de requests ({overview.traffic.timezone})</p>
            </header>
            {overview.traffic.peakHours24h.length === 0 ? (
              <EmptyState text="Sem dados de pico nas ultimas 24h." />
            ) : (
              <div className="platform-admin-page__bar-list">
                {overview.traffic.peakHours24h.map(item => {
                  const width = peakMax > 0 ? Math.max((item.total / peakMax) * 100, 4) : 0;
                  return (
                    <div key={item.hour} className="platform-admin-page__bar-row">
                      <span>{formatHour(item.hour)}</span>
                      <div className="platform-admin-page__bar-track">
                        <i style={{ width: `${width}%` }} />
                      </div>
                      <strong>{item.total}</strong>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        </section>

        <section className="platform-admin-page__grid-two">
          <article className="platform-admin-page__panel">
            <header>
              <div className="platform-admin-page__panel-title">
                <h2>Saude do backend</h2>
                <InfoHint
                  label="Saude do backend"
                  detail="Distribuicao de respostas por classe HTTP e indicadores de latencia para monitorar estabilidade e degradacoes."
                />
              </div>
              <p>Distribuicao de respostas por classe HTTP</p>
            </header>
            <div className="platform-admin-page__bar-list">
              {overview.backend.statusBuckets24h.map(bucket => {
                const width = statusMax > 0 ? Math.max((bucket.total / statusMax) * 100, 4) : 0;
                return (
                  <div key={bucket.bucket} className="platform-admin-page__bar-row">
                    <span>{bucket.bucket}</span>
                    <div className="platform-admin-page__bar-track">
                      <i style={{ width: `${width}%` }} />
                    </div>
                    <strong>{bucket.total}</strong>
                  </div>
                );
              })}
            </div>
            <div className="platform-admin-page__mini-metrics platform-admin-page__mini-metrics--backend">
              <div className={`platform-admin-page__metric-pill platform-admin-page__metric-pill--latency-${latencyAvgTone}`}>
                <span>Latencia media</span>
                <strong>{formatLatencyMs(overview.backend.latency24h.avgMs)}</strong>
              </div>
              <div className={`platform-admin-page__metric-pill platform-admin-page__metric-pill--latency-${latencyP95Tone}`}>
                <span>p95</span>
                <strong>{formatLatencyMs(overview.backend.latency24h.p95Ms)}</strong>
              </div>
              <div className={`platform-admin-page__metric-pill platform-admin-page__metric-pill--latency-${latencyP99Tone}`}>
                <span>p99</span>
                <strong>{formatLatencyMs(overview.backend.latency24h.p99Ms)}</strong>
              </div>
            </div>
          </article>

          <article className="platform-admin-page__panel">
            <header>
              <div className="platform-admin-page__panel-title">
                <h2>Eventos de produto (7d)</h2>
                <InfoHint
                  label="Eventos de produto"
                  detail="Acoes de dominio mais executadas na ultima semana, uteis para entender adesao real e valor por funcionalidade."
                />
              </div>
              <p>Acoes de dominio mais executadas</p>
            </header>
            {overview.product.topDomainEvents7d.length === 0 ? (
              <EmptyState text="Sem eventos de dominio no periodo." />
            ) : (
              <div className="platform-admin-page__bar-list">
                {overview.product.topDomainEvents7d.map(event => {
                  const width = domainMax > 0 ? Math.max((event.total / domainMax) * 100, 3) : 0;
                  return (
                    <div key={event.eventName} className="platform-admin-page__bar-row">
                      <span title={event.eventName}>
                        {event.eventName.length > 28 ? `${event.eventName.slice(0, 28)}...` : event.eventName}
                      </span>
                      <div className="platform-admin-page__bar-track">
                        <i style={{ width: `${width}%` }} />
                      </div>
                      <strong>{event.total}</strong>
                    </div>
                  );
                })}
              </div>
            )}
          </article>
        </section>

        <section className="platform-admin-page__grid-two">
          <article className="platform-admin-page__panel">
            <header>
              <div className="platform-admin-page__panel-title">
                <h2>Motivos de falha de login (24h)</h2>
                <InfoHint
                  label="Falhas de login"
                  detail="Top causas de tentativa sem sucesso. Ajuda a separar problema de UX, credencial e possivel abuso."
                />
              </div>
              <p>Top causas para reduzir friccao e risco</p>
            </header>
            {overview.auth.failedLoginReasons24h.length === 0 ? (
              <EmptyState text="Nenhuma falha de login registrada no periodo." />
            ) : (
              <ul className="platform-admin-page__reason-list">
                {overview.auth.failedLoginReasons24h.map(item => (
                  <li key={item.reason}>
                    <span>{item.reason}</span>
                    <strong>{item.attempts}</strong>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="platform-admin-page__panel">
            <header>
              <div className="platform-admin-page__panel-title">
                <h2>Contexto da plataforma</h2>
                <InfoHint
                  label="Contexto da plataforma"
                  detail="Resumo de capacidade e operacao: base de workspaces, quantidade de admins e saude da fila outbox."
                />
              </div>
              <p>Visao resumida do estado atual</p>
            </header>
            <ul className="platform-admin-page__reason-list">
              <li>
                <span>Workspaces totais</span>
                <strong>{overview.workspaces.total}</strong>
              </li>
              <li>
                <span>Admins de plataforma</span>
                <strong>{overview.users.platformAdmins}</strong>
              </li>
              <li>
                <span>Outbox dead-letter</span>
                <strong>{overview.outbox.deadLetter}</strong>
              </li>
              <li>
                <span>Outbox item mais antigo</span>
                <strong>
                  {overview.outbox.oldestPendingAgeSeconds === null
                    ? "-"
                    : `${Math.round(overview.outbox.oldestPendingAgeSeconds / 60)} min`}
                </strong>
              </li>
            </ul>
          </article>
        </section>

        {errorMessage ? <p className="platform-admin-page__error">{errorMessage}</p> : null}
      </div>
    </section>
  );
}
