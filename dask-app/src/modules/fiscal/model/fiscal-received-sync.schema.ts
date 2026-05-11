import { z } from "zod";

export const fiscalReceivedSyncSchema = z.object({
  companyConfigId: z.string().uuid(),
  type: z.enum(["NFE_MDE", "NFSE_NFSER"]),
  trigger: z.enum(["MANUAL", "SCHEDULED", "WEBHOOK", "RETRY"]).default("MANUAL")
});

export type FiscalReceivedSyncValues = z.infer<typeof fiscalReceivedSyncSchema>;
