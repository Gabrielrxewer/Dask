export type { WorkItemPublicField, WorkItemPublicFieldType, WorkItemFieldOption, BillingSummaryFieldMetadata } from "./model/work-item-field.types";
export type { WorkItemLayoutFieldRef, WorkItemLayoutSurface, WorkItemPublicLayout } from "./model/work-item-layout.types";
export type { WorkItemPublicSchema } from "./model/work-item-schema.types";
export { WORK_ITEM_SCHEMA_VERSION } from "./model/work-item-schema-version";
export { workItemPublicFieldSchema, workItemPublicFieldTypeSchema, billingSummaryFieldMetadataSchema } from "./model/work-item-field.zod";
export { workItemPublicLayoutSchema, workItemLayoutFieldRefSchema } from "./model/work-item-layout.zod";
export { workItemPublicSchemaZod } from "./model/work-item-schema.zod";
export { fieldCapabilities } from "./model/field-capabilities";
export { normalizeFieldKey, normalizePublicField } from "./model/field-normalizers";
export { validatePublicField } from "./model/field-validators";
export {
  assertNoDuplicateWorkItemFields,
  createWorkItemFieldRegistry,
  createWorkItemSchemaFieldRegistry,
  type WorkItemFieldRegistry
} from "./model/work-item-field-registry";
export { createDefaultWorkItemSchema } from "./model/default-work-item-schemas";
export { migrateWorkItemSchema } from "./model/work-item-schema-migrations";
export { legacyFieldBindingsToPublicSchema, publicSchemaToFieldBindings } from "./model/legacy-adapters";

