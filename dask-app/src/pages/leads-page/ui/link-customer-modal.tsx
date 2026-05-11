import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { getCustomerDisplayName, type Customer } from "@/modules/workspace";
import { linkCustomerSchema, type LinkCustomerValues } from "@/modules/leads/model";
import { AppDialog, AppForm, AppFormActions, AppSelectField, Button } from "@/shared/ui";

const EMPTY_VALUE = "__empty__";

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
  onSubmit: (value: string) => void;
}) {
  const form = useForm<LinkCustomerValues>({
    resolver: zodResolver(linkCustomerSchema),
    values: { customerId: linkCustomerId },
    mode: "onBlur"
  });
  const customerOptions = useMemo(
    () => [
      { value: EMPTY_VALUE, label: "Remover vinculo" },
      ...customers.map((customer) => ({
        value: customer.id,
        label: getCustomerDisplayName(customer)
      }))
    ],
    [customers]
  );

  return (
    <AppDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Vincular cliente ao lead"
      className="leads-page__modal"
      contentClassName="leads-page__modal-content"
      footer={(
        <AppFormActions className="leads-page__row-actions">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button type="submit" form="link-customer-form" variant="primary" loading={isSubmitting}>
            Salvar
          </Button>
        </AppFormActions>
      )}
    >
      <AppForm
        id="link-customer-form"
        form={form}
        disabled={isSubmitting}
        onSubmit={(values) => {
          onChange(values.customerId);
          onSubmit(values.customerId);
        }}
      >
        <AppSelectField
          name="customerId"
          label="Selecionar cliente"
          placeholder="Remover vinculo"
          options={customerOptions}
          disabled={isSubmitting}
          formatValue={(value) => (typeof value === "string" && value.length > 0 ? value : EMPTY_VALUE)}
          parseValue={(value) => (value === EMPTY_VALUE ? "" : value)}
          onValueChange={(_, formValue) => onChange(typeof formValue === "string" ? formValue : "")}
        />
      </AppForm>
    </AppDialog>
  );
}
