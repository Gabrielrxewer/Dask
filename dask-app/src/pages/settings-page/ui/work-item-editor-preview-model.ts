import {
  isTaskFieldValueEmpty,
  readTaskFieldStorage,
  resolveTaskFieldValue
} from "@/entities/task";
import type { Task, TaskCustomFieldValue, TaskFieldDefinition } from "@/entities/task";
import {
  isCatalogSelectType,
  normalizeOptionInputs,
  type FieldDraft,
  type PendingFieldSetup
} from "./work-item-editor-field-model";

export const PREVIEW_CARD_TITLE = "Refinar experiencia do checkout";
export const PREVIEW_CARD_DESCRIPTION = "Ajustar fluxo, copy e validacoes para reduzir friccao no funil.";
export const PREVIEW_CARD_TAGS = ["ux", "receita", "q2"];
export const PREVIEW_CARD_IDENTIFIER = "WK-2048";
export const PREVIEW_CREATED_BY = {
  id: "preview-creator",
  name: "Marina Costa",
  initials: "MC",
  color: "var(--danger-border)"
};
export const PREVIEW_ASSIGNEE = {
  id: "preview-member",
  name: "Squad Produto",
  initials: "SP",
  color: "var(--text-secondary)"
};
export const PREVIEW_DUE_DATE = "2026-04-26";
export const PREVIEW_DATETIME = "2026-04-28T14:20:00.000Z";
export const PREVIEW_SCHEDULE = {
  plannedStartAt: "2026-04-24T09:00:00.000Z",
  plannedEndAt: "2026-04-26T18:00:00.000Z"
};
export const PREVIEW_CHECKLIST = {
  items: [
    { id: "check-1", label: "Mapear friccoes do fluxo", done: true },
    { id: "check-2", label: "Revisar copy dos CTAs", done: true },
    { id: "check-3", label: "Ajustar validacoes do formulario", done: true },
    { id: "check-4", label: "Validar eventos de conversao", done: false },
    { id: "check-5", label: "Publicar experimento", done: false }
  ]
};

export function getPreviewOptionLabels(field: TaskFieldDefinition): string[] {
  return (field.options ?? []).map((option) => option.label).filter(Boolean);
}

export function getPreviewValue(field: TaskFieldDefinition): string {
  const identity = `${field.id} ${field.slug ?? ""} ${field.label}`.toLowerCase();
  if ((field.type === "text" || field.type === "number") && (/\bid\b/.test(identity) || identity.includes("codigo") || identity.includes("identificador"))) {
    return PREVIEW_CARD_IDENTIFIER;
  }
  if (field.type === "work_item_type") return "Growth";
  if (field.type === "priority") return "Alta";
  if (field.type === "status") return "Em validacao";
  if (field.type === "text") return PREVIEW_CARD_TITLE;
  if (field.type === "long_text") return PREVIEW_CARD_DESCRIPTION;
  if (field.type === "user") return PREVIEW_ASSIGNEE.name;
  if (field.type === "tag") return PREVIEW_CARD_TAGS.join(", ");
  if (field.type === "boolean") return "Ativado";
  if (field.type === "number") return "42";
  if (field.type === "date") return "28/04/2026";
  if (field.type === "datetime") return "28/04 14:20";
  if (field.type === "schedule") return "24/04 09:00 -> 26/04 18:00";
  if (field.type === "select" || field.type === "multi_select") {
    return getPreviewOptionLabels(field).slice(0, 2).join(", ") || "Opcao A";
  }
  if (field.type === "checklist") return "3 / 5 concluidos";
  return "Valor de exemplo";
}

export function getPreviewSampleFieldValue(input: {
  field: TaskFieldDefinition;
  typeId: string;
  statusId: string;
  priority: 0 | 1 | 2 | 3 | 4;
}): TaskCustomFieldValue {
  const { field, typeId, statusId, priority } = input;
  const identity = `${field.id} ${field.slug ?? ""} ${field.label}`.toLowerCase();

  if ((field.type === "text" || field.type === "number") && (/\bid\b/.test(identity) || identity.includes("codigo") || identity.includes("identificador"))) {
    return PREVIEW_CARD_IDENTIFIER;
  }
  if (field.type === "work_item_type") return typeId;
  if (field.type === "priority") return priority;
  if (field.type === "status") return statusId;
  if (field.type === "boolean") return true;
  if (field.type === "number") return 42;
  if (field.type === "date") return PREVIEW_DUE_DATE;
  if (field.type === "datetime") return PREVIEW_DATETIME;
  if (field.type === "user") return PREVIEW_ASSIGNEE.id;
  if (field.type === "tag") return PREVIEW_CARD_TAGS;
  if (field.type === "schedule") return PREVIEW_SCHEDULE;
  if (field.type === "checklist") return PREVIEW_CHECKLIST;
  if (field.type === "select") return field.options?.[0]?.value ?? "Opcao A";
  if (field.type === "multi_select") {
    const options = field.options?.slice(0, 2).map((option) => option.value).filter(Boolean) ?? [];
    return options.length > 0 ? options : ["Opcao A", "Opcao B"];
  }
  return field.type === "long_text" ? PREVIEW_CARD_DESCRIPTION : "Valor de exemplo";
}

export function buildPreviewTask(input: {
  fields: TaskFieldDefinition[];
  typeId: string;
  statusId: string;
  sourceTask?: Task | null;
}): Task {
  const sourceTask = input.sourceTask ?? null;
  const previewTask: Task = sourceTask
    ? {
        ...sourceTask,
        linkedDocuments: [...(sourceTask.linkedDocuments ?? [])],
        tags: [...sourceTask.tags],
        checklist: { items: sourceTask.checklist.items.map((item) => ({ ...item })) },
        customFields: { ...(sourceTask.customFields ?? {}) }
      }
    : {
        id: "preview-work-item",
        title: PREVIEW_CARD_TITLE,
        text: PREVIEW_CARD_DESCRIPTION,
        createdById: PREVIEW_CREATED_BY.id,
        type: input.typeId,
        status: input.statusId,
        position: 0,
        priority: 2,
        tags: [...PREVIEW_CARD_TAGS],
        assignee: PREVIEW_ASSIGNEE.id,
        checklist: { items: PREVIEW_CHECKLIST.items.map((item) => ({ ...item })) },
        due: PREVIEW_DUE_DATE,
        plannedStartAt: PREVIEW_SCHEDULE.plannedStartAt,
        plannedEndAt: PREVIEW_SCHEDULE.plannedEndAt,
        linkedDocuments: [],
        customFields: {}
      };

  input.fields.forEach((field) => {
    const currentValue = resolveTaskFieldValue(previewTask, field);
    if (!isTaskFieldValueEmpty(field, currentValue)) return;

    const sampleValue = getPreviewSampleFieldValue({
      field,
      typeId: input.typeId,
      statusId: previewTask.status,
      priority: previewTask.priority
    });

    if (isTaskFieldValueEmpty(field, sampleValue)) return;

    const storage = readTaskFieldStorage(field);
    const kind = typeof storage?.kind === "string" ? storage.kind : "";
    const property = typeof storage?.property === "string" ? storage.property : "";

    if (kind === "item_property") {
      switch (property) {
        case "title": previewTask.title = typeof sampleValue === "string" ? sampleValue : PREVIEW_CARD_TITLE; return;
        case "description": previewTask.text = typeof sampleValue === "string" ? sampleValue : PREVIEW_CARD_DESCRIPTION; return;
        case "typeSlug": previewTask.type = typeof sampleValue === "string" ? sampleValue : input.typeId; return;
        case "stateSlug": previewTask.status = typeof sampleValue === "string" ? sampleValue : input.statusId; return;
        case "assigneeId": previewTask.assignee = typeof sampleValue === "string" ? sampleValue : PREVIEW_ASSIGNEE.id; return;
        case "dueDate": previewTask.due = typeof sampleValue === "string" ? sampleValue : PREVIEW_DUE_DATE; return;
        case "createdBy": previewTask.createdById = typeof sampleValue === "string" ? sampleValue : PREVIEW_CREATED_BY.id; return;
        case "checklist":
          if (sampleValue && typeof sampleValue === "object" && "items" in sampleValue) {
            previewTask.checklist = sampleValue as Task["checklist"];
          }
          return;
        default: break;
      }
    }

    if (kind === "metadata" && property === "priority") {
      previewTask.priority = typeof sampleValue === "number" ? (sampleValue as Task["priority"]) : previewTask.priority;
      return;
    }

    if (kind === "item_relation" && property === "tags") {
      previewTask.tags = Array.isArray(sampleValue) ? sampleValue.map((value) => String(value)) : [...PREVIEW_CARD_TAGS];
      return;
    }

    if (kind === "legacy_fields" && property === "schedule" && sampleValue && typeof sampleValue === "object" && !Array.isArray(sampleValue)) {
      const schedule = sampleValue as Record<string, unknown>;
      previewTask.plannedStartAt = typeof schedule.plannedStartAt === "string" ? schedule.plannedStartAt : previewTask.plannedStartAt;
      previewTask.plannedEndAt = typeof schedule.plannedEndAt === "string" ? schedule.plannedEndAt : previewTask.plannedEndAt;
      return;
    }

    previewTask.customFields[field.id] = sampleValue;
    if (field.slug && field.slug !== field.id) previewTask.customFields[field.slug] = sampleValue;
  });

  return previewTask;
}

export function buildFieldEditorPreview(
  selectedField: TaskFieldDefinition | null,
  fieldDraft: FieldDraft | null
): TaskFieldDefinition | null {
  if (!selectedField) return null;
  if (!fieldDraft || fieldDraft.runtimeFieldId !== selectedField.id) return selectedField;

  return {
    ...selectedField,
    label: fieldDraft.name.trim() || selectedField.label,
    type: fieldDraft.type,
    options: normalizeOptionInputs(fieldDraft.options).map((option, index) => ({
      id: `preview-option-${index + 1}`,
      label: option.label,
      value: option.value
    })),
    config: {
      ...(selectedField.config ?? {}),
      ...(isCatalogSelectType(fieldDraft.type) ? { entityType: "billing_catalog_item" } : {}),
      checklistDisplay:
        fieldDraft.type === "checklist"
          ? {
              icon: fieldDraft.checklistIcon,
              color: fieldDraft.checklistColor,
              label: fieldDraft.name.trim() || selectedField.label
            }
          : (selectedField.config as Record<string, unknown> | null | undefined)?.checklistDisplay
    }
  };
}

export function buildPendingFieldPreview(pendingFieldSetup: PendingFieldSetup | null): TaskFieldDefinition | null {
  if (!pendingFieldSetup) return null;

  return {
    id: "pending-field-preview",
    label: pendingFieldSetup.name.trim() || "Novo campo",
    name: pendingFieldSetup.name.trim() || "Novo campo",
    slug: "pending-field-preview",
    type: pendingFieldSetup.type,
    required: pendingFieldSetup.required,
    isEditable: true,
    isActive: true,
    config: {
      ...(isCatalogSelectType(pendingFieldSetup.type) ? { entityType: "billing_catalog_item" } : {}),
      checklistDisplay:
        pendingFieldSetup.type === "checklist"
          ? {
              icon: pendingFieldSetup.checklistIcon,
              color: pendingFieldSetup.checklistColor,
              label: pendingFieldSetup.name.trim() || "Novo campo"
            }
          : undefined
    },
    options: normalizeOptionInputs(pendingFieldSetup.options).map((option, index) => ({
      id: `pending-preview-option-${index + 1}`,
      label: option.label,
      value: option.value
    }))
  };
}
