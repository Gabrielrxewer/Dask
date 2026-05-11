import type { WorkItemPublicField } from "@/entities/work-item-schema/model/work-item-field.types";

export function normalizeFieldKey(value: string): string {
  return value
    .trim()
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^[0-9]/, "_$&")
    .slice(0, 80);
}

export function normalizePublicField(field: WorkItemPublicField): WorkItemPublicField {
  const key = normalizeFieldKey(field.key || field.label || field.id);
  return {
    ...field,
    key,
    required: Boolean(field.required),
    visibility: field.visibility ?? "visible",
    userConfigurable: field.userConfigurable ?? !field.system
  };
}

