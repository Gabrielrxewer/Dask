import { useMemo, type CSSProperties } from "react";
import type { Task, TaskStatus } from "@/entities/task";
import { getCustomerDisplayName, type Customer, type WorkspaceDocument } from "@/modules/workspace";
import { formatMoney, formatMoneyCompact } from "@/shared/lib/money";
import { cn } from "@/shared/lib/cn";
import { AppIcon, Button, EmptyState, FormField, ResourceSection, StatusBadge, TextInput, type AppIconName } from "@/shared/ui";
import {
  getInitials,
  getNumberField,
  getTextField,
  isApprovedProposal,
  isOpenBillingStatus,
  type FilteredLeadMetrics
} from "./leads-page.model";

interface OpportunityRow {
  task: Task;
  customer: Customer | undefined;
  proposal: WorkspaceDocument | undefined;
  contract: WorkspaceDocument | undefined;
  billingStatus: string;
  billingOrderId: string;
  stageColor: string | undefined;
  statusLabel: string;
  leadSubtitle: string;
  source: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  companyName: string;
  estimatedValue: number | null;
}

type PipelineStageState = "done" | "pending" | "action" | "idle" | "blocked";

interface OpportunityStage {
  id: string;
  label: string;
  detail: string;
  state: PipelineStageState;
  icon: AppIconName;
}

interface OpportunityAction {
  label: string;
  description: string;
  icon: AppIconName;
  onClick: () => void;
}

interface OpportunityActionHandlers {
  onOpenCustomerDetails: (customerId: string) => void;
  onOpenCustomerFromLead: (task: Task) => void;
  onOpenLinkCustomer: (task: Task) => void;
  onCreateCharge: (task: Task) => void;
  onOpenFlow: (task: Task) => void;
  onOpenDocs: () => void;
  onOpenBoard: () => void;
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

const DOCUMENT_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  sent: "Enviada",
  viewed: "Visualizada",
  approved: "Aprovada",
  rejected: "Rejeitada",
  accepted: "Aceita",
  signed: "Assinada"
};

function formatOpportunityValue(value: number | null): string {
  return value !== null && value > 0 ? formatMoney(value) : "A estimar";
}

function getDocumentStatusLabel(document: WorkspaceDocument | undefined, generatedLabel: string): string {
  if (!document) return "Nao iniciada";
  const status = String(document.metadata?.status ?? "").trim();
  return (status && DOCUMENT_STATUS_LABELS[status]) || generatedLabel;
}

function isCompletedContract(document: WorkspaceDocument | undefined): boolean {
  const status = String(document?.metadata?.status ?? "").trim();
  return document?.kind === "contract" && ["accepted", "signed"].includes(status);
}

function getBillingStatusLabel(status: string, billingOrderId: string): string {
  if (status) return BILLING_STATUS_LABELS[status] ?? status;
  if (billingOrderId) return "Gerada";
  return "Nao iniciada";
}

function getBillingTone(status: string, billingOrderId: string): "success" | "warning" | "danger" | "info" | "muted" {
  if (status === "paid" || status === "subscription_active") return "success";
  if (status === "overdue" || status === "failed") return "danger";
  if (isOpenBillingStatus(status) || billingOrderId) return "warning";
  return "muted";
}

function buildOpportunityStages(row: OpportunityRow): OpportunityStage[] {
  const hasCustomer = Boolean(row.customer);
  const hasProposal = Boolean(row.proposal);
  const hasContract = Boolean(row.contract);
  const hasBilling = Boolean(row.billingStatus || row.billingOrderId);
  const proposalDone = isApprovedProposal(row.proposal);
  const contractDone = isCompletedContract(row.contract);
  const billingDone = row.billingStatus === "paid" || row.billingStatus === "subscription_active";

  return [
    {
      id: "customer",
      label: "Cliente",
      detail: hasCustomer ? "Vinculado" : "Criar/vincular",
      state: hasCustomer ? "done" : "action",
      icon: hasCustomer ? "check" : "user"
    },
    {
      id: "proposal",
      label: "Proposta",
      detail: hasProposal ? getDocumentStatusLabel(row.proposal, "Gerada") : hasCustomer ? "Preparar" : "Bloqueada",
      state: hasProposal ? (proposalDone ? "done" : "pending") : hasCustomer ? "action" : "blocked",
      icon: hasProposal ? "file" : hasCustomer ? "plus" : "lock"
    },
    {
      id: "contract",
      label: "Contrato",
      detail: hasContract ? getDocumentStatusLabel(row.contract, "Gerado") : hasProposal ? "Preparar" : "Aguardando proposta",
      state: hasContract ? (contractDone ? "done" : "pending") : hasProposal ? "action" : "blocked",
      icon: hasContract ? "documentation" : hasProposal ? "plus" : "lock"
    },
    {
      id: "billing",
      label: "Cobranca",
      detail: getBillingStatusLabel(row.billingStatus, row.billingOrderId),
      state: hasBilling ? (billingDone ? "done" : "pending") : hasContract ? "action" : "blocked",
      icon: hasBilling ? "wallet" : hasContract ? "plus" : "lock"
    }
  ];
}

function resolvePrimaryAction(row: OpportunityRow, handlers: OpportunityActionHandlers): OpportunityAction {
  if (!row.customer) {
    return {
      label: "Criar cliente",
      description: "Desbloqueia proposta, contrato e cobranca.",
      icon: "user",
      onClick: () => handlers.onOpenCustomerFromLead(row.task)
    };
  }

  if (!row.proposal) {
    return {
      label: "Gerar proposta",
      description: "Abrir documentacao comercial para preparar a proposta.",
      icon: "file",
      onClick: handlers.onOpenDocs
    };
  }

  if (!row.contract) {
    return {
      label: "Gerar contrato",
      description: "Formalizar a proposta ja registrada para este lead.",
      icon: "documentation",
      onClick: handlers.onOpenDocs
    };
  }

  if (!row.billingStatus && !row.billingOrderId) {
    return {
      label: "Gerar cobranca",
      description: "Criar checkout e enviar por e-mail ao cliente.",
      icon: "wallet",
      onClick: () => handlers.onCreateCharge(row.task)
    };
  }

  return {
    label: "Abrir fluxo",
    description: "Acompanhar a execucao e a proxima etapa operacional.",
    icon: "automation",
    onClick: () => handlers.onOpenFlow(row.task)
  };
}

function CommercialPipelineProgress({ stages }: { stages: OpportunityStage[] }) {
  return (
    <ol className="commercial-pipeline" aria-label="Esteira comercial">
      {stages.map((stage, index) => (
        <li key={stage.id} className={cn("commercial-pipeline__stage", `commercial-pipeline__stage--${stage.state}`)}>
          <span className="commercial-pipeline__node">
            <AppIcon name={stage.icon} size={13} />
          </span>
          <span className="commercial-pipeline__copy">
            <strong>{stage.label}</strong>
            <span>{stage.detail}</span>
          </span>
          {index < stages.length - 1 ? <span className="commercial-pipeline__connector" aria-hidden="true" /> : null}
        </li>
      ))}
    </ol>
  );
}

function CommandMetric({
  label,
  value,
  detail,
  icon,
  tone
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: AppIconName;
  tone: "blue" | "green" | "amber" | "purple" | "cyan" | "muted";
}) {
  return (
    <article className={cn("leads-command-metric", `leads-command-metric--${tone}`)}>
      <span className="leads-command-metric__icon" aria-hidden="true">
        <AppIcon name={icon} size={17} />
      </span>
      <span className="leads-command-metric__body">
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </span>
    </article>
  );
}

function SecondaryActionsMenu({ actions }: { actions: Array<{ label: string; icon: AppIconName; onClick: () => void }> }) {
  if (actions.length === 0) return null;

  return (
    <details className="opportunity-actions-menu">
      <summary aria-label="Acoes secundarias">
        <AppIcon name="chevron-down" size={15} />
      </summary>
      <div className="opportunity-actions-menu__panel">
        {actions.map((action) => (
          <button key={action.label} type="button" onClick={action.onClick}>
            <AppIcon name={action.icon} size={14} />
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </details>
  );
}

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
  onOpenFlow,
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
  onOpenFlow: (task: Task) => void;
  onOpenDocs: () => void;
  onOpenBoard: () => void;
}) {
  const rows = useMemo<OpportunityRow[]>(
    () =>
      filteredTasks.map((task) => {
        const customer = customersById.get(getTextField(task, "customerId"));
        return {
          task,
          customer,
          proposal: documentsById.get(getTextField(task, "proposalId")),
          contract: documentsById.get(getTextField(task, "contractId")),
          billingStatus: getTextField(task, "billingStatus"),
          billingOrderId: getTextField(task, "billingOrderId"),
          stageColor: boardStatuses.find((status) => status.id === task.status)?.dot,
          statusLabel: statusLabelById.get(task.status) ?? task.status,
          leadSubtitle: resolveCatalogLabel(getTextField(task, "interest")) || task.text || "Escopo comercial a qualificar",
          source: getTextField(task, "source"),
          contactName: getTextField(task, "contactName"),
          contactEmail: getTextField(task, "contactEmail"),
          contactPhone: getTextField(task, "contactPhone"),
          companyName: getTextField(task, "companyName"),
          estimatedValue: getNumberField(task, "estimatedValue")
        };
      }),
    [boardStatuses, customersById, documentsById, filteredTasks, resolveCatalogLabel, statusLabelById]
  );

  const handlers: OpportunityActionHandlers = {
    onOpenCustomerDetails,
    onOpenCustomerFromLead,
    onOpenLinkCustomer,
    onCreateCharge,
    onOpenFlow,
    onOpenDocs,
    onOpenBoard
  };

  return (
    <ResourceSection variant="plain" className="leads-opportunities-shell">
      <header className="leads-command-hero">
        <div className="leads-command-hero__copy">
          <span className="leads-page__eyebrow">Pipeline comercial</span>
          <h2>Leads comerciais</h2>
          <p>
            Central de oportunidades conectando lead, cliente, proposta, contrato, cobranca e execucao em um fluxo operacional.
          </p>
        </div>
        <div className="leads-command-hero__value">
          <span>Valor em aberto</span>
          <strong>{formatMoneyCompact(filteredLeadMetrics.openValue)}</strong>
          <small>Pipeline estimado {formatMoneyCompact(filteredLeadMetrics.totalValue)}</small>
        </div>
      </header>

      <div className="leads-command-metrics">
        <CommandMetric
          label="Ativos"
          value={filteredLeadMetrics.activeCount}
          detail={`${filteredTasks.length} no radar filtrado`}
          icon="trend-up"
          tone="blue"
        />
        <CommandMetric
          label="Sem cliente"
          value={filteredLeadMetrics.unlinkedCount}
          detail="Precisam ser criados ou vinculados"
          icon="user"
          tone="amber"
        />
        <CommandMetric
          label="Com proposta"
          value={filteredLeadMetrics.proposalCount}
          detail="Ja possuem documento comercial"
          icon="file"
          tone="purple"
        />
        <CommandMetric
          label="Cobranças"
          value={filteredLeadMetrics.billingCount}
          detail={`${formatMoneyCompact(filteredLeadMetrics.openValue)} em aberto`}
          icon="wallet"
          tone="green"
        />
        <CommandMetric
          label="Ticket medio"
          value={formatMoneyCompact(filteredLeadMetrics.avgValue)}
          detail="Baseado nos valores estimados"
          icon="receipt"
          tone="cyan"
        />
        <CommandMetric
          label="Proximos passos"
          value={filteredLeadMetrics.nextStepsCount}
          detail="Acoes comerciais pendentes"
          icon="zap"
          tone="muted"
        />
      </div>

      <div className="leads-opportunities-toolbar shared-surface-panel">
        <FormField label="Buscar oportunidades" className="leads-search-field">
          <span className="leads-search-control">
            <AppIcon name="search" size={16} />
            <TextInput
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Empresa, contato, origem ou interesse..."
              className="leads-search-input"
            />
          </span>
        </FormField>
        <div className="leads-opportunities-toolbar__meta">
          <span>
            {filteredTasks.length} lead{filteredTasks.length !== 1 ? "s" : ""}
            {search ? ` encontrado${filteredTasks.length !== 1 ? "s" : ""}` : " no total"}
          </span>
          <strong>{formatMoneyCompact(filteredLeadMetrics.totalValue)} em pipeline</strong>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          className="leads-opportunities-empty"
          variant="card"
          icon={<AppIcon name="briefcase" size={22} />}
          title={search ? "Nenhuma oportunidade neste filtro" : "Nenhum lead comercial encontrado"}
          description={search ? "Ajuste a busca para voltar ao radar comercial." : "Quando leads comerciais entrarem no Dask, eles aparecem aqui como oportunidades operacionais."}
        />
      ) : (
        <div className="opportunity-list" role="list">
          {rows.map((row) => {
            const customerName = row.customer ? getCustomerDisplayName(row.customer) : "";
            const contactPrimary = row.contactName || row.contactEmail || row.contactPhone;
            const contactSecondary = [row.contactEmail, row.contactPhone].filter(Boolean).join(" - ");
            const companyContext = row.companyName || customerName || "Cliente ainda nao definido";
            const billingOpenValue = (isOpenBillingStatus(row.billingStatus) || (row.billingOrderId && !row.billingStatus)) && row.estimatedValue && row.estimatedValue > 0
              ? row.estimatedValue
              : null;
            const primaryAction = resolvePrimaryAction(row, handlers);
            const stages = buildOpportunityStages(row);
            const secondaryActions = [
              row.customer
                ? { label: "Abrir cliente", icon: "user" as AppIconName, onClick: () => onOpenCustomerDetails(row.customer!.id) }
                : { label: "Vincular cliente", icon: "link" as AppIconName, onClick: () => onOpenLinkCustomer(row.task) },
              row.customer ? { label: "Vincular cliente", icon: "link" as AppIconName, onClick: () => onOpenLinkCustomer(row.task) } : null,
              { label: "Documentacao", icon: "documentation" as AppIconName, onClick: onOpenDocs },
              !row.billingStatus && !row.billingOrderId && primaryAction.label !== "Gerar cobranca"
                ? { label: "Gerar cobranca", icon: "wallet" as AppIconName, onClick: () => onCreateCharge(row.task) }
                : null,
              { label: "Abrir fluxo", icon: "automation" as AppIconName, onClick: () => onOpenFlow(row.task) },
              { label: "Abrir board", icon: "board" as AppIconName, onClick: onOpenBoard }
            ].filter((action): action is { label: string; icon: AppIconName; onClick: () => void } => Boolean(action));

            return (
              <article
                key={row.task.id}
                className="opportunity-card"
                role="listitem"
                style={{ "--opportunity-color": row.stageColor ?? "var(--leads-accent)" } as CSSProperties}
              >
                <section className="opportunity-card__lead" aria-label="Lead">
                  <div className="opportunity-avatar">
                    <span>{getInitials(row.task.title)}</span>
                  </div>
                  <div className="opportunity-identity">
                    <div className="opportunity-identity__title-row">
                      <span className="opportunity-status-dot" aria-hidden="true" />
                      <h3>{row.task.title}</h3>
                    </div>
                    <p>{row.leadSubtitle}</p>
                    <div className="opportunity-meta-line">
                      <span>
                        <AppIcon name="marketing" size={13} />
                        {row.source || "Origem a mapear"}
                      </span>
                      <span>
                        <AppIcon name="message" size={13} />
                        {contactPrimary || "Contato a completar"}
                      </span>
                    </div>
                    {contactSecondary && contactSecondary !== contactPrimary ? (
                      <span className="opportunity-contact-detail">{contactSecondary}</span>
                    ) : null}
                  </div>
                </section>

                <section className="opportunity-card__customer" aria-label="Cliente">
                  <span className={cn("opportunity-customer-icon", row.customer ? "opportunity-customer-icon--linked" : "opportunity-customer-icon--pending")}>
                    <AppIcon name={row.customer ? "check" : "user"} size={16} />
                  </span>
                  <div>
                    <span>Cliente</span>
                    <strong>{customerName || "Cliente pendente"}</strong>
                    <small>{row.customer ? row.customer.email ?? row.customer.document ?? "Cadastro vinculado" : companyContext}</small>
                  </div>
                </section>

                <section className="opportunity-card__pipeline" aria-label="Esteira">
                  <div className="opportunity-card__pipeline-head">
                    <span>Esteira comercial</span>
                    <span className="opportunity-current-status">
                      <span style={{ background: row.stageColor ?? "var(--leads-accent)" }} />
                      {row.statusLabel}
                    </span>
                  </div>
                  <CommercialPipelineProgress stages={stages} />
                </section>

                <section className="opportunity-card__finance" aria-label="Financeiro">
                  <span>Financeiro</span>
                  <strong>{formatOpportunityValue(row.estimatedValue)}</strong>
                  {billingOpenValue ? (
                    <small>Aberto {formatMoneyCompact(billingOpenValue)}</small>
                  ) : (
                    <StatusBadge size="sm" tone={getBillingTone(row.billingStatus, row.billingOrderId)}>
                      {getBillingStatusLabel(row.billingStatus, row.billingOrderId)}
                    </StatusBadge>
                  )}
                </section>

                <section className="opportunity-card__next" aria-label="Proxima acao">
                  <div className="opportunity-next-copy">
                    <span>Proxima acao</span>
                    <p>{primaryAction.description}</p>
                  </div>
                  <div className="opportunity-next-actions">
                    <Button variant="primary" size="sm" onClick={primaryAction.onClick} className="opportunity-primary-action">
                      <AppIcon name={primaryAction.icon} size={15} />
                      {primaryAction.label}
                    </Button>
                    <SecondaryActionsMenu actions={secondaryActions} />
                  </div>
                </section>
              </article>
            );
          })}
        </div>
      )}
    </ResourceSection>
  );
}
