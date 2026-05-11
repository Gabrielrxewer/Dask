import { workItemPublicFieldSchema } from "@/entities/work-item-schema/model/work-item-field.zod";
import type { WorkItemPublicField } from "@/entities/work-item-schema/model/work-item-field.types";

export function validatePublicField(field: WorkItemPublicField) {
  return workItemPublicFieldSchema.safeParse(field);
}

