import { z } from "zod";
import type { WorkItemPublicField, WorkItemPublicSchema } from "@/entities/work-item-schema";

function schemaForField(field: WorkItemPublicField): z.ZodTypeAny {
  const required = field.required;

  switch (field.type) {
    case "number":
    case "currency":
      return required ? z.coerce.number() : z.coerce.number().nullable().optional();
    case "date":
    case "datetime":
    case "text":
    case "textarea":
    case "long_text":
    case "select":
    case "status":
    case "priority":
    case "user":
    case "client":
    case "reference":
    case "relation":
    case "catalog_select":
      return required ? z.string().min(1, "Campo obrigatorio") : z.string().nullable().optional();
    case "multi_select":
    case "file":
    case "attachment":
      return required ? z.array(z.string()).min(1, "Campo obrigatorio") : z.array(z.string()).optional();
    case "checkbox":
    case "boolean":
      return required ? z.boolean().refine(Boolean, "Campo obrigatorio") : z.boolean().optional();
    case "checklist":
      return z.array(z.object({
        id: z.string(),
        label: z.string(),
        done: z.boolean()
      })).optional();
    case "billing_summary":
    case "computed":
      return z.unknown().optional();
    default:
      return z.unknown().optional();
  }
}

export function buildWorkItemFormSchema(schema: WorkItemPublicSchema) {
  return z.object(
    Object.fromEntries(schema.fields.map(field => [field.key, schemaForField(field)]))
  );
}

