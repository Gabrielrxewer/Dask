import { z } from "zod";

export const fiscalEmissionModeSchema = z.enum(["manual_review", "automatic_after_payment"]);
export const fiscalBillingModelSchema = z.enum(["per_invoice", "initial_total_contract", "custom"]);

export const fiscalEmissionPolicySchema = z.object({
  workspaceId: z.string().uuid(),
  companyId: z.string().uuid(),
  enabled: z.boolean().default(false),
  mode: fiscalEmissionModeSchema.default("manual_review"),
  documentType: z.enum(["NFE", "NFSE"]),
  billingModel: fiscalBillingModelSchema.default("per_invoice"),
  requiresOwnerApproval: z.boolean().default(true),
  requiresFiscalDataComplete: z.boolean().default(true),
  defaultFiscalProfileId: z.string().uuid().optional().nullable(),
  defaultOperationTemplateId: z.string().uuid().optional().nullable(),
  allowStandaloneBilling: z.boolean().default(true),
  allowBillingWithoutContractWithJustification: z.boolean().default(false),
  legalReviewConfirmed: z.boolean().default(false)
}).superRefine((payload, ctx) => {
  if (payload.mode === "automatic_after_payment" && !payload.legalReviewConfirmed) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["legalReviewConfirmed"],
      message: "Emissao automatica exige validacao contabil/juridica."
    });
  }
  if (payload.mode === "automatic_after_payment" && (!payload.defaultFiscalProfileId || !payload.defaultOperationTemplateId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["mode"],
      message: "Emissao automatica exige perfil fiscal e template de operacao."
    });
  }
});

export type FiscalEmissionPolicyValues = z.infer<typeof fiscalEmissionPolicySchema>;
