import type { Task, TaskFieldDefinition } from "@/entities/task";
import type { Customer, WorkspaceDocument, WorkspaceSnapshot } from "@/modules/workspace/model/types";

export interface DocumentVariableContext {
  document: WorkspaceDocument;
  workItem?: Task | null;
  customer?: Customer | null;
  workspace?: Pick<WorkspaceSnapshot, "id" | "name" | "membersById" | "currentUserId"> | null;
  owner?: { name?: string | null } | null;
  fieldDefinitions?: TaskFieldDefinition[];
  fieldValues?: Record<string, unknown>;
}

export type DocumentVariables = Record<string, string>;

function asString(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

function firstText(...values: unknown[]): string {
  for (const value of values) {
    const normalized = asString(value);
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return "";
}

function firstValue(...values: unknown[]): unknown {
  for (const value of values) {
    if (value === undefined || value === null) {
      continue;
    }

    if (typeof value === "string" && value.trim().length === 0) {
      continue;
    }

    return value;
  }

  return undefined;
}

function formatDate(value: unknown, fallbackToToday = false): string {
  const text = asString(value);
  if (!text && !fallbackToToday) {
    return "";
  }

  const date = text ? new Date(text) : new Date();
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString("pt-BR");
}

function formatNumber(value: unknown): string {
  const raw = typeof value === "number" ? value : Number(asString(value).replace(",", "."));
  if (!Number.isFinite(raw)) {
    return "";
  }

  return new Intl.NumberFormat("pt-BR").format(raw);
}

function formatCurrency(value: unknown): string {
  const raw = typeof value === "number" ? value : Number(asString(value).replace(",", "."));
  if (!Number.isFinite(raw)) {
    return "";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(raw);
}

function formatAddress(customer?: Customer | null): string {
  const address = customer?.address;
  if (!address) {
    return "";
  }

  return [
    [address.street, address.number].filter(Boolean).join(", "),
    address.complement,
    address.district,
    [address.city, address.state].filter(Boolean).join(" / "),
    address.zipCode,
    address.country
  ]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" - ");
}

function generatedProposalCode(document: WorkspaceDocument): string {
  const year = new Date(document.createdAt || Date.now()).getFullYear();
  const numeric = document.id.replace(/\D/g, "").slice(-5).padStart(5, "0") || "00001";
  return `PROP-${year}-${numeric}`;
}

function sanitizeVariableValue(value: string): string {
  return value.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
}

function formatDynamicFieldValue(field: TaskFieldDefinition, value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  if (field.type === "date" || field.type === "datetime") {
    return formatDate(value);
  }

  if (field.type === "number") {
    const key = field.variableKey?.toLowerCase() ?? "";
    return key.includes("value") || key.includes("amount") || key.includes("price") || key === "dealvalue"
      ? formatCurrency(value)
      : formatNumber(value);
  }

  if (Array.isArray(value)) {
    return value.map(asString).filter(Boolean).join(", ");
  }

  if (typeof value === "object") {
    return "";
  }

  return asString(value);
}

function resolveDynamicFieldVariables(
  fieldDefinitions: TaskFieldDefinition[] | undefined,
  workItem?: Task | null,
  explicitFieldValues?: Record<string, unknown>
): DocumentVariables {
  if (!fieldDefinitions?.length || !workItem) {
    return {};
  }

  const valuesById = {
    ...(workItem.customFieldValuesById ?? {}),
    ...(explicitFieldValues ?? {})
  };
  const valuesBySlug = workItem.customFields ?? {};

  return fieldDefinitions.reduce<DocumentVariables>((acc, field) => {
    const variableKey = field.variableKey?.trim();
    if (!variableKey) {
      return acc;
    }

    const rawValue = firstValue(
      field.definitionId ? valuesById[field.definitionId] : undefined,
      valuesById[field.id],
      field.slug ? valuesBySlug[field.slug] : undefined,
      valuesBySlug[field.id]
    );
    acc[variableKey] = sanitizeVariableValue(formatDynamicFieldValue(field, rawValue));
    return acc;
  }, {});
}

export function resolveDocumentVariables({
  document,
  workItem,
  customer,
  workspace,
  owner,
  fieldDefinitions,
  fieldValues
}: DocumentVariableContext): DocumentVariables {
  const fields = workItem?.customFields ?? {};
  const metadata = document.metadata ?? {};
  const dynamicVariables = resolveDynamicFieldVariables(fieldDefinitions, workItem, fieldValues);
  const ownerName = firstText(
    metadata.ownerName,
    owner?.name,
    workItem?.assignee ? workspace?.membersById?.[workItem.assignee]?.name : "",
    workspace?.membersById?.[workspace.currentUserId ?? ""]?.name
  );
  const clientName = firstText(
    metadata.clientName,
    customer?.tradeName,
    customer?.legalName,
    customer?.name,
    dynamicVariables.clientName,
    fields.clientName,
    fields.companyName,
    fields.contactName
  );
  const dealValue = firstText(dynamicVariables.dealValue, formatCurrency(firstText(fields.estimatedValue, fields.value)));

  return {
    ...dynamicVariables,
    clientLogoUrl: sanitizeVariableValue(firstText(metadata.clientLogoUrl, customer?.logoUrl, dynamicVariables.clientLogoUrl, fields.clientLogoUrl)),
    clientName: sanitizeVariableValue(clientName),
    ownerName: sanitizeVariableValue(ownerName),
    proposalDate: sanitizeVariableValue(formatDate(firstText(metadata.proposalDate, document.createdAt), true)),
    proposalValidity: sanitizeVariableValue(firstText(metadata.proposalValidity, fields.proposalValidity)),
    proposalCode: sanitizeVariableValue(firstText(metadata.proposalCode, generatedProposalCode(document))),
    dealTitle: sanitizeVariableValue(firstText(workItem?.title)),
    dealDescription: sanitizeVariableValue(firstText(workItem?.text)),
    dealValue: sanitizeVariableValue(dealValue),
    contactName: sanitizeVariableValue(firstText(dynamicVariables.contactName, fields.contactName)),
    contactEmail: sanitizeVariableValue(firstText(dynamicVariables.contactEmail, fields.contactEmail)),
    contactPhone: sanitizeVariableValue(firstText(dynamicVariables.contactPhone, fields.contactPhone)),
    clientDocument: sanitizeVariableValue(firstText(customer?.document)),
    clientAddress: sanitizeVariableValue(formatAddress(customer)),
    companyDocument: sanitizeVariableValue(firstText(customer?.document)),
    companyAddress: sanitizeVariableValue(formatAddress(customer)),
    companyName: sanitizeVariableValue(firstText(workspace?.name)),
    paymentTerms: sanitizeVariableValue(firstText(metadata.paymentTerms, dynamicVariables.paymentTerms, fields.paymentTerms)),
    expectedCloseDate: sanitizeVariableValue(firstText(dynamicVariables.expectedCloseDate, formatDate(fields.expectedCloseDate)))
  };
}

export function interpolateDocumentTemplate(content: string, variables: DocumentVariables): string {
  return content.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(variables, key)) {
      return match;
    }

    return variables[key] ?? "";
  });
}
