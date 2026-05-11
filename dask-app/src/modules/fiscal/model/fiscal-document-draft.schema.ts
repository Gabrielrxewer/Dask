import { z } from "zod";

const moneySchema = z.string().trim().regex(/^\d+([,.]\d{1,2})?$/, "Informe um valor monetario valido.");

export const fiscalDocumentDraftSchema = z.object({
  workspaceBusinessId: z.string().trim().optional().nullable(),
  companyConfigId: z.string().trim().optional().nullable(),
  documentType: z.enum(["NFE", "NFSE"]),
  origin: z.enum([
    "MANUAL_PRODUCT",
    "MANUAL_SERVICE",
    "CATALOG_PRODUCT",
    "CATALOG_SERVICE",
    "STRIPE_PAYMENT",
    "STRIPE_SUBSCRIPTION"
  ]),
  customerId: z.string().trim().optional().nullable(),
  customerDocument: z.string().trim().min(11),
  customerEmail: z.string().trim().email().optional().nullable(),
  amountTotal: moneySchema,
  payload: z.record(z.string(), z.unknown()).optional().default({})
});

export type FiscalDocumentDraftFormValues = z.infer<typeof fiscalDocumentDraftSchema>;
