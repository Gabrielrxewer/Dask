import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef } from "react";
import { useForm, type DeepPartialSkipArrayKey } from "react-hook-form";
import { customerFormSchema, type CustomerFormInputValues, type CustomerFormValues } from "@/modules/commercial/model";
import { getCustomerDisplayName, type Customer, type CustomerStatus, type CreateCustomerInput } from "@/modules/workspace";
import { AppForm, AppFormGrid, AppSelectField, AppTextField, AppTextareaField } from "@/shared/ui";

type CustomerFormDraftValues = DeepPartialSkipArrayKey<CustomerFormInputValues>;

const customerAddressKeys = [
  "street",
  "number",
  "complement",
  "district",
  "city",
  "state",
  "zipCode",
  "country"
] as const;

function readFormText(value: unknown): string | null {
  if (typeof value === "string") return value;
  return value === null ? null : "";
}

function toFormValues(value: CreateCustomerInput): CustomerFormInputValues {
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

function cleanAddress(address: CustomerFormDraftValues["address"]): CreateCustomerInput["address"] {
  if (!address) return null;
  const cleaned: NonNullable<CreateCustomerInput["address"]> = {};
  for (const key of customerAddressKeys) {
    const entry = address[key];
    if (typeof entry === "string" && entry.trim().length > 0) {
      cleaned[key] = entry.trim();
    }
  }
  return Object.keys(cleaned).length > 0 ? cleaned : null;
}

function toCustomerInput(values: CustomerFormDraftValues): CreateCustomerInput {
  return {
    name: typeof values.name === "string" ? values.name : "",
    tradeName: readFormText(values.tradeName),
    legalName: readFormText(values.legalName),
    document: readFormText(values.document),
    stateRegistration: readFormText(values.stateRegistration),
    municipalRegistration: readFormText(values.municipalRegistration),
    taxRegime: readFormText(values.taxRegime),
    email: readFormText(values.email),
    phone: readFormText(values.phone),
    website: readFormText(values.website),
    logoUrl: readFormText(values.logoUrl),
    status: values.status ?? "prospect",
    notes: readFormText(values.notes),
    address: cleanAddress(values.address),
    sourceWorkItemId: readFormText(values.sourceWorkItemId)
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
  const form = useForm<CustomerFormInputValues, unknown, CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    values: formValues,
    mode: "onBlur"
  });

  useEffect(() => {
    const subscription = form.watch((nextValues) => {
      const nextInput = toCustomerInput(nextValues);
      const nextSerialized = JSON.stringify(nextInput);
      if (nextSerialized !== lastEmittedValueRef.current) {
        lastEmittedValueRef.current = nextSerialized;
        onChange(nextInput);
      }
    });
    return () => subscription.unsubscribe();
  }, [form, onChange]);

  return (
    <AppForm<CustomerFormInputValues, CustomerFormValues>
      id={id}
      form={form}
      disabled={disabled}
      className="commercial-page__modal-form"
      onSubmit={(values) => onSubmit?.(toCustomerInput(values))}
    >
      <AppFormGrid className="commercial-page__form-grid" columns={3}>
        <AppTextField<CustomerFormInputValues> name="name" label="Nome" required autoFocus />
        <AppTextField<CustomerFormInputValues> name="tradeName" label="Nome fantasia" />
        <AppTextField<CustomerFormInputValues> name="legalName" label="Razao social" />
      </AppFormGrid>
      <AppFormGrid className="commercial-page__form-grid" columns={3}>
        <AppTextField<CustomerFormInputValues> name="document" label="CNPJ / CPF" />
        <AppTextField<CustomerFormInputValues> name="stateRegistration" label="Inscricao estadual" />
        <AppTextField<CustomerFormInputValues> name="municipalRegistration" label="Inscricao municipal" />
      </AppFormGrid>
      <AppFormGrid className="commercial-page__form-grid" columns={3}>
        <AppTextField<CustomerFormInputValues> name="taxRegime" label="Regime tributario" />
        <AppTextField<CustomerFormInputValues> name="email" label="E-mail" />
        <AppTextField<CustomerFormInputValues> name="phone" label="Telefone" />
      </AppFormGrid>
      <AppFormGrid className="commercial-page__form-grid" columns={3}>
        <AppTextField<CustomerFormInputValues> name="website" label="Website" />
        <AppTextField<CustomerFormInputValues> name="logoUrl" label="Logo URL" />
        <AppSelectField<CustomerFormInputValues, "status", CustomerStatus>
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
      <AppFormGrid className="commercial-page__form-grid" columns={3}>
        <AppTextField<CustomerFormInputValues> name="address.street" label="Endereco" />
        <AppTextField<CustomerFormInputValues> name="address.number" label="Numero" />
        <AppTextField<CustomerFormInputValues> name="address.complement" label="Complemento" />
      </AppFormGrid>
      <AppFormGrid className="commercial-page__form-grid" columns={3}>
        <AppTextField<CustomerFormInputValues> name="address.city" label="Cidade" />
        <AppTextField<CustomerFormInputValues> name="address.state" label="Estado" />
        <AppTextField<CustomerFormInputValues> name="address.zipCode" label="CEP" />
      </AppFormGrid>
      <AppTextareaField<CustomerFormInputValues> name="notes" label="Observacoes" rows={3} />
      {duplicates.length > 0 ? (
        <div className="commercial-page__duplicates">
          <span className="commercial-page__eyebrow">Possiveis duplicados - clique para vincular</span>
          {duplicates.slice(0, 4).map((customer) => (
            <button
              key={customer.id}
              type="button"
              className="commercial-duplicate-btn"
              onClick={() => onLinkDuplicate(customer)}
            >
              <div className="commercial-customer-avatar">
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
