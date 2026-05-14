import type { UpdateTaskInput } from "@/modules/workspace";
import type { WorkItemFormValues } from "@/entities/work-item-form/buildWorkItemDefaultValues";
import type { FieldDefinition } from "@/shared/field-core";

type WorkItemPayloadSchema = {
  fields: Pick<FieldDefinition, "key" | "type">[];
};

export function mapFormValuesToWorkItemPayload(values: WorkItemFormValues, schema: WorkItemPayloadSchema): UpdateTaskInput {
  const fields = schema.fields.reduce<Record<string, unknown>>((acc, field) => {
    if (field.type === "computed" || field.type === "billing_summary") {
      return acc;
    }
    acc[field.key] = values[field.key];
    return acc;
  }, {});

  return { fields };
}

