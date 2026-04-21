import type { MembersById } from "@/entities/member";
import {
  formatTaskFieldValue,
  isTaskFieldValueEmpty,
  readTaskFieldStorage,
  resolveTaskFieldValue
} from "@/entities/task/model/field-registry";
import { resolveWorkItemFieldBindings } from "@/entities/task/model/field-bindings";
import type {
  BoardConfig,
  Task,
  TaskCustomFieldValue,
  TaskFieldCardArea,
  TaskFieldDefinition,
  TaskFieldVisualPriority,
  TaskStatus
} from "@/entities/task/model/types";

export type TaskCardSlotArea = "badge" | "title" | "description" | "summary" | "tags" | "custom-field" | "meta";

export const CARD_SLOT_LIMITS: Record<TaskCardSlotArea, number> = {
  badge: 3,
  title: 1,
  description: 1,
  summary: 2,
  tags: 1,
  "custom-field": 2,
  meta: 3
};

export interface ResolvedTaskCardField {
  definition: TaskFieldDefinition;
  area: TaskCardSlotArea;
  value: TaskCustomFieldValue;
  visualPriority: TaskFieldVisualPriority;
}

export interface TaskCardDebugField {
  fieldId: string;
  label: string;
  type: TaskFieldDefinition["type"];
  order: number;
  area: TaskCardSlotArea;
  zone: "main" | "side";
  visualPriority: TaskFieldVisualPriority;
  bindingSource: "binding" | "legacy";
  bindingId?: string;
  storage: { kind: string | null; property: string | null } | null;
  value: TaskCustomFieldValue;
  valueSource:
    | "item_property"
    | "metadata"
    | "item_relation"
    | "legacy_fields"
    | `custom_fields:${string}`
    | "default_value"
    | "empty";
  displayValue: string;
  isEmpty: boolean;
  rendered: boolean;
  omissionReason: "empty" | "slot_limit" | null;
}

export interface TaskCardDebugSnapshot {
  task: {
    id: string;
    type: string;
    status: string;
    priority: Task["priority"];
    title: string;
    customFieldKeys: string[];
  };
  bindings: Array<{
    fieldId: string;
    order: number;
    area: TaskCardSlotArea;
    zone: "main" | "side";
    visualPriority: TaskFieldVisualPriority;
    source: "binding" | "legacy";
    bindingId?: string;
  }>;
  renderedFieldIds: string[];
  zones: Record<TaskCardSlotArea, string[]>;
  fields: TaskCardDebugField[];
}

export interface TaskCardRenderModel {
  resolvedFields: ResolvedTaskCardField[];
  debugSnapshot: TaskCardDebugSnapshot;
}

function hasOwnFieldValue(task: Task, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(task.customFields, key);
}

function resolveValueSource(task: Task, field: TaskFieldDefinition): TaskCardDebugField["valueSource"] {
  const storage = readTaskFieldStorage(field);
  if (storage) {
    const kind = typeof storage.kind === "string" ? storage.kind : "";
    if (kind === "item_property") {
      return "item_property";
    }
    if (kind === "metadata") {
      return "metadata";
    }
    if (kind === "item_relation") {
      return "item_relation";
    }
    if (kind === "legacy_fields") {
      return "legacy_fields";
    }
  }

  if (hasOwnFieldValue(task, field.id)) {
    return `custom_fields:${field.id}`;
  }

  if (field.slug && hasOwnFieldValue(task, field.slug)) {
    return `custom_fields:${field.slug}`;
  }

  if (field.defaultValue !== undefined && field.defaultValue !== null) {
    return "default_value";
  }

  return "empty";
}

function buildDisplayValue(input: {
  field: TaskFieldDefinition;
  value: TaskCustomFieldValue;
  boardConfig: BoardConfig;
  statuses: TaskStatus[];
  membersById?: MembersById;
}): string {
  return formatTaskFieldValue({
    field: input.field,
    value: input.value,
    boardConfig: input.boardConfig,
    statuses: input.statuses,
    membersById: input.membersById
  });
}

export function buildTaskCardRenderModel(input: {
  task: Task;
  boardConfig: BoardConfig;
  statuses?: TaskStatus[];
  membersById?: MembersById;
}): TaskCardRenderModel {
  const statuses = input.statuses ?? input.boardConfig.statuses;
  const bindings = resolveWorkItemFieldBindings(input.boardConfig, input.task.type, "card");

  const areaCount: Partial<Record<TaskCardSlotArea, number>> = {};
  const resolvedFields = bindings
    .map<ResolvedTaskCardField>((binding) => ({
      definition: binding.field,
      area: binding.cardArea,
      value: resolveTaskFieldValue(input.task, binding.field),
      visualPriority: binding.visualPriority
    }))
    .filter((field) => field.area === "title" || !isTaskFieldValueEmpty(field.definition, field.value))
    .filter((field) => {
      const count = areaCount[field.area] ?? 0;
      const limit = CARD_SLOT_LIMITS[field.area];
      if (count >= limit) return false;
      areaCount[field.area] = count + 1;
      return true;
    });

  const renderedFieldIdSet = new Set(resolvedFields.map((f) => f.definition.id));

  const fields = bindings.map<TaskCardDebugField>((binding) => {
    const value = resolveTaskFieldValue(input.task, binding.field);
    const isEmpty = isTaskFieldValueEmpty(binding.field, value);
    const rendered = renderedFieldIdSet.has(binding.field.id);
    const omittedByEmpty = !rendered && (binding.cardArea !== "title" && isEmpty);
    const storage = readTaskFieldStorage(binding.field);

    return {
      fieldId: binding.field.id,
      label: binding.field.label,
      type: binding.field.type,
      order: binding.order,
      area: binding.cardArea,
      zone: binding.zone,
      visualPriority: binding.visualPriority,
      bindingSource: binding.source,
      bindingId: binding.bindingId,
      storage: storage
        ? {
            kind: typeof storage.kind === "string" ? storage.kind : null,
            property: typeof storage.property === "string" ? storage.property : null
          }
        : null,
      value,
      valueSource: resolveValueSource(input.task, binding.field),
      displayValue: buildDisplayValue({
        field: binding.field,
        value,
        boardConfig: input.boardConfig,
        statuses,
        membersById: input.membersById
      }),
      isEmpty,
      rendered,
      omissionReason: rendered ? null : omittedByEmpty ? "empty" : "slot_limit"
    };
  });

  const renderedFieldIds = resolvedFields.map((field) => field.definition.id);
  // renderedFieldIdSet is already defined above
  const emptyZones: Record<TaskCardSlotArea, string[]> = {
    badge: [],
    title: [],
    description: [],
    summary: [],
    tags: [],
    "custom-field": [],
    meta: []
  };
  const zones = fields.reduce<Record<TaskCardSlotArea, string[]>>((acc, field) => {
    acc[field.area] = [...acc[field.area], field.fieldId];
    return acc;
  }, emptyZones);

  return {
    resolvedFields,
    debugSnapshot: {
      task: {
        id: input.task.id,
        type: input.task.type,
        status: input.task.status,
        priority: input.task.priority,
        title: input.task.title,
        customFieldKeys: Object.keys(input.task.customFields).sort()
      },
      bindings: bindings.map((binding) => ({
        fieldId: binding.field.id,
        order: binding.order,
        area: binding.cardArea,
        zone: binding.zone,
        visualPriority: binding.visualPriority,
        source: binding.source,
        bindingId: binding.bindingId
      })),
      renderedFieldIds,
      zones,
      fields
    }
  };
}
