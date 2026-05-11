import { z } from "zod";

export const fiscalIssueDocumentSchema = z.object({
  documentId: z.string().uuid(),
  confirmFiscalDataReviewed: z.literal(true, {
    message: "Revise os dados fiscais antes de emitir."
  })
});

export type FiscalIssueDocumentValues = z.infer<typeof fiscalIssueDocumentSchema>;
