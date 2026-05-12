export type CommercialTemplateKey = "signal" | "workItem" | "customer" | "opportunity";

export type CommercialFieldKey =
  | "customerId"
  | "customerName"
  | "customerDocument"
  | "customerEmail"
  | "customerPhone"
  | "source"
  | "estimatedValue"
  | "proposalId"
  | "contractId"
  | "billingOrderId"
  | "nextActionAt"
  | "ownerId"
  | "priority"
  | "conversionStatus";

export interface CommercialFieldDefinition {
  key: CommercialFieldKey;
  label: string;
  type: "text" | "email" | "phone" | "currency" | "date" | "user" | "select" | "reference" | "number";
  required?: boolean;
  options?: string[];
}

export interface CommercialTemplateVersion {
  version: number;
  fields: CommercialFieldDefinition[];
  compatibleFrom?: number;
}

export interface CommercialTemplate {
  key: CommercialTemplateKey;
  name: string;
  currentVersion: number;
  versions: CommercialTemplateVersion[];
}

export interface CommercialTemplateMigration {
  fromTemplate: CommercialTemplateKey;
  toTemplate: CommercialTemplateKey;
  fromVersion: number;
  toVersion: number;
  fieldMap: Partial<Record<CommercialFieldKey, CommercialFieldKey>>;
}

const sharedRelationshipFields: CommercialFieldDefinition[] = [
  { key: "customerId", label: "Cliente vinculado", type: "reference" },
  { key: "proposalId", label: "Proposta", type: "reference" },
  { key: "contractId", label: "Contrato", type: "reference" },
  { key: "billingOrderId", label: "Cobranca", type: "reference" }
];

export const commercialTemplates: Record<CommercialTemplateKey, CommercialTemplate> = {
  signal: {
    key: "signal",
    name: "Commercial Signal",
    currentVersion: 1,
    versions: [
      {
        version: 1,
        fields: [
          { key: "customerName", label: "Nome do contato/empresa", type: "text", required: true },
          { key: "customerEmail", label: "E-mail", type: "email" },
          { key: "customerPhone", label: "Telefone", type: "phone" },
          { key: "source", label: "Origem", type: "text", required: true },
          { key: "estimatedValue", label: "Valor estimado", type: "currency" },
          { key: "nextActionAt", label: "Proxima acao", type: "date" },
          { key: "ownerId", label: "Responsavel", type: "user" },
          { key: "priority", label: "Prioridade", type: "number" },
          { key: "conversionStatus", label: "Conversao", type: "select", options: ["new", "qualified", "discarded"] }
        ]
      }
    ]
  },
  workItem: {
    key: "workItem",
    name: "Commercial WorkItem",
    currentVersion: 1,
    versions: [
      {
        version: 1,
        fields: [
          { key: "customerName", label: "Cliente", type: "text", required: true },
          { key: "customerDocument", label: "Documento", type: "text" },
          { key: "customerEmail", label: "E-mail", type: "email" },
          { key: "customerPhone", label: "Telefone", type: "phone" },
          { key: "source", label: "Origem", type: "text" },
          { key: "estimatedValue", label: "Valor estimado", type: "currency" },
          { key: "nextActionAt", label: "Proxima acao", type: "date" },
          { key: "ownerId", label: "Responsavel", type: "user" },
          { key: "priority", label: "Prioridade", type: "number" },
          { key: "conversionStatus", label: "Conversao", type: "select", options: ["open", "won", "lost"] },
          ...sharedRelationshipFields
        ]
      }
    ]
  },
  customer: {
    key: "customer",
    name: "Commercial Customer",
    currentVersion: 1,
    versions: [
      {
        version: 1,
        fields: [
          { key: "customerId", label: "Cliente", type: "reference", required: true },
          { key: "customerName", label: "Nome", type: "text", required: true },
          { key: "customerDocument", label: "Documento", type: "text" },
          { key: "customerEmail", label: "E-mail", type: "email" },
          { key: "customerPhone", label: "Telefone", type: "phone" },
          { key: "ownerId", label: "Responsavel", type: "user" }
        ]
      }
    ]
  },
  opportunity: {
    key: "opportunity",
    name: "Commercial Opportunity",
    currentVersion: 1,
    versions: [
      {
        version: 1,
        fields: [
          { key: "customerId", label: "Cliente", type: "reference", required: true },
          { key: "estimatedValue", label: "Valor estimado", type: "currency", required: true },
          { key: "proposalId", label: "Proposta", type: "reference" },
          { key: "contractId", label: "Contrato", type: "reference" },
          { key: "billingOrderId", label: "Cobranca", type: "reference" },
          { key: "nextActionAt", label: "Proxima acao", type: "date" },
          { key: "ownerId", label: "Responsavel", type: "user" },
          { key: "conversionStatus", label: "Status", type: "select", options: ["open", "proposal", "contract", "won", "lost"] }
        ]
      }
    ]
  }
};

export const commercialTemplateMigrations: CommercialTemplateMigration[] = [
  {
    fromTemplate: "signal",
    toTemplate: "workItem",
    fromVersion: 1,
    toVersion: 1,
    fieldMap: {
      customerName: "customerName",
      customerEmail: "customerEmail",
      customerPhone: "customerPhone",
      source: "source",
      estimatedValue: "estimatedValue",
      nextActionAt: "nextActionAt",
      ownerId: "ownerId",
      priority: "priority",
      conversionStatus: "conversionStatus"
    }
  }
];

export function getCommercialTemplate(key: CommercialTemplateKey, version?: number): CommercialTemplateVersion {
  const template = commercialTemplates[key];
  const resolvedVersion = version ?? template.currentVersion;
  const found = template.versions.find((entry) => entry.version === resolvedVersion);
  if (!found) {
    throw new Error(`Commercial template ${key}@${resolvedVersion} not found.`);
  }
  return found;
}

export function getCommercialFieldDefinition(
  templateKey: CommercialTemplateKey,
  fieldKey: CommercialFieldKey,
  version?: number
): CommercialFieldDefinition | null {
  return getCommercialTemplate(templateKey, version).fields.find((field) => field.key === fieldKey) ?? null;
}

export function listCommercialFieldKeys(templateKey: CommercialTemplateKey, version?: number): CommercialFieldKey[] {
  return getCommercialTemplate(templateKey, version).fields.map((field) => field.key);
}
