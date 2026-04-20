import { useCallback, useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";
import { TaskCard } from "@/entities/task";
import {
  applyFieldCapabilityOverrides,
  CARD_FIELDS_SCHEMA_VERSION,
  factoryBoardConfig,
  getTaskFieldTypeLabel,
  isSystemCardFieldId,
  mergeCardFieldDefinitions,
  resolveFieldIdsForTaskType
} from "@/entities/task";
import type { BoardConfig, Task, TaskFieldDefinition } from "@/entities/task";
import type { ApiCustomField, ApiItemType, CustomFieldType } from "@/modules/workspace/model";
import { useWorkspace } from "@/modules/workspace";
import { Button, FormField, TextInput } from "@/shared/ui";
import "@/widgets/task-details/ui/task-details-modal.css";
import "./work-item-editor-settings.css";

const DEFAULT_TYPE_COLOR = "#0a86e8";

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
  { value: "multi_select", label: "Selecao multipla", caption: "Etiquetas e combinacoes." }
];

type LayoutScope = "card" | "detail";
type LibraryFilter = "all" | "system" | "custom" | "text" | "selectable";

interface FieldOptionDraft {
  id: string;
  label: string;
  value: string;
}

interface LayoutDraft {
  card: string[];
  detail: string[];
}

interface TypeDraft {
  name: string;
  color: string;
}

interface FieldDraft {
  id: string | null;
  name: string;
  type: CustomFieldType;
  required: boolean;
  allowAiGeneration: boolean;
  options: FieldOptionDraft[];
}

interface DragPayload {
  fieldId: string;
  origin: "library" | LayoutScope;
}

interface FieldLibraryItem extends TaskFieldDefinition {
  sourceLabel: string;
  optionsCount: number;
  required: boolean;
  allowAiGeneration: boolean;
}

function sanitizeFieldIds(values: string[], allowedFieldIds?: Set<string>): string[] {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value.length > 0 && (!allowedFieldIds || allowedFieldIds.has(value)))
    )
  );
}

function sanitizeFieldMapByType(
  input: Record<string, string[]>,
  allowedFieldIds?: Set<string>
): Record<string, string[]> {
  return Object.entries(input).reduce<Record<string, string[]>>((acc, [typeSlug, fieldIds]) => {
    const normalizedSlug = typeSlug.trim();
    if (!normalizedSlug) {
      return acc;
    }

    acc[normalizedSlug] = sanitizeFieldIds(Array.isArray(fieldIds) ? fieldIds : [], allowedFieldIds);
    return acc;
  }, {});
}

function areSameOrderedIds(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function supportsAiGeneration(type: CustomFieldType): boolean {
  return type === "text" || type === "long_text";
}

function supportsSelectableOptions(type: CustomFieldType): boolean {
  return type === "select" || type === "multi_select";
}

function readAllowAiGeneration(settings: ApiCustomField["settings"]): boolean {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return false;
  }

  return settings.allowAiGeneration === true;
}

function readFieldCapabilitiesById(settings?: Record<string, unknown>): Record<string, { aiEnhance?: boolean }> {
  const source = settings?.fieldCapabilitiesById;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return {};
  }

  return Object.entries(source as Record<string, unknown>).reduce<Record<string, { aiEnhance?: boolean }>>(
    (acc, [fieldId, value]) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return acc;
      }

      if (typeof (value as { aiEnhance?: unknown }).aiEnhance === "boolean") {
        acc[fieldId] = { aiEnhance: (value as { aiEnhance: boolean }).aiEnhance };
      }

      return acc;
    },
    {}
  );
}

function sanitizeOptionValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeOptionInputs(options: FieldOptionDraft[]): Array<{ label: string; value: string }> {
  const seen = new Set<string>();
  const normalized: Array<{ label: string; value: string }> = [];

  options.forEach((option, index) => {
    const label = option.label.trim();
    if (!label) {
      return;
    }

    const baseValue = sanitizeOptionValue(option.value) || sanitizeOptionValue(label) || `opcao_${index + 1}`;
    let nextValue = baseValue;
    let suffix = 2;

    while (seen.has(nextValue)) {
      nextValue = `${baseValue}_${suffix}`;
      suffix += 1;
    }

    seen.add(nextValue);
    normalized.push({ label, value: nextValue });
  });

  return normalized;
}

function mapApiOptionsToDraft(options: ApiCustomField["options"]): FieldOptionDraft[] {
  return (options ?? []).map((option, index) => ({
    id: option.id || `option-${index}`,
    label: option.label,
    value: option.value
  }));
}

function createEmptyOptionDraft(index: number): FieldOptionDraft {
  return {
    id: `new-option-${Date.now()}-${index}`,
    label: "",
    value: ""
  };
}

function createFieldDraft(field?: ApiCustomField): FieldDraft {
  if (!field) {
    return {
      id: null,
      name: "",
      type: "text",
      required: false,
      allowAiGeneration: false,
      options: []
    };
  }

  return {
    id: field.id,
    name: field.name,
    type: field.type as CustomFieldType,
    required: field.required,
    allowAiGeneration: readAllowAiGeneration(field.settings),
    options: mapApiOptionsToDraft(field.options)
  };
}

function getPreviewValue(field: TaskFieldDefinition): string {
  const previewValues: Record<string, string> = {
    "sys:type": "Growth bug",
    "sys:priority": "Alta",
    "sys:status": "Em validacao",
    "sys:title": "Refinar experiencia do checkout",
    "sys:description": "Ajustar fluxo, copy e validacoes para reduzir friccao no funil.",
    "sys:created-by": "Marina Costa",
    "sys:assignee": "Squad Produto",
    "sys:tags": "ux, receita, q2",
    "sys:checklist": "3 de 5 itens concluidos",
    "sys:schedule": "24/04 09:30 -> 24/04 17:00",
    "sys:due-date": "26/04/2026"
  };

  if (previewValues[field.id]) {
    return previewValues[field.id];
  }

  if (field.type === "boolean") {
    return "Ativado";
  }

  if (field.type === "number") {
    return "42";
  }

  if (field.type === "date") {
    return "28/04/2026";
  }

  if (field.type === "datetime") {
    return "28/04/2026 14:20";
  }

  if (field.type === "select" || field.type === "multi_select" || field.type === "multi-select") {
    return field.options?.slice(0, 2).join(", ") || "Opcao A";
  }

  return "Valor de exemplo";
}

function formatFieldValuePreview(field: TaskFieldDefinition): string {
  const value = getPreviewValue(field);
  return field.type === "text_ai" ? `${value} - IA pronta para sugerir.` : value;
}

function removeFieldFromScope(draft: LayoutDraft, scope: LayoutScope, fieldId: string): LayoutDraft {
  if (scope === "card") {
    return { ...draft, card: draft.card.filter((id) => id !== fieldId) };
  }

  return { ...draft, detail: draft.detail.filter((id) => id !== fieldId) };
}

function moveField(
  draft: LayoutDraft,
  payload: DragPayload,
  targetScope: LayoutScope,
  targetIndex: number,
  allowedFieldIds: Set<string>
): LayoutDraft {
  const nextCard = [...draft.card];
  const nextDetail = [...draft.detail];

  if (!allowedFieldIds.has(payload.fieldId)) {
    return draft;
  }

  if (payload.origin === "card") {
    const index = nextCard.indexOf(payload.fieldId);
    if (index >= 0) {
      nextCard.splice(index, 1);
    }
  }

  if (payload.origin === "detail") {
    const index = nextDetail.indexOf(payload.fieldId);
    if (index >= 0) {
      nextDetail.splice(index, 1);
    }
  }

  const targetList = targetScope === "card" ? nextCard : nextDetail;
  const currentIndex = targetList.indexOf(payload.fieldId);
  if (currentIndex >= 0) {
    targetList.splice(currentIndex, 1);
  }

  const insertAt = Math.max(0, Math.min(targetIndex, targetList.length));
  targetList.splice(insertAt, 0, payload.fieldId);

  return {
    card: sanitizeFieldIds(nextCard, allowedFieldIds),
    detail: sanitizeFieldIds(nextDetail, allowedFieldIds)
  };
}

function computeDropIndex(
  event: DragEvent<HTMLElement>,
  draggingFieldId: string,
  scope: LayoutScope
): number {
  const items = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(`[data-workitem-slot='${scope}']`)
  ).filter((element) => element.dataset.fieldId !== draggingFieldId);

  for (let index = 0; index < items.length; index += 1) {
    const rect = items[index].getBoundingClientRect();
    if (event.clientY < rect.top + rect.height / 2) {
      return index;
    }
  }

  return items.length;
}

function resolveLibraryFilter(field: FieldLibraryItem, filter: LibraryFilter): boolean {
  switch (filter) {
    case "system":
      return field.source === "system";
    case "custom":
      return field.source === "custom";
    case "text":
      return field.type === "text" || field.type === "text_ai";
    case "selectable":
      return Boolean(field.capabilities?.selectable || field.capabilities?.multiSelectable);
    default:
      return true;
  }
}

function createMockTask(
  activeType: ApiItemType | null,
  layout: LayoutDraft,
  fieldsById: Record<string, FieldLibraryItem>,
  statusId: string
): Task {
  const customFields = layout.detail.reduce<Record<string, string | number | boolean | string[] | null>>((acc, fieldId) => {
    const field = fieldsById[fieldId];
    if (!field || isSystemCardFieldId(fieldId)) {
      return acc;
    }

    if (field.type === "boolean") {
      acc[fieldId] = true;
      return acc;
    }

    if (field.type === "number") {
      acc[fieldId] = 42;
      return acc;
    }

    if (field.type === "multi_select" || field.type === "multi-select") {
      acc[fieldId] = field.options?.slice(0, 2) ?? ["Opcao A", "Opcao B"];
      return acc;
    }

    acc[fieldId] = getPreviewValue(field);
    return acc;
  }, {});

  customFields["createdBy"] = "Marina Costa";

  return {
    id: "workitem-editor-preview",
    title: "Refinar experiencia do checkout",
    text: "Ajustar fluxo, copy e validacoes para reduzir friccao no funil.",
    type: activeType?.slug ?? "task",
    status: statusId,
    position: 0,
    priority: 1,
    tags: ["ux", "receita", "q2"],
    assignee: "preview-member",
    checklist: {
      items: [
        { id: "1", label: "Mapear gargalos do fluxo atual", done: true },
        { id: "2", label: "Atualizar copy do CTA principal", done: true },
        { id: "3", label: "Revisar mensagens de erro", done: false },
        { id: "4", label: "Validar com time comercial", done: false }
      ]
    },
    due: "2026-04-26",
    plannedStartAt: "2026-04-24T09:30:00.000Z",
    plannedEndAt: "2026-04-24T17:00:00.000Z",
    customFields
  };
}

function buildPreviewBoardConfig(
  boardConfig: BoardConfig,
  activeType: ApiItemType | null,
  layout: LayoutDraft
): BoardConfig {
  const typeSlug = activeType?.slug ?? boardConfig.taskTypes[0]?.id ?? "task";

  return {
    ...boardConfig,
    cardLayout: {
      ...boardConfig.cardLayout,
      visibleFieldIds: layout.card,
      visibleFieldIdsByType: {
        ...(boardConfig.cardLayout.visibleFieldIdsByType ?? {}),
        [typeSlug]: layout.card
      },
      detailVisibleFieldIdsByType: {
        ...(boardConfig.cardLayout.detailVisibleFieldIdsByType ?? {}),
        [typeSlug]: layout.detail
      }
    }
  };
}

export function WorkItemEditorSettings() {
  const {
    snapshot,
    fetchItemTypes,
    fetchCustomFields,
    createItemType,
    updateItemType,
    deleteItemType,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    updatePreferences
  } = useWorkspace();

  const boardConfig = snapshot?.boardConfig ?? factoryBoardConfig;
  const settings = (snapshot?.preferences.settings as Record<string, unknown> | undefined) ?? {};
  const allFields = useMemo(
    () =>
      applyFieldCapabilityOverrides(
        mergeCardFieldDefinitions(Array.isArray(boardConfig.fieldDefinitions) ? boardConfig.fieldDefinitions : []),
        settings
      ),
    [boardConfig.fieldDefinitions, settings]
  );
  const fieldCapabilitiesById = useMemo(() => readFieldCapabilitiesById(settings), [settings]);
  const allowedFieldIds = useMemo(() => new Set(allFields.map((field) => field.id)), [allFields]);
  const persistedVisibleFieldsByType = useMemo(
    () => sanitizeFieldMapByType(snapshot?.preferences.visibleFieldsByType ?? {}, allowedFieldIds),
    [allowedFieldIds, snapshot?.preferences.visibleFieldsByType]
  );
  const persistedDetailFieldsByType = useMemo(
    () => sanitizeFieldMapByType(snapshot?.preferences.detailVisibleFieldsByType ?? {}, allowedFieldIds),
    [allowedFieldIds, snapshot?.preferences.detailVisibleFieldsByType]
  );

  const [itemTypes, setItemTypes] = useState<ApiItemType[]>([]);
  const [customFields, setCustomFields] = useState<ApiCustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTypeSlug, setActiveTypeSlug] = useState("");
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>("all");
  const [layoutDraftsByTypeSlug, setLayoutDraftsByTypeSlug] = useState<Record<string, LayoutDraft>>({});
  const [savingLayout, setSavingLayout] = useState(false);
  const [layoutMessage, setLayoutMessage] = useState("");
  const [typeComposer, setTypeComposer] = useState<TypeDraft | null>(null);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [typeSaving, setTypeSaving] = useState(false);
  const [typeDeletingId, setTypeDeletingId] = useState<string | null>(null);
  const [fieldDraft, setFieldDraft] = useState<FieldDraft | null>(null);
  const [fieldSaving, setFieldSaving] = useState(false);
  const [fieldDeletingId, setFieldDeletingId] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState("");
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [dropTarget, setDropTarget] = useState<{ scope: LayoutScope; index: number } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [nextTypes, nextFields] = await Promise.all([fetchItemTypes(), fetchCustomFields()]);
      setItemTypes(nextTypes);
      setCustomFields(nextFields);
    } finally {
      setLoading(false);
    }
  }, [fetchCustomFields, fetchItemTypes]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeItemTypes = useMemo(() => itemTypes.filter((type) => type.isActive !== false), [itemTypes]);

  useEffect(() => {
    if (!activeItemTypes.length) {
      setActiveTypeSlug("");
      return;
    }

    if (!activeItemTypes.some((type) => type.slug === activeTypeSlug)) {
      setActiveTypeSlug(activeItemTypes[0].slug);
    }
  }, [activeItemTypes, activeTypeSlug]);

  const activeType = useMemo(
    () => activeItemTypes.find((type) => type.slug === activeTypeSlug) ?? activeItemTypes[0] ?? null,
    [activeItemTypes, activeTypeSlug]
  );

  const customFieldById = useMemo(
    () =>
      customFields.reduce<Record<string, ApiCustomField>>((acc, field) => {
        acc[field.id] = field;
        return acc;
      }, {}),
    [customFields]
  );

  const libraryFields = useMemo<FieldLibraryItem[]>(
    () =>
      allFields.map((field) => {
        const customField = customFieldById[field.id];
        const explicitCapability = fieldCapabilitiesById[field.id]?.aiEnhance;
        const allowAiGeneration =
          typeof explicitCapability === "boolean"
            ? explicitCapability
            : field.capabilities?.aiEnhance === true ||
              field.type === "text_ai" ||
              readAllowAiGeneration(customField?.settings);

        return {
          ...field,
          optionsCount: customField?.options.length ?? field.options?.length ?? 0,
          required: customField?.required ?? false,
          allowAiGeneration,
          sourceLabel: isSystemCardFieldId(field.id) ? "Sistema" : "Customizado"
        };
      }),
    [allFields, customFieldById, fieldCapabilitiesById]
  );

  const fieldsById = useMemo(
    () =>
      libraryFields.reduce<Record<string, FieldLibraryItem>>((acc, field) => {
        acc[field.id] = field;
        return acc;
      }, {}),
    [libraryFields]
  );

  const filteredLibraryFields = useMemo(
    () => libraryFields.filter((field) => resolveLibraryFilter(field, libraryFilter)),
    [libraryFields, libraryFilter]
  );

  const getEffectiveLayout = useCallback(
    (typeSlug: string): LayoutDraft => ({
      card: resolveFieldIdsForTaskType(typeSlug, persistedVisibleFieldsByType, boardConfig.cardLayout.visibleFieldIds),
      detail: resolveFieldIdsForTaskType(
        typeSlug,
        persistedDetailFieldsByType,
        resolveFieldIdsForTaskType(typeSlug, persistedVisibleFieldsByType, boardConfig.cardLayout.visibleFieldIds)
      )
    }),
    [boardConfig.cardLayout.visibleFieldIds, persistedDetailFieldsByType, persistedVisibleFieldsByType]
  );

  const activeLayout = activeType
    ? layoutDraftsByTypeSlug[activeType.slug] ?? getEffectiveLayout(activeType.slug)
    : { card: [], detail: [] };

  const activeCardFields = activeLayout.card.map((fieldId) => fieldsById[fieldId]).filter(Boolean);
  const activeDetailFields = activeLayout.detail.map((fieldId) => fieldsById[fieldId]).filter(Boolean);
  const filteredCardFields = activeCardFields.filter(
    (field): field is FieldLibraryItem => Boolean(field)
  );
  const filteredDetailFields = activeDetailFields.filter(
    (field): field is FieldLibraryItem => Boolean(field)
  );

  const hasUnsavedLayout = Boolean(
    activeType &&
      layoutDraftsByTypeSlug[activeType.slug] &&
      (!areSameOrderedIds(activeLayout.card, getEffectiveLayout(activeType.slug).card) ||
        !areSameOrderedIds(activeLayout.detail, getEffectiveLayout(activeType.slug).detail))
  );

  const handleUpdateLayout = useCallback(
    (typeSlug: string, nextLayout: LayoutDraft) => {
      setLayoutMessage("");
      setLayoutDraftsByTypeSlug((current) => ({
        ...current,
        [typeSlug]: {
          card: sanitizeFieldIds(nextLayout.card, allowedFieldIds),
          detail: sanitizeFieldIds(nextLayout.detail, allowedFieldIds)
        }
      }));
    },
    [allowedFieldIds]
  );

  const handleDragStart = (event: DragEvent<HTMLElement>, payload: DragPayload) => {
    setDragPayload(payload);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", payload.fieldId);
  };

  const handleDragEnd = () => {
    setDragPayload(null);
    setDropTarget(null);
  };

  const handleDropIntoScope = (event: DragEvent<HTMLElement>, scope: LayoutScope) => {
    event.preventDefault();
    if (!activeType || !dragPayload) {
      return;
    }

    const index = dropTarget?.scope === scope ? dropTarget.index : computeDropIndex(event, dragPayload.fieldId, scope);
    handleUpdateLayout(activeType.slug, moveField(activeLayout, dragPayload, scope, index, allowedFieldIds));
    setDropTarget(null);
  };

  const handleSaveLayout = async () => {
    if (!activeType || !snapshot) {
      return;
    }

    setSavingLayout(true);
    setLayoutMessage("");

    try {
      const nextVisibleByType = sanitizeFieldMapByType(
        { ...(snapshot.preferences.visibleFieldsByType ?? {}), [activeType.slug]: activeLayout.card },
        allowedFieldIds
      );
      const nextDetailByType = sanitizeFieldMapByType(
        { ...(snapshot.preferences.detailVisibleFieldsByType ?? {}), [activeType.slug]: activeLayout.detail },
        allowedFieldIds
      );

      await updatePreferences({
        visibleFieldsByType: nextVisibleByType,
        detailVisibleFieldsByType: nextDetailByType,
        settings: {
          ...settings,
          cardFieldSchemaVersion: CARD_FIELDS_SCHEMA_VERSION
        }
      });

      setLayoutDraftsByTypeSlug((current) => {
        const next = { ...current };
        delete next[activeType.slug];
        return next;
      });
      setLayoutMessage("Layout salvo. O editor agora espelha o que vai para o board.");
    } catch {
      setLayoutMessage("Nao foi possivel salvar o layout agora.");
    } finally {
      setSavingLayout(false);
    }
  };

  const handleDiscardLayout = () => {
    if (!activeType) {
      return;
    }

    setLayoutMessage("");
    setLayoutDraftsByTypeSlug((current) => {
      const next = { ...current };
      delete next[activeType.slug];
      return next;
    });
  };

  const persistFieldCapabilities = useCallback(
    async (fieldId: string, aiEnhance: boolean) => {
      if (!snapshot) {
        return;
      }

      const nextCapabilitiesById = {
        ...fieldCapabilitiesById,
        [fieldId]: {
          ...(fieldCapabilitiesById[fieldId] ?? {}),
          aiEnhance
        }
      };

      await updatePreferences({
        settings: {
          ...settings,
          fieldCapabilitiesById: nextCapabilitiesById
        }
      });
    },
    [fieldCapabilitiesById, settings, snapshot, updatePreferences]
  );

  const handleSaveType = async () => {
    if (!typeComposer?.name.trim()) {
      return;
    }

    setTypeSaving(true);
    try {
      if (editingTypeId) {
        await updateItemType(editingTypeId, {
          name: typeComposer.name.trim(),
          color: typeComposer.color
        });
      } else {
        await createItemType({
          name: typeComposer.name.trim(),
          color: typeComposer.color
        });
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
    try {
      await deleteItemType(typeId);
      await loadData();
    } finally {
      setTypeDeletingId(null);
    }
  };

  const handleSaveField = async () => {
    if (!fieldDraft?.name.trim()) {
      return;
    }

    const normalizedOptions = normalizeOptionInputs(fieldDraft.options);
    if (supportsSelectableOptions(fieldDraft.type) && normalizedOptions.length === 0) {
      setFieldError("Campos de selecao precisam de pelo menos uma opcao.");
      return;
    }

    setFieldSaving(true);
    setFieldError("");

    try {
      if (fieldDraft.id) {
        await updateCustomField(fieldDraft.id, {
          name: fieldDraft.name.trim(),
          type: fieldDraft.type,
          required: fieldDraft.required,
          settings: {
            allowAiGeneration: supportsAiGeneration(fieldDraft.type) ? fieldDraft.allowAiGeneration : false
          },
          options: supportsSelectableOptions(fieldDraft.type) ? normalizedOptions : []
        });
        await persistFieldCapabilities(fieldDraft.id, supportsAiGeneration(fieldDraft.type) && fieldDraft.allowAiGeneration);
      } else {
        await createCustomField({
          name: fieldDraft.name.trim(),
          type: fieldDraft.type,
          required: fieldDraft.required,
          settings: {
            allowAiGeneration: supportsAiGeneration(fieldDraft.type) ? fieldDraft.allowAiGeneration : false
          },
          options: supportsSelectableOptions(fieldDraft.type) ? normalizedOptions : []
        });
      }

      setFieldDraft(null);
      await loadData();
    } finally {
      setFieldSaving(false);
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    setFieldDeletingId(fieldId);
    try {
      await deleteCustomField(fieldId);
      if (fieldDraft?.id === fieldId) {
        setFieldDraft(null);
      }
      await loadData();
    } finally {
      setFieldDeletingId(null);
    }
  };

  const previewBoardConfig = useMemo(
    () => buildPreviewBoardConfig(boardConfig, activeType, activeLayout),
    [activeLayout, activeType, boardConfig]
  );
  const previewTask = useMemo(
    () => createMockTask(activeType, activeLayout, fieldsById, boardConfig.statuses[1]?.id ?? boardConfig.statuses[0]?.id ?? "doing"),
    [activeLayout, activeType, boardConfig.statuses, fieldsById]
  );

  const summary = {
    activeTypes: activeItemTypes.length,
    customFields: customFields.filter((field) => field.isActive !== false).length,
    cardFields: filteredCardFields.length,
    detailFields: filteredDetailFields.length
  };

  return (
    <div className="workitem-editor-v2">
      <div className="workitem-editor-v2__topbar">
        <div className="workitem-editor-v2__tabs">
          {activeItemTypes.map((type) => (
            <div
              key={type.id}
              className={`workitem-editor-v2__tab${activeType?.slug === type.slug ? " is-active" : ""}`}
            >
              <button type="button" onClick={() => setActiveTypeSlug(type.slug)}>
                <i style={{ background: type.color || DEFAULT_TYPE_COLOR }} />
                {type.name}
              </button>
            </div>
          ))}

          <button
            type="button"
            className="workitem-editor-v2__add-tab"
            onClick={() => {
              setEditingTypeId(null);
              setTypeComposer({ name: "", color: DEFAULT_TYPE_COLOR });
            }}
          >
            Novo tipo
          </button>
        </div>

        <div className="workitem-editor-v2__save-area">
          <div className="workitem-editor-v2__summary">
            <span><strong>{summary.activeTypes}</strong> tipos</span>
            <span><strong>{summary.customFields}</strong> campos</span>
            <span><strong>{summary.cardFields}</strong> no card</span>
            <span><strong>{summary.detailFields}</strong> no expandido</span>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={handleDiscardLayout} disabled={!hasUnsavedLayout || savingLayout}>
            Descartar
          </Button>
          <Button type="button" size="sm" onClick={() => void handleSaveLayout()} disabled={!hasUnsavedLayout || savingLayout}>
            {savingLayout ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      <div className="workitem-editor-v2__canvas-wrap">
        {loading ? (
          <div className="workitem-editor-v2__loading">
            <div className="workitem-editor-v2__skeleton" />
            <div className="workitem-editor-v2__skeleton" />
            <div className="workitem-editor-v2__skeleton" />
          </div>
        ) : (
          <div className="workitem-editor-v2__canvas">
            <section className="workitem-editor-v2__column workitem-editor-v2__column--library">
              <header className="workitem-editor-v2__column-head">
                <div>
                  <span>Biblioteca visual</span>
                  <h2>Campos</h2>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setFieldError("");
                    setFieldDraft(createFieldDraft());
                  }}
                >
                  Novo campo
                </Button>
              </header>

              <div className="workitem-editor-v2__filters">
                {[
                  { id: "all", label: "Todos" },
                  { id: "system", label: "Sistema" },
                  { id: "custom", label: "Customizados" },
                  { id: "text", label: "Texto" },
                  { id: "selectable", label: "Selecao" }
                ].map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    className={`workitem-editor-v2__filter${libraryFilter === filter.id ? " is-active" : ""}`}
                    onClick={() => setLibraryFilter(filter.id as LibraryFilter)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              <div className="workitem-editor-v2__field-list">
                {filteredLibraryFields.map((field) => (
                  <article
                    key={field.id}
                    className="workitem-editor-v2__field-card"
                    draggable
                    onDragStart={(event) => handleDragStart(event, { fieldId: field.id, origin: "library" })}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="workitem-editor-v2__field-card-head">
                      <div>
                        <strong>{field.label}</strong>
                        <span>{getTaskFieldTypeLabel(field)}</span>
                      </div>
                      <small>{field.sourceLabel}</small>
                    </div>

                    <p>{formatFieldValuePreview(field)}</p>

                    <div className="workitem-editor-v2__field-meta">
                      {field.required ? <span>Obrigatorio</span> : null}
                      {field.allowAiGeneration ? <span>IA</span> : null}
                      {field.optionsCount > 0 ? <span>{field.optionsCount} opcoes</span> : null}
                    </div>

                    {!isSystemCardFieldId(field.id) ? (
                      <div className="workitem-editor-v2__mini-actions">
                        <button type="button" onClick={() => { setFieldError(""); setFieldDraft(createFieldDraft(customFieldById[field.id])); }}>
                          Editar
                        </button>
                        <button type="button" onClick={() => void handleDeleteField(field.id)} disabled={fieldDeletingId === field.id}>
                          {fieldDeletingId === field.id ? "Removendo..." : "Remover"}
                        </button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>

            <section className="workitem-editor-v2__column workitem-editor-v2__column--preview">
              <header className="workitem-editor-v2__column-head">
                <div>
                  <span>Preview real</span>
                  <h2>Card do board</h2>
                </div>
                <small>O preview abaixo usa o `TaskCard` real.</small>
              </header>

              <div className="workitem-editor-v2__preview-panel">
                <div className="workitem-editor-v2__preview-stage">
                  <TaskCard
                    task={previewTask}
                    boardConfig={previewBoardConfig}
                    creatorName="Marina Costa"
                    assigneeName="Squad Produto"
                    statusLabel="Em validacao"
                    onDragStart={() => {}}
                    onDragEnd={() => {}}
                    onOpen={() => {}}
                  />
                </div>

                <div
                  className="workitem-editor-v2__slot-board"
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (!dragPayload) {
                      return;
                    }
                    setDropTarget({
                      scope: "card",
                      index: computeDropIndex(event, dragPayload.fieldId, "card")
                    });
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setDropTarget((current) => (current?.scope === "card" ? null : current));
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (!activeType || !dragPayload) {
                      return;
                    }
                    const index =
                      dropTarget?.scope === "card"
                        ? dropTarget.index
                        : computeDropIndex(event, dragPayload.fieldId, "card");
                    handleUpdateLayout(activeType.slug, moveField(activeLayout, dragPayload, "card", index, allowedFieldIds));
                    setDropTarget(null);
                  }}
                >
                  {filteredCardFields.length === 0 ? (
                    <p className="workitem-editor-v2__empty">Solte campos aqui para montar o card.</p>
                  ) : (
                    filteredCardFields.map((field, index) => (
                      <div className="workitem-editor-v2__slot-wrap" key={`card-slot-${field.id}`}>
                        {dropTarget?.scope === "card" && dropTarget.index === index ? (
                          <div className="workitem-editor-v2__drop-indicator" />
                        ) : null}
                        <div
                          className="workitem-editor-v2__slot-chip"
                          data-workitem-slot="card"
                          data-field-id={field.id}
                          draggable
                          onDragStart={(event) => handleDragStart(event, { fieldId: field.id, origin: "card" })}
                          onDragEnd={handleDragEnd}
                        >
                          <div>
                            <strong>{field.label}</strong>
                            <span>{getTaskFieldTypeLabel(field)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => activeType && handleUpdateLayout(activeType.slug, removeFieldFromScope(activeLayout, "card", field.id))}
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    ))
                  )}

                  {dropTarget?.scope === "card" && dropTarget.index === filteredCardFields.length ? (
                    <div className="workitem-editor-v2__drop-indicator" />
                  ) : null}
                </div>
              </div>
            </section>

            <section className="workitem-editor-v2__column workitem-editor-v2__column--preview">
              <header className="workitem-editor-v2__column-head">
                <div>
                  <span>Preview expandido</span>
                  <h2>Work item aberto</h2>
                </div>
                <small>Mesma linguagem visual do modal real.</small>
              </header>

              <div className="workitem-editor-v2__preview-panel workitem-editor-v2__preview-panel--detail">
                <div className="task-details workitem-editor-v2__detail-shell">
                  <div className="task-details__topbar">
                    <div className="task-details__header-copy">
                      <p className="task-details__breadcrumbs">Work item</p>
                      <h2>{previewTask.title}</h2>
                    </div>
                    <div className="task-details__topbar-actions">
                      <button type="button" className="task-details__close" aria-label="Fechar preview">
                        ×
                      </button>
                    </div>
                  </div>

                  <div className="task-details__body task-details__body--edit">
                    <section className="task-details__main">
                      <section className="task-details__hero">
                        <div className="task-details__hero-accent" />
                        <div className="task-details__hero-copy">
                          <p className="task-details__eyebrow">{activeType?.name ?? "Tipo"}</p>
                          <div className="workitem-editor-v2__hero-mock-input">{previewTask.title}</div>
                          <div className="workitem-editor-v2__hero-mock-textarea">{previewTask.text}</div>
                        </div>
                      </section>

                      <section className="task-details__section">
                        <div className="task-details__section-head">
                          <h3 className="task-details__summary-style-title">Campos na ordem do formulario</h3>
                          <span className="task-details__section-caption">{filteredDetailFields.length} visiveis</span>
                        </div>

                        <div
                          className="workitem-editor-v2__detail-dropzone"
                          onDragOver={(event) => {
                            event.preventDefault();
                            if (!dragPayload) {
                              return;
                            }
                            setDropTarget({
                              scope: "detail",
                              index: computeDropIndex(event, dragPayload.fieldId, "detail")
                            });
                          }}
                          onDragLeave={(event) => {
                            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                              setDropTarget((current) => (current?.scope === "detail" ? null : current));
                            }
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            if (!activeType || !dragPayload) {
                              return;
                            }
                            const index =
                              dropTarget?.scope === "detail"
                                ? dropTarget.index
                                : computeDropIndex(event, dragPayload.fieldId, "detail");
                            handleUpdateLayout(activeType.slug, moveField(activeLayout, dragPayload, "detail", index, allowedFieldIds));
                            setDropTarget(null);
                          }}
                        >
                          {filteredDetailFields.length === 0 ? (
                            <p className="workitem-editor-v2__empty">Solte campos aqui para montar o expandido.</p>
                          ) : (
                            filteredDetailFields.map((field, index) => (
                              <div className="workitem-editor-v2__slot-wrap" key={`detail-slot-${field.id}`}>
                                {dropTarget?.scope === "detail" && dropTarget.index === index ? (
                                  <div className="workitem-editor-v2__drop-indicator" />
                                ) : null}
                                <div
                                  className="workitem-editor-v2__detail-row"
                                  data-workitem-slot="detail"
                                  data-field-id={field.id}
                                  draggable
                                  onDragStart={(event) => handleDragStart(event, { fieldId: field.id, origin: "detail" })}
                                  onDragEnd={handleDragEnd}
                                >
                                  <div className="workitem-editor-v2__detail-label">
                                    <strong>{field.label}</strong>
                                    <span>{getTaskFieldTypeLabel(field)}</span>
                                  </div>
                                  <div className="workitem-editor-v2__detail-value">{getPreviewValue(field)}</div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      activeType && handleUpdateLayout(activeType.slug, removeFieldFromScope(activeLayout, "detail", field.id))
                                    }
                                  >
                                    Remover
                                  </button>
                                </div>
                              </div>
                            ))
                          )}

                          {dropTarget?.scope === "detail" && dropTarget.index === filteredDetailFields.length ? (
                            <div className="workitem-editor-v2__drop-indicator" />
                          ) : null}
                        </div>
                      </section>
                    </section>

                    <aside className="task-details__side">
                      <section className="task-details__panel task-details__panel--summary">
                        <span className="task-details__eyebrow">Resumo</span>
                        <div className="task-details__chips">
                          <span className="task-details__chip task-details__chip--status">Em validacao</span>
                          <span className="task-details__chip">Alta</span>
                          <span className="task-details__chip task-details__chip--type">{activeType?.name ?? "Tipo"}</span>
                        </div>
                      </section>

                      <section className="task-details__panel task-details__panel--metadata">
                        <div className="task-details__section-head">
                          <h3 className="task-details__summary-style-title">Leitura lateral</h3>
                        </div>
                        <div className="workitem-editor-v2__metadata-copy">
                          <span>O objetivo aqui e te deixar editar vendo a cara real do card expandido.</span>
                          <small>Se a ordem mudar, essa preview responde na hora.</small>
                        </div>
                      </section>
                    </aside>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>

      <div className="workitem-editor-v2__composer-row">
        <section className="workitem-editor-v2__composer">
          <header>
            <span>Tipo ativo</span>
            <h3>{editingTypeId ? "Editar tipo" : typeComposer ? "Novo tipo" : activeType?.name ?? "Sem tipo"}</h3>
          </header>

          {typeComposer ? (
            <>
              <FormField label="Nome">
                <TextInput
                  value={typeComposer.name}
                  placeholder="Ex: Growth, Operacao, Bugs..."
                  onChange={(event) => setTypeComposer({ ...typeComposer, name: event.target.value })}
                />
              </FormField>
              <FormField label="Cor">
                <div className="workitem-editor-v2__color-row">
                  <input
                    type="color"
                    value={typeComposer.color}
                    onChange={(event) => setTypeComposer({ ...typeComposer, color: event.target.value })}
                  />
                  <TextInput
                    value={typeComposer.color}
                    onChange={(event) => setTypeComposer({ ...typeComposer, color: event.target.value })}
                  />
                </div>
              </FormField>
              <div className="workitem-editor-v2__composer-actions">
                <Button type="button" size="sm" onClick={() => void handleSaveType()} disabled={typeSaving || !typeComposer.name.trim()}>
                  {typeSaving ? "Salvando..." : "Salvar tipo"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setTypeComposer(null); setEditingTypeId(null); }}>
                  Cancelar
                </Button>
              </div>
            </>
          ) : activeType ? (
            <div className="workitem-editor-v2__type-card-inline">
              <div>
                <strong>{activeType.name}</strong>
                <small>{filteredCardFields.length} campos no card • {filteredDetailFields.length} no expandido</small>
              </div>
              <div className="workitem-editor-v2__composer-actions">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingTypeId(activeType.id);
                    setTypeComposer({ name: activeType.name, color: activeType.color || DEFAULT_TYPE_COLOR });
                  }}
                >
                  Editar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleDeleteType(activeType.id)}
                  disabled={typeDeletingId === activeType.id}
                >
                  {typeDeletingId === activeType.id ? "Removendo..." : "Remover"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="workitem-editor-v2__empty">Crie o primeiro tipo para começar.</p>
          )}
        </section>

        <section className="workitem-editor-v2__composer">
          <header>
            <span>Campo</span>
            <h3>{fieldDraft?.id ? "Editar campo" : fieldDraft ? "Novo campo" : "Selecione ou crie um campo"}</h3>
          </header>

          {fieldDraft ? (
            <>
              <FormField label="Nome do campo">
                <TextInput
                  value={fieldDraft.name}
                  placeholder="Ex: Impacto esperado"
                  onChange={(event) => setFieldDraft({ ...fieldDraft, name: event.target.value })}
                />
              </FormField>

              <div className="workitem-editor-v2__field-types">
                {FIELD_TYPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`workitem-editor-v2__field-type${fieldDraft.type === option.value ? " is-active" : ""}`}
                    onClick={() =>
                      setFieldDraft((current) =>
                        current
                          ? {
                              ...current,
                              type: option.value,
                              allowAiGeneration: supportsAiGeneration(option.value) ? current.allowAiGeneration : false
                            }
                          : current
                      )
                    }
                  >
                    <strong>{option.label}</strong>
                    <span>{option.caption}</span>
                  </button>
                ))}
              </div>

              <div className="workitem-editor-v2__toggles">
                <label>
                  <input
                    type="checkbox"
                    checked={fieldDraft.required}
                    onChange={(event) => setFieldDraft({ ...fieldDraft, required: event.target.checked })}
                  />
                  Obrigatorio
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={fieldDraft.allowAiGeneration}
                    disabled={!supportsAiGeneration(fieldDraft.type)}
                    onChange={(event) => setFieldDraft({ ...fieldDraft, allowAiGeneration: event.target.checked })}
                  />
                  IA no campo
                </label>
              </div>

              {supportsSelectableOptions(fieldDraft.type) ? (
                <div className="workitem-editor-v2__options">
                  <div className="workitem-editor-v2__options-head">
                    <strong>Opcoes</strong>
                    <button
                      type="button"
                      onClick={() =>
                        setFieldDraft({
                          ...fieldDraft,
                          options: [...fieldDraft.options, createEmptyOptionDraft(fieldDraft.options.length + 1)]
                        })
                      }
                    >
                      Adicionar
                    </button>
                  </div>

                  {fieldDraft.options.map((option) => (
                    <div key={option.id} className="workitem-editor-v2__option-row">
                      <TextInput
                        value={option.label}
                        placeholder="Label"
                        onChange={(event) =>
                          setFieldDraft({
                            ...fieldDraft,
                            options: fieldDraft.options.map((entry) =>
                              entry.id === option.id ? { ...entry, label: event.target.value } : entry
                            )
                          })
                        }
                      />
                      <TextInput
                        value={option.value}
                        placeholder="valor_interno"
                        onChange={(event) =>
                          setFieldDraft({
                            ...fieldDraft,
                            options: fieldDraft.options.map((entry) =>
                              entry.id === option.id ? { ...entry, value: event.target.value } : entry
                            )
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              ) : null}

              {fieldError ? <p className="workitem-editor-v2__error">{fieldError}</p> : null}

              <div className="workitem-editor-v2__composer-actions">
                <Button type="button" size="sm" onClick={() => void handleSaveField()} disabled={fieldSaving || !fieldDraft.name.trim()}>
                  {fieldSaving ? "Salvando..." : "Salvar campo"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setFieldDraft(null)}>
                  Cancelar
                </Button>
              </div>
            </>
          ) : (
            <p className="workitem-editor-v2__empty">
              Arraste os campos da biblioteca e use "Novo campo" quando precisar criar uma informacao nova.
            </p>
          )}
        </section>
      </div>

      {layoutMessage ? <p className="workitem-editor-v2__footer-message">{layoutMessage}</p> : null}
    </div>
  );
}
