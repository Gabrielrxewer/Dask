import { resolveFieldIdsForTaskType } from "@/entities/task/model/card-fields";
import { resolveTaskFieldCardArea, resolveTaskFieldDetailZone } from "@/entities/task/model/field-registry";
import type {
  BoardConfig,
  TaskFieldBinding,
  TaskFieldBindingDisplayContext,
  TaskFieldBindingSettings,
  TaskFieldCardArea,
  TaskFieldDefinition,
  TaskFieldDetailZone,
  TaskFieldSurface,
  TaskFieldVisualPriority
} from "@/entities/task/model/types";

type WorkItemRuntimeContext = "card" | "detail" | "form";

export interface ResolvedWorkItemFieldBinding {
  bindingId?: string;
  field: TaskFieldDefinition;
  typeId: string;
  displayContext: TaskFieldBindingDisplayContext;
  runtimeContext: WorkItemRuntimeContext;
  order: number;
  visible: boolean;
  section: string | null;
  zone: TaskFieldDetailZone;
  cardArea: TaskFieldCardArea;
  required: boolean;
  readonly: boolean;
  visualPriority: TaskFieldVisualPriority;
  surfaces: Partial<Record<TaskFieldSurface, boolean>>;
  settings: TaskFieldBindingSettings | null;
  source: "binding" | "legacy";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildBindingKey(
  typeId: string,
  displayContext: TaskFieldBindingDisplayContext,
  fieldId: string
): string {
  return `${typeId}:${displayContext}:${fieldId}`;
}

function normalizeCardArea(value: unknown): TaskFieldCardArea | null {
  return value === "badge" ||
    value === "title" ||
    value === "description" ||
    value === "summary" ||
    value === "tags" ||
    value === "custom-field" ||
    value === "meta"
    ? value
    : null;
}

function normalizeDetailZone(value: unknown): TaskFieldDetailZone | null {
  return value === "main" || value === "side" ? value : null;
}

function normalizeVisualPriority(value: unknown): TaskFieldVisualPriority | null {
  return value === "primary" || value === "secondary" || value === "supporting" ? value : null;
}

function readBindingSettings(input: TaskFieldBinding["settings"]): TaskFieldBindingSettings | null {
  return isRecord(input) ? (input as TaskFieldBindingSettings) : null;
}

function cloneBindingSettings(input: TaskFieldBinding["settings"]): TaskFieldBindingSettings | null {
  const settings = readBindingSettings(input);
  if (!settings) {
    return null;
  }

  return {
    ...settings,
    ...(isRecord(settings.surfaces)
      ? { surfaces: { ...(settings.surfaces as Partial<Record<TaskFieldSurface, boolean>>) } }
      : {})
  };
}

function deriveVisualPriorityFromCardArea(area: TaskFieldCardArea): TaskFieldVisualPriority {
  if (area === "title" || area === "description") {
    return "primary";
  }

  if (area === "badge" || area === "summary") {
    return "secondary";
  }

  return "supporting";
}

function deriveVisualPriorityFromDetailZone(zone: TaskFieldDetailZone): TaskFieldVisualPriority {
  return zone === "main" ? "primary" : "secondary";
}

function deriveDefaultSurfaces(
  displayContext: TaskFieldBindingDisplayContext
): Partial<Record<TaskFieldSurface, boolean>> {
  return displayContext === "card"
    ? { card: true, inline: true }
    : { detail: true, form: true };
}

function readSurfaces(
  settings: TaskFieldBindingSettings | null,
  displayContext: TaskFieldBindingDisplayContext
): Partial<Record<TaskFieldSurface, boolean>> {
  if (!settings || !isRecord(settings.surfaces)) {
    return deriveDefaultSurfaces(displayContext);
  }

  return {
    ...deriveDefaultSurfaces(displayContext),
    ...Object.entries(settings.surfaces).reduce<Partial<Record<TaskFieldSurface, boolean>>>((acc, [key, value]) => {
      if (
        (key === "detail" || key === "form" || key === "inline" || key === "table" || key === "card" || key === "filter") &&
        typeof value === "boolean"
      ) {
        acc[key] = value;
      }
      return acc;
    }, {})
  };
}

export function buildDefaultTaskFieldBindingSettings(
  field: TaskFieldDefinition,
  displayContext: TaskFieldBindingDisplayContext
): TaskFieldBindingSettings {
  if (displayContext === "card") {
    const cardArea = resolveTaskFieldCardArea(field);
    return {
      cardArea,
      visualPriority: deriveVisualPriorityFromCardArea(cardArea),
      surfaces: deriveDefaultSurfaces("card")
    };
  }

  const detailZone = resolveTaskFieldDetailZone(field);
  return {
    detailZone,
    visualPriority: deriveVisualPriorityFromDetailZone(detailZone),
    surfaces: deriveDefaultSurfaces("detail")
  };
}

export function materializeTaskFieldBinding(input: {
  field: TaskFieldDefinition;
  typeId: string;
  displayContext: TaskFieldBindingDisplayContext;
  order: number;
  existingBinding?: TaskFieldBinding | null;
  section?: string | null;
  isVisible?: boolean;
  settings?: Partial<TaskFieldBindingSettings>;
}): TaskFieldBinding {
  const existingBinding = input.existingBinding ?? null;
  const nextSettings = {
    ...buildDefaultTaskFieldBindingSettings(input.field, input.displayContext),
    ...(cloneBindingSettings(existingBinding?.settings) ?? {}),
    ...(input.settings ?? {})
  };
  const nextSection =
    input.section !== undefined
      ? input.section
      : existingBinding?.section ??
        (input.displayContext === "detail"
          ? nextSettings.detailZone ?? resolveTaskFieldDetailZone(input.field)
          : null);

  return {
    id: existingBinding?.id ?? `draft-${input.displayContext}-${input.typeId}-${input.field.id}`,
    fieldId: input.field.id,
    typeId: input.typeId,
    fieldDefinitionId: existingBinding?.fieldDefinitionId,
    workItemTypeId: existingBinding?.workItemTypeId,
    displayContext: input.displayContext,
    order: input.order,
    section: nextSection ?? null,
    isVisible: input.isVisible ?? existingBinding?.isVisible ?? true,
    isRequiredOverride: existingBinding?.isRequiredOverride ?? null,
    isReadonlyOverride: existingBinding?.isReadonlyOverride ?? null,
    settings: nextSettings
  };
}

export function buildTaskFieldBindingsForType(input: {
  typeId: string;
  fieldDefinitions: TaskFieldDefinition[];
  fieldBindings?: TaskFieldBinding[];
  cardFieldIds: string[];
  detailFieldIds: string[];
  detailZonesByFieldId?: Record<string, TaskFieldDetailZone>;
}): TaskFieldBinding[] {
  const fieldMap = input.fieldDefinitions.reduce<Record<string, TaskFieldDefinition>>((acc, field) => {
    acc[field.id] = field;
    return acc;
  }, {});
  const existingBindingsByKey = (input.fieldBindings ?? [])
    .filter((binding) => binding.typeId === input.typeId)
    .reduce<Record<string, TaskFieldBinding>>((acc, binding) => {
      acc[buildBindingKey(binding.typeId, binding.displayContext, binding.fieldId)] = binding;
      return acc;
    }, {});

  const cardBindings = input.cardFieldIds
    .map((fieldId, index) => {
      const field = fieldMap[fieldId];
      if (!field) {
        return null;
      }

      return materializeTaskFieldBinding({
        field,
        typeId: input.typeId,
        displayContext: "card",
        order: index,
        existingBinding: existingBindingsByKey[buildBindingKey(input.typeId, "card", fieldId)],
        section: null
      });
    })
    .filter((binding): binding is TaskFieldBinding => binding !== null);

  const detailBindings = input.detailFieldIds
    .map((fieldId, index) => {
      const field = fieldMap[fieldId];
      if (!field) {
        return null;
      }

      const existingBinding = existingBindingsByKey[buildBindingKey(input.typeId, "detail", fieldId)];
      const zone =
        input.detailZonesByFieldId?.[fieldId] ??
        normalizeDetailZone(readBindingSettings(existingBinding?.settings)?.detailZone) ??
        normalizeDetailZone(existingBinding?.section) ??
        resolveTaskFieldDetailZone(field, input.detailZonesByFieldId);

      return materializeTaskFieldBinding({
        field,
        typeId: input.typeId,
        displayContext: "detail",
        order: index,
        existingBinding,
        section: zone,
        settings: { detailZone: zone }
      });
    })
    .filter((binding): binding is TaskFieldBinding => binding !== null);

  return [...cardBindings, ...detailBindings];
}

function createResolvedBinding(input: {
  field: TaskFieldDefinition;
  typeId: string;
  displayContext: TaskFieldBindingDisplayContext;
  runtimeContext: WorkItemRuntimeContext;
  source: "binding" | "legacy";
  binding?: TaskFieldBinding;
  order: number;
  detailZoneMap?: Record<string, TaskFieldDetailZone>;
}): ResolvedWorkItemFieldBinding {
  const settings = readBindingSettings(input.binding?.settings);
  const cardArea = normalizeCardArea(settings?.cardArea) ?? resolveTaskFieldCardArea(input.field);
  const zone =
    normalizeDetailZone(settings?.detailZone) ??
    normalizeDetailZone(input.binding?.section) ??
    resolveTaskFieldDetailZone(input.field, input.detailZoneMap);
  const visualPriority =
    normalizeVisualPriority(settings?.visualPriority) ??
    (input.displayContext === "card"
      ? deriveVisualPriorityFromCardArea(cardArea)
      : deriveVisualPriorityFromDetailZone(zone));

  return {
    bindingId: input.binding?.id,
    field: input.field,
    typeId: input.typeId,
    displayContext: input.displayContext,
    runtimeContext: input.runtimeContext,
    order: input.order,
    visible: input.binding?.isVisible !== false,
    section: input.binding?.section ?? (input.displayContext === "detail" ? zone : null),
    zone,
    cardArea,
    required: input.binding?.isRequiredOverride ?? input.field.required === true,
    readonly: input.binding?.isReadonlyOverride ?? input.field.isEditable === false,
    visualPriority,
    surfaces: readSurfaces(settings, input.displayContext),
    settings,
    source: input.source
  };
}

function resolveBindingsForDisplayContext(
  boardConfig: BoardConfig,
  typeId: string,
  displayContext: TaskFieldBindingDisplayContext
): ResolvedWorkItemFieldBinding[] {
  const fieldMap = boardConfig.fieldDefinitions.reduce<Record<string, TaskFieldDefinition>>((acc, field) => {
    acc[field.id] = field;
    return acc;
  }, {});

  const bindings = Array.isArray(boardConfig.fieldBindings)
    ? boardConfig.fieldBindings.filter((binding) => binding.typeId === typeId && binding.displayContext === displayContext)
    : [];

  if (bindings.length > 0) {
    return bindings
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((binding, index) => {
        const field = fieldMap[binding.fieldId];
        return field
          ? createResolvedBinding({
              field,
              typeId,
              displayContext,
              runtimeContext: displayContext,
              source: "binding",
              binding,
              order: binding.order ?? index
            })
          : null;
      })
      .filter((binding): binding is ResolvedWorkItemFieldBinding => binding !== null && binding.visible);
  }

  const fieldIds =
    displayContext === "card"
      ? resolveFieldIdsForTaskType(
          typeId,
          boardConfig.cardLayout.visibleFieldIdsByType,
          boardConfig.cardLayout.visibleFieldIds
        )
      : resolveFieldIdsForTaskType(
          typeId,
          boardConfig.cardLayout.detailVisibleFieldIdsByType,
          resolveFieldIdsForTaskType(
            typeId,
            boardConfig.cardLayout.visibleFieldIdsByType,
            boardConfig.cardLayout.visibleFieldIds
          )
        );
  const detailZoneMap = boardConfig.cardLayout.detailFieldZoneByType?.[typeId];

  return fieldIds
    .map((fieldId, index) => {
      const field = fieldMap[fieldId];
      return field
        ? createResolvedBinding({
            field,
            typeId,
            displayContext,
            runtimeContext: displayContext,
            source: "legacy",
            order: index,
            detailZoneMap
          })
        : null;
    })
    .filter((binding): binding is ResolvedWorkItemFieldBinding => binding !== null);
}

export function resolveWorkItemFieldBindings(
  boardConfig: BoardConfig,
  typeId: string,
  displayContext: TaskFieldBindingDisplayContext
): ResolvedWorkItemFieldBinding[] {
  return resolveBindingsForDisplayContext(boardConfig, typeId, displayContext);
}

export function resolveWorkItemFieldBindingsForContext(
  boardConfig: BoardConfig,
  typeId: string,
  runtimeContext: WorkItemRuntimeContext
): ResolvedWorkItemFieldBinding[] {
  const displayContext = runtimeContext === "card" ? "card" : "detail";
  return resolveBindingsForDisplayContext(boardConfig, typeId, displayContext).map((binding) => ({
    ...binding,
    runtimeContext
  }));
}
