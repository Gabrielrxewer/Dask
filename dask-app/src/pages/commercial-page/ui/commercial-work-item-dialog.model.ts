import type { TaskFieldDefinition } from "@/entities/task";
import type { ConnectCatalogItem } from "@/modules/billing";
import type { CreateCommercialWorkItemInput } from "@/modules/commercial";
import type { CommercialWorkItemFormValues } from "@/modules/commercial/model";
import { getCustomerDisplayName, type CreateCustomerInput, type Customer } from "@/modules/workspace";
import {
  buildCustomFieldValuesBySlug,
  formatCustomerAddress,
  type CommercialWorkItemFormState
} from "./commercial-page.model";

export type CommercialWorkItemKind = "workItem" | "signal";

export interface CommercialWorkItemSubmitOptions {
  kind: CommercialWorkItemKind;
  commercialTypeId: string;
  signalTypeId: string;
  initialStatusId: string;
  signalInitialStatusId: string;
  fieldDefinitions: TaskFieldDefinition[];
  catalogItemsById: Map<string, ConnectCatalogItem>;
}

export interface CommercialWorkItemSubmitDependencies {
  customers: Customer[];
  createCustomer: (input: CreateCustomerInput) => Promise<Customer>;
  createWorkItem: (input: CreateCommercialWorkItemInput) => Promise<unknown>;
}

export function findMatchingCustomerForCommercialForm(
  form: CommercialWorkItemFormState,
  customers: Customer[]
): Customer | null {
  const email = form.contactEmail.trim().toLowerCase();
  const phone = form.contactPhone.replace(/\D/g, "");
  const name = (form.companyName.trim() || form.contactName.trim()).toLowerCase();

  return customers.find((customer) => {
    const customerPhone = String(customer.phone ?? "").replace(/\D/g, "");
    return (
      (email.length > 0 && customer.email?.toLowerCase() === email) ||
      (phone.length > 0 && customerPhone === phone) ||
      (name.length > 0 && getCustomerDisplayName(customer).trim().toLowerCase() === name)
    );
  }) ?? null;
}

export async function resolveCustomerForCommercialForm(
  form: CommercialWorkItemFormValues,
  customers: Customer[],
  createCustomer: (input: CreateCustomerInput) => Promise<Customer>
): Promise<Customer | null> {
  if (form.customerId) {
    return customers.find((customer) => customer.id === form.customerId) ?? null;
  }

  const existing = findMatchingCustomerForCommercialForm(form, customers);
  if (existing) return existing;

  const companyName = form.companyName.trim();
  const contactName = form.contactName.trim();
  const name = companyName || contactName;

  if (!name) return null;

  return createCustomer({
    name,
    tradeName: companyName || null,
    email: form.contactEmail.trim() || null,
    phone: form.contactPhone.trim() || null,
    status: "prospect",
    notes: form.notes.trim() || null
  });
}

export function buildCommercialWorkItemInput(
  form: CommercialWorkItemFormValues,
  customer: Customer | null,
  options: CommercialWorkItemSubmitOptions
): CreateCommercialWorkItemInput {
  const isSignal = options.kind === "signal";
  const typeSlug = isSignal ? options.signalTypeId : options.commercialTypeId;
  const stateSlug = isSignal ? options.signalInitialStatusId : options.initialStatusId;

  if (!typeSlug || !stateSlug) {
    throw new Error(
      isSignal
        ? "Metadados comerciais do board nao configurados para criar sinais."
        : "Metadados comerciais do board nao configurados para criar WorkItems comerciais."
    );
  }

  const companyNameInput = form.companyName.trim();
  const contactName = form.contactName.trim();
  const catalogItem = form.interest ? options.catalogItemsById.get(form.interest) ?? null : null;
  const catalogMetadata = catalogItem?.metadata ?? {};
  const titleBase = companyNameInput || contactName || catalogItem?.name;

  if (!titleBase) {
    throw new Error("Informe empresa, contato ou interesse para criar o WorkItem comercial.");
  }

  const companyName = companyNameInput || getCustomerDisplayName(customer);
  const rawEstimatedValue = form.estimatedValue.trim();
  const estimatedValue = rawEstimatedValue ? Number(rawEstimatedValue.replace(",", ".")) : Number.NaN;
  const catalogAmount = catalogItem ? catalogItem.amount / 100 : undefined;
  const fields = {
    customerId: customer?.id || undefined,
    clientName: getCustomerDisplayName(customer) || companyName || contactName,
    companyName: companyName || undefined,
    clientLegalName: customer?.legalName || customer?.tradeName || customer?.name || undefined,
    clientDocument: customer?.document || undefined,
    clientAddress: formatCustomerAddress(customer) || undefined,
    clientLogoUrl: customer?.logoUrl || undefined,
    contactName: contactName || undefined,
    contactEmail: form.contactEmail.trim() || customer?.email || undefined,
    contactPhone: form.contactPhone.trim() || customer?.phone || undefined,
    source: form.source.trim() || undefined,
    interest: catalogItem?.id || undefined,
    estimatedValue: Number.isFinite(estimatedValue) ? estimatedValue : catalogAmount,
    proposalValidity: form.proposalValidity || catalogMetadata.proposalValidity || undefined,
    paymentTerms: catalogMetadata.paymentTerms || undefined
  };

  return {
    typeSlug,
    title: titleBase,
    description: form.notes.trim() || catalogMetadata.scope || catalogItem?.description || catalogItem?.name || "",
    stateSlug,
    fields,
    customFieldValues: buildCustomFieldValuesBySlug(options.fieldDefinitions, fields)
  };
}

export async function submitCommercialWorkItem(
  form: CommercialWorkItemFormValues,
  options: CommercialWorkItemSubmitOptions,
  dependencies: CommercialWorkItemSubmitDependencies
) {
  const customer = await resolveCustomerForCommercialForm(
    form,
    dependencies.customers,
    dependencies.createCustomer
  );
  const input = buildCommercialWorkItemInput(form, customer, options);

  await dependencies.createWorkItem(input);

  return { customer, input };
}
