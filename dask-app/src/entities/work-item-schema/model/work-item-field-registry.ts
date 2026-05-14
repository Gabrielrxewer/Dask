import type { WorkItemPublicField } from "@/entities/work-item-schema/model/work-item-field.types";
import type { WorkItemPublicSchema } from "@/entities/work-item-schema/model/work-item-schema.types";
import { createFieldRegistry, FieldRegistry } from "@/shared/field-core";

export type WorkItemFieldRegistry = FieldRegistry<WorkItemPublicField>;

export function createWorkItemFieldRegistry(fields: WorkItemPublicField[] = []): WorkItemFieldRegistry {
  return createFieldRegistry<WorkItemPublicField>(fields);
}

export function createWorkItemSchemaFieldRegistry(schema: Pick<WorkItemPublicSchema, "fields">): WorkItemFieldRegistry {
  return createWorkItemFieldRegistry(schema.fields);
}

export function assertNoDuplicateWorkItemFields(fields: WorkItemPublicField[]): void {
  createWorkItemFieldRegistry().assertNoDuplicateFields(fields);
}

