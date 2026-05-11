import { z } from "zod";

export const fiscalOperationTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  workspaceBusinessId: z.string().trim().optional().nullable(),
  name: z.string().trim().min(1).max(120),
  documentType: z.enum(["NFE", "NFSE"]),
  itemType: z.enum(["PRODUCT", "SERVICE"]).optional().nullable(),
  serie: z.string().trim().optional().nullable(),
  natureOperation: z.string().trim().optional().nullable(),
  cfop: z.string().trim().optional().nullable(),
  taxDefaults: z.record(z.string(), z.unknown()).optional().nullable(),
  notes: z.string().trim().optional().nullable(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true)
});

export type FiscalOperationTemplateValues = z.infer<typeof fiscalOperationTemplateSchema>;
