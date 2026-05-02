import type { Dispatch, SetStateAction } from "react";
import { getCustomerDisplayName, type Customer } from "@/modules/workspace";
import type { ConnectCatalogItem } from "@/modules/billing";
import { FormField, FormModal, Select, Textarea, TextInput } from "@/shared/ui";
import type { LeadFormState } from "./leads-page.model";

export function LeadFormModal({
  leadForm,
  customers,
  catalogItems,
  catalogItemsById,
  isSubmitting,
  onChange,
  onClose,
  onSubmit
}: {
  leadForm: LeadFormState;
  customers: Customer[];
  catalogItems: ConnectCatalogItem[];
  catalogItemsById: Map<string, ConnectCatalogItem>;
  isSubmitting: boolean;
  onChange: Dispatch<SetStateAction<LeadFormState>>;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <FormModal
      titleId="lead-form-modal"
      title="Novo lead comercial"
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel="Criar lead"
      submittingLabel="Criando lead..."
      isSubmitting={isSubmitting}
      className="leads-page__modal"
      headerClassName="leads-page__modal-header"
      titleWrapperClassName="leads-page__modal-title"
      contentClassName="leads-page__modal-content"
      footerClassName="leads-page__row-actions"
      errorClassName="leads-page__modal-error"
    >
      <div className="leads-page__form-grid shared-form-grid shared-form-grid--three">
        <FormField label="Cliente vinculado">
          <Select value={leadForm.customerId} onChange={(e) => onChange((c) => ({ ...c, customerId: e.target.value }))}>
            <option value="">Sem cliente vinculado</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{getCustomerDisplayName(c)}</option>)}
          </Select>
        </FormField>
        <FormField label="Empresa">
          <TextInput value={leadForm.companyName} onChange={(e) => onChange((c) => ({ ...c, companyName: e.target.value }))} />
        </FormField>
        <FormField label="Contato">
          <TextInput value={leadForm.contactName} onChange={(e) => onChange((c) => ({ ...c, contactName: e.target.value }))} />
        </FormField>
      </div>
      <div className="leads-page__form-grid shared-form-grid shared-form-grid--three">
        <FormField label="E-mail">
          <TextInput value={leadForm.contactEmail} onChange={(e) => onChange((c) => ({ ...c, contactEmail: e.target.value }))} />
        </FormField>
        <FormField label="Telefone">
          <TextInput value={leadForm.contactPhone} onChange={(e) => onChange((c) => ({ ...c, contactPhone: e.target.value }))} />
        </FormField>
        <FormField label="Origem">
          <TextInput value={leadForm.source} onChange={(e) => onChange((c) => ({ ...c, source: e.target.value }))} />
        </FormField>
      </div>
      <div className="leads-page__form-grid shared-form-grid shared-form-grid--three">
        <FormField label="Valor estimado (R$)">
          <TextInput value={leadForm.estimatedValue} onChange={(e) => onChange((c) => ({ ...c, estimatedValue: e.target.value }))} placeholder="0,00" />
        </FormField>
        <FormField label="Validade da proposta">
          <TextInput type="date" value={leadForm.proposalValidity} onChange={(e) => onChange((c) => ({ ...c, proposalValidity: e.target.value }))} />
        </FormField>
      </div>
      <FormField label="Interesse / escopo">
        <Select
          value={leadForm.interest}
          onChange={(e) => {
            const catalogItem = catalogItemsById.get(e.target.value);
            onChange((current) => ({
              ...current,
              interest: e.target.value,
              estimatedValue: current.estimatedValue || (catalogItem ? String(catalogItem.amount / 100) : ""),
              proposalValidity: current.proposalValidity || catalogItem?.metadata?.proposalValidity || ""
            }));
          }}
        >
          <option value="">Selecione um item do catalogo</option>
          {catalogItems.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </Select>
      </FormField>
      <FormField label="ObservaÃ§Ãµes">
        <Textarea rows={3} value={leadForm.notes} onChange={(e) => onChange((c) => ({ ...c, notes: e.target.value }))} />
      </FormField>
    </FormModal>
  );
}
