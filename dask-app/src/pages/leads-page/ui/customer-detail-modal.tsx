import type { Task } from "@/entities/task";
import { getCustomerDisplayName, type Customer } from "@/modules/workspace";
import { formatMoney } from "@/shared/lib/money";
import { Button, FormModal } from "@/shared/ui";
import { CUSTOMER_STATUS_LABELS, formatCustomerAddress, getNumberField, getTextField } from "./leads-page.model";

export function CustomerDetailModal({
  customer,
  commercialTasks,
  statusLabelById,
  resolveCatalogLabel,
  onClose,
  onNewLead
}: {
  customer: Customer;
  commercialTasks: Task[];
  statusLabelById: Map<string, string>;
  resolveCatalogLabel: (value: string) => string;
  onClose: () => void;
  onNewLead: (customer: Customer) => void;
}) {
  const linkedTasks = commercialTasks.filter((t) => getTextField(t, "customerId") === customer.id);

  return (
    <FormModal
      titleId="customer-detail-modal"
      title="Detalhes do cliente"
      onClose={onClose}
      className="leads-page__modal"
      headerClassName="leads-page__modal-header"
      titleWrapperClassName="leads-page__modal-title"
      contentClassName="leads-page__modal-content"
      footerClassName="leads-page__row-actions"
      footer={<Button onClick={() => onNewLead(customer)}>Novo lead para este cliente</Button>}
    >
        <div className="leads-page__customer-detail">
          <div className="leads-customer-avatar leads-customer-avatar--lg">
            {customer.logoUrl
              ? <img src={customer.logoUrl} alt="" />
              : <span>{getCustomerDisplayName(customer).slice(0, 2).toUpperCase()}</span>}
          </div>
          <div className="leads-customer-detail-info">
            <h3>{getCustomerDisplayName(customer)}</h3>
            <span className={`leads-customer-status leads-customer-status--${customer.status}`}>{CUSTOMER_STATUS_LABELS[customer.status]}</span>
            {customer.legalName ? <p>{customer.legalName}</p> : null}
            {customer.document ? <p>{customer.document}</p> : null}
            {customer.email || customer.phone ? <p>{[customer.email, customer.phone].filter(Boolean).join(" Â· ")}</p> : null}
            {formatCustomerAddress(customer) ? <p>{formatCustomerAddress(customer)}</p> : null}
          </div>
        </div>
        <h3 className="leads-modal-section-title">Deals vinculados</h3>
        <ul className="leads-page__history">
          {linkedTasks.length === 0
            ? <li>Nenhum deal vinculado.</li>
            : linkedTasks.map((task) => {
                const value = getNumberField(task, "estimatedValue");
                return (
                  <li key={task.id}>
                    <strong>{task.title}</strong>
                    <div className="leads-history-meta">
                      <span>{statusLabelById.get(task.status) ?? task.status}</span>
                      {value !== null && <span>{formatMoney(value)}</span>}
                    </div>
                    {getTextField(task, "interest") || task.text ? <p>{resolveCatalogLabel(getTextField(task, "interest")) || task.text}</p> : null}
                  </li>
                );
              })}
        </ul>
    </FormModal>
  );
}
