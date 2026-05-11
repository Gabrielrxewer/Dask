import { z } from "zod";

export const billingCatalogKindSchema = z.enum(["PRODUCT", "SERVICE"]);
export const billingCatalogBillingTypeSchema = z.enum(["ONE_TIME", "ASSINATURA", "SUBSCRIPTION"]);
export const billingCatalogRecurringIntervalSchema = z.enum(["DAY", "WEEK", "MONTH", "YEAR"]);

export function parseMoneyToCents(value: string): number | null {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return Math.round(parsed * 100);
}

export function formatCentsToMoneyInput(amountInCents: number): string {
  return (amountInCents / 100).toFixed(2);
}

export function normalizeMoneyInput(value: string): string {
  const amountInCents = parseMoneyToCents(value);
  return amountInCents === null ? value.trim() : formatCentsToMoneyInput(amountInCents);
}

const requiredText = (min = 3) => z.string().trim().min(min);

export const billingCatalogItemFormSchema = z.object({
  kind: billingCatalogKindSchema,
  billingType: billingCatalogBillingTypeSchema.default("ONE_TIME"),
  recurringInterval: billingCatalogRecurringIntervalSchema.optional(),
  recurringIntervalCount: z.coerce.number().int().min(1).max(36).optional(),
  name: z.string().trim().min(2).max(120),
  description: requiredText(3).max(280),
  amount: z.string().trim().refine((value) => parseMoneyToCents(value) !== null, {
    message: "Informe um valor maior que zero."
  }),
  currency: z.string().trim().length(3).default("brl"),
  unit: requiredText(1),
  defaultQuantity: requiredText(1),
  scope: requiredText(),
  deliverables: requiredText(),
  deliveryTerms: requiredText(),
  paymentTerms: requiredText(),
  proposalValidity: requiredText(),
  contractTerm: requiredText(),
  cancellationTerms: requiredText(),
  clientResponsibilities: requiredText(),
  acceptanceCriteria: requiredText(),
  contractNotes: z.string().trim().optional().default("")
}).superRefine((payload, ctx) => {
  const isRecurring = payload.billingType === "ASSINATURA" || payload.billingType === "SUBSCRIPTION";
  if (isRecurring && !payload.recurringInterval) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["recurringInterval"],
      message: "Informe a recorrencia do item."
    });
  }
  if (!isRecurring && (payload.recurringInterval || payload.recurringIntervalCount)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["billingType"],
      message: "Recorrencia so pode ser usada em assinatura."
    });
  }
});

export type BillingCatalogItemFormValues = z.infer<typeof billingCatalogItemFormSchema>;

export function toBillingCatalogItemPayload(values: BillingCatalogItemFormValues) {
  return {
    kind: values.kind,
    billingType: values.billingType,
    recurringInterval:
      values.billingType === "ONE_TIME" ? undefined : values.recurringInterval,
    recurringIntervalCount:
      values.billingType === "ONE_TIME" ? undefined : values.recurringIntervalCount ?? 1,
    name: values.name.trim(),
    description: values.description.trim(),
    amount: parseMoneyToCents(values.amount) ?? 0,
    currency: values.currency.toLowerCase(),
    metadata: {
      unit: values.unit.trim(),
      defaultQuantity: values.defaultQuantity.trim(),
      scope: values.scope.trim(),
      deliverables: values.deliverables.trim(),
      deliveryTerms: values.deliveryTerms.trim(),
      paymentTerms: values.paymentTerms.trim(),
      proposalValidity: values.proposalValidity.trim(),
      contractTerm: values.contractTerm.trim(),
      cancellationTerms: values.cancellationTerms.trim(),
      clientResponsibilities: values.clientResponsibilities.trim(),
      acceptanceCriteria: values.acceptanceCriteria.trim(),
      contractNotes: values.contractNotes.trim()
    }
  };
}
