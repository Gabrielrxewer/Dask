import { useMemo } from "react";
import type { Task } from "@/entities/task";
import { getCustomerDisplayName, type Customer } from "@/modules/workspace";
import { formatDate } from "@/shared/lib/date";
import { Button, FormField, ResourceSection, ResourceTable, TextInput } from "@/shared/ui";
import { CUSTOMER_STATUS_LABELS, getTextField, type PipelineMetrics } from "./commercial-page.model";

interface CustomerTableRow {
  customer: Customer;
  linkedTasks: Task[];
  proposalCount: number;
}

export function CustomersListSection({
  filteredCustomers,
  commercialTasks,
  search,
  pipelineMetrics,
  onSearchChange,
  onOpenCustomerDetails,
  onNewCommercialWorkItem,
  totalCount,
  hasMore = false,
  isFetchingMore = false,
  onLoadMore
}: {
  filteredCustomers: Customer[];
  commercialTasks: Task[];
  search: string;
  pipelineMetrics: PipelineMetrics;
  onSearchChange: (value: string) => void;
  onOpenCustomerDetails: (customerId: string) => void;
  onNewCommercialWorkItem: (customer: Customer) => void;
  totalCount?: number;
  hasMore?: boolean;
  isFetchingMore?: boolean;
  onLoadMore?: () => void;
}) {
  const rows = useMemo<CustomerTableRow[]>(
    () =>
      filteredCustomers.map((customer) => {
        const linkedTasks = commercialTasks.filter((task) => getTextField(task, "customerId") === customer.id);
        return {
          customer,
          linkedTasks,
          proposalCount: linkedTasks.filter((task) => getTextField(task, "proposalId")).length
        };
      }),
    [commercialTasks, filteredCustomers]
  );

  return (
    <ResourceSection variant="plain">
      <div className="commercial-page__filters commercial-page__filters--bar shared-form-grid shared-form-grid--three">
        <FormField label="Buscar clientes">
          <TextInput
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Nome, documento, e-mail ou telefone..."
          />
        </FormField>
        <div className="commercial-page__filter-meta">
          <span className="commercial-filter-count">
            {totalCount ?? filteredCustomers.length} cliente{(totalCount ?? filteredCustomers.length) !== 1 ? "s" : ""}
          </span>
          <span className="commercial-filter-pipeline">
            {pipelineMetrics.activeCustomers} ativo{pipelineMetrics.activeCustomers !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      <ResourceTable
        data={rows}
        rowKey={(row) => row.customer.id}
        responsiveMinWidth="1080px"
        className="commercial-page__table"
        emptyState="Nenhum cliente cadastrado."
        columns={[
          {
            id: "customer",
            header: "Cliente",
            width: "1.3fr",
            render: ({ customer }) => (
              <div className="commercial-page__customer-cell">
                <div className="commercial-customer-avatar">
                  {customer.logoUrl ? (
                    <img src={customer.logoUrl} alt="" />
                  ) : (
                    <span>{getCustomerDisplayName(customer).slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="commercial-page__workItem-main">
                  <strong>{getCustomerDisplayName(customer)}</strong>
                  <span>{customer.legalName ?? customer.website ?? "Cadastro mestre"}</span>
                </div>
              </div>
            )
          },
          {
            id: "document",
            header: "Documento",
            width: "0.8fr",
            render: ({ customer }) => <span className="commercial-muted">{customer.document ?? "-"}</span>
          },
          {
            id: "email",
            header: "E-mail",
            width: "1.1fr",
            render: ({ customer }) => customer.email ?? <span className="commercial-muted">-</span>
          },
          {
            id: "phone",
            header: "Telefone",
            width: "0.8fr",
            render: ({ customer }) => customer.phone ?? <span className="commercial-muted">-</span>
          },
          {
            id: "status",
            header: "Status",
            width: "0.65fr",
            render: ({ customer }) => (
              <span className={`commercial-customer-status commercial-customer-status--${customer.status}`}>
                {CUSTOMER_STATUS_LABELS[customer.status]}
              </span>
            )
          },
          {
            id: "deals",
            header: "Deals",
            width: "0.65fr",
            render: ({ linkedTasks }) => <strong>{linkedTasks.length}</strong>
          },
          {
            id: "proposals",
            header: "Propostas",
            width: "0.65fr",
            render: ({ proposalCount }) => <strong>{proposalCount}</strong>
          },
          {
            id: "updated",
            header: "Ultima atividade",
            width: "0.8fr",
            render: ({ customer }) => <span className="commercial-muted">{formatDate(customer.updatedAt)}</span>
          }
        ]}
        actions={{
          header: "Acoes",
          width: "1.1fr",
          render: ({ customer }) => (
            <div className="commercial-page__row-actions shared-actions-row">
              <Button size="sm" variant="outline" onClick={() => onOpenCustomerDetails(customer.id)}>
                Detalhes
              </Button>
              <Button size="sm" onClick={() => onNewCommercialWorkItem(customer)}>
                Novo WorkItem
              </Button>
            </div>
          )
        }}
      />
      {hasMore && onLoadMore ? (
        <div className="commercial-page__load-more">
          <Button variant="outline" onClick={onLoadMore} loading={isFetchingMore}>
            Carregar mais
          </Button>
        </div>
      ) : null}
    </ResourceSection>
  );
}
