import { z } from "zod";

export const billingPortalTokenScopeSchema = z.enum([
  "view",
  "pay",
  "download_receipt",
  "download_fiscal_document"
]);

export const billingPortalTokenFormSchema = z.object({
  expiresInSeconds: z.coerce.number().int().min(60).max(30 * 24 * 60 * 60).default(7 * 24 * 60 * 60),
  scopes: z.array(billingPortalTokenScopeSchema).min(1).default(["view", "pay", "download_receipt"])
});

export type BillingPortalTokenFormValues = z.infer<typeof billingPortalTokenFormSchema>;
