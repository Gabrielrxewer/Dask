import { useMemo } from "react";
import type { Task, TaskStatus } from "@/entities/task";
import { getCustomerDisplayName, type Customer, type WorkspaceDocument } from "@/modules/workspace";
import { formatMoney, formatMoneyCompact } from "@/shared/lib/money";
import { Button, FormField, ResourceSection, ResourceTable, StatusBadge, TextInput } from "@/shared/ui";
import {
  getInitials,
  getNumberField,
  getTextField,
  isApprovedProposal,
  type FilteredLeadMetrics
} from "./leads-page.model";

interface LeadTableRow {
  task: Task;
  customer: Customer | undefined;
  proposal: WorkspaceDocument | undefined;
  contract: WorkspaceDocument | undefined;
  billingStatus: string;
  stageColor: string | undefined;
  leadSubtitle: string;
}

const BILLING_STATUS_LABELS: Record<string, string> = {
  pending: "Gerada",
  paid: "Paga",
  overdue: "Em atraso",
  canceled: "Cancelada",
  failed: "Falhou",
  refunded: "Estornada",
  subscription_active: "Assinatura ativa",
  subscription_canceled: "Assinatura cancelada"
};

export function LeadsListSection({
  filteredTasks,
  filteredLeadMetrics,
  search,
  customersById,
  documentsById,
  boardStatuses,
  statusLabelById,
  resolveCatalogLabel,
  onSearchChange,
  onOpenCustomerDetails,
  onOpenCustomerFromLead,
  onOpenLinkCustomer,
  onCreateCharge,
  onOpenDocs,
  onOpenBoard
}: {
  filteredTasks: Task[];
  filteredLeadMetrics: FilteredLeadMetrics;
  search: string;
  customersById: Map<string, Customer>;
  documentsById: Map<string, WorkspaceDocument>;
  boardStatuses: TaskStatus[];
  statusLabelById: Map<string, string>;
  resolveCatalogLabel: (value: string) => string;
  onSearchChange: (value: string) => void;
  onOpenCustomerDetails: (customerId: string) => void;
  onOpenCustomerFromLead: (task: Task) => void;
  onOpenLinkCustomer: (task: Task) => void;
  onCreateCharge: (task: Task) => void;
  onOpenDocs: () => void;
  onOpenBoard: () => void;
}) {
  const rows = useMemo<LeadTableRow[]>(
    () =>
      filteredTasks.map((task) => ({
        task,
        customer: customersById.get(getTextField(task, "customerId")),
        proposal: documentsById.get(getTextField(task, "proposalId")),
        contract: documentsById.get(getTextField(task, "contractId")),
        billingStatus: getTextField(task, "billingStatus"),
        stageColor: boardStatuses.find((status) => status.id === task.status)?.dot,
        leadSubtitle: resolveCatalogLabel(getTextField(task, "interest")) || task.text || "Sem escopo informado"
      })),
    [boardStatuses, customersById, documentsById, filteredTasks, resolveCatalogLabel]
  );

  return (
    <ResourceSection variant="plain" className="leads-board-shell">
      <header className="leads-board-hero">
        <div className="leads-board-hero__copy">
          <span className="leads-page__eyebrow">Pipeline filtrado</span>
          <h2>Leads comerciais</h2>
          <p>
            {filteredTasks.length} lead{filteredTasks.length !== 1 ? "s" : ""}
            {search ? ` encontrado${filteredTasks.length !== 1 ? "s" : ""}` : " no radar"} com contexto de cliente, proposta e contrato.
          </p>
        </div>
        <div className="leads-board-hero__value">
          <span>Valor em aberto</span>
          <strong>{formatMoneyCompact(filteredLeadMetrics.totalValue)}</strong>
        </div>
      </header>

      <div className="leads-board-stats">
        <div className="leads-board-stat">
          <span>Ativos</span>
          <strong>{filteredLeadMetrics.activeCount}</strong>
        </div>
        <div className="leads-board-stat">
          <span>Sem cliente</span>
          <strong>{filteredLeadMetrics.unlinkedCount}</strong>
        </div>
        <div className="leads-board-stat">
          <span>Com proposta</span>
          <strong>{filteredLeadMetrics.proposalCount}</strong>
        </div>
        <div className="leads-board-stat">
          <span>Ticket medio</span>
          <strong>{formatMoneyCompact(filteredLeadMetrics.avgValue)}</strong>
        </div>
      </div>

      <div className="leads-page__filters leads-page__filters--bar leads-page__filters--panel shared-form-grid shared-form-grid--three shared-surface-panel">
        <FormField label="Buscar leads">
          <TextInput
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Empresa, contato, origem ou interesse..."
          />
        </FormField>
        <div className="leads-page__filter-meta leads-page__filter-meta--chips">
          <span className="leads-filter-count">
            {filteredTasks.length} lead{filteredTasks.length !== 1 ? "s" : ""}
            {search ? ` encontrado${filteredTasks.length !== 1 ? "s" : ""}` : " no total"}
          </span>
          <span className="leads-filter-pipeline">
            Pipeline: {formatMoneyCompact(filteredLeadMetrics.totalValue)}
          </span>
        </div>
      </div>

      <ResourceTable
        data={rows}
        rowKey={({ task }) => task.id}
        rowClassName="leads-page__lead-row"
        responsiveMinWidth="1320px"
        className="leads-page__table leads-page__table--leads"
        emptyState="Nenhum WorkItem comercial encontrado."
        columns={[
          {
            id: "lead",
            header: "Lead / Oportunidade",
            width: "minmax(240px, 1.35fr)",
            render: ({ task, stageColor, leadSubtitle }) => (
              <div className="leads-page__lead-cell">
                <div className="leads-lead-avatar" style={{ borderColor: stageColor ?? "var(--leads-accent)" }}>
                  <span>{getInitials(task.title)}</span>
                </div>
                <div className="leads-page__lead-main">
                  <div className="leads-page__lead-title-row">
                    <span className="leads-stage-dot" style={{ background: stageColor ?? "var(--leads-accent)" }} />
                    <strong>{task.title}</strong>
                  </div>
                  <span>{leadSubtitle}</span>
                </div>
              </div>
            )
          },
          {
            id: "customer",
            header: "Cliente",
            width: "minmax(180px, 1fr)",
            render: ({ task, customer }) => (
              <div className="leads-page__lead-main">
                <StatusBadge size="sm" tone={customer ? "success" : "warning"} className="leads-page__badge">
                  {customer ? getCustomerDisplayName(customer) : "Sem cliente"}
                </StatusBadge>
                {!customer && getTextField(task, "companyName") ? <span>{getTextField(task, "companyName")}</span> : null}
              </div>
            )
          },
          {
            id: "contact",
            header: "Contato",
            width: "minmax(170px, .9fr)",
            render: ({ task }) => (
              <div className="leads-page__lead-main">
                {getTextField(task, "contactName") ? <strong>{getTextField(task, "contactName")}</strong> : null}
                <span>{getTextField(task, "contactEmail") || "-"}</span>
              </div>
            )
          },
          {
            id: "source",
            header: "Origem",
            width: "minmax(120px, .7fr)",
            render: ({ task }) =>
              getTextField(task, "source") ? (
                <StatusBadge size="sm" tone="default" className="leads-page__badge">
                  {getTextField(task, "source")}
                </StatusBadge>
              ) : (
                <span className="leads-muted">-</span>
              )
          },
          {
            id: "value",
            header: "Valor estimado",
            width: "minmax(135px, .78fr)",
            render: ({ task }) => (
              <strong className="leads-value-cell">{formatMoney(getNumberField(task, "estimatedValue"))}</strong>
            )
          },
          {
            id: "status",
            header: "Status",
            width: "minmax(180px, .92fr)",
            render: ({ task }) => <StatusBadge>{statusLabelById.get(task.status) ?? task.status}</StatusBadge>
          },
          {
            id: "proposal",
            header: "Proposta",
            width: "minmax(126px, .68fr)",
            render: ({ proposal }) => (
              <StatusBadge
                size="sm"
                tone={proposal ? (isApprovedProposal(proposal) ? "success" : "default") : "muted"}
                className="leads-page__badge"
              >
                {proposal ? (isApprovedProposal(proposal) ? "Aprovada" : "Gerada") : "Sem proposta"}
              </StatusBadge>
            )
          },
          {
            id: "contract",
            header: "Contrato",
            width: "minmax(104px, .58fr)",
            render: ({ contract }) => (
              <StatusBadge size="sm" tone={contract ? "success" : "muted"} className="leads-page__badge">
                {contract ? "Gerado" : "-"}
              </StatusBadge>
            )
          },
          {
            id: "billing",
            header: "Cobrança",
            width: "minmax(130px, .7fr)",
            render: ({ billingStatus }) => (
              <StatusBadge
                size="sm"
                tone={billingStatus === "paid" || billingStatus === "subscription_active" ? "success" : billingStatus ? "default" : "muted"}
                className="leads-page__badge"
              >
                {billingStatus ? BILLING_STATUS_LABELS[billingStatus] ?? billingStatus : "Sem cobrança"}
              </StatusBadge>
            )
          }
        ]}
        actions={{
          header: "Acoes",
          width: "minmax(260px, 1.4fr)",
          render: ({ task, customer, proposal, contract }) => (
            <div className="leads-page__row-actions leads-page__row-actions--lead shared-actions-row">
              {customer ? (
                <Button size="sm" variant="outline" onClick={() => onOpenCustomerDetails(customer.id)}>
                  Cliente
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => onOpenCustomerFromLead(task)}>
                  Criar cliente
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => onOpenLinkCustomer(task)}>
                Vincular
              </Button>
              {proposal || contract ? (
                <Button size="sm" variant="outline" onClick={onOpenDocs}>
                  Docs
                </Button>
              ) : null}
              <Button size="sm" variant="outline" onClick={() => onCreateCharge(task)}>
                Cobrar
              </Button>
              <Button size="sm" className="leads-page__board-button" onClick={onOpenBoard}>
                Board
              </Button>
            </div>
          )
        }}
      />
    </ResourceSection>
  );
}
