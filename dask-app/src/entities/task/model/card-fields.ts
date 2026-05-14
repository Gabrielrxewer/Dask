import type { TaskFieldDefinition, TaskFieldOption } from "@/entities/task/model/types";
import { getTaskFieldTypeLabelFromRegistry } from "@/entities/task/model/field-registry";

export const CARD_FIELDS_SCHEMA_VERSION = 3;

function uniqueNonEmptyIds(fieldIds: string[]): string[] {
  return Array.from(
    new Set(
      fieldIds
        .filter((value): value is string => typeof value === "string")
        .map(value => value.trim())
        .filter(value => value.length > 0)
    )
  );
}

function resolveRuntimeFieldType(field: TaskFieldDefinition): TaskFieldDefinition["type"] {
  if (field.config?.entityType === "billing_catalog_item") {
    return "catalog_select";
  }
  return field.type;
}

export function mergeCardFieldDefinitions(fieldDefinitions: TaskFieldDefinition[]): TaskFieldDefinition[] {
  return fieldDefinitions.map(field => {
    const type = resolveRuntimeFieldType(field);
    return {
      ...field,
      type,
      capabilities: field.capabilities ?? inferCapabilitiesByType(type, field.config)
    };
  });
}

export function resolveVisibleCardFieldIds(
  fieldIds: string[],
  _settings?: Record<string, unknown>
): string[] {
  return uniqueNonEmptyIds(fieldIds);
}

export function resolveFieldIdsForTaskType(
  typeId: string,
  fieldIdsByType: Record<string, string[]> | undefined,
  fallbackFieldIds: string[]
): string[] {
  const scoped = fieldIdsByType?.[typeId];
  if (Array.isArray(scoped)) {
    return uniqueNonEmptyIds(scoped);
  }

  return uniqueNonEmptyIds(fallbackFieldIds);
}

function canAiEnhance(config?: Record<string, unknown> | null): boolean {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return false;
  }

  return config.allowAiGeneration === true;
}

export function inferCapabilitiesByType(
  type: TaskFieldDefinition["type"],
  config?: Record<string, unknown> | null
) {
  if (type === "text" || type === "long_text") {
    return canAiEnhance(config) ? { aiEnhance: true } : {};
  }

  if (type === "select" || type === "catalog_select" || type === "user" || type === "priority" || type === "status" || type === "work_item_type") {
    return { selectable: true };
  }

  if (type === "multi_select" || type === "tag") {
    return { multiSelectable: true };
  }

  return {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readCapabilityOverridesById(settings?: Record<string, unknown>): Record<string, Record<string, unknown>> {
  const source = settings?.fieldCapabilitiesById;
  if (!isRecord(source)) {
    return {};
  }

  return Object.entries(source).reduce<Record<string, Record<string, unknown>>>((acc, [fieldId, value]) => {
    if (!isRecord(value)) {
      return acc;
    }

    acc[fieldId] = value;
    return acc;
  }, {});
}

function readFieldDefinitionOverridesById(settings?: Record<string, unknown>): Record<string, Record<string, unknown>> {
  const source = settings?.fieldDefinitionsById;
  if (!isRecord(source)) {
    return {};
  }

  return Object.entries(source).reduce<Record<string, Record<string, unknown>>>((acc, [fieldId, value]) => {
    if (!isRecord(value)) {
      return acc;
    }

    acc[fieldId] = value;
    return acc;
  }, {});
}

export function applyFieldCapabilityOverrides(
  fieldDefinitions: TaskFieldDefinition[],
  settings?: Record<string, unknown>
): TaskFieldDefinition[] {
  const overridesById = readCapabilityOverridesById(settings);
  if (Object.keys(overridesById).length === 0) {
    return fieldDefinitions;
  }

  return fieldDefinitions.map(definition => {
    const override = overridesById[definition.id];
    if (!override) {
      return definition;
    }

    const nextCapabilities = {
      ...(definition.capabilities ?? {})
    };

    if (typeof override.aiEnhance === "boolean") {
      nextCapabilities.aiEnhance = override.aiEnhance;
    }

    if (typeof override.selectable === "boolean") {
      nextCapabilities.selectable = override.selectable;
    }

    if (typeof override.multiSelectable === "boolean") {
      nextCapabilities.multiSelectable = override.multiSelectable;
    }

    return {
      ...definition,
      capabilities: nextCapabilities
    };
  });
}

export function applyFieldDefinitionOverrides(
  fieldDefinitions: TaskFieldDefinition[],
  settings?: Record<string, unknown>
): TaskFieldDefinition[] {
  const overridesById = readFieldDefinitionOverridesById(settings);
  if (Object.keys(overridesById).length === 0) {
    return fieldDefinitions;
  }

  return fieldDefinitions.map(definition => {
    const override = overridesById[definition.id];
    if (!override) {
      return definition;
    }

    return {
      ...definition,
      label: typeof override.label === "string" && override.label.trim().length > 0 ? override.label : definition.label,
      name: typeof override.name === "string" && override.name.trim().length > 0 ? override.name : definition.name,
      type: typeof override.type === "string" ? (override.type as TaskFieldDefinition["type"]) : definition.type,
      required: typeof override.required === "boolean" ? override.required : definition.required,
      options: Array.isArray(override.options) ? (override.options as TaskFieldDefinition["options"]) : definition.options,
      config: {
        ...(definition.config ?? {}),
        ...(typeof override.allowAiGeneration === "boolean" ? { allowAiGeneration: override.allowAiGeneration } : {}),
        ...(isRecord(override.checklistDisplay) ? { checklistDisplay: override.checklistDisplay } : {})
      }
    };
  });
}

export function getTaskFieldTypeLabel(definition: Pick<TaskFieldDefinition, "type" | "capabilities">): string {
  if (definition.capabilities?.aiEnhance === true) {
    return "Texto IA";
  }

  return getTaskFieldTypeLabelFromRegistry(definition.type);
}

export function injectCatalogOptionsIntoBoardConfig<T extends { fieldDefinitions: TaskFieldDefinition[] }>(
  boardConfig: T,
  catalogOptions: TaskFieldOption[]
): T {
  if (catalogOptions.length === 0) {
    return boardConfig;
  }

  return {
    ...boardConfig,
    fieldDefinitions: boardConfig.fieldDefinitions.map(field =>
      field.type === "catalog_select" || field.config?.entityType === "billing_catalog_item"
        ? { ...field, options: catalogOptions }
        : field
    )
  };
}
