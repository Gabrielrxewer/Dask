import {
  readTaskFieldStorage,
  resolveWorkItemFieldBindingsForContext,
  type BoardConfig,
  type TaskFieldDefinition
} from "@/entities/task";
import type {
  WorkItemListColumnConfig,
  WorkItemListConfig,
  WorkItemListConfigBuildInput,
  WorkItemListConfigsByType,
  WorkItemListMobileCardLayout
} from "@/modules/work-item-list/model/types";
import {
  WORK_ITEM_LIST_CONFIG_SCHEMA_VERSION,
  WORK_ITEM_LIST_CONFIG_SETTINGS_KEY
} from "@/modules/work-item-list/model/types";

const SYSTEM_PROPERTY_COLUMNS = new Set([
  "title",
  "description",
  "typeSlug",
  "typeId",
  "stateSlug",
  "stateId",
  "assigneeId",
  "dueDate",
  "createdBy",
  "checklist"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isListConfig(value: unknown): value is WorkItemListConfig {
  return (
    isRecord(value) &&
    value.schemaVersion === WORK_ITEM_LIST_CONFIG_SCHEMA_VERSION &&
    typeof value.workItemTypeId === "string" &&
    Array.isArray(value.columns)
  );
}

function getTaskTypeLabel(boardConfig: BoardConfig, typeId: string): string {
  return boardConfig.taskTypes.find((type) => type.id === typeId)?.label ?? "Work items";
}

function getFieldKey(field: TaskFieldDefinition): string {
  return field.variableKey ?? field.slug ?? field.id;
}

function isSystemBackedField(field: TaskFieldDefinition): boolean {
  const storage = readTaskFieldStorage(field);
  return (
    typeof storage?.kind === "string" &&
    storage.kind === "item_property" &&
    typeof storage.property === "string" &&
    SYSTEM_PROPERTY_COLUMNS.has(storage.property)
  );
}

function fixedColumns(): WorkItemListColumnConfig[] {
  return [
    {
      id: "title",
      fieldKey: "title",
      label: "Negocio",
      type: "title",
      visible: true,
      pinned: "left",
      width: 280,
      minWidth: 220,
      sortable: true,
      filterable: true,
      required: true,
      order: 0
    },
    {
      id: "type",
      fieldKey: "type",
      label: "Tipo",
      type: "type",
      visible: true,
      width: 132,
      minWidth: 112,
      sortable: true,
      filterable: true,
      order: 10
    },
    {
      id: "status",
      fieldKey: "status",
      label: "Etapa",
      type: "status",
      visible: true,
      width: 172,
      minWidth: 146,
      sortable: true,
      filterable: true,
      editableInline: true,
      order: 20
    },
    {
      id: "assignee",
      fieldKey: "assignee",
      label: "Responsavel",
      type: "assignee",
      visible: true,
      width: 170,
      minWidth: 132,
      sortable: true,
      filterable: true,
      order: 30
    },
    {
      id: "dueDate",
      fieldKey: "dueDate",
      label: "Prazo",
      type: "dueDate",
      visible: true,
      width: 108,
      minWidth: 92,
      sortable: true,
      filterable: true,
      order: 40
    },
    {
      id: "progress",
      fieldKey: "progress",
      label: "Progresso",
      type: "progress",
      visible: true,
      width: 104,
      minWidth: 86,
      sortable: false,
      order: 50
    },
    {
      id: "actions",
      fieldKey: "actions",
      label: "",
      type: "actions",
      visible: true,
      pinned: "right",
      width: 78,
      minWidth: 68,
      sortable: false,
      order: 10_000,
      align: "right"
    }
  ];
}

function buildDynamicColumns(boardConfig: BoardConfig, workItemTypeId: string): WorkItemListColumnConfig[] {
  return resolveWorkItemFieldBindingsForContext(boardConfig, workItemTypeId, "detail")
    .filter((binding) => binding.visible)
    .map((binding) => binding.field)
    .filter((field) => !isSystemBackedField(field))
    .slice(0, 8)
    .map((field, index) => {
      const fieldKey = getFieldKey(field);
      const isCustomer = field.config?.entityType === "customer" || field.slug === "customerId" || field.variableKey === "customerId";

      return {
        id: `field:${field.id}`,
        fieldId: field.id,
        fieldKey,
        label: field.label,
        type: isCustomer ? "customer" : field.type,
        visible: index < 4,
        width: field.type === "long_text" ? 220 : 160,
        minWidth: 120,
        sortable: field.type === "date" || field.type === "datetime" || field.type === "number",
        filterable: true,
        editableInline: false,
        required: field.required,
        order: 100 + index * 10
      } satisfies WorkItemListColumnConfig;
    });
}

function defaultMobileLayout(columns: WorkItemListColumnConfig[]): WorkItemListMobileCardLayout {
  const visibleColumnIds = columns.filter((column) => column.visible).map((column) => column.id);

  return {
    titleField: "title",
    subtitleFields: visibleColumnIds.filter((id) => id.startsWith("field:")).slice(0, 1),
    badgeFields: ["type", "status"].filter((id) => visibleColumnIds.includes(id)),
    primaryMetaFields: ["assignee", "dueDate"].filter((id) => visibleColumnIds.includes(id)),
    secondaryMetaFields: ["progress", ...visibleColumnIds.filter((id) => id.startsWith("field:")).slice(1, 3)],
    actions: ["open", "status"]
  };
}

export function readWorkItemListConfigs(settings: unknown): WorkItemListConfigsByType {
  if (!isRecord(settings) || !isRecord(settings[WORK_ITEM_LIST_CONFIG_SETTINGS_KEY])) {
    return {};
  }

  return Object.entries(settings[WORK_ITEM_LIST_CONFIG_SETTINGS_KEY]).reduce<WorkItemListConfigsByType>((acc, [key, value]) => {
    if (isListConfig(value)) {
      acc[key] = value;
    }
    return acc;
  }, {});
}

export function mergeWorkItemListConfigWithDefaults(
  persisted: WorkItemListConfig | undefined,
  fallback: WorkItemListConfig
): WorkItemListConfig {
  if (!persisted) {
    return fallback;
  }

  const fallbackColumnsById = new Map(fallback.columns.map((column) => [column.id, column]));
  const persistedColumnIds = new Set(persisted.columns.map((column) => column.id));
  const mergedColumns = [
    ...persisted.columns.map((column) => ({
      ...(fallbackColumnsById.get(column.id) ?? {}),
      ...column
    })),
    ...fallback.columns.filter((column) => !persistedColumnIds.has(column.id))
  ].sort((left, right) => left.order - right.order);

  return {
    ...fallback,
    ...persisted,
    columns: mergedColumns,
    mobileCardLayout: {
      ...fallback.mobileCardLayout,
      ...persisted.mobileCardLayout
    }
  };
}

export function buildDefaultWorkItemListConfig(input: WorkItemListConfigBuildInput): WorkItemListConfig {
  const columns = [...fixedColumns(), ...buildDynamicColumns(input.boardConfig, input.workItemTypeId)]
    .sort((left, right) => left.order - right.order);
  const fallback: WorkItemListConfig = {
    id: `${input.workspaceId}:${input.workItemTypeId}:default-list`,
    workspaceId: input.workspaceId,
    workItemTypeId: input.workItemTypeId,
    schemaVersion: WORK_ITEM_LIST_CONFIG_SCHEMA_VERSION,
    name: `${getTaskTypeLabel(input.boardConfig, input.workItemTypeId)} - Lista`,
    columns,
    defaultSort: {
      sortBy: "position",
      sortDirection: "asc"
    },
    defaultFilters: {},
    density: "compact",
    rowActions: ["open"],
    bulkActions: ["status", "assignee", "archive"],
    mobileCardLayout: defaultMobileLayout(columns)
  };
  const persisted = readWorkItemListConfigs(input.settings)[input.workItemTypeId];

  return mergeWorkItemListConfigWithDefaults(persisted, fallback);
}

export function upsertWorkItemListConfigInSettings(settings: unknown, config: WorkItemListConfig): Record<string, unknown> {
  const source = isRecord(settings) ? settings : {};
  return {
    ...source,
    [WORK_ITEM_LIST_CONFIG_SETTINGS_KEY]: {
      ...readWorkItemListConfigs(source),
      [config.workItemTypeId]: config
    }
  };
}
