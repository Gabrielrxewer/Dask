import type { Task } from "@/entities/task";
import type { WorkItemPublicSchema } from "@/entities/work-item-schema";
import { buildWorkItemDefaultValues, type WorkItemFormValues } from "@/entities/work-item-form/buildWorkItemDefaultValues";

export function mapWorkItemToFormValues(task: Task | null | undefined, schema: WorkItemPublicSchema): WorkItemFormValues {
  const defaults = buildWorkItemDefaultValues(schema);
  if (!task) return defaults;

  return schema.fields.reduce<WorkItemFormValues>((acc, field) => {
    const runtimeFieldId =
      field.metadata && typeof field.metadata.runtimeFieldId === "string" ? field.metadata.runtimeFieldId : null;

    acc[field.key] =
      task.customFields[field.key] ??
      task.customFields[field.id] ??
      (runtimeFieldId ? task.customFields[runtimeFieldId] : undefined) ??
      task.customFieldValuesById?.[field.id] ??
      (runtimeFieldId ? task.customFieldValuesById?.[runtimeFieldId] : undefined) ??
      defaults[field.key];
    return acc;
  }, { ...defaults });
}

