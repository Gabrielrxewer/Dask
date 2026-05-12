import type { Task } from "@/entities/task";
import { getCustomerDisplayName, type Customer } from "@/modules/workspace";
import { formatMoney } from "@/shared/lib/money";
import { AppDialog, Button } from "@/shared/ui";
import { CUSTOMER_STATUS_LABELS, formatCustomerAddress, getNumberField, getTextField } from "./commercial-page.model";

export function CustomerDetailModal({
  customer,
  commercialTasks,
  statusLabelById,
  resolveCatalogLabel,
  onClose,
  onNewCommercialWorkItem
}: {
  customer: Customer;
  commercialTasks: Task[];
  statusLabelById: Map<string, string>;
  resolveCatalogLabel: (value: string) => string;
  onClose: () => void;
  onNewCommercialWorkItem: (customer: Customer) => void;
}) {
  const linkedTasks = commercialTasks.filter((t) => getTextField(t, "customerId") === customer.id);

  return (
    <AppDialog
      open
      title="Detalhes do cliente"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      className="commercial-page__modal"
      contentClassName="commercial-page__modal-content"
      footer={
        <div className="commercial-page__row-actions">
          <Button onClick={() => onNewCommercialWorkItem(customer)}>Novo WorkItem para este cliente</Button>
        </div>
      }
    >
        <div className="commercial-page__customer-detail">
          <div className="commercial-customer-avatar commercial-customer-avatar--lg">
            {customer.logoUrl
              ? <img src={customer.logoUrl} alt="" />
              : <span>{getCustomerDisplayName(customer).slice(0, 2).toUpperCase()}</span>}
          </div>
          <div className="commercial-customer-detail-info">
            <h3>{getCustomerDisplayName(customer)}</h3>
            <span className={`commercial-customer-status commercial-customer-status--${customer.status}`}>{CUSTOMER_STATUS_LABELS[customer.status]}</span>
            {customer.legalName ? <p>{customer.legalName}</p> : null}
            {customer.document ? <p>{customer.document}</p> : null}
            {customer.email || customer.phone ? <p>{[customer.email, customer.phone].filter(Boolean).join(" · ")}</p> : null}
            {formatCustomerAddress(customer) ? <p>{formatCustomerAddress(customer)}</p> : null}
          </div>
        </div>
        <h3 className="commercial-modal-section-title">Deals vinculados</h3>
        <ul className="commercial-page__history">
          {linkedTasks.length === 0
            ? <li>Nenhum deal vinculado.</li>
            : linkedTasks.map((task) => {
                const value = getNumberField(task, "estimatedValue");
                return (
                  <li key={task.id}>
                    <strong>{task.title}</strong>
                    <div className="commercial-history-meta">
                      <span>{statusLabelById.get(task.status) ?? task.status}</span>
                      {value !== null && <span>{formatMoney(value)}</span>}
                    </div>
                    {getTextField(task, "interest") || task.text ? <p>{resolveCatalogLabel(getTextField(task, "interest")) || task.text}</p> : null}
                  </li>
                );
              })}
        </ul>
    </AppDialog>
  );
}
