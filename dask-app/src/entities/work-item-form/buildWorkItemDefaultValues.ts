import type { WorkItemPublicSchema } from "@/entities/work-item-schema";

export type WorkItemFormValues = Record<string, unknown>;

export function buildWorkItemDefaultValues(schema: WorkItemPublicSchema): WorkItemFormValues {
  return schema.fields.reduce<WorkItemFormValues>((acc, field) => {
    if (field.defaultValue !== undefined) {
      acc[field.key] = field.defaultValue;
      return acc;
    }

    switch (field.type) {
      case "multi_select":
      case "checklist":
      case "file":
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

