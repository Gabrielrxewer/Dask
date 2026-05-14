export const LEGACY_FIELD_ALIASES = {
  contactEmail: "contact.email",
  contactName: "contact.name",
  contactPhone: "contact.phone",
  companyName: "company.name",
  customerId: "customer.id",
  estimatedValue: "commercial.estimated_value",
  proposalId: "commercial.proposal_id",
  contractId: "commercial.contract_id",
  billingOrderId: "billing.order_id",
  interest: "commercial.interest",
  paymentTerms: "commercial.payment_terms"
} as const;

export type LegacyFieldAlias = keyof typeof LEGACY_FIELD_ALIASES;
export type FieldAliasMap = Record<string, string>;
export type FieldSemanticKeyMap = Record<string, string>;

export const DEFAULT_FIELD_SEMANTIC_KEYS: FieldSemanticKeyMap = {
  contactEmail: LEGACY_FIELD_ALIASES.contactEmail,
  contactName: LEGACY_FIELD_ALIASES.contactName,
  contactPhone: LEGACY_FIELD_ALIASES.contactPhone,
  companyName: LEGACY_FIELD_ALIASES.companyName,
  customerId: LEGACY_FIELD_ALIASES.customerId,
  estimatedValue: LEGACY_FIELD_ALIASES.estimatedValue,
  proposalId: LEGACY_FIELD_ALIASES.proposalId,
  contractId: LEGACY_FIELD_ALIASES.contractId,
  billingOrderId: LEGACY_FIELD_ALIASES.billingOrderId,
  interest: LEGACY_FIELD_ALIASES.interest,
  paymentTerms: LEGACY_FIELD_ALIASES.paymentTerms
};

