import { getCustomerDisplayName, type Customer } from "@/modules/workspace";
import { FormField, FormModal, Select } from "@/shared/ui";

export function LinkCustomerModal({
  customers,
  linkCustomerId,
  isSubmitting,
  onChange,
  onClose,
  onSubmit
}: {
  customers: Customer[];
  linkCustomerId: string;
  isSubmitting: boolean;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <FormModal
      titleId="link-customer-modal"
      title="Vincular cliente ao lead"
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Salvar"
      submittingLabel="Salvando..."
      isSubmitting={isSubmitting}
      className="leads-page__modal"
      headerClassName="leads-page__modal-header"
      titleWrapperClassName="leads-page__modal-title"
      contentClassName="leads-page__modal-content"
      footerClassName="leads-page__row-actions"
      errorClassName="leads-page__modal-error"
    >
      <FormField label="Selecionar cliente">
        <Select value={linkCustomerId} onChange={(e) => onChange(e.target.value)}>
          <option value="">Remover vÃ­nculo</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{getCustomerDisplayName(c)}</option>)}
        </Select>
      </FormField>
    </FormModal>
  );
}
