import type { Task } from "@/entities/task";
import type { WorkItemPublicSchema } from "@/entities/work-item-schema";
import { buildWorkItemDefaultValues, type WorkItemFormValues } from "@/entities/work-item-form/buildWorkItemDefaultValues";

export function mapWorkItemToFormValues(task: Task | null | undefined, schema: WorkItemPublicSchema): WorkItemFormValues {
  const defaults = buildWorkItemDefaultValues(schema);
  if (!task) return defaults;

  return schema.fields.reduce<WorkItemFormValues>((acc, field) => {
    acc[field.key] = task.customFields[field.key] ?? task.customFieldValuesById?.[field.id] ?? defaults[field.key];
    return acc;
  }, { ...defaults });
}

