import { z } from "zod";

export function normalizeFiscalDocument(value: string): string {
  return value.replace(/\D/g, "");
}

export const fiscalStripePolicySchema = z.enum(["manual_review", "automatic_after_payment"]);

export function normalizeFiscalStripePolicy(
  value: string | null | undefined,
  emitAutomatically = false
): z.infer<typeof fiscalStripePolicySchema> {
  if (value === "automatic_after_payment" || emitAutomatically) {
    return "automatic_after_payment";
  }
  return "manual_review";
}

export const fiscalCompanySchema = z.object({
  workspaceBusinessId: z.string().trim().optional().nullable(),
  displayName: z.string().trim().min(2).max(120),
  legalName: z.string().trim().min(2).max(160),
  cnpj: z.string().trim().transform(normalizeFiscalDocument).refine((value) => value.length === 14, {
    message: "Informe um CNPJ valido."
  }),
  stateRegistration: z.string().trim().optional().nullable(),
  municipalRegistration: z.string().trim().optional().nullable(),
  taxRegime: z.string().trim().optional().nullable(),
  focusToken: z.string().trim().min(10),
  focusEnvironment: z.enum(["homologacao", "producao"]).default("homologacao"),
  focusCompanyReference: z.string().trim().optional().nullable(),
  focusWebhookSecret: z.string().trim().optional().nullable(),
  emitAutomatically: z.boolean().default(false),
  stripePolicy: fiscalStripePolicySchema.default("manual_review"),
  defaultSerie: z.string().trim().optional().nullable(),
  defaultNatureOperation: z.string().trim().optional().nullable(),
  fallbackRules: z.record(z.string(), z.unknown()).optional().nullable(),
  syncConfig: z.record(z.string(), z.unknown()).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable()
});

export type FiscalCompanyFormValues = z.infer<typeof fiscalCompanySchema>;
