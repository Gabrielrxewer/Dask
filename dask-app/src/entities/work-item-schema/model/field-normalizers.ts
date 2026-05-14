import type { WorkItemPublicField } from "@/entities/work-item-schema/model/work-item-field.types";
import { normalizeFieldKey as normalizeSharedFieldKey } from "@/shared/field-core";

export function normalizeFieldKey(value: string): string {
  return normalizeSharedFieldKey(value);
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

