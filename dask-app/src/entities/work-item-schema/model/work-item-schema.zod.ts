import { z } from "zod";
import { WORK_ITEM_SCHEMA_VERSION } from "@/entities/work-item-schema/model/work-item-schema-version";
import { workItemPublicFieldSchema } from "@/entities/work-item-schema/model/work-item-field.zod";
import { workItemPublicLayoutSchema } from "@/entities/work-item-schema/model/work-item-layout.zod";

export const workItemPublicSchemaZod = z.object({
  schemaVersion: z.literal(WORK_ITEM_SCHEMA_VERSION),
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  fields: z.array(workItemPublicFieldSchema),
  layouts: z.object({
    card: workItemPublicLayoutSchema,
    detail: workItemPublicLayoutSchema,
    form: workItemPublicLayoutSchema
  }),
  workflow: z.object({
    stateIds: z.array(z.string().min(1))
  }),
  permissions: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  createdBy: z.string().nullable().optional(),
  updatedBy: z.string().nullable().optional()
});

export type WorkItemPublicSchemaZod = z.infer<typeof workItemPublicSchemaZod>;

