import type { TaskFieldDefinition } from "@/entities/task/model/types";

export const CARD_FIELDS_SCHEMA_VERSION = 2;

export const systemCardFieldDefinitions: TaskFieldDefinition[] = [
  { id: "sys:type", label: "Tipo", type: "select", source: "system", capabilities: { selectable: true } },
  { id: "sys:priority", label: "Prioridade", type: "select", source: "system", capabilities: { selectable: true } },
  { id: "sys:status", label: "Status", type: "select", source: "system", capabilities: { selectable: true } },
  { id: "sys:title", label: "Titulo", type: "text", source: "system" },
  { id: "sys:description", label: "Descricao", type: "text_ai", source: "system", capabilities: { aiEnhance: true } },
  { id: "sys:created-by", label: "Criado por", type: "user", source: "system" },
  { id: "sys:assignee", label: "Responsavel", type: "user", source: "system", capabilities: { selectable: true } },
  { id: "sys:tags", label: "Tags", type: "multi_select", source: "system", capabilities: { multiSelectable: true } },
  { id: "sys:checklist", label: "Checklist", type: "text", source: "system" },
  { id: "sys:schedule", label: "Planejamento", type: "datetime", source: "system" },
  { id: "sys:due-date", label: "Prazo", type: "date", source: "system" }
];

const systemFieldIdSet = new Set(systemCardFieldDefinitions.map(field => field.id));
const defaultSystemFieldIds = systemCardFieldDefinitions
  .filter(field => field.id !== "sys:schedule")
  .map(field => field.id);

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

export function isSystemCardFieldId(fieldId: string): boolean {
  return systemFieldIdSet.has(fieldId);
}

export function mergeCardFieldDefinitions(customFieldDefinitions: TaskFieldDefinition[]): TaskFieldDefinition[] {
  const customFiltered = customFieldDefinitions
    .filter(field => !isSystemCardFieldId(field.id))
    .map(field => ({
      ...field,
      source: field.source ?? "custom",
      capabilities: field.capabilities ?? inferCapabilitiesByType(field.type)
    }));
  return [...systemCardFieldDefinitions, ...customFiltered];
}

export function resolveVisibleCardFieldIds(
  fieldIds: string[],
  settings?: Record<string, unknown>
): string[] {
  const normalized = uniqueNonEmptyIds(fieldIds);
  const schemaVersion =
    typeof settings?.cardFieldSchemaVersion === "number"
      ? settings.cardFieldSchemaVersion
      : undefined;

  if (schemaVersion === CARD_FIELDS_SCHEMA_VERSION || normalized.some(isSystemCardFieldId)) {
    return normalized;
  }

  return uniqueNonEmptyIds([...defaultSystemFieldIds, ...normalized]);
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

export function inferCapabilitiesByType(type: TaskFieldDefinition["type"]) {
  if (type === "text_ai") {
    return { aiEnhance: true };
  }

  if (type === "select" || type === "user") {
    return { selectable: true };
  }

  if (type === "multi_select" || type === "multi-select") {
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

    return {
      ...definition,
      capabilities: nextCapabilities
    };
  });
}

export function getTaskFieldTypeLabel(definition: Pick<TaskFieldDefinition, "type" | "capabilities">): string {
  const aiEnabled =
    typeof definition.capabilities?.aiEnhance === "boolean"
      ? definition.capabilities.aiEnhance
      : definition.type === "text_ai";

  if (aiEnabled) {
    return "Text IA";
  }

  const normalizedType = definition.type === "multi-select" ? "multi_select" : definition.type;

  const labels: Record<string, string> = {
    text: "Text",
    number: "Number",
    date: "Date",
    datetime: "DateTime",
    boolean: "Boolean",
    select: "Select",
    multi_select: "Multi Select",
    user: "User"
  };

  return labels[normalizedType] ?? normalizedType;
}
