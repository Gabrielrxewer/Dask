import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type { ConnectCatalogItem } from "@/modules/billing";
import { normalizeMoneyInput } from "@/modules/billing";
import { leadFormSchema, type LeadFormValues } from "@/modules/leads/model";
import { getCustomerDisplayName, type Customer } from "@/modules/workspace";
import {
  AppDateField,
  AppDialog,
  AppForm,
  AppFormActions,
  AppFormGrid,
  AppMoneyField,
  AppSelectField,
  AppTextField,
  AppTextareaField,
  Button
} from "@/shared/ui";
import type { LeadFormState } from "./leads-page.model";

const EMPTY_VALUE = "__empty__";

export function LeadFormModal({
  leadForm,
  mode = "lead",
  customers,
  catalogItems,
  catalogItemsById,
  isSubmitting,
  onClose,
  onSubmit
}: {
  leadForm: LeadFormState;
  mode?: "lead" | "signal";
  customers: Customer[];
  catalogItems: ConnectCatalogItem[];
  catalogItemsById: Map<string, ConnectCatalogItem>;
  isSubmitting: boolean;
  onChange: (value: LeadFormState) => void;
  onClose: () => void;
  onSubmit: (value: LeadFormValues) => void;
}) {
  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    values: leadForm,
    mode: "onBlur"
  });
  const isSignal = mode === "signal";

  return (
    <AppDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={isSignal ? "Novo signal comercial" : "Novo lead comercial"}
      className="leads-page__modal"
      contentClassName="leads-page__modal-content"
      footer={(
        <AppFormActions className="leads-page__row-actions">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="lead-form" variant="primary" loading={isSubmitting}>
            {isSignal ? "Criar signal" : "Criar lead"}
          </Button>
        </AppFormActions>
      )}
    >
      <AppForm
        id="lead-form"
        form={form}
        disabled={isSubmitting}
        onSubmit={(values) => onSubmit(values)}
        className="leads-page__modal-form"
      >
        <AppFormGrid className="leads-page__form-grid" columns={3}>
          <AppSelectField
            name="customerId"
            label="Cliente vinculado"
            placeholder="Sem cliente vinculado"
            options={[
              { value: EMPTY_VALUE, label: "Sem cliente vinculado" },
              ...customers.map((customer) => ({
                value: customer.id,
                label: getCustomerDisplayName(customer)
              }))
            ]}
            formatValue={(value) => (typeof value === "string" && value.length > 0 ? value : EMPTY_VALUE)}
            parseValue={(value) => (value === EMPTY_VALUE ? "" : value)}
          />
          <AppTextField name="companyName" label="Empresa" autoFocus />
          <AppTextField name="contactName" label="Contato" />
        </AppFormGrid>

        <AppFormGrid className="leads-page__form-grid" columns={3}>
          <AppTextField name="contactEmail" label="E-mail" />
          <AppTextField name="contactPhone" label="Telefone" />
          <AppTextField name="source" label="Origem" />
        </AppFormGrid>

        <AppFormGrid className="leads-page__form-grid" columns={3}>
          <AppMoneyField
            name="estimatedValue"
            label="Valor estimado (R$)"
            placeholder="0,00"
            normalizeOnBlur={normalizeMoneyInput}
          />
          <AppDateField
            name="proposalValidity"
            label="Validade da proposta"
            placeholder="Selecionar data"
            parseValue={(value) => value ?? ""}
          />
        </AppFormGrid>

        <AppSelectField
          name="interest"
          label="Interesse / escopo"
          placeholder="Selecione um item do catalogo"
          options={[
            { value: EMPTY_VALUE, label: "Selecione um item do catalogo" },
            ...catalogItems.map((item) => ({ value: item.id, label: item.name }))
          ]}
          formatValue={(value) => (typeof value === "string" && value.length > 0 ? value : EMPTY_VALUE)}
          parseValue={(value) => (value === EMPTY_VALUE ? "" : value)}
          onValueChange={(_, formValue) => {
            const nextValue = typeof formValue === "string" ? formValue : "";
            const catalogItem = catalogItemsById.get(nextValue);
            if (catalogItem && !form.getValues("estimatedValue")) {
              form.setValue("estimatedValue", String(catalogItem.amount / 100), { shouldDirty: true });
            }
            if (catalogItem?.metadata?.proposalValidity && !form.getValues("proposalValidity")) {
              form.setValue("proposalValidity", catalogItem.metadata.proposalValidity, { shouldDirty: true });
            }
          }}
        />

        <AppTextareaField name="notes" label="Observacoes" rows={3} />
      </AppForm>
    </AppDialog>
  );
}
