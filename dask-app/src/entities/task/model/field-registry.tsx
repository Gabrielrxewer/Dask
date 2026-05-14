import type { MembersById } from "@/entities/member";
import type {
  BoardConfig,
  Task,
  TaskChecklist,
  TaskFieldCardArea,
  TaskCustomFieldValue,
  TaskFieldDetailZone,
  TaskFieldDefinition,
  TaskFieldOption,
  TaskFieldType,
  TaskPriority,
  TaskStatus
} from "@/entities/task/model/types";
import type { CreateTaskInput, UpdateTaskInput } from "@/modules/workspace/model";

export type TaskFieldRegistryEntry = {
  label: string;
  creationLabel?: string;
  caption: string;
  creatable?: boolean;
  supportsAi?: boolean;
  supportsOptions?: boolean;
  supportsManualOptions?: boolean;
  defaultCardArea: TaskFieldCardArea;
  defaultDetailZone: TaskFieldDetailZone;
  normalize: (value: TaskCustomFieldValue) => TaskCustomFieldValue;
};

export type TaskFieldCreationOption = {
  value: TaskFieldType;
  label: string;
  caption: string;
};

const priorityOptions: Array<{ value: string; label: string; color: string }> = [
  { value: "0", label: "P0 Critica", color: "var(--danger)" },
  { value: "1", label: "P1 Alta", color: "var(--warning)" },
  { value: "2", label: "P2 Media", color: "var(--text-secondary)" },
  { value: "3", label: "P3 Baixa", color: "var(--success)" },
  { value: "4", label: "P4 Minima", color: "var(--text-secondary)" }
];

export const taskFieldTypeRegistry: Record<TaskFieldType, TaskFieldRegistryEntry> = {
  text: {
    label: "Texto curto",
    caption: "Linha simples e direta.",
    supportsAi: true,
    defaultCardArea: "custom-field",
    defaultDetailZone: "side",
    normalize: value => (value == null ? "" : String(value))
  },
  long_text: {
    label: "Texto longo",
    caption: "Contexto e briefing.",
    supportsAi: true,
    defaultCardArea: "description",
    defaultDetailZone: "main",
    normalize: value => (value == null ? "" : String(value))
  },
  number: {
    label: "Numero",
    caption: "Metricas e contagens.",
    defaultCardArea: "custom-field",
    defaultDetailZone: "side",
    normalize: value => {
      if (value == null || value === "") return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
  },
  date: {
    label: "Data",
    caption: "Datas sem horario.",
    defaultCardArea: "meta",
    defaultDetailZone: "side",
    normalize: value => (value == null || value === "" ? null : String(value))
  },
  datetime: {
    label: "Data e hora",
    caption: "Agenda e planejamento.",
    defaultCardArea: "meta",
    defaultDetailZone: "side",
    normalize: value => (value == null || value === "" ? null : String(value))
  },
  select: {
    label: "Selecao unica",
    caption: "Uma opcao entre varias.",
    supportsOptions: true,
    supportsManualOptions: true,
    defaultCardArea: "custom-field",
    defaultDetailZone: "side",
    normalize: value => (value == null || value === "" ? null : String(value))
  },
  catalog_select: {
    label: "Item de catalogo",
    creationLabel: "Selecao dinamica",
    caption: "Fonte das opcoes: Catalogo de cobranca.",
    supportsOptions: true,
    defaultCardArea: "custom-field",
    defaultDetailZone: "main",
    normalize: value => (value == null || value === "" ? null : String(value))
  },
  multi_select: {
    label: "Selecao multipla",
    caption: "Etiquetas e combinacoes.",
    supportsOptions: true,
    supportsManualOptions: true,
    defaultCardArea: "tags",
    defaultDetailZone: "side",
    normalize: value => {
      if (Array.isArray(value)) {
        return value.map(entry => String(entry).trim()).filter(Boolean);
      }

      if (typeof value === "string") {
        return value
          .split(",")
          .map(entry => entry.trim())
          .filter(Boolean);
      }

      return [];
    }
  },
  boolean: {
    label: "Sim / Nao",
    caption: "Alternancia rapida.",
    defaultCardArea: "custom-field",
    defaultDetailZone: "side",
    normalize: value => value === true
  },
  user: {
    label: "Usuario",
    caption: "Pessoa responsavel ou autora.",
    defaultCardArea: "summary",
    defaultDetailZone: "side",
    normalize: value => (value == null || value === "" ? null : String(value))
  },
  checklist: {
    label: "Checklist",
    caption: "Lista operacional com marcacao.",
    defaultCardArea: "meta",
    defaultDetailZone: "main",
    normalize: value => (value as TaskChecklist | null) ?? null
  },
  priority: {
    label: "Prioridade",
    caption: "Prioridade operacional do item.",
    creatable: false,
    defaultCardArea: "badge",
    defaultDetailZone: "side",
    normalize: value => {
      if (value == null || value === "") return 2;
      const parsed = Number(value);
      return Number.isInteger(parsed) ? parsed : 2;
    }
  },
  status: {
    label: "Status",
    caption: "Estado atual no workflow.",
    creatable: false,
    defaultCardArea: "badge",
    defaultDetailZone: "side",
    normalize: value => (value == null || value === "" ? null : String(value))
  },
  tag: {
    label: "Tags",
    caption: "Marcadores do item.",
    creatable: false,
    defaultCardArea: "tags",
    defaultDetailZone: "side",
    normalize: value => {
      if (Array.isArray(value)) {
        return value.map(entry => String(entry).trim()).filter(Boolean);
      }

      if (typeof value === "string") {
        return value
          .split(",")
          .map(entry => entry.trim())
          .filter(Boolean);
      }

      return [];
    }
  },
  schedule: {
    label: "Planejamento",
    caption: "Datas planejadas de execucao.",
    creatable: false,
    defaultCardArea: "meta",
    defaultDetailZone: "side",
    normalize: value => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return value as Record<string, unknown>;
      }

      return { plannedStartAt: null, plannedEndAt: null };
    }
  },
  work_item_type: {
    label: "Tipo de item",
    caption: "Tipo de work item.",
    creatable: false,
    defaultCardArea: "badge",
    defaultDetailZone: "side",
    normalize: value => (value == null || value === "" ? null : String(value))
  },
  billing_summary: {
    label: "Cobrancas vinculadas",
    caption: "Ordens de cobranca com status e valor.",
    defaultCardArea: "custom-field",
    defaultDetailZone: "main",
    normalize: value => {
      if (Array.isArray(value)) return value;
      if (typeof value === "string" && value.trim().length > 0) {
        try { return JSON.parse(value); } catch { return []; }
      }
      return [];
    }
  }
};

const taskFieldCreationOrder: TaskFieldType[] = [
  "text",
  "long_text",
  "number",
  "date",
  "datetime",
  "boolean",
  "select",
  "catalog_select",
  "multi_select",
  "user",
  "checklist",
  "billing_summary"
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readTaskFieldStorage(field: TaskFieldDefinition): Record<string, unknown> | null {
  if (field.storage && isRecord(field.storage)) {
    return field.storage;
  }

  if (field.config && isRecord(field.config.storage)) {
    return field.config.storage as Record<string, unknown>;
  }

  return null;
}

export function matchesTaskFieldStorage(
  field: TaskFieldDefinition,
  expected: { kind: string; property: string }
): boolean {
  const storage = readTaskFieldStorage(field);
  if (!storage) {
    return false;
  }

  return storage.kind === expected.kind && storage.property === expected.property;
}

export function getTaskFieldRegistryEntry(type: TaskFieldType): TaskFieldRegistryEntry {
  return taskFieldTypeRegistry[type] ?? taskFieldTypeRegistry.text;
}

export function getTaskFieldTypeLabelFromRegistry(type: TaskFieldType): string {
  return getTaskFieldRegistryEntry(type).label;
}

export function getCreatableTaskFieldTypeOptions(): TaskFieldCreationOption[] {
  return taskFieldCreationOrder
    .map((type) => {
      const entry = getTaskFieldRegistryEntry(type);
      return {
        value: type,
        label: entry.creationLabel ?? entry.label,
        caption: entry.caption
      };
    })
    .filter((option) => getTaskFieldRegistryEntry(option.value).creatable !== false);
}

export function supportsManualOptionsForTaskFieldType(type: TaskFieldType): boolean {
  return getTaskFieldRegistryEntry(type).supportsManualOptions === true;
}

export function supportsAiGenerationForField(field: Pick<TaskFieldDefinition, "type" | "config">): boolean {
  return getTaskFieldRegistryEntry(field.type).supportsAi === true || field.config?.allowAiGeneration === true;
}

export function resolveTaskFieldCardArea(field: TaskFieldDefinition): TaskFieldCardArea {
  const configuredArea = typeof field.config?.cardArea === "string" ? field.config.cardArea : null;
  if (
    configuredArea === "badge" ||
    configuredArea === "title" ||
    configuredArea === "description" ||
    configuredArea === "summary" ||
    configuredArea === "tags" ||
    configuredArea === "custom-field" ||
    configuredArea === "meta"
  ) {
    return configuredArea;
  }

  return getTaskFieldRegistryEntry(field.type).defaultCardArea;
}

export function resolveTaskFieldDetailZone(
  field: TaskFieldDefinition,
  zonesByFieldId?: Record<string, TaskFieldDetailZone>
): TaskFieldDetailZone {
  const explicitZone = zonesByFieldId?.[field.id];
  if (explicitZone === "main" || explicitZone === "side") {
    return explicitZone;
  }

  const configuredZone = typeof field.config?.detailSection === "string" ? field.config.detailSection : null;
  if (configuredZone === "main" || configuredZone === "side") {
    return configuredZone;
  }

  return getTaskFieldRegistryEntry(field.type).defaultDetailZone;
}

function normalizeDateValue(value: string | null | undefined): string | null {
  if (!value) return null;
  return value;
}

function resolveCustomTaskFieldValue(task: Task, field: TaskFieldDefinition): TaskCustomFieldValue | undefined {
  const keys = [
    field.id,
    field.definitionId,
    field.variableKey,
    field.slug
  ].filter((key): key is string => typeof key === "string" && key.length > 0);

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(task.customFields, key)) {
      return task.customFields[key];
    }

    if (task.customFieldValuesById && Object.prototype.hasOwnProperty.call(task.customFieldValuesById, key)) {
      return task.customFieldValuesById[key];
    }
  }

  return undefined;
}

export function resolveTaskFieldValue(task: Task | null | undefined, field: TaskFieldDefinition): TaskCustomFieldValue {
  if (!task) {
    return field.defaultValue ?? null;
  }

  const storage = readTaskFieldStorage(field);
  if (storage) {
    const kind = typeof storage.kind === "string" ? storage.kind : "";
    const property = typeof storage.property === "string" ? storage.property : "";

    if (kind === "item_property") {
      switch (property) {
        case "title":
          return task.title;
        case "description":
          return task.text;
        case "typeSlug":
          return task.type;
        case "stateSlug":
          return task.status;
        case "assigneeId":
          return task.assignee ?? null;
        case "dueDate":
          return normalizeDateValue(task.due);
        case "createdBy":
          return task.createdById ?? null;
        case "checklist":
          return task.checklist;
        default:
          break;
      }
    }

    if (kind === "metadata" && property === "priority") {
      return task.priority;
    }

    if (kind === "item_relation" && property === "tags") {
      return task.tags;
    }

    if (kind === "legacy_fields" && property === "schedule") {
      return {
        plannedStartAt: task.plannedStartAt ?? null,
        plannedEndAt: task.plannedEndAt ?? null
      };
    }
  }

  return resolveCustomTaskFieldValue(task, field) ?? field.defaultValue ?? null;
}

export function resolveTaskFieldOptions(input: {
  field: TaskFieldDefinition;
  boardConfig: BoardConfig;
  statuses: TaskStatus[];
  membersById?: MembersById;
  availableTags?: Array<{ id: string; name: string; color: string }>;
}): TaskFieldOption[] {
  const { field, boardConfig, statuses, membersById, availableTags } = input;

  if (field.type === "status") {
    return statuses.map(status => ({
      id: status.id,
      label: status.label,
      value: status.id,
      color: status.dot,
      order: 0,
      isActive: true
    }));
  }

  if (field.type === "priority") {
    return priorityOptions.map((option, index) => ({
      id: option.value,
      label: option.label,
      value: option.value,
      color: option.color,
      order: index,
      isActive: true
    }));
  }

  if (field.type === "work_item_type") {
    return boardConfig.taskTypes.map((taskType, index) => ({
      id: taskType.id,
      label: taskType.label,
      value: taskType.id,
      color: taskType.text,
      order: index,
      isActive: true
    }));
  }

  if (field.type === "user") {
    return Object.values(membersById ?? {}).map((member, index) => ({
      id: member.id,
      label: member.name,
      value: member.id,
      color: member.color,
      order: index,
      isActive: true
    }));
  }

  if (field.type === "tag") {
    return (availableTags ?? []).map((tag, index) => ({
      id: tag.id,
      label: tag.name,
      value: tag.name,
      color: tag.color,
      order: index,
      isActive: true
    }));
  }

  return (field.options ?? []).filter(option => option.isActive !== false);
}

function resolveOptionLabel(value: string, options: TaskFieldOption[]): string {
  return options.find(option => option.value === value)?.label ?? value;
}

function formatDateValue(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const hasTime = value.includes("T") || value.includes(":");
  return new Intl.DateTimeFormat("pt-BR", hasTime
    ? { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "2-digit", year: "numeric" }
  ).format(parsed);
}

function getFieldSemantic(field: TaskFieldDefinition): string | null {
  if (typeof field.config?.semantic === "string") {
    return field.config.semantic;
  }

  return null;
}

function formatNumberValue(field: TaskFieldDefinition, value: number): string {
  const semantic = getFieldSemantic(field);

  if (semantic === "currency") {
    const currency = typeof field.config?.currency === "string" ? field.config.currency : "BRL";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(value);
  }

  if (semantic === "percentage") {
    return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value)}%`;
  }

  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
}

export function formatTaskFieldValue(input: {
  field: TaskFieldDefinition;
  value: TaskCustomFieldValue;
  boardConfig: BoardConfig;
  statuses: TaskStatus[];
  membersById?: MembersById;
  availableTags?: Array<{ id: string; name: string; color: string }>;
}): string {
  const { field, value, boardConfig, statuses, membersById, availableTags } = input;

  if (value == null || value === "") {
    return "";
  }

  const options = resolveTaskFieldOptions({ field, boardConfig, statuses, membersById, availableTags });

  if (field.type === "multi_select" || field.type === "tag") {
    const values = Array.isArray(value) ? value : [];
    return values.map(entry => resolveOptionLabel(String(entry), options)).join(", ");
  }

  if (field.type === "select" || field.type === "status" || field.type === "work_item_type") {
    return resolveOptionLabel(String(value), options);
  }

  if (field.type === "priority") {
    return resolveOptionLabel(String(value), options);
  }

  if (field.type === "user") {
    const member = membersById?.[String(value)];
    return member?.name ?? String(value);
  }

  if (field.type === "boolean") {
    return value === true ? "Sim" : "Nao";
  }

  if (field.type === "date" || field.type === "datetime") {
    return formatDateValue(String(value));
  }

  if (field.type === "number") {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? formatNumberValue(field, parsed) : String(value);
  }

  if (field.type === "checklist" && isRecord(value) && Array.isArray(value.items)) {
    const total = value.items.length;
    const done = value.items.filter(entry => isRecord(entry) && entry.done === true).length;
    return `${done}/${total} concluidos`;
  }

  if (field.type === "schedule" && isRecord(value)) {
    const start = typeof value.plannedStartAt === "string" ? value.plannedStartAt : "";
    const end = typeof value.plannedEndAt === "string" ? value.plannedEndAt : "";
    if (!start && !end) {
      return "";
    }
    return [start, end].filter(Boolean).join(" -> ");
  }

  return String(value);
}

export function isTaskFieldValueEmpty(field: TaskFieldDefinition, value: TaskCustomFieldValue): boolean {
  if (value === null || typeof value === "undefined") {
    return true;
  }

  if (typeof value === "string") {
    return value.trim().length === 0;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (typeof value === "boolean") {
    return false;
  }

  if (typeof value === "number") {
    return false;
  }

  if (field.type === "schedule" && isRecord(value)) {
    const start = typeof value.plannedStartAt === "string" ? value.plannedStartAt.trim() : "";
    const end = typeof value.plannedEndAt === "string" ? value.plannedEndAt.trim() : "";
    return start.length === 0 && end.length === 0;
  }

  if (field.type === "checklist" && isRecord(value) && Array.isArray(value.items)) {
    return value.items.length === 0;
  }

  return false;
}

export function createTaskFieldDrafts(task: Task | null | undefined, fields: TaskFieldDefinition[]) {
  return fields.reduce<Record<string, TaskCustomFieldValue>>((acc, field) => {
    acc[field.id] = getTaskFieldRegistryEntry(field.type).normalize(resolveTaskFieldValue(task, field));
    return acc;
  }, {});
}

function addCustomFieldValue(
  customFieldValues: Record<string, unknown>,
  field: TaskFieldDefinition,
  value: TaskCustomFieldValue
) {
  if (!field.definitionId) {
    return;
  }

  customFieldValues[field.definitionId] = value;
}

export function buildTaskInputFromFieldDrafts(fields: TaskFieldDefinition[], drafts: Record<string, TaskCustomFieldValue>) {
  const payload: Partial<CreateTaskInput & UpdateTaskInput> = {};
  const extraFields: Record<string, unknown> = {};
  const customFieldValues: Record<string, unknown> = {};

  for (const field of fields) {
    const normalizedValue = getTaskFieldRegistryEntry(field.type).normalize(drafts[field.id] ?? null);
    const storage = readTaskFieldStorage(field);

    if (storage) {
      const kind = typeof storage.kind === "string" ? storage.kind : "";
      const property = typeof storage.property === "string" ? storage.property : "";

      if (kind === "item_property") {
        switch (property) {
          case "title":
            payload.title = typeof normalizedValue === "string" ? normalizedValue : "";
            continue;
          case "description":
            payload.description = typeof normalizedValue === "string" ? normalizedValue : "";
            continue;
          case "typeSlug":
            payload.typeSlug = typeof normalizedValue === "string" ? normalizedValue : undefined;
            payload.type = typeof normalizedValue === "string" ? normalizedValue : undefined;
            continue;
          case "stateSlug":
            if (typeof normalizedValue === "string") {
              payload.stateId = normalizedValue;
              payload.statusId = normalizedValue;
            }
            continue;
          case "assigneeId":
            payload.assigneeId = typeof normalizedValue === "string" && normalizedValue.length > 0 ? normalizedValue : null;
            continue;
          case "dueDate":
            payload.dueDate = typeof normalizedValue === "string" && normalizedValue.length > 0 ? normalizedValue : null;
            continue;
          case "checklist":
            if (normalizedValue && typeof normalizedValue === "object" && !Array.isArray(normalizedValue)) {
              payload.checklist = normalizedValue as TaskChecklist;
            }
            continue;
          default:
            break;
        }
      }

      if (kind === "metadata" && property === "priority") {
        payload.priority = Number(normalizedValue ?? 2) as TaskPriority;
        continue;
      }

      if (kind === "item_relation" && property === "tags") {
        payload.tags = Array.isArray(normalizedValue) ? normalizedValue.map(entry => String(entry)) : [];
        continue;
      }

      if (kind === "legacy_fields" && property === "schedule" && isRecord(normalizedValue)) {
        extraFields.plannedStartAt =
          typeof normalizedValue.plannedStartAt === "string" && normalizedValue.plannedStartAt.length > 0
            ? normalizedValue.plannedStartAt
            : null;
        extraFields.plannedEndAt =
          typeof normalizedValue.plannedEndAt === "string" && normalizedValue.plannedEndAt.length > 0
            ? normalizedValue.plannedEndAt
            : null;
        continue;
      }
    }

    addCustomFieldValue(customFieldValues, field, normalizedValue);
  }

  if (Object.keys(extraFields).length > 0) {
    payload.fields = {
      ...(payload.fields ?? {}),
      ...extraFields
    };
  }

  if (Object.keys(customFieldValues).length > 0) {
    payload.customFieldValues = customFieldValues;
  }

  return payload;
}
