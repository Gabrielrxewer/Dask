import { z } from "zod";

export const fiscalProfileSchema = z.object({
  id: z.string().uuid().optional(),
  workspaceBusinessId: z.string().trim().optional().nullable(),
  itemType: z.enum(["PRODUCT", "SERVICE"]),
  name: z.string().trim().min(1).max(120),
  descriptionCommercial: z.string().trim().optional().nullable(),
  descriptionFiscal: z.string().trim().optional().nullable(),
  sku: z.string().trim().optional().nullable(),
  unit: z.string().trim().optional().nullable(),
  defaultValue: z.coerce.number().nonnegative().optional().nullable(),
  ncm: z.string().trim().optional().nullable(),
  serviceCode: z.string().trim().optional().nullable(),
  cnae: z.string().trim().optional().nullable(),
  lcItem: z.string().trim().optional().nullable(),
  cfopDefault: z.string().trim().optional().nullable(),
  operationNature: z.string().trim().optional().nullable(),
  taxConfig: z.record(z.string(), z.unknown()).optional().nullable(),
  isActive: z.boolean().default(true),
  metadata: z.record(z.string(), z.unknown()).optional().nullable()
});

export type FiscalProfileValues = z.infer<typeof fiscalProfileSchema>;
