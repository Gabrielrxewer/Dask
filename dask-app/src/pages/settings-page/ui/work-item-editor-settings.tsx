import { useCallback, useEffect, useMemo, useState } from "react";
import type { DragEvent, MouseEvent, ReactNode } from "react";
import {
  applyFieldCapabilityOverrides,
  buildTaskFieldBindingsForType,
  CARD_SLOT_LIMITS,
  factoryBoardConfig,
  getTaskFieldTypeLabel,
  isTaskFieldValueEmpty,
  mergeCardFieldDefinitions,
  resolveTaskFieldCardArea,
  resolveTaskFieldValue,
  resolveTaskFieldDetailZone,
  resolveWorkItemFieldBindings,
  readTaskFieldStorage,
  TaskCard,
  FieldShell,
  WorkItemFieldRenderer,
  resolveFieldShellStyle
} from "@/entities/task";
import type {
  BoardConfig,
  Task,
  TaskCustomFieldValue,
  TaskCardDebugSnapshot,
  TaskCardSlotArea,
  TaskFieldBinding,
  TaskFieldCardArea,
  TaskFieldDefinition,
  TaskFieldVisualPriority
} from "@/entities/task";
import type { ApiBoardColumn, ApiCustomField, ApiItemType, ApiWorkflowState, CustomFieldType } from "@/modules/workspace/model";
import { useWorkspace } from "@/modules/workspace";
import {
  applyFieldDrop,
  isEditorDropTargetEqual,
  resolveDetailInsertIndex,
  type DetailZone,
  type EditorDropTarget,
  type LayoutDraft,
  type LayoutScope
} from "@/pages/settings-page/model/work-item-layout-editor";
import { buildBoardColumnsRuntimeView, mapTasksForBoardPerspective } from "@/widgets/board-columns/model/board-runtime";
import { Button, FormField, TextInput } from "@/shared/ui";
import "./work-item-editor-settings.css";

const DEFAULT_TYPE_COLOR = "#0a86e8";

const CARD_SLOT_AREA_META: Array<{ area: TaskCardSlotArea; label: string }> = [
  { area: "badge", label: "Topo" },
  { area: "title", label: "Titulo" },
  { area: "description", label: "Resumo" },
  { area: "summary", label: "Meta principal" },
  { area: "tags", label: "Tag principal" },
  { area: "custom-field", label: "Apoio" },
  { area: "meta", label: "Base" }
];

const CARD_SLOT_AREA_LABELS = Object.fromEntries(
  CARD_SLOT_AREA_META.map(({ area, label }) => [area, label])
) as Record<TaskCardSlotArea, string>;

const FIELD_TYPE_OPTIONS: Array<{
  value: CustomFieldType;
  label: string;
  caption: string;
}> = [
  { value: "text", label: "Texto curto", caption: "Linha simples e direta." },
  { value: "long_text", label: "Texto longo", caption: "Contexto e briefing." },
  { value: "number", label: "Numero", caption: "Metricas e contagens." },
  { value: "date", label: "Data", caption: "Datas sem horario." },
  { value: "datetime", label: "Data e hora", caption: "Agenda e planejamento." },
  { value: "boolean", label: "Sim / Nao", caption: "Alternancia rapida." },
  { value: "select", label: "Selecao unica", caption: "Uma opcao entre varias." },
  { value: "multi_select", label: "Selecao multipla", caption: "Etiquetas e combinacoes." },
  { value: "user", label: "Usuario", caption: "Pessoa responsavel ou autora." },
  { value: "checklist", label: "Checklist", caption: "Lista operacional com marcacao." }
];

const PREVIEW_CARD_TITLE = "Refinar experiencia do checkout";
const PREVIEW_CARD_DESCRIPTION = "Ajustar fluxo, copy e validacoes para reduzir friccao no funil.";
const PREVIEW_CARD_TAGS = ["ux", "receita", "q2"];
const PREVIEW_CARD_IDENTIFIER = "WK-2048";
const PREVIEW_CREATED_BY = {
  id: "preview-creator",
  name: "Marina Costa",
  initials: "MC",
  color: "#ffd7bf"
};
const PREVIEW_ASSIGNEE = {
  id: "preview-member",
  name: "Squad Produto",
  initials: "SP",
  color: "#b8dafd"
};
const PREVIEW_DUE_DATE = "2026-04-26";
const PREVIEW_DATETIME = "2026-04-28T14:20:00.000Z";
const PREVIEW_SCHEDULE = {
  plannedStartAt: "2026-04-24T09:00:00.000Z",
  plannedEndAt: "2026-04-26T18:00:00.000Z"
};
const PREVIEW_CHECKLIST = {
  items: [
    { id: "check-1", label: "Mapear friccoes do fluxo", done: true },
    { id: "check-2", label: "Revisar copy dos CTAs", done: true },
    { id: "check-3", label: "Ajustar validacoes do formulario", done: true },
    { id: "check-4", label: "Validar eventos de conversao", done: false },
    { id: "check-5", label: "Publicar experimento", done: false }
  ]
};

interface FieldOptionDraft {
  id: string;
  label: string;
  value: string;
}

interface TypeDraft {
  name: string;
  color: string;
}

interface FieldDraft {
  id: string;
  runtimeFieldId: string;
  name: string;
  type: TaskFieldDefinition["type"];
  required: boolean;
  allowAiGeneration: boolean;
  options: FieldOptionDraft[];
  checklistIcon: string;
  checklistColor: string;
}

interface PendingFieldSetup {
  type: CustomFieldType;
  targetScope: LayoutScope;
  targetIndex: number;
  targetDetailZone?: DetailZone;
  dropTarget?: EditorDropTarget | null;
  addToLayout: boolean;
  name: string;
  required: boolean;
  allowAiGeneration: boolean;
  options: FieldOptionDraft[];
  checklistIcon: string;
  checklistColor: string;
}

type DragPayload =
  | { kind: "field"; fieldId: string; origin: "library" | "card" | "detail" }
  | { kind: "type"; type: CustomFieldType };

interface FieldLibraryItem extends TaskFieldDefinition {
  optionsCount: number;
  required: boolean;
  allowAiGeneration: boolean;
  hasApiDefinition: boolean;
}


// ── Utilities ──────────────────────────────────────────────────────────────

function sanitizeFieldIds(values: string[], allowedFieldIds?: Set<string>): string[] {
  return Array.from(
    new Set(
      values
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter((v) => v.length > 0 && (!allowedFieldIds || allowedFieldIds.has(v)))
    )
  );
}

function areSameOrderedIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function supportsAiGeneration(type: CustomFieldType): boolean {
  return type === "text" || type === "long_text";
}

function supportsSelectableOptions(type: CustomFieldType): boolean {
  return type === "select" || type === "multi_select";
}

function readChecklistDisplaySettings(source: Record<string, unknown> | null | undefined): { icon: string; color: string } {
  const display =
    source && typeof source === "object" && !Array.isArray(source) &&
    source.checklistDisplay && typeof source.checklistDisplay === "object" && !Array.isArray(source.checklistDisplay)
      ? (source.checklistDisplay as Record<string, unknown>)
      : {};

  return {
    icon: typeof display.icon === "string" && display.icon.trim().length > 0 ? display.icon : "checklist",
    color: typeof display.color === "string" && /^#[0-9a-fA-F]{6}$/.test(display.color) ? display.color : "#0a86e8"
  };
}

function readAllowAiGeneration(settings: ApiCustomField["settings"]): boolean {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return false;
  return settings.allowAiGeneration === true;
}

function readFieldCapabilitiesById(settings?: Record<string, unknown>): Record<string, { aiEnhance?: boolean }> {
  const source = settings?.fieldCapabilitiesById;
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};
  return Object.entries(source as Record<string, unknown>).reduce<Record<string, { aiEnhance?: boolean }>>(
    (acc, [id, val]) => {
      if (val && typeof val === "object" && !Array.isArray(val)) {
        const ai = (val as { aiEnhance?: unknown }).aiEnhance;
        if (typeof ai === "boolean") acc[id] = { aiEnhance: ai };
      }
      return acc;
    },
    {}
  );
}

function readFieldDefinitionOverridesById(
  settings?: Record<string, unknown>
): Record<string, Partial<TaskFieldDefinition> & { allowAiGeneration?: boolean; checklistDisplay?: Record<string, unknown> }> {
  const source = settings?.fieldDefinitionsById;
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};

  return Object.entries(source as Record<string, unknown>).reduce<Record<string, Partial<TaskFieldDefinition> & { allowAiGeneration?: boolean; checklistDisplay?: Record<string, unknown> }>>(
    (acc, [id, value]) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        acc[id] = value as Partial<TaskFieldDefinition> & { allowAiGeneration?: boolean; checklistDisplay?: Record<string, unknown> };
      }
      return acc;
    },
    {}
  );
}

function applyFieldDefinitionOverrides(
  fieldDefinitions: TaskFieldDefinition[],
  settings?: Record<string, unknown>
): TaskFieldDefinition[] {
  const overridesById = readFieldDefinitionOverridesById(settings);
  if (Object.keys(overridesById).length === 0) return fieldDefinitions;

  return fieldDefinitions.map((definition) => {
    const override = overridesById[definition.id];
    if (!override) return definition;

    return {
      ...definition,
      label: typeof override.label === "string" ? override.label : definition.label,
      name: typeof override.name === "string" ? override.name : definition.name,
      type: typeof override.type === "string" ? (override.type as TaskFieldDefinition["type"]) : definition.type,
      required: typeof override.required === "boolean" ? override.required : definition.required,
      options: Array.isArray(override.options) ? (override.options as TaskFieldDefinition["options"]) : definition.options,
      config: {
        ...(definition.config ?? {}),
        ...(typeof override.allowAiGeneration === "boolean" ? { allowAiGeneration: override.allowAiGeneration } : {}),
        ...(override.checklistDisplay && typeof override.checklistDisplay === "object" ? { checklistDisplay: override.checklistDisplay } : {})
      }
    };
  });
}

function sanitizeOptionValue(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeOptionInputs(options: FieldOptionDraft[]): Array<{ label: string; value: string }> {
  const seen = new Set<string>();
  const out: Array<{ label: string; value: string }> = [];
  options.forEach((o, i) => {
    const label = o.label.trim();
    if (!label) return;
    const base = sanitizeOptionValue(o.value) || sanitizeOptionValue(label) || `opcao_${i + 1}`;
    let val = base;
    let s = 2;
    while (seen.has(val)) { val = `${base}_${s}`; s += 1; }
    seen.add(val);
    out.push({ label, value: val });
  });
  return out;
}

function mapApiOptionsToDraft(options: ApiCustomField["options"]): FieldOptionDraft[] {
  return (options ?? []).map((o, i) => ({ id: o.id || `opt-${i}`, label: o.label, value: o.value }));
}

function createEmptyOptionDraft(index: number): FieldOptionDraft {
  return { id: `new-opt-${Date.now()}-${index}`, label: "", value: "" };
}

function buildFieldDraftFromApiField(raw: ApiCustomField, runtimeFieldId: string): FieldDraft {
  const checklistDisplay = readChecklistDisplaySettings((raw.settings as Record<string, unknown> | null | undefined) ?? undefined);
  return {
    id: raw.id,
    runtimeFieldId,
    name: raw.name,
    type: raw.type as CustomFieldType,
    required: raw.required,
    allowAiGeneration: readAllowAiGeneration(raw.settings),
    options: mapApiOptionsToDraft(raw.options),
    checklistIcon: checklistDisplay.icon,
    checklistColor: checklistDisplay.color
  };
}

function buildFieldDraftFromDefinition(field: TaskFieldDefinition): FieldDraft {
  const checklistDisplay = readChecklistDisplaySettings((field.config as Record<string, unknown> | null | undefined) ?? undefined);
  return {
    id: field.definitionId ?? field.id,
    runtimeFieldId: field.id,
    name: field.label,
    type: field.type,
    required: field.required ?? false,
    allowAiGeneration: field.capabilities?.aiEnhance === true,
    options: (field.options ?? []).map((option, index) => ({
      id: option.id || `field-opt-${index}`,
      label: option.label,
      value: option.value
    })),
    checklistIcon: checklistDisplay.icon,
    checklistColor: checklistDisplay.color
  };
}

function getPreviewOptionLabels(field: TaskFieldDefinition): string[] {
  return (field.options ?? []).map((option) => option.label).filter(Boolean);
}

function getPreviewValue(field: TaskFieldDefinition): string {
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

function getPreviewSampleFieldValue(input: {
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

function buildPreviewTask(input: {
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

function renderPreviewFieldValue(field: TaskFieldDefinition): ReactNode {
  if (field.type === "long_text") {
    return <p className="wie__detail-preview-copy">{getPreviewValue(field)}</p>;
  }
  if (field.type === "multi_select" || field.type === "tag") {
    const values = String(getPreviewValue(field)).split(",").map((v) => v.trim()).filter(Boolean);
    return (
      <div className="wie__detail-preview-pills">
        {values.map((v) => <span key={v} className="wie__detail-preview-pill">{v}</span>)}
      </div>
    );
  }
  if (field.type === "checklist") {
    return (
      <div className="wie__detail-preview-checklist">
        <span className="wie__detail-preview-progress">3 de 5 concluidos</span>
        <div className="wie__detail-preview-progressbar"><i /></div>
      </div>
    );
  }
  if (field.type === "boolean") return <div className="wie__detail-preview-input">Ativado</div>;
  if (field.type === "schedule") return <div className="wie__detail-preview-input">24/04 09:00 → 26/04 18:00</div>;
  return <div className="wie__detail-preview-input">{getPreviewValue(field)}</div>;
}

function removeFieldFromScope(draft: LayoutDraft, scope: LayoutScope, fieldId: string): LayoutDraft {
  return scope === "card"
    ? { ...draft, card: draft.card.filter((id) => id !== fieldId) }
    : { ...draft, detail: draft.detail.filter((id) => id !== fieldId) };
}

function addFieldIdToList(ids: string[], fieldId: string, index: number): string[] {
  const filtered = ids.filter((id) => id !== fieldId);
  filtered.splice(Math.max(0, Math.min(index, filtered.length)), 0, fieldId);
  return Array.from(new Set(filtered));
}

function getDefaultDetailZone(field: TaskFieldDefinition | undefined): DetailZone {
  return field ? resolveTaskFieldDetailZone(field) : "side";
}

function resolveDetailPreviewLayoutClass(field: TaskFieldDefinition, zone: DetailZone) {
  const storage = readTaskFieldStorage(field);
  const shouldSpan =
    zone === "main" &&
    (field.type === "long_text" ||
      field.type === "checklist" ||
      field.type === "schedule" ||
      (storage?.kind === "item_property" && (storage.property === "title" || storage.property === "description")));

  return shouldSpan ? "is-wide" : "is-compact";
}

// ── Component ──────────────────────────────────────────────────────────────

export function WorkItemEditorSettings() {
  const {
    snapshot,
    fetchBoardColumns,
    fetchWorkflowStates,
    fetchItemTypes,
    fetchCustomFields,
    createItemType,
    updateItemType,
    deleteItemType,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    replaceItemTypeFieldBindings,
    updatePreferences
  } = useWorkspace();

  const boardConfig = snapshot?.boardConfig ?? factoryBoardConfig;
  const settings = (snapshot?.preferences.settings as Record<string, unknown> | undefined) ?? {};

  const allFields = useMemo(
    () =>
      applyFieldCapabilityOverrides(
        applyFieldDefinitionOverrides(
          mergeCardFieldDefinitions(Array.isArray(boardConfig.fieldDefinitions) ? boardConfig.fieldDefinitions : []),
          settings
        ),
        settings
      ),
    [boardConfig.fieldDefinitions, settings]
  );
  const fieldCapabilitiesById = useMemo(() => readFieldCapabilitiesById(settings), [settings]);
  const allowedFieldIds = useMemo(() => new Set(allFields.map((f) => f.id)), [allFields]);

  // ── Data state ──────────────────────────────────────────────────────────
  const [itemTypes, setItemTypes] = useState<ApiItemType[]>([]);
  const [customFields, setCustomFields] = useState<ApiCustomField[]>([]);
  const [boardColumns, setBoardColumns] = useState<ApiBoardColumn[]>([]);
  const [workflowStates, setWorkflowStates] = useState<ApiWorkflowState[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Type navigation ──────────────────────────────────────────────────────
  const [activeTypeSlug, setActiveTypeSlug] = useState("");

  // ── Layout drafts ────────────────────────────────────────────────────────
  const [layoutDraftsByTypeSlug, setLayoutDraftsByTypeSlug] = useState<Record<string, LayoutDraft>>({});
  const [detailZoneDraftsByTypeSlug, setDetailZoneDraftsByTypeSlug] = useState<Record<string, Record<string, DetailZone>>>({});
  const [cardAreaDraftsByTypeSlug, setCardAreaDraftsByTypeSlug] = useState<Record<string, Record<string, TaskFieldCardArea>>>({});
  const [savingLayout, setSavingLayout] = useState(false);
  const [layoutMessage, setLayoutMessage] = useState("");

  // ── Type composer ────────────────────────────────────────────────────────
  const [typeComposer, setTypeComposer] = useState<TypeDraft | null>(null);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [typeSaving, setTypeSaving] = useState(false);
  const [typeDeletingId, setTypeDeletingId] = useState<string | null>(null);

  // ── Field panels ─────────────────────────────────────────────────────────
  const [fieldDraft, setFieldDraft] = useState<FieldDraft | null>(null);
  const [pendingFieldSetup, setPendingFieldSetup] = useState<PendingFieldSetup | null>(null);
  const [fieldSaving, setFieldSaving] = useState(false);
  const [fieldDeletingId, setFieldDeletingId] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState("");

  // ── Canvas interaction ───────────────────────────────────────────────────
  const [activeCanvasTab, setActiveCanvasTab] = useState<"card" | "detail" | "field">("card");
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [dropTarget, setDropTarget] = useState<EditorDropTarget | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [previewCardDebug, setPreviewCardDebug] = useState<TaskCardDebugSnapshot | null>(null);

  // ── Library filter ───────────────────────────────────────────────────────
  const [librarySearch, setLibrarySearch] = useState("");

  // ── Load ─────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [nextTypes, nextFields, nextBoardColumns, nextWorkflowStates] = await Promise.all([
        fetchItemTypes(),
        fetchCustomFields(),
        fetchBoardColumns(),
        fetchWorkflowStates()
      ]);
      setItemTypes(nextTypes);
      setCustomFields(nextFields);
      setBoardColumns(nextBoardColumns.filter((c) => c.isActive).sort((a, b) => a.order - b.order));
      setWorkflowStates(nextWorkflowStates.filter((s) => s.isActive));
    } finally {
      setLoading(false);
    }
  }, [fetchBoardColumns, fetchCustomFields, fetchItemTypes, fetchWorkflowStates]);

  useEffect(() => { void loadData(); }, [loadData]);

  const activeItemTypes = useMemo(() => itemTypes.filter((t) => t.isActive !== false), [itemTypes]);

  useEffect(() => {
    if (!activeItemTypes.length) { setActiveTypeSlug(""); return; }
    if (!activeItemTypes.some((t) => t.slug === activeTypeSlug)) {
      setActiveTypeSlug(activeItemTypes[0].slug);
    }
  }, [activeItemTypes, activeTypeSlug]);

  const activeType = useMemo(
    () => activeItemTypes.find((t) => t.slug === activeTypeSlug) ?? activeItemTypes[0] ?? null,
    [activeItemTypes, activeTypeSlug]
  );

  const customFieldByRuntimeId = useMemo(
    () =>
      customFields.reduce<Record<string, ApiCustomField>>((acc, field) => {
        acc[field.id] = field;
        acc[field.slug] = field;
        if (field.definitionId) acc[field.definitionId] = field;
        return acc;
      }, {}),
    [customFields]
  );

  const libraryFields = useMemo<FieldLibraryItem[]>(
    () =>
      allFields.map((field) => {
        const cf = customFieldByRuntimeId[field.id] ?? (field.definitionId ? customFieldByRuntimeId[field.definitionId] : undefined);
        const explicit = fieldCapabilitiesById[field.id]?.aiEnhance;
        const allowAiGeneration =
          typeof explicit === "boolean"
            ? explicit
            : field.capabilities?.aiEnhance === true || readAllowAiGeneration(cf?.settings);
        return {
          ...field,
          optionsCount: cf?.options.length ?? field.options?.length ?? 0,
          required: cf?.required ?? field.required ?? false,
          allowAiGeneration,
          hasApiDefinition: Boolean(cf)
        };
      }),
    [allFields, customFieldByRuntimeId, fieldCapabilitiesById]
  );

  const fieldsById = useMemo(
    () => libraryFields.reduce<Record<string, FieldLibraryItem>>((acc, f) => { acc[f.id] = f; return acc; }, {}),
    [libraryFields]
  );
  const editableFields = useMemo(
    () => libraryFields.filter((field) => field.isEditable !== false),
    [libraryFields]
  );

  const persistedDetailZonesByType = useMemo(
    () =>
      activeItemTypes.reduce<Record<string, Record<string, DetailZone>>>((acc, itemType) => {
        acc[itemType.slug] = Object.fromEntries(
          resolveWorkItemFieldBindings(boardConfig, itemType.slug, "detail").map((binding) => [binding.field.id, binding.zone])
        );
        return acc;
      }, {}),
    [activeItemTypes, boardConfig]
  );

  const persistedCardAreasByType = useMemo(
    () =>
      activeItemTypes.reduce<Record<string, Record<string, TaskFieldCardArea>>>((acc, itemType) => {
        acc[itemType.slug] = Object.fromEntries(
          resolveWorkItemFieldBindings(boardConfig, itemType.slug, "card").map((binding) => [binding.field.id, binding.cardArea])
        );
        return acc;
      }, {}),
    [activeItemTypes, boardConfig]
  );

  const getEffectiveLayout = useCallback(
    (typeSlug: string): LayoutDraft => ({
      card: resolveWorkItemFieldBindings(boardConfig, typeSlug, "card").map((binding) => binding.field.id),
      detail: resolveWorkItemFieldBindings(boardConfig, typeSlug, "detail").map((binding) => binding.field.id)
    }),
    [boardConfig]
  );

  const activeLayout = activeType
    ? layoutDraftsByTypeSlug[activeType.slug] ?? getEffectiveLayout(activeType.slug)
    : { card: [], detail: [] };

  const activeDetailZones = activeType
    ? {
        ...Object.fromEntries(activeLayout.detail.map((fieldId) => [fieldId, getDefaultDetailZone(fieldsById[fieldId])])),
        ...(persistedDetailZonesByType[activeType.slug] ?? {}),
        ...(detailZoneDraftsByTypeSlug[activeType.slug] ?? {})
      }
    : {};

  const activeCardAreaDrafts = activeType ? (cardAreaDraftsByTypeSlug[activeType.slug] ?? {}) : {};
  const activeCardAreasByFieldId = useMemo(
    () =>
      Object.fromEntries(
        activeLayout.card.map((fieldId) => [
          fieldId,
          activeCardAreaDrafts[fieldId] ??
            persistedCardAreasByType[activeType?.slug ?? ""]?.[fieldId] ??
            (fieldsById[fieldId] ? resolveTaskFieldCardArea(fieldsById[fieldId]) : "custom-field")
        ])
      ) as Record<string, TaskFieldCardArea>,
    [activeCardAreaDrafts, activeLayout.card, activeType?.slug, fieldsById, persistedCardAreasByType]
  );

  const cardFieldSet = useMemo(() => new Set(activeLayout.card), [activeLayout.card]);
  const detailFieldSet = useMemo(() => new Set(activeLayout.detail), [activeLayout.detail]);

  const cardFields = activeLayout.card.map((id) => fieldsById[id]).filter((f): f is FieldLibraryItem => Boolean(f));
  const detailFields = activeLayout.detail.map((id) => fieldsById[id]).filter((f): f is FieldLibraryItem => Boolean(f));
  const detailMainFields = detailFields.filter((f) => activeDetailZones[f.id] === "main");
  const detailSideFields = detailFields.filter((f) => activeDetailZones[f.id] !== "main");

  // Library grouping by usage
  const filteredLibraryFields = useMemo(() => {
    if (!librarySearch.trim()) return libraryFields;
    const q = librarySearch.trim().toLowerCase();
    return libraryFields.filter((f) => f.label.toLowerCase().includes(q) || getTaskFieldTypeLabel(f).toLowerCase().includes(q));
  }, [libraryFields, librarySearch]);

  const libraryFieldsInBoth = useMemo(
    () => filteredLibraryFields.filter((f) => cardFieldSet.has(f.id) && detailFieldSet.has(f.id)),
    [filteredLibraryFields, cardFieldSet, detailFieldSet]
  );
  const libraryFieldsInCardOnly = useMemo(
    () => filteredLibraryFields.filter((f) => cardFieldSet.has(f.id) && !detailFieldSet.has(f.id)),
    [filteredLibraryFields, cardFieldSet, detailFieldSet]
  );
  const libraryFieldsInDetailOnly = useMemo(
    () => filteredLibraryFields.filter((f) => !cardFieldSet.has(f.id) && detailFieldSet.has(f.id)),
    [filteredLibraryFields, cardFieldSet, detailFieldSet]
  );
  const libraryFieldsUnused = useMemo(
    () => filteredLibraryFields.filter((f) => !cardFieldSet.has(f.id) && !detailFieldSet.has(f.id)),
    [filteredLibraryFields, cardFieldSet, detailFieldSet]
  );

  const hasUnsavedLayout = Boolean(
    activeType &&
      (
        (layoutDraftsByTypeSlug[activeType.slug] &&
          (!areSameOrderedIds(activeLayout.card, getEffectiveLayout(activeType.slug).card) ||
            !areSameOrderedIds(activeLayout.detail, getEffectiveLayout(activeType.slug).detail))) ||
        (detailZoneDraftsByTypeSlug[activeType.slug] &&
          JSON.stringify(detailZoneDraftsByTypeSlug[activeType.slug]) !==
            JSON.stringify(persistedDetailZonesByType[activeType.slug] ?? {})) ||
        (cardAreaDraftsByTypeSlug[activeType.slug] &&
          Object.keys(cardAreaDraftsByTypeSlug[activeType.slug]).length > 0)
      )
  );

  // ── Layout handlers ───────────────────────────────────────────────────────
  const handleUpdateLayout = useCallback(
    (typeSlug: string, next: LayoutDraft) => {
      setLayoutMessage("");
      setLayoutDraftsByTypeSlug((cur) => ({
        ...cur,
        [typeSlug]: {
          card: sanitizeFieldIds(next.card, allowedFieldIds),
          detail: sanitizeFieldIds(next.detail, allowedFieldIds)
        }
      }));
    },
    [allowedFieldIds]
  );

  const handleUpdateDetailZones = useCallback((typeSlug: string, next: Record<string, DetailZone>) => {
    setLayoutMessage("");
    setDetailZoneDraftsByTypeSlug((cur) => ({ ...cur, [typeSlug]: next }));
  }, []);

  const handleAddFieldToLayout = useCallback(
    (fieldId: string, scope: LayoutScope) => {
      if (!activeType) return;
      const next: LayoutDraft = scope === "card"
        ? { ...activeLayout, card: [...activeLayout.card.filter((id) => id !== fieldId), fieldId] }
        : { ...activeLayout, detail: [...activeLayout.detail.filter((id) => id !== fieldId), fieldId] };
      handleUpdateLayout(activeType.slug, next);
      setSelectedFieldId(fieldId);
      setActiveCanvasTab(scope);
    },
    [activeLayout, activeType, handleUpdateLayout]
  );

  const handleRemoveFromLayout = useCallback(
    (fieldId: string, scope: LayoutScope) => {
      if (!activeType) return;
      handleUpdateLayout(activeType.slug, removeFieldFromScope(activeLayout, scope, fieldId));
    },
    [activeLayout, activeType, handleUpdateLayout]
  );

  const handleSetDetailZoneForField = useCallback(
    (fieldId: string, zone: DetailZone) => {
      if (!activeType) return;
      handleUpdateDetailZones(activeType.slug, { ...activeDetailZones, [fieldId]: zone });
    },
    [activeDetailZones, activeType, handleUpdateDetailZones]
  );

  const handleSyncCardAreaDraft = useCallback(
    (typeSlug: string, fieldId: string, nextArea: TaskFieldCardArea) => {
      setLayoutMessage("");
      setCardAreaDraftsByTypeSlug((cur) => {
        const baselineArea =
          persistedCardAreasByType[typeSlug]?.[fieldId] ??
          (fieldsById[fieldId] ? resolveTaskFieldCardArea(fieldsById[fieldId]) : null);
        const currentDrafts = { ...(cur[typeSlug] ?? {}) };

        if (baselineArea && baselineArea === nextArea) {
          delete currentDrafts[fieldId];
        } else {
          currentDrafts[fieldId] = nextArea;
        }

        if (Object.keys(currentDrafts).length === 0) {
          if (!(typeSlug in cur)) {
            return cur;
          }

          const next = { ...cur };
          delete next[typeSlug];
          return next;
        }

        return {
          ...cur,
          [typeSlug]: currentDrafts
        };
      });
    },
    [fieldsById, persistedCardAreasByType]
  );

  const handleSetCardAreaForField = useCallback(
    (fieldId: string, area: TaskFieldCardArea) => {
      if (!activeType) return;
      handleSyncCardAreaDraft(activeType.slug, fieldId, area);
    },
    [activeType, handleSyncCardAreaDraft]
  );

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const updateDropTarget = useCallback((nextTarget: EditorDropTarget | null) => {
    setDropTarget((current) => (isEditorDropTargetEqual(current, nextTarget) ? current : nextTarget));
  }, []);

  const handleDragStartField = (event: DragEvent<HTMLElement>, fieldId: string, origin: "library" | "card" | "detail") => {
    setDragPayload({ kind: "field", fieldId, origin });
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", fieldId);
  };

  const beginDetailMouseDrag = useCallback((event: MouseEvent<HTMLElement>, fieldId: string) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    setSelectedFieldId(fieldId);
    setFieldDraft(null);
    setPendingFieldSetup(null);
    setTypeComposer(null);
    setDragPayload({ kind: "field", fieldId, origin: "detail" });
  }, []);

  const handleDragStartType = (event: DragEvent<HTMLElement>, type: CustomFieldType) => {
    setDragPayload({ kind: "type", type });
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", `type:${type}`);
  };

  const handleDragEnd = () => {
    setDragPayload(null);
    updateDropTarget(null);
  };

  const applyResolvedDropTarget = useCallback(
    (target: EditorDropTarget) => {
      if (!activeType || !dragPayload) return;

      if (dragPayload.kind === "type") {
        setFieldError("");
        setFieldDraft(null);
        setTypeComposer(null);
        setPendingFieldSetup({
          type: dragPayload.type,
          targetScope: target.surface === "card" ? "card" : "detail",
          targetIndex: target.surface === "card" ? activeLayout.card.length : activeLayout.detail.length,
          targetDetailZone: target.surface === "detail" ? target.zone : undefined,
          dropTarget: target,
          addToLayout: true,
          name: "",
          required: false,
          allowAiGeneration: false,
          options: [],
          checklistIcon: "checklist",
          checklistColor: "#0a86e8"
        });
        updateDropTarget(null);
        setDragPayload(null);
        return;
      }

      const nextDrop = applyFieldDrop({
        draft: activeLayout,
        payload: dragPayload,
        target,
        allowedFieldIds,
        cardAreasByFieldId: activeCardAreasByFieldId,
        detailZonesByFieldId: activeDetailZones
      });

      handleUpdateLayout(activeType.slug, nextDrop.layout);

      if (target.surface === "detail") {
        handleUpdateDetailZones(activeType.slug, nextDrop.detailZonesByFieldId);
      }

      if (target.surface === "card") {
        handleSyncCardAreaDraft(activeType.slug, dragPayload.fieldId, nextDrop.cardAreasByFieldId[dragPayload.fieldId]);
      }

      setSelectedFieldId(dragPayload.fieldId);
      updateDropTarget(null);
      setDragPayload(null);
    },
    [
      activeDetailZones,
      activeLayout,
      activeType,
      allowedFieldIds,
      dragPayload,
      handleSyncCardAreaDraft,
      handleUpdateDetailZones,
      handleUpdateLayout,
      activeCardAreasByFieldId,
      updateDropTarget
    ]
  );

  const handleDropOnTarget = useCallback(
    (event: DragEvent<HTMLElement>, target: EditorDropTarget) => {
      event.preventDefault();
      event.stopPropagation();
      applyResolvedDropTarget(target);
    },
    [applyResolvedDropTarget]
  );

  const handlePreviewSurfaceDragOver = useCallback(
    (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      if (!dragPayload) return;
      event.dataTransfer.dropEffect = dragPayload.kind === "type" ? "copy" : "move";
    },
    [dragPayload]
  );

  const handleDetailZoneDragOver = useCallback(
    (event: DragEvent<HTMLElement>, zone: DetailZone, index: number) => {
      event.preventDefault();
      if (!dragPayload) return;
      event.dataTransfer.dropEffect = dragPayload.kind === "type" ? "copy" : "move";
      if (event.target === event.currentTarget) {
        updateDropTarget({ surface: "detail", kind: "insert", zone, index });
      }
    },
    [dragPayload, updateDropTarget]
  );

  const handleDetailZoneMouseMove = useCallback(
    (event: MouseEvent<HTMLElement>, zone: DetailZone, index: number) => {
      if (!dragPayload) return;
      event.preventDefault();
      if (event.target === event.currentTarget) {
        updateDropTarget({ surface: "detail", kind: "insert", zone, index });
      }
    },
    [dragPayload, updateDropTarget]
  );

  useEffect(() => {
    if (!dragPayload || dragPayload.kind !== "field" || dragPayload.origin !== "detail") return;

    const handleMouseUp = () => {
      if (dropTarget?.surface === "detail") {
        applyResolvedDropTarget(dropTarget);
      } else {
        updateDropTarget(null);
        setDragPayload(null);
      }
    };

    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, [applyResolvedDropTarget, dragPayload, dropTarget, updateDropTarget]);

  const makeSurfaceDragLeaveHandler = useCallback(
    (surface: LayoutScope) => (event: DragEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null) && dropTarget?.surface === surface) {
        updateDropTarget(null);
      }
    },
    [dropTarget, updateDropTarget]
  );

  // ── Save/discard ──────────────────────────────────────────────────────────
  const handleSaveLayout = async () => {
    if (!activeType) return;
    setSavingLayout(true);
    setLayoutMessage("");
    try {
      const savedCardAreaDrafts = cardAreaDraftsByTypeSlug[activeType.slug] ?? {};
      const bindings = buildTaskFieldBindingsForType({
        typeId: activeType.slug,
        fieldDefinitions: allFields,
        fieldBindings: boardConfig.fieldBindings,
        cardFieldIds: activeLayout.card,
        detailFieldIds: activeLayout.detail,
        detailZonesByFieldId: activeDetailZones
      })
        .map((binding) => {
          if (binding.displayContext === "card" && savedCardAreaDrafts[binding.fieldId]) {
            binding = { ...binding, settings: { ...(binding.settings ?? {}), cardArea: savedCardAreaDrafts[binding.fieldId] } };
          }
          return binding;
        })
        .map((binding) => {
          const field = fieldsById[binding.fieldId];
          if (!field?.definitionId) return null;
          return {
            fieldDefinitionId: field.definitionId,
            displayContext: binding.displayContext,
            order: binding.order,
            section: binding.section,
            isVisible: binding.isVisible,
            isRequiredOverride: binding.isRequiredOverride,
            isReadonlyOverride: binding.isReadonlyOverride,
            settings: (binding.settings ?? null) as Record<string, unknown> | null
          };
        })
        .filter((binding): binding is NonNullable<typeof binding> => binding !== null);

      await replaceItemTypeFieldBindings(activeType.id, bindings);
      setLayoutDraftsByTypeSlug((cur) => { const n = { ...cur }; delete n[activeType.slug]; return n; });
      setDetailZoneDraftsByTypeSlug((cur) => { const n = { ...cur }; delete n[activeType.slug]; return n; });
      setCardAreaDraftsByTypeSlug((cur) => { const n = { ...cur }; delete n[activeType.slug]; return n; });
      setLayoutMessage("Layout salvo com sucesso.");
    } catch {
      setLayoutMessage("Nao foi possivel salvar agora.");
    } finally {
      setSavingLayout(false);
    }
  };

  const handleDiscardLayout = () => {
    if (!activeType) return;
    setLayoutMessage("");
    setLayoutDraftsByTypeSlug((cur) => { const n = { ...cur }; delete n[activeType.slug]; return n; });
    setDetailZoneDraftsByTypeSlug((cur) => { const n = { ...cur }; delete n[activeType.slug]; return n; });
    setCardAreaDraftsByTypeSlug((cur) => { const n = { ...cur }; delete n[activeType.slug]; return n; });
  };

  // ── Type CRUD ─────────────────────────────────────────────────────────────
  const persistFieldCapabilities = useCallback(
    async (fieldId: string, aiEnhance: boolean) => {
      if (!snapshot) return;
      await updatePreferences({
        settings: {
          ...settings,
          fieldCapabilitiesById: { ...fieldCapabilitiesById, [fieldId]: { ...(fieldCapabilitiesById[fieldId] ?? {}), aiEnhance } }
        }
      });
    },
    [fieldCapabilitiesById, settings, snapshot, updatePreferences]
  );

  const persistFieldDefinitionOverride = useCallback(
    async (fieldId: string, draft: FieldDraft) => {
      if (!snapshot) return;

      const normalizedOptions = normalizeOptionInputs(draft.options).map((option, index) => ({
        id: `override-${fieldId}-${index + 1}`,
        label: option.label,
        value: option.value
      }));
      const currentOverrides = readFieldDefinitionOverridesById(settings);

      await updatePreferences({
        settings: {
          ...settings,
          fieldDefinitionsById: {
            ...currentOverrides,
            [fieldId]: {
              ...(currentOverrides[fieldId] ?? {}),
              label: draft.name.trim(),
              name: draft.name.trim(),
              type: draft.type,
              required: draft.required,
              options: supportsSelectableOptions(draft.type as CustomFieldType) ? normalizedOptions : [],
              allowAiGeneration: supportsAiGeneration(draft.type as CustomFieldType) ? draft.allowAiGeneration : false,
              checklistDisplay:
                draft.type === "checklist"
                  ? {
                      icon: draft.checklistIcon,
                      color: draft.checklistColor,
                      label: draft.name.trim()
                    }
                  : undefined
            }
          }
        }
      });
    },
    [settings, snapshot, updatePreferences]
  );

  const handleSaveType = async () => {
    if (!typeComposer?.name.trim()) return;
    setTypeSaving(true);
    try {
      if (editingTypeId) {
        await updateItemType(editingTypeId, { name: typeComposer.name.trim(), color: typeComposer.color });
      } else {
        await createItemType({ name: typeComposer.name.trim(), color: typeComposer.color });
      }
      setTypeComposer(null);
      setEditingTypeId(null);
      await loadData();
    } finally {
      setTypeSaving(false);
    }
  };

  const handleDeleteType = async (typeId: string) => {
    setTypeDeletingId(typeId);
    try { await deleteItemType(typeId); await loadData(); }
    finally { setTypeDeletingId(null); }
  };

  // ── Field CRUD ────────────────────────────────────────────────────────────
  const handleConfirmFieldSetup = async () => {
    if (!pendingFieldSetup?.name.trim() || !activeType) return;

    const normalizedOptions = normalizeOptionInputs(pendingFieldSetup.options);
    if (supportsSelectableOptions(pendingFieldSetup.type) && normalizedOptions.length === 0) {
      setFieldError("Campos de selecao precisam de pelo menos uma opcao.");
      return;
    }

    setFieldSaving(true);
    setFieldError("");
    try {
      await createCustomField({
        name: pendingFieldSetup.name.trim(),
        type: pendingFieldSetup.type,
        required: pendingFieldSetup.required,
        settings: {
          allowAiGeneration: supportsAiGeneration(pendingFieldSetup.type) ? pendingFieldSetup.allowAiGeneration : false,
          ...(pendingFieldSetup.type === "checklist"
            ? {
                checklistDisplay: {
                  icon: pendingFieldSetup.checklistIcon,
                  color: pendingFieldSetup.checklistColor,
                  label: pendingFieldSetup.name.trim()
                }
              }
            : {})
        },
        options: supportsSelectableOptions(pendingFieldSetup.type) ? normalizedOptions : []
      });

      const [nextTypes, nextFields] = await Promise.all([fetchItemTypes(), fetchCustomFields()]);
      setItemTypes(nextTypes);
      setCustomFields(nextFields);

      const newField = [...nextFields]
        .filter((f) => f.type === pendingFieldSetup.type && f.name.trim().toLowerCase() === pendingFieldSetup.name.trim().toLowerCase())
        .sort((a, b) => (b.id > a.id ? 1 : -1))[0];

      if (newField) {
        const newFieldRuntimeId = newField.slug;
        const { addToLayout, targetScope: sc, targetIndex: idx, targetDetailZone, dropTarget } = pendingFieldSetup;

        if (addToLayout) {
          if (dropTarget) {
            const nextDrop = applyFieldDrop({
              draft: activeLayout,
              payload: { fieldId: newFieldRuntimeId, origin: "library" },
              target: dropTarget,
              allowedFieldIds: new Set([...allowedFieldIds, newFieldRuntimeId]),
              cardAreasByFieldId: activeCardAreasByFieldId,
              detailZonesByFieldId: activeDetailZones
            });

            handleUpdateLayout(activeType.slug, nextDrop.layout);

            if (dropTarget.surface === "detail") {
              handleUpdateDetailZones(activeType.slug, nextDrop.detailZonesByFieldId);
            }

            if (dropTarget.surface === "card") {
              handleSyncCardAreaDraft(activeType.slug, newFieldRuntimeId, nextDrop.cardAreasByFieldId[newFieldRuntimeId]);
            }
          } else {
            setLayoutDraftsByTypeSlug((cur) => ({
              ...cur,
              [activeType.slug]: {
                card: sc === "card" ? addFieldIdToList(activeLayout.card, newFieldRuntimeId, idx) : [...activeLayout.card],
                detail: sc === "detail" ? addFieldIdToList(activeLayout.detail, newFieldRuntimeId, idx) : [...activeLayout.detail]
              }
            }));
            if (sc === "detail") {
              handleUpdateDetailZones(activeType.slug, { ...activeDetailZones, [newFieldRuntimeId]: targetDetailZone ?? "side" });
            }
          }
        }
        setSelectedFieldId(newFieldRuntimeId);
        setActiveCanvasTab(addToLayout ? sc : "field");
      }
      setPendingFieldSetup(null);
    } finally {
      setFieldSaving(false);
    }
  };

  const handleSaveField = async () => {
    if (!fieldDraft?.name.trim()) return;
    const normalizedOptions = normalizeOptionInputs(fieldDraft.options);
    if (supportsSelectableOptions(fieldDraft.type as CustomFieldType) && normalizedOptions.length === 0) {
      setFieldError("Campos de selecao precisam de pelo menos uma opcao.");
      return;
    }
    setFieldSaving(true);
    setFieldError("");
    try {
      const selectedDefinition = fieldsById[fieldDraft.runtimeFieldId];
      const isCustomField = selectedDefinition?.hasApiDefinition === true;

      if (isCustomField) {
        await updateCustomField(fieldDraft.id, {
          name: fieldDraft.name.trim(),
          type: fieldDraft.type as CustomFieldType,
          required: fieldDraft.required,
          settings: {
            allowAiGeneration: supportsAiGeneration(fieldDraft.type as CustomFieldType) ? fieldDraft.allowAiGeneration : false,
            ...(fieldDraft.type === "checklist"
              ? {
                  checklistDisplay: {
                    icon: fieldDraft.checklistIcon,
                    color: fieldDraft.checklistColor,
                    label: fieldDraft.name.trim()
                  }
                }
              : {})
          },
          options: supportsSelectableOptions(fieldDraft.type as CustomFieldType) ? normalizedOptions : []
        });
      }

      await persistFieldCapabilities(
        fieldDraft.runtimeFieldId,
        supportsAiGeneration(fieldDraft.type as CustomFieldType) && fieldDraft.allowAiGeneration
      );
      await persistFieldDefinitionOverride(fieldDraft.runtimeFieldId, fieldDraft);
      const savedFieldId = fieldDraft.runtimeFieldId;
      setFieldDraft(null);
      setSelectedFieldId(savedFieldId);
      await loadData();
    } finally {
      setFieldSaving(false);
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    setFieldDeletingId(fieldId);
    try {
      await deleteCustomField(fieldId);
      if (fieldDraft?.id === fieldId) setFieldDraft(null);
      if (selectedFieldId === fieldId) setSelectedFieldId(null);
      await loadData();
    } finally {
      setFieldDeletingId(null);
    }
  };

  const openNewFieldPanel = (type: CustomFieldType) => {
    setFieldError("");
    setFieldDraft(null);
    setTypeComposer(null);
    setPendingFieldSetup({
      type,
      targetScope: preferredFieldTargetScope,
      targetIndex: (preferredFieldTargetScope === "card" ? activeLayout.card : activeLayout.detail).length,
      targetDetailZone: preferredFieldTargetScope === "detail" ? "side" : undefined,
      dropTarget: null,
      addToLayout: activeCanvasTab !== "field",
      name: "",
      required: false,
      allowAiGeneration: false,
      options: [],
      checklistIcon: "checklist",
      checklistColor: "#0a86e8"
    });
  };

  useEffect(() => {
    if (pendingFieldSetup || typeComposer) return;

    if (!selectedFieldId) {
      if (fieldDraft) setFieldDraft(null);
      return;
    }

    const selectedDefinition = fieldsById[selectedFieldId];
    if (!selectedDefinition) {
      if (fieldDraft?.runtimeFieldId === selectedFieldId) setFieldDraft(null);
      return;
    }

    if (fieldDraft?.runtimeFieldId !== selectedFieldId) {
      const raw = customFieldByRuntimeId[selectedFieldId];
      setFieldError("");
      setFieldDraft(raw ? buildFieldDraftFromApiField(raw, selectedFieldId) : buildFieldDraftFromDefinition(selectedDefinition));
    }
  }, [customFieldByRuntimeId, fieldDraft, fieldsById, pendingFieldSetup, selectedFieldId, typeComposer]);

  useEffect(() => {
    if (activeCanvasTab !== "field" || pendingFieldSetup || editableFields.length === 0) {
      return;
    }

    if (!selectedFieldId || fieldsById[selectedFieldId]?.isEditable === false) {
      setSelectedFieldId(editableFields[0].id);
      setFieldDraft(null);
    }
  }, [activeCanvasTab, editableFields, fieldsById, pendingFieldSetup, selectedFieldId]);


  // ── Preview computation ──────────────────────────────────────────────────
  const typeColor = activeType?.color || DEFAULT_TYPE_COLOR;
  const previewTypeId = activeType?.slug ?? boardConfig.taskTypes[0]?.id ?? "preview-type";
  const previewTypeLabel = activeType?.name ?? boardConfig.taskTypes.find((t) => t.id === previewTypeId)?.label ?? "Tipo";
  const previewTypeColor = activeType?.color ?? boardConfig.taskTypes.find((t) => t.id === previewTypeId)?.text ?? DEFAULT_TYPE_COLOR;

  const previewPerspectives = useMemo<BoardConfig["perspectives"]>(() => {
    if (Array.isArray((boardConfig as { perspectives?: unknown }).perspectives)) {
      return (boardConfig as { perspectives: BoardConfig["perspectives"] }).perspectives;
    }
    if (Array.isArray((boardConfig as { views?: unknown }).views)) {
      return (boardConfig as { views: BoardConfig["perspectives"] }).views;
    }
    return [];
  }, [boardConfig]);

  const previewBoardMode = snapshot?.preferences.defaultBoardMode ?? previewPerspectives[0]?.id ?? "dev";
  const previewPerspective = previewPerspectives.find((p) => p.id === previewBoardMode) ?? previewPerspectives[0] ?? null;

  const previewProjectedTasks = useMemo(
    () => mapTasksForBoardPerspective(snapshot?.tasks ?? [], previewPerspective),
    [previewPerspective, snapshot?.tasks]
  );

  const previewBoardColumnsPerspective = useMemo(
    () =>
      previewPerspective?.statusSource.kind === "workflow_state"
        ? buildBoardColumnsRuntimeView(previewProjectedTasks, boardColumns, workflowStates, previewPerspective?.visibleBoardColumnIds)
        : null,
    [boardColumns, previewPerspective, previewProjectedTasks, workflowStates]
  );

  const previewRuntimeStatuses = previewBoardColumnsPerspective?.statuses ?? previewPerspective?.statuses ?? boardConfig.statuses;
  const previewRuntimeTasks = previewBoardColumnsPerspective?.tasks ?? previewProjectedTasks;
  const previewSourceTask = useMemo(
    () => previewRuntimeTasks.find((task) => task.type === previewTypeId) ?? null,
    [previewRuntimeTasks, previewTypeId]
  );
  const previewStatus =
    previewRuntimeStatuses.find((s) => s.id === previewSourceTask?.status) ??
    previewRuntimeStatuses[0] ??
    { id: "preview-status", label: "Em validacao", dot: DEFAULT_TYPE_COLOR };

  const previewTaskTypes = useMemo(() => {
    const meta = {
      id: previewTypeId,
      label: previewTypeLabel,
      background: `${previewTypeColor}1a`,
      border: `${previewTypeColor}66`,
      text: previewTypeColor
    };
    if (boardConfig.taskTypes.some((t) => t.id === previewTypeId)) {
      return boardConfig.taskTypes.map((t) => (t.id === previewTypeId ? { ...t, ...meta } : t));
    }
    return [...boardConfig.taskTypes, meta];
  }, [boardConfig.taskTypes, previewTypeColor, previewTypeId, previewTypeLabel]);

  const previewFieldBindings = useMemo<TaskFieldBinding[]>(() => {
    if (!activeType) return Array.isArray(boardConfig.fieldBindings) ? boardConfig.fieldBindings : [];
    const otherTypeBindings = Array.isArray(boardConfig.fieldBindings)
      ? boardConfig.fieldBindings.filter((b) => b.typeId !== activeType.slug)
      : [];
    const rawActiveBindings = buildTaskFieldBindingsForType({
      typeId: activeType.slug,
      fieldDefinitions: allFields,
      fieldBindings: boardConfig.fieldBindings,
      cardFieldIds: activeLayout.card,
      detailFieldIds: activeLayout.detail,
      detailZonesByFieldId: activeDetailZones
    });
    const activeCardAreaDraftsSnapshot = activeCardAreaDrafts;
    const activeBindings = rawActiveBindings.map((binding) => {
      if (binding.displayContext !== "card") return binding;
      const areaOverride = activeCardAreaDraftsSnapshot[binding.fieldId];
      if (!areaOverride) return binding;
      return { ...binding, settings: { ...(binding.settings ?? {}), cardArea: areaOverride } };
    });
    return [...otherTypeBindings, ...activeBindings];
  }, [activeCardAreaDrafts, activeDetailZones, activeLayout.card, activeLayout.detail, activeType, allFields, boardConfig.fieldBindings]);

  const previewBoardConfig = useMemo<BoardConfig>(
    () => ({ ...boardConfig, taskTypes: previewTaskTypes, fieldDefinitions: allFields, fieldBindings: previewFieldBindings }),
    [allFields, boardConfig, previewFieldBindings, previewTaskTypes]
  );

  const previewTask = useMemo<Task>(
    () =>
      buildPreviewTask({
        fields: libraryFields,
        typeId: previewTypeId,
        statusId: previewStatus.id,
        sourceTask: previewSourceTask
      }),
    [libraryFields, previewSourceTask, previewStatus.id, previewTypeId]
  );

  const previewMembersById = useMemo(
    () => ({ ...(snapshot?.membersById ?? {}), [PREVIEW_CREATED_BY.id]: PREVIEW_CREATED_BY, [PREVIEW_ASSIGNEE.id]: PREVIEW_ASSIGNEE }),
    [snapshot?.membersById]
  );

  const isDragging = dragPayload !== null;
  const isDraggingType = dragPayload?.kind === "type";

  // ── Properties panel derived ──────────────────────────────────────────────
  const selectedField = selectedFieldId ? fieldsById[selectedFieldId] : null;
  const selectedInCard = selectedFieldId ? cardFieldSet.has(selectedFieldId) : false;
  const selectedInDetail = selectedFieldId ? detailFieldSet.has(selectedFieldId) : false;
  const selectedDetailZone = selectedFieldId
    ? (activeDetailZones[selectedFieldId] ?? getDefaultDetailZone(fieldsById[selectedFieldId]))
    : "side";
  const preferredFieldTargetScope: LayoutScope = activeCanvasTab === "detail" ? "detail" : "card";
  const fieldEditorPreview = useMemo<TaskFieldDefinition | null>(() => {
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
  }, [fieldDraft, selectedField]);
  const pendingFieldPreview = useMemo<TaskFieldDefinition | null>(() => {
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
  }, [pendingFieldSetup]);
  const activeFieldCanvasPreview = pendingFieldPreview ?? fieldEditorPreview;

  const activePendingTypeLabel = pendingFieldSetup
    ? (FIELD_TYPE_OPTIONS.find((o) => o.value === pendingFieldSetup.type)?.label ?? pendingFieldSetup.type)
    : null;
  const pendingFieldTargetLabel = useMemo(() => {
    if (!pendingFieldSetup) {
      return "";
    }

    const target = pendingFieldSetup.dropTarget;
    if (!target) {
      if (pendingFieldSetup.targetScope === "card") {
        return "Card do board";
      }
      return `Formulario — ${pendingFieldSetup.targetDetailZone === "main" ? "Coluna principal" : "Barra lateral"}`;
    }

    if (target.surface === "card") {
      if (target.kind === "replace-field") {
        return `Card do board — substitui ${fieldsById[target.targetFieldId]?.label ?? "campo"}`;
      }
      return `Card do board — ${CARD_SLOT_AREA_LABELS[target.area]}`;
    }

    const zoneLabel = target.zone === "main" ? "Coluna principal" : "Barra lateral";
    if (target.kind === "replace-field") {
      return `Formulario — ${zoneLabel} — substitui ${fieldsById[target.targetFieldId]?.label ?? "campo"}`;
    }

    return `Formulario — ${zoneLabel}`;
  }, [fieldsById, pendingFieldSetup]);

  // ── Card preview field props ──────────────────────────────────────────────
  const getCardPreviewFieldProps = ({
    fieldId,
    area,
    visualPriority
  }: {
    fieldId: string;
    area: TaskFieldCardArea;
    visualPriority: TaskFieldVisualPriority;
    index: number;
    slotLimit: number;
    occupiedCount: number;
  }) => {
    const isReplaceTarget =
      dropTarget?.surface === "card" &&
      dropTarget.kind === "replace-field" &&
      dropTarget.targetFieldId === fieldId;
    const isSelected = selectedFieldId === fieldId;
    const isSelfDrag = dragPayload?.kind === "field" && dragPayload.fieldId === fieldId;

    return {
      className: `wie__card-field wie__card-field--${area}${isSelected ? " is-selected" : ""}${isReplaceTarget ? " is-replace-target" : ""}`,
      "data-workitem-slot": "card",
      "data-field-id": fieldId,
      "data-visual-priority": visualPriority,
      "data-drop-intent": isReplaceTarget ? "replace" : undefined,
      "data-drop-label": isReplaceTarget ? "Mover aqui" : undefined,
      draggable: true,
      onClick: (event: MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        setSelectedFieldId(fieldId);
        setFieldDraft(null);
        setPendingFieldSetup(null);
        setTypeComposer(null);
      },
      onDragStart: (event: DragEvent<HTMLElement>) => {
        event.stopPropagation();
        setSelectedFieldId(fieldId);
        handleDragStartField(event, fieldId, "card");
      },
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (!dragPayload || isSelfDrag) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = dragPayload.kind === "type" ? "copy" : "move";
        updateDropTarget({
          surface: "card",
          kind: "replace-field",
          targetFieldId: fieldId,
          area
        });
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        if (isSelfDrag) return;
        handleDropOnTarget(event, {
          surface: "card",
          kind: "replace-field",
          targetFieldId: fieldId,
          area
        });
      },
      onDragEnd: handleDragEnd
    };
  };

  // ── Renders ───────────────────────────────────────────────────────────────

  const renderCardEmptySlot = ({
    area,
    index,
    occupiedCount,
    slotLimit
  }: {
    area: TaskCardSlotArea;
    index: number;
    occupiedCount: number;
    slotLimit: number;
    availableCount: number;
  }) => {
    const target: EditorDropTarget = {
      surface: "card",
      kind: "empty-slot",
      area,
      index
    };
    const isTarget =
      dropTarget?.surface === "card" &&
      dropTarget.kind === "empty-slot" &&
      dropTarget.area === area &&
      dropTarget.index === index;
    const SlotTag = area === "badge" || area === "summary" || area === "meta" ? "span" : "div";

      return (
        <SlotTag
          className={`wie__card-empty-slot wie__card-empty-slot--${area}${isTarget ? " is-target" : ""}`}
          data-slot-area={area}
          data-drop-intent={isTarget ? "vacancy" : undefined}
        onDragOver={(event) => {
          if (!dragPayload) return;
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = dragPayload.kind === "type" ? "copy" : "move";
          updateDropTarget(target);
          }}
          onDrop={(event) => handleDropOnTarget(event, target)}
        >
          <span className="wie__card-empty-slot-label">+ campo</span>
          <span className="wie__card-empty-slot-count">{`${occupiedCount}/${slotLimit}`}</span>
        </SlotTag>
      );
    };

  const renderLibraryChip = (field: FieldLibraryItem) => {
    const inCard = cardFieldSet.has(field.id);
    const inDetail = detailFieldSet.has(field.id);
    const isSelected = selectedFieldId === field.id;

    let usageLabel = "";
    if (inCard && inDetail) usageLabel = "card + form";
    else if (inCard) usageLabel = "card";
    else if (inDetail) usageLabel = "form";

    return (
      <div
        key={field.id}
        className={`wie__lib-chip${isSelected ? " is-selected" : ""}${inCard || inDetail ? " is-used" : ""}`}
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          handleDragStartField(e, field.id, "library");
        }}
        onDragEnd={handleDragEnd}
        onClick={() => {
          setSelectedFieldId(field.id);
          setFieldDraft(null);
          setPendingFieldSetup(null);
          setTypeComposer(null);
        }}
      >
        <div className="wie__lib-chip-info">
          <span className="wie__lib-chip-label">{field.label}</span>
          <span className="wie__lib-chip-type">{getTaskFieldTypeLabel(field)}</span>
        </div>
        {usageLabel ? <span className="wie__lib-chip-badge">{usageLabel}</span> : null}
      </div>
    );
  };

  const renderDetailInsertTarget = (zone: DetailZone, index: number) => {
    const target: EditorDropTarget = {
      surface: "detail",
      kind: "insert",
      zone,
      index
    };
    const isTarget =
      dropTarget?.surface === "detail" &&
      dropTarget.kind === "insert" &&
      dropTarget.zone === zone &&
      dropTarget.index === index;

    return (
      <div
        key={`detail-insert-${zone}-${index}`}
        className={`wie__detail-insert-target${zone === "side" ? " is-side" : ""}${isTarget ? " is-target" : ""}`}
        data-detail-zone={zone}
        data-drop-intent={isTarget ? "vacancy" : undefined}
        onDragOver={(event) => {
          if (!dragPayload) return;
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = dragPayload.kind === "type" ? "copy" : "move";
          updateDropTarget(target);
        }}
        onMouseMove={(event) => {
          if (!dragPayload) return;
          event.preventDefault();
          event.stopPropagation();
          updateDropTarget(target);
        }}
        onDrop={(event) => handleDropOnTarget(event, target)}
      >
        <span>Solte aqui</span>
      </div>
    );
  };

  const renderDetailFieldCard = (field: FieldLibraryItem, zone: DetailZone, index: number) => {
    const isSelected = selectedFieldId === field.id;
    const isSelfDrag = dragPayload?.kind === "field" && dragPayload.fieldId === field.id;
    const previewValue = resolveTaskFieldValue(previewTask, field);
    const beforeTarget: EditorDropTarget = { surface: "detail", kind: "insert", zone, index };
    const afterTarget: EditorDropTarget = { surface: "detail", kind: "insert", zone, index: index + 1 };
    const shellStyle = resolveFieldShellStyle({
      field,
      mode: "edit",
      context: "detail",
      readonly: false
    });
    const layoutClass = resolveDetailPreviewLayoutClass(field, zone);

    return (
      <div key={`detail-${zone}-${field.id}`} className={`wie__detail-slot-wrap ${layoutClass}`}>
        {isDragging ? renderDetailInsertTarget(zone, index) : null}
        <section
          className={`wie__detail-field-card wie__detail-field-card--${shellStyle.kind} ${layoutClass}${zone === "side" ? " is-side" : ""}${isSelected ? " is-selected" : ""}`}
          data-workitem-slot="detail"
          data-detail-zone={zone}
          data-field-type={field.type}
          data-field-id={field.id}
          draggable
          onClick={(e) => {
            e.stopPropagation();
            setSelectedFieldId(field.id);
            setFieldDraft(null);
            setPendingFieldSetup(null);
            setTypeComposer(null);
          }}
          onMouseDown={(e) => beginDetailMouseDrag(e, field.id)}
          onDragStart={(e) => {
            e.stopPropagation();
            handleDragStartField(e, field.id, "detail");
          }}
          onDragOver={(event) => {
            if (!dragPayload || isSelfDrag) return;
            event.preventDefault();
            event.stopPropagation();
            event.dataTransfer.dropEffect = dragPayload.kind === "type" ? "copy" : "move";
            const rect = event.currentTarget.getBoundingClientRect();
            updateDropTarget(event.clientY < rect.top + rect.height / 2 ? beforeTarget : afterTarget);
          }}
          onMouseMove={(event) => {
            if (!dragPayload || isSelfDrag) return;
            event.preventDefault();
            event.stopPropagation();
            const rect = event.currentTarget.getBoundingClientRect();
            updateDropTarget(event.clientY < rect.top + rect.height / 2 ? beforeTarget : afterTarget);
          }}
          onDrop={(event) => {
            if (isSelfDrag) return;
            const rect = event.currentTarget.getBoundingClientRect();
            handleDropOnTarget(event, event.clientY < rect.top + rect.height / 2 ? beforeTarget : afterTarget);
          }}
          onDragEnd={handleDragEnd}
        >
          <div
            className="wie__detail-field-card-dragbar"
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              handleDragStartField(e, field.id, "detail");
            }}
            onMouseDown={(e) => beginDetailMouseDrag(e, field.id)}
            onDragEnd={handleDragEnd}
          >
            <span className="wie__detail-field-card-type">{getTaskFieldTypeLabel(field)}</span>
            <span className="wie__detail-field-card-handle">Arrastar</span>
          </div>
          <FieldShell
            label={field.label}
            hint={field.description}
            required={field.required}
            kind={shellStyle.kind}
            helpMode={shellStyle.helpMode}
          >
            <div className="wie__detail-field-card-body">
              <WorkItemFieldRenderer
                field={field}
                value={previewValue}
                mode="edit"
                context="detail"
                boardConfig={previewBoardConfig}
                statuses={previewRuntimeStatuses}
                membersById={previewMembersById}
                task={previewTask}
                disabled
                onChange={() => undefined}
              />
            </div>
          </FieldShell>
          <div
            className="wie__detail-field-card-drag-surface"
            aria-label={`Mover campo ${field.label}`}
            draggable
            onClick={(e) => {
              e.stopPropagation();
              setSelectedFieldId(field.id);
              setFieldDraft(null);
              setPendingFieldSetup(null);
              setTypeComposer(null);
            }}
            onDragStart={(e) => {
              e.stopPropagation();
              handleDragStartField(e, field.id, "detail");
            }}
            onMouseDown={(e) => beginDetailMouseDrag(e, field.id)}
            onDragEnd={handleDragEnd}
          />
        </section>
      </div>
    );
  };

  // ── Slot panel ────────────────────────────────────────────────────────────


  // ── Properties panel content ──────────────────────────────────────────────

  const renderFieldDefinitionEditor = (draft: FieldDraft, options?: { showHeader?: boolean; showDelete?: boolean }) => {
    const showHeader = options?.showHeader ?? false;
    const showDelete = options?.showDelete ?? true;

    return (
      <>
        {showHeader ? (
          <div className="wie__props-head">
            <div className="wie__props-head-main">
              <span className="wie__props-eyebrow">Campo</span>
              <h3 className="wie__props-title">Editar definicao</h3>
            </div>
            <div className="wie__props-head-actions">
              <button
                type="button"
                className="wie__props-icon-btn"
                title={fieldSaving ? "Salvando..." : "Salvar campo"}
                aria-label={fieldSaving ? "Salvando campo" : "Salvar campo"}
                onClick={() => void handleSaveField()}
                disabled={fieldSaving || !draft.name.trim()}
              >
                {fieldSaving ? "..." : "✓"}
              </button>
              {showDelete ? (
                <button
                  type="button"
                  className="wie__props-icon-btn is-danger"
                  title={fieldDeletingId === draft.id ? "Removendo..." : "Excluir campo"}
                  aria-label={fieldDeletingId === draft.id ? "Removendo campo" : "Excluir campo"}
                  onClick={() => void handleDeleteField(draft.id)}
                  disabled={fieldDeletingId === draft.id}
                >
                  {fieldDeletingId === draft.id ? "..." : "🗑"}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className={showHeader ? "wie__props-scroll" : "wie__props-definition-editor"}>
          {!showHeader ? (
            <>
              <span className="wie__props-section-label">Definicao do campo</span>
              <p className="wie__props-section-hint">
                Alteracoes aqui afetam todos os tipos que utilizam este campo.
              </p>
            </>
          ) : null}
          <FormField label="Label do campo">
            <TextInput value={draft.name} placeholder="Ex: Impacto esperado"
              onChange={(e) => setFieldDraft({ ...draft, name: e.target.value })} />
          </FormField>
          <div className="wie__props-field-types">
            {FIELD_TYPE_OPTIONS.map((opt) => (
              <button key={opt.value} type="button"
                className={`wie__props-type-btn${draft.type === opt.value ? " is-active" : ""}`}
                onClick={() => setFieldDraft({ ...draft, type: opt.value, allowAiGeneration: supportsAiGeneration(opt.value) ? draft.allowAiGeneration : false })}>
                {opt.label}
              </button>
            ))}
          </div>
          <div className="wie__props-toggles">
            <label>
              <input type="checkbox" checked={draft.required}
                onChange={(e) => setFieldDraft({ ...draft, required: e.target.checked })} />
              Obrigatorio
            </label>
            <label>
              <input type="checkbox" checked={draft.allowAiGeneration}
                disabled={!supportsAiGeneration(draft.type)}
                onChange={(e) => setFieldDraft({ ...draft, allowAiGeneration: e.target.checked })} />
              IA no campo
            </label>
          </div>
          {draft.type === "checklist" ? (
            <div className="wie__props-checklist-display">
              <FormField label="Icone do display">
                <TextInput
                  value={draft.checklistIcon}
                  placeholder="checklist, bug, user..."
                  onChange={(e) => setFieldDraft({ ...draft, checklistIcon: e.target.value })}
                />
              </FormField>
              <FormField label="Cor do display">
                <div className="wie__props-color-row">
                  <input
                    type="color"
                    value={draft.checklistColor}
                    onChange={(e) => setFieldDraft({ ...draft, checklistColor: e.target.value })}
                  />
                  <TextInput
                    value={draft.checklistColor}
                    onChange={(e) => setFieldDraft({ ...draft, checklistColor: e.target.value })}
                  />
                </div>
              </FormField>
            </div>
          ) : null}
          {supportsSelectableOptions(draft.type) ? (
            <div className="wie__props-options">
              <div className="wie__props-options-head">
                <strong>Opcoes</strong>
                <button type="button" onClick={() =>
                  setFieldDraft({ ...draft, options: [...draft.options, createEmptyOptionDraft(draft.options.length + 1)] })
                }>+ Adicionar</button>
              </div>
              {draft.options.map((opt) => (
                <div key={opt.id} className="wie__props-option-row">
                  <TextInput value={opt.label} placeholder="Label"
                    onChange={(e) => setFieldDraft({ ...draft, options: draft.options.map((o) => o.id === opt.id ? { ...o, label: e.target.value } : o) })} />
                  <button type="button" className="wie__props-option-remove"
                    onClick={() => setFieldDraft({ ...draft, options: draft.options.filter((o) => o.id !== opt.id) })}>x</button>
                </div>
              ))}
            </div>
          ) : null}
          {fieldError ? <p className="wie__props-error">{fieldError}</p> : null}
          {showHeader ? (
            <div className="wie__props-actions">
              <Button type="button" size="sm" variant="outline" onClick={() => { setFieldDraft(null); setFieldError(""); setSelectedFieldId(draft.runtimeFieldId); }}>
                Cancelar
              </Button>
            </div>
          ) : null}
        </div>
      </>
    );
  };

  const renderPropertiesPanel = () => {
    // 1. Creating new field
    if (pendingFieldSetup) {
      return (
        <div className="wie__props-panel">
          <div className="wie__props-head">
            <span className="wie__props-eyebrow">Novo campo â€” {activePendingTypeLabel}</span>
            <h3 className="wie__props-title">Configurar campo</h3>
          </div>
          <div className="wie__props-scroll">
            <FormField label="Label do campo">
              <TextInput
                value={pendingFieldSetup.name}
                placeholder="Ex: Titulo, Impacto, Prazo..."
                autoFocus
                onChange={(e) => setPendingFieldSetup({ ...pendingFieldSetup, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !supportsSelectableOptions(pendingFieldSetup.type)) void handleConfirmFieldSetup();
                  if (e.key === "Escape") setPendingFieldSetup(null);
                }}
              />
            </FormField>
            {pendingFieldSetup.addToLayout ? (
              <div className="wie__props-target-info">
                <span>Posicao:</span>
                <strong>{pendingFieldTargetLabel}</strong>
              </div>
            ) : null}
            <div className="wie__props-field-types">
              {FIELD_TYPE_OPTIONS.map((opt) => (
                <button key={opt.value} type="button"
                  className={`wie__props-type-btn${pendingFieldSetup.type === opt.value ? " is-active" : ""}`}
                  onClick={() => setPendingFieldSetup({
                    ...pendingFieldSetup,
                    type: opt.value,
                    allowAiGeneration: supportsAiGeneration(opt.value) ? pendingFieldSetup.allowAiGeneration : false,
                    options: supportsSelectableOptions(opt.value) ? pendingFieldSetup.options : []
                  })}>
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="wie__props-toggles">
              <label>
                <input type="checkbox" checked={pendingFieldSetup.required}
                  onChange={(e) => setPendingFieldSetup({ ...pendingFieldSetup, required: e.target.checked })} />
                Obrigatorio
              </label>
              <label>
                <input type="checkbox" checked={pendingFieldSetup.allowAiGeneration}
                  disabled={!supportsAiGeneration(pendingFieldSetup.type)}
                  onChange={(e) => setPendingFieldSetup({ ...pendingFieldSetup, allowAiGeneration: e.target.checked })} />
                IA no campo
              </label>
            </div>
            {pendingFieldSetup.type === "checklist" ? (
              <div className="wie__props-checklist-display">
                <FormField label="Icone do display">
                  <TextInput
                    value={pendingFieldSetup.checklistIcon}
                    placeholder="checklist, bug, user..."
                    onChange={(e) => setPendingFieldSetup({ ...pendingFieldSetup, checklistIcon: e.target.value })}
                  />
                </FormField>
                <FormField label="Cor do display">
                  <div className="wie__props-color-row">
                    <input
                      type="color"
                      value={pendingFieldSetup.checklistColor}
                      onChange={(e) => setPendingFieldSetup({ ...pendingFieldSetup, checklistColor: e.target.value })}
                    />
                    <TextInput
                      value={pendingFieldSetup.checklistColor}
                      onChange={(e) => setPendingFieldSetup({ ...pendingFieldSetup, checklistColor: e.target.value })}
                    />
                  </div>
                </FormField>
              </div>
            ) : null}
            {supportsSelectableOptions(pendingFieldSetup.type) ? (
              <div className="wie__props-options">
                <div className="wie__props-options-head">
                  <strong>Opcoes</strong>
                  <button type="button" onClick={() =>
                    setPendingFieldSetup({ ...pendingFieldSetup, options: [...pendingFieldSetup.options, createEmptyOptionDraft(pendingFieldSetup.options.length + 1)] })
                  }>+ Adicionar</button>
                </div>
                {pendingFieldSetup.options.map((opt) => (
                  <div key={opt.id} className="wie__props-option-row">
                    <TextInput value={opt.label} placeholder="Label"
                      onChange={(e) => setPendingFieldSetup({ ...pendingFieldSetup, options: pendingFieldSetup.options.map((o) => o.id === opt.id ? { ...o, label: e.target.value } : o) })} />
                    <button type="button" className="wie__props-option-remove"
                      onClick={() => setPendingFieldSetup({ ...pendingFieldSetup, options: pendingFieldSetup.options.filter((o) => o.id !== opt.id) })}>x</button>
                  </div>
                ))}
              </div>
            ) : null}
            {fieldError ? <p className="wie__props-error">{fieldError}</p> : null}
            <div className="wie__props-actions">
              <Button type="button" size="sm" onClick={() => void handleConfirmFieldSetup()} disabled={fieldSaving || !pendingFieldSetup.name.trim()}>
                {fieldSaving ? "Criando..." : pendingFieldSetup.addToLayout ? "Criar e adicionar" : "Criar campo"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => { setPendingFieldSetup(null); setFieldError(""); }}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      );

      /* return (
        <div className="wie__props-panel">
          <div className="wie__props-head">
            <span className="wie__props-eyebrow">Novo campo — {activePendingTypeLabel}</span>
            <h3 className="wie__props-title">Configurar campo</h3>
          </div>
          <div className="wie__props-scroll">
            <FormField label="Label do campo">
              <TextInput
                value={pendingFieldSetup.name}
                placeholder="Ex: Titulo, Impacto, Prazo..."
                autoFocus
                onChange={(e) => setPendingFieldSetup({ ...pendingFieldSetup, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !supportsSelectableOptions(pendingFieldSetup.type)) void handleConfirmFieldSetup();
                  if (e.key === "Escape") setPendingFieldSetup(null);
                }}
              />
            </FormField>
            <div className="wie__props-target-info">
              <span>Posicao:</span>
              <strong>{pendingFieldTargetLabel}</strong>
            </div>
            <div className="wie__props-toggles">
              <label>
                <input type="checkbox" checked={pendingFieldSetup.required}
                  onChange={(e) => setPendingFieldSetup({ ...pendingFieldSetup, required: e.target.checked })} />
                Obrigatorio
              </label>
              <label>
                <input type="checkbox" checked={pendingFieldSetup.allowAiGeneration}
                  disabled={!supportsAiGeneration(pendingFieldSetup.type)}
                  onChange={(e) => setPendingFieldSetup({ ...pendingFieldSetup, allowAiGeneration: e.target.checked })} />
                IA no campo
              </label>
            </div>
            {supportsSelectableOptions(pendingFieldSetup.type) ? (
              <div className="wie__props-options">
                <div className="wie__props-options-head">
                  <strong>Opcoes</strong>
                  <button type="button" onClick={() =>
                    setPendingFieldSetup({ ...pendingFieldSetup, options: [...pendingFieldSetup.options, createEmptyOptionDraft(pendingFieldSetup.options.length + 1)] })
                  }>+ Adicionar</button>
                </div>
                {pendingFieldSetup.options.map((opt) => (
                  <div key={opt.id} className="wie__props-option-row">
                    <TextInput value={opt.label} placeholder="Label"
                      onChange={(e) => setPendingFieldSetup({ ...pendingFieldSetup, options: pendingFieldSetup.options.map((o) => o.id === opt.id ? { ...o, label: e.target.value } : o) })} />
                    <button type="button" className="wie__props-option-remove"
                      onClick={() => setPendingFieldSetup({ ...pendingFieldSetup, options: pendingFieldSetup.options.filter((o) => o.id !== opt.id) })}>×</button>
                  </div>
                ))}
              </div>
            ) : null}
            {fieldError ? <p className="wie__props-error">{fieldError}</p> : null}
            <div className="wie__props-actions">
              <Button type="button" size="sm" onClick={() => void handleConfirmFieldSetup()} disabled={fieldSaving || !pendingFieldSetup.name.trim()}>
                {fieldSaving ? "Criando..." : "Criar e adicionar"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => { setPendingFieldSetup(null); setFieldError(""); }}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      ); */
    }

    // 2. Editing existing field definition
    if (fieldDraft && (!selectedFieldId || fieldDraft.runtimeFieldId !== selectedFieldId)) {
      return (
        <div className="wie__props-panel">
          {renderFieldDefinitionEditor(fieldDraft, { showHeader: true })}
        </div>
      );

      /* return (
        <div className="wie__props-panel">
          <div className="wie__props-head">
            <span className="wie__props-eyebrow">Campo</span>
            <h3 className="wie__props-title">Editar definicao</h3>
          </div>
          <div className="wie__props-scroll">
            <FormField label="Label do campo">
              <TextInput value={fieldDraft.name} placeholder="Ex: Impacto esperado"
                onChange={(e) => setFieldDraft({ ...fieldDraft, name: e.target.value })} />
            </FormField>
            <div className="wie__props-field-types">
              {FIELD_TYPE_OPTIONS.map((opt) => (
                <button key={opt.value} type="button"
                  className={`wie__props-type-btn${fieldDraft.type === opt.value ? " is-active" : ""}`}
                  onClick={() => setFieldDraft({ ...fieldDraft, type: opt.value, allowAiGeneration: supportsAiGeneration(opt.value) ? fieldDraft.allowAiGeneration : false })}>
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="wie__props-toggles">
              <label>
                <input type="checkbox" checked={fieldDraft.required}
                  onChange={(e) => setFieldDraft({ ...fieldDraft, required: e.target.checked })} />
                Obrigatorio
              </label>
              <label>
                <input type="checkbox" checked={fieldDraft.allowAiGeneration}
                  disabled={!supportsAiGeneration(fieldDraft.type)}
                  onChange={(e) => setFieldDraft({ ...fieldDraft, allowAiGeneration: e.target.checked })} />
                IA no campo
              </label>
            </div>
            {supportsSelectableOptions(fieldDraft.type) ? (
              <div className="wie__props-options">
                <div className="wie__props-options-head">
                  <strong>Opcoes</strong>
                  <button type="button" onClick={() =>
                    setFieldDraft({ ...fieldDraft, options: [...fieldDraft.options, createEmptyOptionDraft(fieldDraft.options.length + 1)] })
                  }>+ Adicionar</button>
                </div>
                {fieldDraft.options.map((opt) => (
                  <div key={opt.id} className="wie__props-option-row">
                    <TextInput value={opt.label} placeholder="Label"
                      onChange={(e) => setFieldDraft({ ...fieldDraft, options: fieldDraft.options.map((o) => o.id === opt.id ? { ...o, label: e.target.value } : o) })} />
                    <button type="button" className="wie__props-option-remove"
                      onClick={() => setFieldDraft({ ...fieldDraft, options: fieldDraft.options.filter((o) => o.id !== opt.id) })}>×</button>
                  </div>
                ))}
              </div>
            ) : null}
            {fieldError ? <p className="wie__props-error">{fieldError}</p> : null}
            <div className="wie__props-actions">
              <Button type="button" size="sm" onClick={() => void handleSaveField()} disabled={fieldSaving || !fieldDraft.name.trim()}>
                {fieldSaving ? "Salvando..." : "Salvar campo"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => { setFieldDraft(null); setFieldError(""); setSelectedFieldId(fieldDraft.runtimeFieldId); }}>
                Cancelar
              </Button>
            </div>
            <div className="wie__props-danger-zone">
              <Button type="button" size="sm" variant="outline"
                onClick={() => void handleDeleteField(fieldDraft.id)}
                disabled={fieldDeletingId === fieldDraft.id}>
                {fieldDeletingId === fieldDraft.id ? "Removendo..." : "Excluir campo permanentemente"}
              </Button>
            </div>
          </div>
        </div>
      ); */
    }

    // 3. Creating/editing item type
    if (typeComposer) {
      return (
        <div className="wie__props-panel">
          <div className="wie__props-head">
            <span className="wie__props-eyebrow">Tipo de item</span>
            <h3 className="wie__props-title">{editingTypeId ? "Editar tipo" : "Novo tipo"}</h3>
          </div>
          <div className="wie__props-scroll">
            <FormField label="Nome do tipo">
              <TextInput
                value={typeComposer.name}
                placeholder="Ex: Growth, Operacao, Bug..."
                autoFocus
                onChange={(e) => setTypeComposer({ ...typeComposer, name: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") void handleSaveType(); if (e.key === "Escape") { setTypeComposer(null); setEditingTypeId(null); } }}
              />
            </FormField>
            <FormField label="Cor">
              <div className="wie__props-color-row">
                <input type="color" value={typeComposer.color}
                  onChange={(e) => setTypeComposer({ ...typeComposer, color: e.target.value })} />
                <TextInput value={typeComposer.color}
                  onChange={(e) => setTypeComposer({ ...typeComposer, color: e.target.value })} />
              </div>
            </FormField>
            <div className="wie__props-actions">
              <Button type="button" size="sm" onClick={() => void handleSaveType()} disabled={typeSaving || !typeComposer.name.trim()}>
                {typeSaving ? "Salvando..." : "Salvar tipo"}
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => { setTypeComposer(null); setEditingTypeId(null); }}>
                Cancelar
              </Button>
            </div>
            {editingTypeId ? (
              <div className="wie__props-danger-zone">
                <Button type="button" size="sm" variant="outline"
                  onClick={() => void handleDeleteType(editingTypeId)}
                  disabled={typeDeletingId === editingTypeId}>
                  {typeDeletingId === editingTypeId ? "Removendo..." : "Excluir tipo"}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      );
    }

    // 4. Field selected — show binding properties
    if (selectedField) {
      const showFieldProps = activeCanvasTab === "field";

      return (
        <div className="wie__props-panel">
          <div className="wie__props-head">
            <div className="wie__props-head-main">
              <span className="wie__props-eyebrow">Campo</span>
              <h3 className="wie__props-title">{selectedField.label}</h3>
              <span className="wie__props-type-badge">{getTaskFieldTypeLabel(selectedField)}</span>
            </div>
            {showFieldProps && fieldDraft ? (
              <div className="wie__props-head-actions">
                <button
                  type="button"
                  className="wie__props-icon-btn"
                  title={fieldSaving ? "Salvando..." : "Salvar campo"}
                  aria-label={fieldSaving ? "Salvando campo" : "Salvar campo"}
                  onClick={() => void handleSaveField()}
                  disabled={fieldSaving || !fieldDraft.name.trim()}
                >
                  {fieldSaving ? "..." : "✓"}
                </button>
                {selectedField.hasApiDefinition ? (
                  <button
                    type="button"
                    className="wie__props-icon-btn is-danger"
                    title={fieldDeletingId === fieldDraft.id ? "Removendo..." : "Excluir campo"}
                    aria-label={fieldDeletingId === fieldDraft.id ? "Removendo campo" : "Excluir campo"}
                    onClick={() => void handleDeleteField(fieldDraft.id)}
                    disabled={fieldDeletingId === fieldDraft.id}
                  >
                    {fieldDeletingId === fieldDraft.id ? "..." : "🗑"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="wie__props-scroll">
            {!showFieldProps ? (
              <>
                <div className="wie__props-usage-section">
                  <div className="wie__props-usage-label">
                    <span>Card do board</span>
                    {selectedInCard ? <span className="wie__props-badge is-active">incluido</span> : <span className="wie__props-badge">fora</span>}
                  </div>
                  {selectedInCard ? (
                    <div className="wie__props-usage-actions">
                      <p className="wie__props-usage-hint">
                        Posicao {activeLayout.card.indexOf(selectedFieldId!) + 1} de {activeLayout.card.length}.
                        Arraste no canvas para reordenar.
                      </p>
                      <div className="wie__props-area-selector">
                        <span className="wie__props-area-label">Slot no card:</span>
                        <div className="wie__props-area-btns">
                          {CARD_SLOT_AREA_META.map(({ area, label }) => {
                            const currentArea =
                              (activeCardAreaDrafts[selectedField.id] as TaskFieldCardArea | undefined) ??
                              (previewCardDebug?.fields.find((f) => f.fieldId === selectedField.id)?.area as TaskFieldCardArea | undefined);
                            const isActive = currentArea === area;
                            return (
                              <button
                                key={area}
                                type="button"
                                className={`wie__props-area-btn${isActive ? " is-active" : ""}`}
                                title={label}
                                onClick={() => handleSetCardAreaForField(selectedField.id, area)}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <Button type="button" size="sm" variant="outline"
                        onClick={() => handleRemoveFromLayout(selectedField.id, "card")}>
                        Remover do card
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" size="sm" variant="outline"
                      onClick={() => handleAddFieldToLayout(selectedField.id, "card")}>
                      + Adicionar ao card
                    </Button>
                  )}
                </div>

                <div className="wie__props-divider" />

                <div className="wie__props-usage-section">
                  <div className="wie__props-usage-label">
                    <span>Formulario expandido</span>
                    {selectedInDetail ? <span className="wie__props-badge is-active">incluido</span> : <span className="wie__props-badge">fora</span>}
                  </div>
                  {selectedInDetail ? (
                    <div className="wie__props-usage-actions">
                      <div className="wie__props-zone-row">
                        <span>Zona:</span>
                        <div className="wie__props-zone-switcher">
                          <button type="button"
                            className={`wie__props-zone-btn${selectedDetailZone === "main" ? " is-active" : ""}`}
                            onClick={() => handleSetDetailZoneForField(selectedField.id, "main")}>
                            Principal
                          </button>
                          <button type="button"
                            className={`wie__props-zone-btn${selectedDetailZone !== "main" ? " is-active" : ""}`}
                            onClick={() => handleSetDetailZoneForField(selectedField.id, "side")}>
                            Lateral
                          </button>
                        </div>
                      </div>
                      <p className="wie__props-usage-hint">
                        Posicao {activeLayout.detail.indexOf(selectedFieldId!) + 1} de {activeLayout.detail.length} campos no formulario.
                        Arraste no canvas para reordenar.
                      </p>
                      <Button type="button" size="sm" variant="outline"
                        onClick={() => handleRemoveFromLayout(selectedField.id, "detail")}>
                        Remover do formulario
                      </Button>
                    </div>
                  ) : (
                    <div className="wie__props-usage-actions">
                      <p className="wie__props-usage-hint">Escolha a zona onde o campo deve aparecer:</p>
                      <div className="wie__props-add-zone-btns">
                        <Button type="button" size="sm" variant="outline"
                          onClick={() => {
                            handleAddFieldToLayout(selectedField.id, "detail");
                            handleSetDetailZoneForField(selectedField.id, "main");
                          }}>
                          + Coluna principal
                        </Button>
                        <Button type="button" size="sm" variant="outline"
                          onClick={() => handleAddFieldToLayout(selectedField.id, "detail")}>
                          + Barra lateral
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                {fieldDraft ? renderFieldDefinitionEditor(fieldDraft, { showDelete: selectedField.hasApiDefinition }) : null}
              </>
            )}
          </div>
        </div>
      );
    }

    // 5. Idle
    return (
      <div className="wie__props-panel is-idle">
        <div className="wie__props-idle">
          <div className="wie__props-idle-icon">⠿</div>
          <strong>Nenhum campo selecionado</strong>
          <p>
            Clique em qualquer campo no canvas ou na biblioteca para ver e editar suas propriedades e posicao no layout.
          </p>
          <div className="wie__props-idle-tips">
            <div className="wie__props-idle-tip">
              <span>Biblioteca</span>
              <p>Clique em um campo para selecionar. Arraste para posicionar no canvas.</p>
            </div>
            <div className="wie__props-idle-tip">
              <span>Canvas</span>
              <p>Clique em um campo para ver suas propriedades. Arraste para reordenar.</p>
            </div>
            <div className="wie__props-idle-tip">
              <span>Novo campo</span>
              <p>Clique ou arraste um tipo da secao "Novo campo" na biblioteca.</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="wie">
      {/* ── Topbar ─────────────────────────────────────────────────────────── */}
      <div className="wie__topbar">
        <div className="wie__tabs">
          {activeItemTypes.map((type) => (
            <div key={type.id} className={`wie__tab${activeType?.slug === type.slug ? " is-active" : ""}`}>
              <button type="button" className="wie__tab-btn" onClick={() => setActiveTypeSlug(type.slug)}>
                <i className="wie__tab-dot" style={{ background: type.color || DEFAULT_TYPE_COLOR }} />
                {type.name}
              </button>
              <button
                type="button"
                className="wie__tab-edit"
                title={`Editar tipo ${type.name}`}
                onClick={() => {
                  setEditingTypeId(type.id);
                  setTypeComposer({ name: type.name, color: type.color || DEFAULT_TYPE_COLOR });
                  setFieldDraft(null);
                  setPendingFieldSetup(null);
                  setSelectedFieldId(null);
                }}
              >
                ✎
              </button>
            </div>
          ))}
          <button
            type="button"
            className="wie__add-tab"
            onClick={() => {
              setEditingTypeId(null);
              setTypeComposer({ name: "", color: DEFAULT_TYPE_COLOR });
              setFieldDraft(null);
              setPendingFieldSetup(null);
              setSelectedFieldId(null);
            }}
          >
            + Novo tipo
          </button>
        </div>

        <div className="wie__topbar-right">
          {hasUnsavedLayout ? <span className="wie__unsaved-indicator">Alteracoes nao salvas</span> : null}
          <div className="wie__summary">
            <span><strong>{cardFields.length}</strong> no card</span>
            <span><strong>{detailFields.length}</strong> no form</span>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={handleDiscardLayout} disabled={!hasUnsavedLayout || savingLayout}>
            Descartar
          </Button>
          <Button type="button" size="sm" onClick={() => void handleSaveLayout()} disabled={!hasUnsavedLayout || savingLayout}>
            {savingLayout ? "Salvando..." : "Salvar layout"}
          </Button>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="wie__body">
        {loading ? (
          <div className="wie__loading">
            <div className="wie__skeleton" style={{ flex: "0 0 240px" }} />
            <div className="wie__skeleton" style={{ flex: 1 }} />
            <div className="wie__skeleton" style={{ flex: "0 0 280px" }} />
          </div>
        ) : (
          <>
            {/* ── Library ────────────────────────────────────────────────────── */}
            <aside className="wie__library">
              <div className="wie__lib-head">
                <div className="wie__lib-title-row">
                  <span className="wie__lib-eyebrow">Biblioteca</span>
                  <strong className="wie__lib-title">Campos</strong>
                </div>
                <input
                  className="wie__lib-search"
                  type="search"
                  placeholder="Buscar campo..."
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                />
              </div>

              <div className="wie__lib-scroll">
                {/* In card only */}
                {libraryFieldsInCardOnly.length > 0 && (
                  <div className="wie__lib-group">
                    <p className="wie__lib-group-title is-card">No card</p>
                    {libraryFieldsInCardOnly.map(renderLibraryChip)}
                  </div>
                )}
                {/* In both */}
                {libraryFieldsInBoth.length > 0 && (
                  <div className="wie__lib-group">
                    <p className="wie__lib-group-title is-both">Card + formulario</p>
                    {libraryFieldsInBoth.map(renderLibraryChip)}
                  </div>
                )}
                {/* In detail only */}
                {libraryFieldsInDetailOnly.length > 0 && (
                  <div className="wie__lib-group">
                    <p className="wie__lib-group-title is-detail">No formulario</p>
                    {libraryFieldsInDetailOnly.map(renderLibraryChip)}
                  </div>
                )}
                {/* Unused */}
                <div className="wie__lib-group">
                  <p className="wie__lib-group-title">Disponiveis</p>
                  {libraryFieldsUnused.length === 0 ? (
                    <p className="wie__lib-empty">Todos os campos estao no layout.</p>
                  ) : (
                    libraryFieldsUnused.map(renderLibraryChip)
                  )}
                </div>

                {activeCanvasTab === "field" ? (
                  <div className="wie__lib-group wie__lib-group--new">
                    <p className="wie__lib-group-title">Novo campo</p>
                    <p className="wie__lib-hint">Clique para criar um novo campo.</p>
                    <div className="wie__type-tiles">
                      {FIELD_TYPE_OPTIONS.map((opt) => (
                        <div
                          key={opt.value}
                          className="wie__type-tile"
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            handleDragStartType(e, opt.value);
                          }}
                          onDragEnd={handleDragEnd}
                          onClick={() => openNewFieldPanel(opt.value)}
                        >
                          <strong>{opt.label}</strong>
                          <span>{opt.caption}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </aside>

            {/* ── Canvas ───────────────────────────────────────────────────────── */}
            <div className="wie__canvas">
              <div className="wie__canvas-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeCanvasTab === "card"}
                  className={`wie__canvas-tab${activeCanvasTab === "card" ? " is-active" : ""}`}
                  onClick={() => setActiveCanvasTab("card")}
                >
                  Card do board
                  {cardFields.length > 0 ? <span className="wie__canvas-tab-count">{cardFields.length}</span> : null}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeCanvasTab === "detail"}
                  className={`wie__canvas-tab${activeCanvasTab === "detail" ? " is-active" : ""}`}
                  onClick={() => setActiveCanvasTab("detail")}
                >
                  Formulario expandido
                  {detailFields.length > 0 ? <span className="wie__canvas-tab-count">{detailFields.length}</span> : null}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeCanvasTab === "field"}
                  className={`wie__canvas-tab${activeCanvasTab === "field" ? " is-active" : ""}`}
                  onClick={() => setActiveCanvasTab("field")}
                >
                  Campos
                  {selectedFieldId ? <span className="wie__canvas-tab-count">1</span> : null}
                </button>
              </div>

              {/* Card canvas */}
              <section className={`wie__canvas-panel wie__canvas-panel--card${activeCanvasTab === "card" ? "" : " is-hidden"}`}>
                <div
                  className={`wie__card-stage${isDragging ? " is-drop-ready" : ""}${isDraggingType ? " is-type-target" : ""}`}
                  onDragOver={handlePreviewSurfaceDragOver}
                  onDragLeave={makeSurfaceDragLeaveHandler("card")}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dropTarget?.surface === "card") {
                      applyResolvedDropTarget(dropTarget);
                    }
                  }}
                  onClick={() => setSelectedFieldId(null)}
                >
                  <TaskCard
                    task={previewTask}
                    boardConfig={previewBoardConfig}
                    ignoreSlotLimits
                    contextualDisplay={{
                      suppressCreatedByWhenAssigneeVisible: true
                    }}
                    membersById={previewMembersById}
                    displayStatuses={previewRuntimeStatuses}
                    draggable={false}
                    getFieldSlotProps={getCardPreviewFieldProps}
                    renderEmptySlot={renderCardEmptySlot}
                    onDebugSnapshot={setPreviewCardDebug}
                    onDragStart={(e) => {
                      if (e.target === e.currentTarget) {
                        e.preventDefault();
                      }
                    }}
                    onDragEnd={handleDragEnd}
                  />
                  <div className={`wie__stage-hint${isDragging ? " is-visible" : ""}`}>
                    {isDraggingType
                      ? "Solte em uma vaga para criar ou em um campo para substituir."
                      : "Passe sobre uma vaga para inserir ou sobre um campo para substituir."}
                  </div>
                </div>
              </section>

              {/* Form canvas */}
              <section className={`wie__canvas-panel${activeCanvasTab === "detail" ? "" : " is-hidden"}`}>
                <div className="wie__form-stage">
                  {/* Main column */}
                  <div className="wie__form-column">
                    <div className="wie__form-hero">
                      <div className="wie__form-hero-accent" style={{ background: typeColor }} />
                      <div className="wie__form-hero-copy">
                        <span>{activeType?.name ?? "Tipo"}</span>
                        <h3>{PREVIEW_CARD_TITLE}</h3>
                        <p>{PREVIEW_CARD_DESCRIPTION}</p>
                      </div>
                    </div>
                    <div
                      className={`wie__form-zone${isDragging ? " is-drop-ready" : ""}${isDraggingType ? " is-type-target" : ""}`}
                      onDragOver={(event) => handleDetailZoneDragOver(event, "main", detailMainFields.length)}
                      onMouseMove={(event) => handleDetailZoneMouseMove(event, "main", detailMainFields.length)}
                      onDragLeave={makeSurfaceDragLeaveHandler("detail")}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (dropTarget?.surface === "detail" && dropTarget.zone === "main") {
                          applyResolvedDropTarget(dropTarget);
                        }
                      }}
                    >
                      <div className="wie__form-zone-head">
                        <span>Coluna principal</span>
                        <strong>{detailMainFields.length} campo{detailMainFields.length !== 1 ? "s" : ""}</strong>
                      </div>
                      {detailMainFields.length === 0 ? (
                        isDragging ? renderDetailInsertTarget("main", 0) : <p className="wie__form-zone-empty">Arraste campos para a coluna principal.</p>
                      ) : (
                        <>
                          {detailMainFields.map((field, index) => renderDetailFieldCard(field, "main", index))}
                          {isDragging ? renderDetailInsertTarget("main", detailMainFields.length) : null}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Sidebar */}
                  <aside className="wie__form-sidebar">
                    <div className="wie__form-summary-panel">
                      <span className="wie__form-eyebrow">Resumo</span>
                      <div className="wie__form-summary-chips">
                        <span>{activeType?.name ?? "Tipo"}</span>
                        <span>{previewStatus.label}</span>
                        <span>{detailFields.length} campos</span>
                      </div>
                    </div>
                    <div
                      className={`wie__form-zone is-side${isDragging ? " is-drop-ready" : ""}${isDraggingType ? " is-type-target" : ""}`}
                      onDragOver={(event) => handleDetailZoneDragOver(event, "side", detailSideFields.length)}
                      onMouseMove={(event) => handleDetailZoneMouseMove(event, "side", detailSideFields.length)}
                      onDragLeave={makeSurfaceDragLeaveHandler("detail")}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (dropTarget?.surface === "detail" && dropTarget.zone === "side") {
                          applyResolvedDropTarget(dropTarget);
                        }
                      }}
                    >
                      <div className="wie__form-zone-head">
                        <span>Barra lateral</span>
                        <strong>{detailSideFields.length} campo{detailSideFields.length !== 1 ? "s" : ""}</strong>
                      </div>
                      {detailSideFields.length === 0 ? (
                        isDragging ? renderDetailInsertTarget("side", 0) : <p className="wie__form-zone-empty">Arraste campos de apoio e metadados para a lateral.</p>
                      ) : (
                        <>
                          {detailSideFields.map((field, index) => renderDetailFieldCard(field, "side", index))}
                          {isDragging ? renderDetailInsertTarget("side", detailSideFields.length) : null}
                        </>
                      )}
                    </div>
                  </aside>
                </div>
                <div className={`wie__stage-hint${isDragging ? " is-visible" : ""}`}>
                  {isDraggingType
                    ? "Solte em uma vaga para criar ou em um campo para substituir."
                    : "Solte em uma vaga para inserir ou em um campo para substituir."}
                </div>
              </section>

              <section className={`wie__canvas-panel wie__canvas-panel--field${activeCanvasTab === "field" ? "" : " is-hidden"}`}>
                <div className="wie__field-editor-stage">
                  {activeFieldCanvasPreview ? (
                    <div className="wie__field-editor-preview-panel">
                      <div className="wie__field-editor-preview-head">
                        <span>Preview do campo</span>
                        <strong>{activeFieldCanvasPreview.label}</strong>
                      </div>
                      <div className="wie__field-editor-preview-card">
                        <div className="wie__field-editor-preview-meta">
                          <span className="wie__field-editor-preview-type">
                            {getTaskFieldTypeLabel(activeFieldCanvasPreview)}
                          </span>
                          <div className="wie__field-editor-preview-badges">
                            {pendingFieldSetup ? <span>Novo campo</span> : null}
                            {!pendingFieldSetup && selectedInCard ? <span>No card</span> : null}
                            {!pendingFieldSetup && selectedInDetail ? <span>No formulario</span> : null}
                            {!pendingFieldSetup && !selectedInCard && !selectedInDetail ? <span>Fora do layout</span> : null}
                          </div>
                        </div>
                        <div className="wie__field-editor-preview-field">
                          <label>{activeFieldCanvasPreview.label}</label>
                          {renderPreviewFieldValue(activeFieldCanvasPreview)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="wie__field-editor-empty">
                      <span>Campos</span>
                      <strong>Selecione um campo para editar visualmente</strong>
                      <p>Clique em um campo na biblioteca, no card ou no formulario para abrir o preview e a edicao aqui.</p>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* ── Properties ──────────────────────────────────────────────────── */}
            <aside className="wie__props">
              {renderPropertiesPanel()}
            </aside>
          </>
        )}
      </div>

      {layoutMessage ? <p className="wie__footer-message">{layoutMessage}</p> : null}
    </div>
  );
}
