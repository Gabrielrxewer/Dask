import { z } from "zod";

export const billingForLeadSchema = z
  .object({
    leadId: z.string().trim().optional().or(z.literal("")),
    customerId: z.string().trim().optional().or(z.literal("")),
    amount: z.string().trim().optional().or(z.literal("")),
    catalogItemId: z.string().trim().optional().or(z.literal("")),
    hasProposalOrContract: z.boolean().default(false),
    justification: z.string().trim().optional().or(z.literal(""))
  })
  .refine(
    (value) => !value.leadId || value.hasProposalOrContract || Boolean(value.justification),
    {
      message: "Informe uma justificativa formal para cobrar um lead sem proposta ou contrato.",
      path: ["justification"]
    }
  )
  .refine(
    (value) =>
      !value.leadId ||
      value.hasProposalOrContract ||
      String(value.justification ?? "").trim().length >= 12,
    {
      message: "A justificativa formal precisa ter pelo menos 12 caracteres.",
      path: ["justification"]
    }
  );

export type BillingForLeadInputValues = z.input<typeof billingForLeadSchema>;
export type BillingForLeadValues = z.output<typeof billingForLeadSchema>;
