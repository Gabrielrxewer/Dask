import { z } from "zod";

export const workItemLayoutFieldRefSchema = z.object({
  fieldId: z.string().min(1),
  area: z.string().optional(),
  section: z.string().nullable().optional(),
  order: z.number().int().nonnegative(),
  visible: z.boolean().optional(),
  required: z.boolean().optional(),
  readonly: z.boolean().optional(),
  display: z.record(z.string(), z.unknown()).optional()
});

export const workItemPublicLayoutSchema = z.object({
  surface: z.enum(["card", "detail", "form"]),
  fields: z.array(workItemLayoutFieldRefSchema),
  sections: z
    .array(z.object({
      id: z.string().min(1),
      title: z.string().min(1),
      order: z.number().int().nonnegative()
    }))
    .optional()
});

