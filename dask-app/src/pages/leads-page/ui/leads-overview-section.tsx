import type { Task, TaskStatus } from "@/entities/task";
import { getCustomerDisplayName, type Customer } from "@/modules/workspace";
import { formatMoneyCompact } from "@/shared/lib/money";
import { MetricCard } from "@/shared/ui";
import { IconCheck, IconDoc, IconTrendUp, IconUsers } from "./leads-page-icons";
import {
  CUSTOMER_STATUS_LABELS,
  getNumberField,
  getTextField,
  type FunnelData,
  type PendingItems,
  type PipelineMetrics,
  type SourceBreakdown,
  type StatusDistribution
} from "./leads-page.model";

export function LeadsOverviewSection({
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
      <div className="leads-kpi-strip">
        <MetricCard
          label="Pipeline total"
          value={formatMoneyCompact(pipelineMetrics.totalPipelineValue)}
          subtitle={`${pipelineMetrics.activeLeads} oportunidades ativas`}
          accent="blue"
          icon={<IconTrendUp />}
          className="leads-kpi-card"
        />
        <MetricCard
          label="Receita ganha"
          value={formatMoneyCompact(pipelineMetrics.wonValue)}
          subtitle={`Ticket médio ${formatMoneyCompact(pipelineMetrics.avgDealSize)}`}
          accent="green"
          icon={<IconCheck />}
          className="leads-kpi-card"
        />
        <MetricCard
          label="Taxa de conversão"
          value={`${pipelineMetrics.conversionRate}%`}
          subtitle={`${pipelineMetrics.linkedCount} de ${pipelineMetrics.totalLeads} leads vinculados`}
          accent="purple"
          icon={<IconUsers />}
          className="leads-kpi-card"
        />
        <MetricCard
          label="Aprovação de propostas"
          value={`${pipelineMetrics.proposalWinRate}%`}
          subtitle={`${pipelineMetrics.approvedProposals} aprovadas de ${pipelineMetrics.proposals}`}
          accent="amber"
          icon={<IconDoc />}
          className="leads-kpi-card"
        />
      </div>

      <section className="leads-funnel-section">
        <header className="leads-section-header">
          <span className="leads-page__eyebrow">Funil de vendas</span>
          <span className="leads-section-header__sub">Progressão por perspectiva</span>
        </header>
        <div className="leads-funnel">
          {funnelData.map((stage, i) => (
            <div key={stage.key} className="leads-funnel__item">
              {i > 0 && stage.conversionFromPrev !== null ? (
                <div className="leads-funnel__connector">
                  <span className="leads-funnel__connector-rate" style={{ color: stage.conversionFromPrev >= 50 ? "var(--success)" : stage.conversionFromPrev >= 25 ? "var(--warning)" : "var(--danger)" }}>
                    {stage.conversionFromPrev}%
                  </span>
                  <span className="leads-funnel__connector-label">conversão</span>
                </div>
              ) : null}
              <div className="leads-funnel__stage">
                <div className="leads-funnel__stage-meta">
                  <span className="leads-funnel__stage-label">{stage.label}</span>
                  <div className="leads-funnel__stage-values">
                    <strong className="leads-funnel__stage-count">{stage.count}</strong>
                    {stage.value > 0 && <span className="leads-funnel__stage-value">{formatMoneyCompact(stage.value)}</span>}
                  </div>
                </div>
                <div className="leads-funnel__bar-track">
                  <div
                    className="leads-funnel__bar-fill"
                    style={{ width: `${Math.max(stage.barPct, stage.count > 0 ? 4 : 0)}%`, background: stage.color }}
                    aria-label={`${stage.count} leads`}
                  />
                </div>
                <span className="leads-funnel__stage-pct">{stage.globalPct}%</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="leads-analytics-grid">
        <section className="leads-chart-card">
          <header className="leads-section-header">
            <span className="leads-page__eyebrow">Distribuição por status</span>
          </header>
          {statusDistribution.length === 0 ? (
            <p className="leads-chart-card__empty">Nenhum lead registrado.</p>
          ) : (
            <div className="leads-status-chart">
              {statusDistribution.map((status) => (
                <div key={status.id} className="leads-status-row">
                  <div className="leads-status-row__label">
                    <span className="leads-status-dot" style={{ background: status.dot }} />
                    <span className="leads-status-name">{status.label}</span>
                  </div>
                  <div className="leads-status-bar-track">
                    <div
                      className="leads-status-bar-fill"
                      style={{ width: `${Math.max(status.barPct, status.count > 0 ? 3 : 0)}%`, background: status.dot }}
                    />
                  </div>
                  <div className="leads-status-row__right">
                    <span className="leads-status-count">{status.count}</span>
                    {status.value > 0 && <span className="leads-status-value">{formatMoneyCompact(status.value)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="leads-chart-card">
          <header className="leads-section-header">
            <span className="leads-page__eyebrow">Origem dos leads</span>
          </header>
          {sourceBreakdown.length === 0 ? (
            <p className="leads-chart-card__empty">Nenhuma origem registrada.</p>
          ) : (
            <div className="leads-status-chart">
              {sourceBreakdown.map((src) => (
                <div key={src.label} className="leads-status-row">
                  <div className="leads-status-row__label">
                    <span className="leads-source-dot" />
                    <span className="leads-status-name">{src.label}</span>
                  </div>
                  <div className="leads-status-bar-track">
                    <div className="leads-status-bar-fill leads-status-bar-fill--source" style={{ width: `${Math.max(src.barPct, src.count > 0 ? 3 : 0)}%` }} />
                  </div>
                  <div className="leads-status-row__right">
                    <span className="leads-status-count">{src.count}</span>
                    {src.value > 0 && <span className="leads-status-value">{formatMoneyCompact(src.value)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {pendingItems.length > 0 && (
        <section className="leads-pending-section">
          <header className="leads-section-header">
            <span className="leads-page__eyebrow">Ações pendentes</span>
            <span className="leads-pending-badge">{pendingItems.length}</span>
          </header>
          <div className="leads-pending-grid">
            {pendingItems.map((item) => (
              <div key={item.id} className={`leads-pending-item leads-pending-item--${item.urgency}`}>
                <span className="leads-pending-urgency" aria-hidden="true">
                  {item.urgency === "high" ? "●" : item.urgency === "medium" ? "◐" : "○"}
                </span>
                <div className="leads-pending-content">
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="leads-analytics-grid leads-analytics-grid--wide">
        <section className="leads-chart-card">
          <header className="leads-section-header">
            <span className="leads-page__eyebrow">Leads recentes</span>
          </header>
          {commercialTasks.length === 0 ? (
            <p className="leads-chart-card__empty">Nenhum lead registrado.</p>
          ) : (
            <ul className="leads-activity-list">
              {commercialTasks.slice(0, 6).map((task) => {
                const customer = customersById.get(getTextField(task, "customerId"));
                const value = getNumberField(task, "estimatedValue");
                return (
                  <li key={task.id} className="leads-activity-item">
                    <span className="leads-activity-dot" style={{ background: boardStatuses.find((s) => s.id === task.status)?.dot ?? "var(--leads-accent)" }} />
                    <div className="leads-activity-main">
                      <strong>{task.title}</strong>
                      <span>{customer ? getCustomerDisplayName(customer) : getTextField(task, "companyName") || "Sem empresa"}</span>
                    </div>
                    <div className="leads-activity-right">
                      <span className="leads-activity-status">{statusLabelById.get(task.status) ?? task.status}</span>
                      {value !== null && <span className="leads-activity-value">{formatMoneyCompact(value)}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="leads-chart-card">
          <header className="leads-section-header">
            <span className="leads-page__eyebrow">Clientes ativos</span>
            <span className="leads-section-header__sub">{pipelineMetrics.activeCustomers} de {pipelineMetrics.customers}</span>
          </header>
          {customers.length === 0 ? (
            <p className="leads-chart-card__empty">Nenhum cliente cadastrado.</p>
          ) : (
            <ul className="leads-activity-list">
              {customers.filter((c) => c.status === "active").concat(customers.filter((c) => c.status !== "active")).slice(0, 6).map((customer) => {
                const linked = commercialTasks.filter((t) => getTextField(t, "customerId") === customer.id).length;
                return (
                  <li key={customer.id} className="leads-activity-item">
                    <div className="leads-customer-avatar">
                      {customer.logoUrl
                        ? <img src={customer.logoUrl} alt="" />
                        : <span>{getCustomerDisplayName(customer).slice(0, 2).toUpperCase()}</span>}
                    </div>
                    <div className="leads-activity-main">
                      <strong>{getCustomerDisplayName(customer)}</strong>
                      <span>{customer.email ?? customer.document ?? "Sem contato"}</span>
                    </div>
                    <div className="leads-activity-right">
                      <span className={`leads-customer-status leads-customer-status--${customer.status}`}>{CUSTOMER_STATUS_LABELS[customer.status]}</span>
                      <span className="leads-activity-value">{linked} deal{linked !== 1 ? "s" : ""}</span>
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
