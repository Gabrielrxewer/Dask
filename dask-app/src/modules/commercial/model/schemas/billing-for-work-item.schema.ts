import { z } from "zod";

export const billingForWorkItemSchema = z
  .object({
    workItemId: z.string().trim().optional().or(z.literal("")),
    customerId: z.string().trim().optional().or(z.literal("")),
    amount: z.string().trim().optional().or(z.literal("")),
    catalogItemId: z.string().trim().optional().or(z.literal("")),
    hasProposalOrContract: z.boolean().default(false),
    justification: z.string().trim().optional().or(z.literal(""))
  })
  .refine(
    (value) => !value.workItemId || value.hasProposalOrContract || Boolean(value.justification),
    {
      message: "Informe uma justificativa formal para cobrar um workItem sem proposta ou contrato.",
      path: ["justification"]
    }
  )
  .refine(
    (value) =>
      !value.workItemId ||
      value.hasProposalOrContract ||
      String(value.justification ?? "").trim().length >= 12,
    {
      message: "A justificativa formal precisa ter pelo menos 12 caracteres.",
      path: ["justification"]
    }
  );

export type BillingForWorkItemInputValues = z.input<typeof billingForWorkItemSchema>;
export type BillingForWorkItemValues = z.output<typeof billingForWorkItemSchema>;
