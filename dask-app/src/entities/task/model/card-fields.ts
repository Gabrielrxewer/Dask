import type { TaskFieldDefinition } from "@/entities/task/model/types";

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

export function isSystemCardFieldId(fieldId: string): boolean {
  return fieldId.startsWith("sys:");
}

export function mergeCardFieldDefinitions(fieldDefinitions: TaskFieldDefinition[]): TaskFieldDefinition[] {
  return fieldDefinitions.map(field => ({
    ...field,
    source: field.source ?? (isSystemCardFieldId(field.id) ? "system" : "custom"),
    capabilities: field.capabilities ?? inferCapabilitiesByType(field.type, field.config)
  }));
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

  if (type === "select" || type === "user" || type === "priority" || type === "status" || type === "work_item_type") {
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

export function getTaskFieldTypeLabel(definition: Pick<TaskFieldDefinition, "type" | "capabilities">): string {
  if (definition.capabilities?.aiEnhance === true) {
    return "Texto IA";
  }

  const labels: Record<TaskFieldDefinition["type"], string> = {
    text: "Texto curto",
    long_text: "Texto longo",
    number: "Numero",
    date: "Data",
    datetime: "Data e hora",
    select: "Selecao unica",
    multi_select: "Selecao multipla",
    boolean: "Sim / Nao",
    user: "Usuario",
    checklist: "Checklist",
    priority: "Prioridade",
    status: "Status",
    tag: "Tags",
    schedule: "Planejamento",
    work_item_type: "Tipo de item"
  };

  return labels[definition.type] ?? definition.type;
}
