import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { customerFormSchema, type CustomerFormValues } from "@/modules/leads/model";
import { getCustomerDisplayName, type Customer, type CustomerStatus, type CreateCustomerInput } from "@/modules/workspace";
import { AppForm, AppFormGrid, AppSelectField, AppTextField, AppTextareaField } from "@/shared/ui";

function toFormValues(value: CreateCustomerInput): CustomerFormValues {
  return {
    name: value.name ?? "",
    tradeName: value.tradeName ?? "",
    legalName: value.legalName ?? "",
    document: value.document ?? "",
    stateRegistration: value.stateRegistration ?? "",
    municipalRegistration: value.municipalRegistration ?? "",
    taxRegime: value.taxRegime ?? "",
    email: value.email ?? "",
    phone: value.phone ?? "",
    website: value.website ?? "",
    logoUrl: value.logoUrl ?? "",
    status: value.status ?? "prospect",
    notes: value.notes ?? "",
    address: {
      street: value.address?.street ?? "",
      number: value.address?.number ?? "",
      complement: value.address?.complement ?? "",
      district: value.address?.district ?? "",
      city: value.address?.city ?? "",
      state: value.address?.state ?? "",
      zipCode: value.address?.zipCode ?? "",
      country: value.address?.country ?? ""
    },
    sourceWorkItemId: value.sourceWorkItemId ?? ""
  };
}

function cleanAddress(address: CustomerFormValues["address"]): CreateCustomerInput["address"] {
  if (!address) return null;
  const cleaned = Object.fromEntries(
    Object.entries(address).filter(([, entry]) => typeof entry === "string" && entry.trim().length > 0)
  );
  return Object.keys(cleaned).length > 0 ? cleaned : null;
}

function toCustomerInput(values: CustomerFormValues): CreateCustomerInput {
  return {
    ...values,
    address: cleanAddress(values.address)
  };
}

export function CustomerForm({ id, value, duplicates, disabled = false, onChange, onLinkDuplicate, onSubmit }: {
  id?: string;
  value: CreateCustomerInput;
  duplicates: Customer[];
  disabled?: boolean;
  onChange: (value: CreateCustomerInput) => void;
  onLinkDuplicate: (customer: Customer) => void;
  onSubmit?: (value: CreateCustomerInput) => void;
}) {
  const formValues = useMemo(() => toFormValues(value), [value]);
  const lastEmittedValueRef = useRef(JSON.stringify(toCustomerInput(formValues)));
  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    values: formValues,
    mode: "onBlur"
  });

  useEffect(() => {
    const subscription = form.watch((nextValues) => {
      const nextInput = toCustomerInput(nextValues as CustomerFormValues);
      const nextSerialized = JSON.stringify(nextInput);
      if (nextSerialized !== lastEmittedValueRef.current) {
        lastEmittedValueRef.current = nextSerialized;
        onChange(nextInput);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, onChange]);

  return (
    <AppForm<CustomerFormValues, CustomerFormValues>
      id={id}
      form={form}
      disabled={disabled}
      className="leads-page__modal-form"
      onSubmit={(values) => onSubmit?.(toCustomerInput(values))}
    >
      <AppFormGrid className="leads-page__form-grid" columns={3}>
        <AppTextField name="name" label="Nome" required autoFocus />
        <AppTextField name="tradeName" label="Nome fantasia" />
        <AppTextField name="legalName" label="Razao social" />
      </AppFormGrid>
      <AppFormGrid className="leads-page__form-grid" columns={3}>
        <AppTextField name="document" label="CNPJ / CPF" />
        <AppTextField name="stateRegistration" label="Inscricao estadual" />
        <AppTextField name="municipalRegistration" label="Inscricao municipal" />
      </AppFormGrid>
      <AppFormGrid className="leads-page__form-grid" columns={3}>
        <AppTextField name="taxRegime" label="Regime tributario" />
        <AppTextField name="email" label="E-mail" />
        <AppTextField name="phone" label="Telefone" />
      </AppFormGrid>
      <AppFormGrid className="leads-page__form-grid" columns={3}>
        <AppTextField name="website" label="Website" />
        <AppTextField name="logoUrl" label="Logo URL" />
        <AppSelectField<CustomerFormValues, "status", CustomerStatus>
          name="status"
          label="Status"
          options={[
            { value: "prospect", label: "Prospect" },
            { value: "active", label: "Ativo" },
            { value: "inactive", label: "Inativo" },
            { value: "archived", label: "Arquivado" }
          ]}
        />
      </AppFormGrid>
      <AppFormGrid className="leads-page__form-grid" columns={3}>
        <AppTextField name="address.street" label="Endereco" />
        <AppTextField name="address.number" label="Numero" />
        <AppTextField name="address.complement" label="Complemento" />
      </AppFormGrid>
      <AppFormGrid className="leads-page__form-grid" columns={3}>
        <AppTextField name="address.city" label="Cidade" />
        <AppTextField name="address.state" label="Estado" />
        <AppTextField name="address.zipCode" label="CEP" />
      </AppFormGrid>
      <AppTextareaField name="notes" label="Observacoes" rows={3} />
      {duplicates.length > 0 ? (
        <div className="leads-page__duplicates">
          <span className="leads-page__eyebrow">Possiveis duplicados - clique para vincular</span>
          {duplicates.slice(0, 4).map((customer) => (
            <button
              key={customer.id}
              type="button"
              className="leads-duplicate-btn"
              onClick={() => onLinkDuplicate(customer)}
            >
              <div className="leads-customer-avatar">
                <span>{getCustomerDisplayName(customer).slice(0, 2).toUpperCase()}</span>
              </div>
              <div>
                <strong>{getCustomerDisplayName(customer)}</strong>
                <span>{customer.email ?? customer.phone ?? customer.document ?? "Cliente existente"}</span>
              </div>
            </button>
          ))}
        </div>
      ) : null}
    </AppForm>
  );
}
