import type { FieldDefinition } from "@/shared/field-core";

export type WorkItemFormValues = Record<string, unknown>;

export type WorkItemDefaultValuesSchema = Pick<FieldDefinition, "key" | "type" | "defaultValue">;

export function buildWorkItemDefaultValues(schema: { fields: WorkItemDefaultValuesSchema[] }): WorkItemFormValues {
  return schema.fields.reduce<WorkItemFormValues>((acc, field) => {
    if (field.defaultValue !== undefined) {
      acc[field.key] = field.defaultValue;
      return acc;
    }

    switch (field.type) {
      case "multi_select":
      case "checklist":
      case "file":
      case "attachment":
        acc[field.key] = [];
        break;
      case "checkbox":
      case "boolean":
        acc[field.key] = false;
        break;
      case "billing_summary":
      case "computed":
        acc[field.key] = null;
        break;
      default:
        acc[field.key] = "";
    }
    return acc;
  }, {});
}

