import type { FieldDefinition, FieldType } from "@/shared/field-core/field-core.types";

export function normalizeFieldKey(value: string): string {
  return value
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^[0-9]/, "_$&")
    .slice(0, 80);
}

export function normalizeFieldDefinition<TField extends FieldDefinition>(field: TField): TField {
  return {
    ...field,
    key: normalizeFieldKey(field.key || field.label || field.id),
    required: Boolean(field.required)
  };
}

export function getFieldContexts(field: Pick<FieldDefinition, "context">): string[] {
  if (!field.context) return [];
  return Array.isArray(field.context) ? field.context : [field.context];
}

export function isReadonlyField(field: Pick<FieldDefinition, "readonly" | "type">): boolean {
  return field.readonly === true || field.type === "computed" || field.type === "billing_summary";
}

export function isFieldType(value: string, supportedTypes: readonly FieldType[]): value is FieldType {
  return supportedTypes.includes(value as FieldType);
}

