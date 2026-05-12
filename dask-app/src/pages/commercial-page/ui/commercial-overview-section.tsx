import type { Task, TaskStatus } from "@/entities/task";
import { getCustomerDisplayName, type Customer } from "@/modules/workspace";
import { formatMoneyCompact } from "@/shared/lib/money";
import { EmptyState, MetricCard } from "@/shared/ui";
import { IconCheck, IconDoc, IconTrendUp, IconUsers } from "./commercial-page-icons";
import {
  CUSTOMER_STATUS_LABELS,
  getNumberField,
  getTextField,
  type FunnelData,
  type PendingItems,
  type PipelineMetrics,
  type SourceBreakdown,
  type StatusDistribution
} from "./commercial-page.model";

export function CommercialOverviewSection({
  pipelineMetrics,
  funnelData,
  statusDistribution,
  sourceBreakdown,
  pendingItems,
  commercialTasks,
  customers,
  customersById,
  boardStatuses,
  statusLabelById
}: {
  pipelineMetrics: PipelineMetrics;
  funnelData: FunnelData;
  statusDistribution: StatusDistribution;
  sourceBreakdown: SourceBreakdown;
  pendingItems: PendingItems;
  commercialTasks: Task[];
  customers: Customer[];
  customersById: Map<string, Customer>;
  boardStatuses: TaskStatus[];
  statusLabelById: Map<string, string>;
}) {
  return (
    <>
      <div className="commercial-kpi-strip">
        <MetricCard
          label="Pipeline total"
          value={formatMoneyCompact(pipelineMetrics.totalPipelineValue)}
          subtitle={`${pipelineMetrics.activeWorkItems} oportunidades ativas`}
          accent="blue"
          icon={<IconTrendUp />}
        />
        <MetricCard
          label="Receita ganha"
          value={formatMoneyCompact(pipelineMetrics.wonValue)}
          subtitle={`Ticket médio ${formatMoneyCompact(pipelineMetrics.avgDealSize)}`}
          accent="green"
          icon={<IconCheck />}
        />
        <MetricCard
          label="Taxa de conversão"
          value={`${pipelineMetrics.conversionRate}%`}
          subtitle={`${pipelineMetrics.linkedCount} de ${pipelineMetrics.totalWorkItems} commercial vinculados`}
          accent="purple"
          icon={<IconUsers />}
        />
        <MetricCard
          label="Aprovação de propostas"
          value={`${pipelineMetrics.proposalWinRate}%`}
          subtitle={`${pipelineMetrics.approvedProposals} aprovadas de ${pipelineMetrics.proposals}`}
          accent="amber"
          icon={<IconDoc />}
        />
      </div>

      <section className="commercial-funnel-section">
        <header className="commercial-section-header">
          <span className="commercial-page__eyebrow">Funil de vendas</span>
          <span className="commercial-section-header__sub">Progressão por perspectiva</span>
        </header>
        <div className="commercial-funnel">
          {funnelData.map((stage, i) => (
            <div key={stage.key} className="commercial-funnel__item">
              {i > 0 && stage.conversionFromPrev !== null ? (
                <div className="commercial-funnel__connector">
                  <span className="commercial-funnel__connector-rate" style={{ color: stage.conversionFromPrev >= 50 ? "var(--success)" : stage.conversionFromPrev >= 25 ? "var(--warning)" : "var(--danger)" }}>
                    {stage.conversionFromPrev}%
                  </span>
                  <span className="commercial-funnel__connector-label">conversão</span>
                </div>
              ) : null}
              <div className="commercial-funnel__stage">
                <div className="commercial-funnel__stage-meta">
                  <span className="commercial-funnel__stage-label">{stage.label}</span>
                  <div className="commercial-funnel__stage-values">
                    <strong className="commercial-funnel__stage-count">{stage.count}</strong>
                    {stage.value > 0 && <span className="commercial-funnel__stage-value">{formatMoneyCompact(stage.value)}</span>}
                  </div>
                </div>
                <div className="commercial-funnel__bar-track">
                  <div
                    className="commercial-funnel__bar-fill"
                    style={{ width: `${Math.max(stage.barPct, stage.count > 0 ? 4 : 0)}%`, background: stage.color }}
                    aria-label={`${stage.count} commercial`}
                  />
                </div>
                <span className="commercial-funnel__stage-pct">{stage.globalPct}%</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="commercial-analytics-grid">
        <section className="commercial-chart-card">
          <header className="commercial-section-header">
            <span className="commercial-page__eyebrow">Distribuição por status</span>
          </header>
          {statusDistribution.length === 0 ? (
            <EmptyState className="commercial-chart-card__empty" size="compact">Nenhum workItem registrado.</EmptyState>
          ) : (
            <div className="commercial-status-chart">
              {statusDistribution.map((status) => (
                <div key={status.id} className="commercial-status-row">
                  <div className="commercial-status-row__label">
                    <span className="commercial-status-dot" style={{ background: status.dot }} />
                    <span className="commercial-status-name">{status.label}</span>
                  </div>
                  <div className="commercial-status-bar-track">
                    <div
                      className="commercial-status-bar-fill"
                      style={{ width: `${Math.max(status.barPct, status.count > 0 ? 3 : 0)}%`, background: status.dot }}
                    />
                  </div>
                  <div className="commercial-status-row__right">
                    <span className="commercial-status-count">{status.count}</span>
                    {status.value > 0 && <span className="commercial-status-value">{formatMoneyCompact(status.value)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="commercial-chart-card">
          <header className="commercial-section-header">
            <span className="commercial-page__eyebrow">Origem dos commercial</span>
          </header>
          {sourceBreakdown.length === 0 ? (
            <EmptyState className="commercial-chart-card__empty" size="compact">Nenhuma origem registrada.</EmptyState>
          ) : (
            <div className="commercial-status-chart">
              {sourceBreakdown.map((src) => (
                <div key={src.label} className="commercial-status-row">
                  <div className="commercial-status-row__label">
                    <span className="commercial-source-dot" />
                    <span className="commercial-status-name">{src.label}</span>
                  </div>
                  <div className="commercial-status-bar-track">
                    <div className="commercial-status-bar-fill commercial-status-bar-fill--source" style={{ width: `${Math.max(src.barPct, src.count > 0 ? 3 : 0)}%` }} />
                  </div>
                  <div className="commercial-status-row__right">
                    <span className="commercial-status-count">{src.count}</span>
                    {src.value > 0 && <span className="commercial-status-value">{formatMoneyCompact(src.value)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {pendingItems.length > 0 && (
        <section className="commercial-pending-section">
          <header className="commercial-section-header">
            <span className="commercial-page__eyebrow">Ações pendentes</span>
            <span className="commercial-pending-badge">{pendingItems.length}</span>
          </header>
          <div className="commercial-pending-grid">
            {pendingItems.map((item) => (
              <div key={item.id} className={`commercial-pending-item commercial-pending-item--${item.urgency}`}>
                <span className="commercial-pending-urgency" aria-hidden="true">
                  {item.urgency === "high" ? "●" : item.urgency === "medium" ? "◐" : "○"}
                </span>
                <div className="commercial-pending-content">
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="commercial-analytics-grid commercial-analytics-grid--wide">
        <section className="commercial-chart-card">
          <header className="commercial-section-header">
            <span className="commercial-page__eyebrow">Comercial recentes</span>
          </header>
          {commercialTasks.length === 0 ? (
            <EmptyState className="commercial-chart-card__empty" size="compact">Nenhum workItem registrado.</EmptyState>
          ) : (
            <ul className="commercial-activity-list">
              {commercialTasks.slice(0, 6).map((task) => {
                const customer = customersById.get(getTextField(task, "customerId"));
                const value = getNumberField(task, "estimatedValue");
                return (
                  <li key={task.id} className="commercial-activity-item">
                    <span className="commercial-activity-dot" style={{ background: boardStatuses.find((s) => s.id === task.status)?.dot ?? "var(--commercial-accent)" }} />
                    <div className="commercial-activity-main">
                      <strong>{task.title}</strong>
                      <span>{customer ? getCustomerDisplayName(customer) : getTextField(task, "companyName") || "Sem empresa"}</span>
                    </div>
                    <div className="commercial-activity-right">
                      <span className="commercial-activity-status">{statusLabelById.get(task.status) ?? task.status}</span>
                      {value !== null && <span className="commercial-activity-value">{formatMoneyCompact(value)}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="commercial-chart-card">
          <header className="commercial-section-header">
            <span className="commercial-page__eyebrow">Clientes ativos</span>
            <span className="commercial-section-header__sub">{pipelineMetrics.activeCustomers} de {pipelineMetrics.customers}</span>
          </header>
          {customers.length === 0 ? (
            <EmptyState className="commercial-chart-card__empty" size="compact">Nenhum cliente cadastrado.</EmptyState>
          ) : (
            <ul className="commercial-activity-list">
              {customers.filter((c) => c.status === "active").concat(customers.filter((c) => c.status !== "active")).slice(0, 6).map((customer) => {
                const linked = commercialTasks.filter((t) => getTextField(t, "customerId") === customer.id).length;
                return (
                  <li key={customer.id} className="commercial-activity-item">
                    <div className="commercial-customer-avatar">
                      {customer.logoUrl
                        ? <img src={customer.logoUrl} alt="" />
                        : <span>{getCustomerDisplayName(customer).slice(0, 2).toUpperCase()}</span>}
                    </div>
                    <div className="commercial-activity-main">
                      <strong>{getCustomerDisplayName(customer)}</strong>
                      <span>{customer.email ?? customer.document ?? "Sem contato"}</span>
                    </div>
                    <div className="commercial-activity-right">
                      <span className={`commercial-customer-status commercial-customer-status--${customer.status}`}>{CUSTOMER_STATUS_LABELS[customer.status]}</span>
                      <span className="commercial-activity-value">{linked} deal{linked !== 1 ? "s" : ""}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
