import type { UpdateTaskInput } from "@/modules/workspace";
import type { WorkItemPublicSchema } from "@/entities/work-item-schema";
import type { WorkItemFormValues } from "@/entities/work-item-form/buildWorkItemDefaultValues";

export function mapFormValuesToWorkItemPayload(values: WorkItemFormValues, schema: WorkItemPublicSchema): UpdateTaskInput {
  const fields = schema.fields.reduce<Record<string, unknown>>((acc, field) => {
    if (field.type === "computed" || field.type === "billing_summary") {
      return acc;
    }
    acc[field.key] = values[field.key];
    return acc;
  }, {});

  return { fields };
}

