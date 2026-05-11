import type { BoardConfig, TaskFieldBinding, TaskFieldDefinition } from "@/entities/task";
import type { WorkItemPublicSchema } from "@/entities/work-item-schema/model/work-item-schema.types";
import type { WorkItemPublicFieldType } from "@/entities/work-item-schema/model/work-item-field.types";
import { WORK_ITEM_SCHEMA_VERSION } from "@/entities/work-item-schema/model/work-item-schema-version";
import { normalizePublicField } from "@/entities/work-item-schema/model/field-normalizers";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapLegacyFieldType(type: string): WorkItemPublicFieldType {
  if (type === "boolean") return "checkbox";
  if (type === "long_text") return "textarea";
  return type as WorkItemPublicFieldType;
}

function toLayoutFields(bindings: TaskFieldBinding[], context: "card" | "detail") {
  return bindings
    .filter(binding => binding.displayContext === context && binding.isVisible !== false)
    .sort((left, right) => left.order - right.order)
    .map(binding => ({
      fieldId: binding.fieldId,
      area: binding.settings?.cardArea,
      section: binding.section,
      order: binding.order,
      visible: binding.isVisible,
      required: binding.isRequiredOverride ?? undefined,
      readonly: binding.isReadonlyOverride ?? undefined,
      display: binding.settings ? { ...binding.settings } : undefined
    }));
}

export function legacyFieldBindingsToPublicSchema(input: {
  schemaId: string;
  workspaceId: string;
  name: string;
  description?: string | null;
  boardConfig: BoardConfig;
  fieldDefinitions?: TaskFieldDefinition[];
  fieldBindings?: TaskFieldBinding[];
  workflowStateIds?: string[];
}): WorkItemPublicSchema {
  const definitions = input.fieldDefinitions ?? input.boardConfig.fieldDefinitions;
  const bindings = input.fieldBindings ?? input.boardConfig.fieldBindings ?? [];
  const fields = definitions.map(definition => normalizePublicField({
    id: definition.definitionId ?? definition.id,
    key: definition.variableKey ?? definition.slug ?? definition.id,
    label: definition.label,
    description: definition.description,
    type: mapLegacyFieldType(definition.type),
    required: Boolean(definition.required),
    defaultValue: definition.defaultValue,
    options: definition.options,
    metadata: {
      ...(isRecord(definition.config) ? definition.config : {}),
      runtimeFieldId: definition.id,
      ...(isRecord(definition.storage) ? { storage: definition.storage } : {})
    },
    system: definition.isEditable === false && definition.isRemovable === false,
    userConfigurable: definition.isEditable !== false
  }));

  return {
    schemaVersion: WORK_ITEM_SCHEMA_VERSION,
    id: input.schemaId,
    workspaceId: input.workspaceId,
    name: input.name,
    description: input.description,
    fields,
    layouts: {
      card: { surface: "card", fields: toLayoutFields(bindings, "card") },
      detail: { surface: "detail", fields: toLayoutFields(bindings, "detail") },
      form: { surface: "form", fields: toLayoutFields(bindings, "detail") }
    },
    workflow: {
      stateIds: input.workflowStateIds ?? input.boardConfig.statuses.map(status => status.id)
    }
  };
}

export function publicSchemaToFieldBindings(schema: WorkItemPublicSchema): TaskFieldBinding[] {
  return [...schema.layouts.card.fields, ...schema.layouts.detail.fields].map((field, index) => ({
    id: `${schema.id}:${field.fieldId}:${index}`,
    fieldId: field.fieldId,
    typeId: schema.id,
    displayContext: schema.layouts.card.fields.includes(field) ? "card" : "detail",
    order: field.order,
    section: field.section,
    isVisible: field.visible !== false,
    isRequiredOverride: field.required,
    isReadonlyOverride: field.readonly,
    settings: field.display
  }));
}
