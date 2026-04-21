import { useCallback, useEffect, useMemo, useState } from "react";
import type { DragEvent, ReactNode } from "react";
import { MemberAvatar } from "@/entities/member";
import {
  applyFieldCapabilityOverrides,
  CARD_FIELDS_SCHEMA_VERSION,
  factoryBoardConfig,
  getTaskFieldTypeLabel,
  isSystemCardFieldId,
  mergeCardFieldDefinitions,
  resolveFieldIdsForTaskType,
  TaskCard
} from "@/entities/task";
import type { BoardConfig, Task, TaskCustomFieldValue, TaskFieldDefinition } from "@/entities/task";
import type { ApiCustomField, ApiItemType, CustomFieldType } from "@/modules/workspace/model";
import { useWorkspace } from "@/modules/workspace";
import { Button, FormField, TextInput } from "@/shared/ui";
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

const PREVIEW_CARD_TITLE = "Refinar experiencia do checkout";
const PREVIEW_CARD_DESCRIPTION = "Ajustar fluxo, copy e validacoes para reduzir friccao no funil.";
const PREVIEW_CARD_TAGS = ["ux", "receita", "q2"];
const PREVIEW_CREATED_BY = "Marina Costa";
const PREVIEW_ASSIGNEE = {
  id: "preview-member",
  name: "Squad Produto",
  initials: "SP",
  color: "#b8dafd"
};
const PREVIEW_DUE_DATE = "2026-04-26";

type LayoutScope = "card" | "detail";
type DetailZone = "main" | "side";

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
  id: string;
  name: string;
  type: CustomFieldType;
  required: boolean;
  allowAiGeneration: boolean;
  options: FieldOptionDraft[];
}

interface PendingFieldSetup {
  type: CustomFieldType;
  targetScope: LayoutScope;
  targetIndex: number;
  targetDetailZone?: DetailZone;
  name: string;
  required: boolean;
  allowAiGeneration: boolean;
  options: FieldOptionDraft[];
}

type DragPayload =
  | { kind: "field"; fieldId: string; origin: "library" | "card" | "detail" }
  | { kind: "type"; type: CustomFieldType };

interface FieldLibraryItem extends TaskFieldDefinition {
  optionsCount: number;
  required: boolean;
  allowAiGeneration: boolean;
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

function sanitizeFieldMapByType(
  input: Record<string, string[]>,
  allowedFieldIds?: Set<string>
): Record<string, string[]> {
  return Object.entries(input).reduce<Record<string, string[]>>((acc, [slug, ids]) => {
    const s = slug.trim();
    if (!s) return acc;
    acc[s] = sanitizeFieldIds(Array.isArray(ids) ? ids : [], allowedFieldIds);
    return acc;
  }, {});
}

function sanitizeDetailZoneMapByType(
  input: Record<string, Record<string, DetailZone>>,
  allowedFieldIds?: Set<string>
): Record<string, Record<string, DetailZone>> {
  return Object.entries(input).reduce<Record<string, Record<string, DetailZone>>>((acc, [slug, map]) => {
    const s = slug.trim();
    if (!s || !map || typeof map !== "object" || Array.isArray(map)) return acc;

    const nextMap = Object.entries(map).reduce<Record<string, DetailZone>>((memo, [fieldId, zone]) => {
      const normalizedFieldId = fieldId.trim();
      if (!normalizedFieldId || (allowedFieldIds && !allowedFieldIds.has(normalizedFieldId))) return memo;
      memo[normalizedFieldId] = zone === "main" ? "main" : "side";
      return memo;
    }, {});

    acc[s] = nextMap;
    return acc;
  }, {});
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

function getPreviewValue(field: TaskFieldDefinition): string {
  const sys: Record<string, string> = {
    "sys:type": "Growth",
    "sys:priority": "Alta",
    "sys:status": "Em validacao",
    "sys:title": "Refinar experiencia do checkout",
    "sys:description": "Ajustar fluxo, copy e validacoes...",
    "sys:created-by": "Marina Costa",
    "sys:assignee": "Squad Produto",
    "sys:tags": "ux, receita, q2",
    "sys:checklist": "3 / 5 concluidos",
    "sys:schedule": "24/04 - 26/04",
    "sys:due-date": "26/04/2026"
  };
  if (sys[field.id]) return sys[field.id];
  if (field.type === "boolean") return "Ativado";
  if (field.type === "number") return "42";
  if (field.type === "date") return "28/04/2026";
  if (field.type === "datetime") return "28/04 14:20";
  if (field.type === "select" || field.type === "multi_select" || field.type === "multi-select") {
    return field.options?.slice(0, 2).join(", ") || "Opcao A";
  }
  return "Valor de exemplo";
}

function getPreviewCustomFieldValue(field: TaskFieldDefinition): TaskCustomFieldValue {
  if (field.type === "boolean") return true;
  if (field.type === "number") return 42;
  if (field.type === "date") return "2026-04-28";
  if (field.type === "datetime") return "2026-04-28 14:20";
  if (field.type === "select") return field.options?.[0] ?? "Opcao A";
  if (field.type === "multi_select" || field.type === "multi-select") {
    const options = field.options?.slice(0, 2).filter(Boolean) ?? [];
    return options.length > 0 ? options : ["Opcao A", "Opcao B"];
  }
  return "Valor de exemplo";
}

function removeFieldFromScope(draft: LayoutDraft, scope: LayoutScope, fieldId: string): LayoutDraft {
  return scope === "card"
    ? { ...draft, card: draft.card.filter((id) => id !== fieldId) }
    : { ...draft, detail: draft.detail.filter((id) => id !== fieldId) };
}

function moveFieldInLayout(
  draft: LayoutDraft,
  payload: { fieldId: string; origin: "library" | "card" | "detail" },
  targetScope: LayoutScope,
  targetIndex: number,
  allowedFieldIds: Set<string>
): LayoutDraft {
  if (!allowedFieldIds.has(payload.fieldId)) return draft;

  const nextCard = [...draft.card];
  const nextDetail = [...draft.detail];

  if (payload.origin === "card") {
    const i = nextCard.indexOf(payload.fieldId);
    if (i >= 0) nextCard.splice(i, 1);
  }
  if (payload.origin === "detail") {
    const i = nextDetail.indexOf(payload.fieldId);
    if (i >= 0) nextDetail.splice(i, 1);
  }

  const list = targetScope === "card" ? nextCard : nextDetail;
  const cur = list.indexOf(payload.fieldId);
  if (cur >= 0) list.splice(cur, 1);
  list.splice(Math.max(0, Math.min(targetIndex, list.length)), 0, payload.fieldId);

  return {
    card: sanitizeFieldIds(nextCard, allowedFieldIds),
    detail: sanitizeFieldIds(nextDetail, allowedFieldIds)
  };
}

function computeDropIndex(
  event: DragEvent<HTMLElement>,
  draggingFieldId: string | null,
  scope: LayoutScope
): number {
  const items = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(`[data-workitem-slot="${scope}"]`)
  ).filter((el) => !draggingFieldId || el.dataset.fieldId !== draggingFieldId);

  for (let i = 0; i < items.length; i++) {
    const rect = items[i].getBoundingClientRect();
    if (event.clientY < rect.top + rect.height / 2) return i;
  }
  return items.length;
}

function addFieldIdToList(ids: string[], fieldId: string, index: number): string[] {
  const filtered = ids.filter((id) => id !== fieldId);
  filtered.splice(Math.max(0, Math.min(index, filtered.length)), 0, fieldId);
  return Array.from(new Set(filtered));
}

function getDefaultDetailZone(fieldId: string): DetailZone {
  if (
    fieldId === "sys:title" ||
    fieldId === "sys:description" ||
    fieldId === "sys:priority" ||
    fieldId === "sys:checklist"
  ) {
    return "main";
  }

  return "side";
}

function computeDropIndexForSelector(
  event: DragEvent<HTMLElement>,
  selector: string,
  draggingFieldId: string | null
): number {
  const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !draggingFieldId || el.dataset.fieldId !== draggingFieldId
  );

  for (let i = 0; i < items.length; i += 1) {
    const rect = items[i].getBoundingClientRect();
    if (event.clientY < rect.top + rect.height / 2) return i;
  }

  return items.length;
}

function resolveDetailInsertIndex(
  orderedFieldIds: string[],
  detailZones: Record<string, DetailZone>,
  zone: DetailZone,
  zoneIndex: number,
  draggingFieldId?: string
): number {
  const filteredOrder = draggingFieldId ? orderedFieldIds.filter((fieldId) => fieldId !== draggingFieldId) : orderedFieldIds;
  const zoneFieldIds = filteredOrder.filter((fieldId) => (detailZones[fieldId] ?? getDefaultDetailZone(fieldId)) === zone);

  if (zoneFieldIds.length === 0) {
    return zone === "main" ? 0 : filteredOrder.length;
  }

  if (zoneIndex <= 0) {
    return filteredOrder.indexOf(zoneFieldIds[0]);
  }

  if (zoneIndex >= zoneFieldIds.length) {
    const lastZoneFieldId = zoneFieldIds[zoneFieldIds.length - 1];
    return filteredOrder.indexOf(lastZoneFieldId) + 1;
  }

  return filteredOrder.indexOf(zoneFieldIds[zoneIndex]);
}

// ── Component ──────────────────────────────────────────────────────────────

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
  const allowedFieldIds = useMemo(() => new Set(allFields.map((f) => f.id)), [allFields]);

  const persistedVisibleFieldsByType = useMemo(
    () => sanitizeFieldMapByType(snapshot?.preferences.visibleFieldsByType ?? {}, allowedFieldIds),
    [allowedFieldIds, snapshot?.preferences.visibleFieldsByType]
  );
  const persistedDetailFieldsByType = useMemo(
    () => sanitizeFieldMapByType(snapshot?.preferences.detailVisibleFieldsByType ?? {}, allowedFieldIds),
    [allowedFieldIds, snapshot?.preferences.detailVisibleFieldsByType]
  );
  const persistedDetailZonesByType = useMemo(
    () =>
      sanitizeDetailZoneMapByType(
        ((settings.detailFieldZoneByType as Record<string, Record<string, DetailZone>> | undefined) ?? {}),
        allowedFieldIds
      ),
    [allowedFieldIds, settings.detailFieldZoneByType]
  );

  const [itemTypes, setItemTypes] = useState<ApiItemType[]>([]);
  const [customFields, setCustomFields] = useState<ApiCustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTypeSlug, setActiveTypeSlug] = useState("");
  const [layoutDraftsByTypeSlug, setLayoutDraftsByTypeSlug] = useState<Record<string, LayoutDraft>>({});
  const [detailZoneDraftsByTypeSlug, setDetailZoneDraftsByTypeSlug] = useState<Record<string, Record<string, DetailZone>>>({});
  const [savingLayout, setSavingLayout] = useState(false);
  const [layoutMessage, setLayoutMessage] = useState("");
  const [typeComposer, setTypeComposer] = useState<TypeDraft | null>(null);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [typeSaving, setTypeSaving] = useState(false);
  const [typeDeletingId, setTypeDeletingId] = useState<string | null>(null);
  const [fieldDraft, setFieldDraft] = useState<FieldDraft | null>(null);
  const [pendingFieldSetup, setPendingFieldSetup] = useState<PendingFieldSetup | null>(null);
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

  const customFieldById = useMemo(
    () => customFields.reduce<Record<string, ApiCustomField>>((acc, f) => { acc[f.id] = f; return acc; }, {}),
    [customFields]
  );

  const libraryFields = useMemo<FieldLibraryItem[]>(
    () =>
      allFields.map((field) => {
        const cf = customFieldById[field.id];
        const explicit = fieldCapabilitiesById[field.id]?.aiEnhance;
        const allowAiGeneration =
          typeof explicit === "boolean"
            ? explicit
            : field.capabilities?.aiEnhance === true || field.type === "text_ai" || readAllowAiGeneration(cf?.settings);
        return {
          ...field,
          optionsCount: cf?.options.length ?? field.options?.length ?? 0,
          required: cf?.required ?? false,
          allowAiGeneration
        };
      }),
    [allFields, customFieldById, fieldCapabilitiesById]
  );

  const fieldsById = useMemo(
    () => libraryFields.reduce<Record<string, FieldLibraryItem>>((acc, f) => { acc[f.id] = f; return acc; }, {}),
    [libraryFields]
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
  const activeDetailZones = activeType
    ? {
        ...Object.fromEntries(activeLayout.detail.map((fieldId) => [fieldId, getDefaultDetailZone(fieldId)])),
        ...(persistedDetailZonesByType[activeType.slug] ?? {}),
        ...(detailZoneDraftsByTypeSlug[activeType.slug] ?? {})
      }
    : {};

  const cardFields = activeLayout.card.map((id) => fieldsById[id]).filter((f): f is FieldLibraryItem => Boolean(f));
  const detailFields = activeLayout.detail.map((id) => fieldsById[id]).filter((f): f is FieldLibraryItem => Boolean(f));
  const detailMainFields = detailFields.filter((field) => activeDetailZones[field.id] === "main");
  const detailSideFields = detailFields.filter((field) => activeDetailZones[field.id] !== "main");

  const hasUnsavedLayout = Boolean(
    activeType &&
      (
        (layoutDraftsByTypeSlug[activeType.slug] &&
          (!areSameOrderedIds(activeLayout.card, getEffectiveLayout(activeType.slug).card) ||
            !areSameOrderedIds(activeLayout.detail, getEffectiveLayout(activeType.slug).detail))) ||
        (detailZoneDraftsByTypeSlug[activeType.slug] &&
          JSON.stringify(detailZoneDraftsByTypeSlug[activeType.slug]) !==
            JSON.stringify(persistedDetailZonesByType[activeType.slug] ?? {}))
      )
  );

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

  const handleDragStartField = (event: DragEvent<HTMLElement>, fieldId: string, origin: "library" | "card" | "detail") => {
    setDragPayload({ kind: "field", fieldId, origin });
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", fieldId);
  };

  const handleDragStartType = (event: DragEvent<HTMLElement>, type: CustomFieldType) => {
    setDragPayload({ kind: "type", type });
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", `type:${type}`);
  };

  const handleDragEnd = () => {
    setDragPayload(null);
    setDropTarget(null);
  };

  const applyDropAtIndex = useCallback(
    (scope: LayoutScope, index: number) => {
      if (!activeType || !dragPayload) return;

      if (dragPayload.kind === "type") {
        setFieldError("");
        setFieldDraft(null);
        setPendingFieldSetup({
          type: dragPayload.type,
          targetScope: scope,
          targetIndex: index,
          targetDetailZone: scope === "detail" ? "side" : undefined,
          name: "",
          required: false,
          allowAiGeneration: false,
          options: []
        });
        setDropTarget(null);
        return;
      }

      handleUpdateLayout(activeType.slug, moveFieldInLayout(activeLayout, dragPayload, scope, index, allowedFieldIds));
      setDropTarget(null);
    },
    [activeLayout, activeType, allowedFieldIds, dragPayload, handleUpdateLayout]
  );

  const applyDropAtDetailZoneIndex = useCallback(
    (zone: DetailZone, index: number) => {
      if (!activeType || !dragPayload) return;

      const nextDetailIndex = resolveDetailInsertIndex(
        activeLayout.detail,
        activeDetailZones,
        zone,
        index,
        dragPayload.kind === "field" ? dragPayload.fieldId : undefined
      );

      if (dragPayload.kind === "type") {
        setFieldError("");
        setFieldDraft(null);
        setPendingFieldSetup({
          type: dragPayload.type,
          targetScope: "detail",
          targetIndex: nextDetailIndex,
          targetDetailZone: zone,
          name: "",
          required: false,
          allowAiGeneration: false,
          options: []
        });
        setDropTarget(null);
        return;
      }

      const fieldId = dragPayload.fieldId;
      handleUpdateLayout(activeType.slug, moveFieldInLayout(activeLayout, dragPayload, "detail", nextDetailIndex, allowedFieldIds));
      handleUpdateDetailZones(activeType.slug, {
        ...activeDetailZones,
        [fieldId]: zone
      });
      setDropTarget(null);
    },
    [activeDetailZones, activeLayout, activeType, allowedFieldIds, dragPayload, handleUpdateDetailZones, handleUpdateLayout]
  );

  const handleDropIntoScope = (event: DragEvent<HTMLElement>, scope: LayoutScope) => {
    event.preventDefault();
    if (!dragPayload) return;

    const index =
      dropTarget?.scope === scope
        ? dropTarget.index
        : computeDropIndex(event, dragPayload.kind === "field" ? dragPayload.fieldId : null, scope);

    applyDropAtIndex(scope, index);
  };

  const makeDetailZoneDragOverHandler = (zone: DetailZone) => (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (!dragPayload) return;
    setDropTarget({
      scope: "detail",
      index: computeDropIndexForSelector(
        event,
        `[data-workitem-slot="detail"][data-detail-zone="${zone}"]`,
        dragPayload.kind === "field" ? dragPayload.fieldId : null
      )
    });
  };

  const makeDetailZoneDragLeaveHandler = (event: DragEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDropTarget((cur) => (cur?.scope === "detail" ? null : cur));
    }
  };

  const handleSaveLayout = async () => {
    if (!activeType || !snapshot) return;
    setSavingLayout(true);
    setLayoutMessage("");
    try {
      const nextDetailZones = sanitizeDetailZoneMapByType(
        {
          ...(persistedDetailZonesByType ?? {}),
          [activeType.slug]: Object.fromEntries(
            activeLayout.detail.map((fieldId) => [fieldId, activeDetailZones[fieldId] ?? getDefaultDetailZone(fieldId)])
          )
        },
        allowedFieldIds
      );

      await updatePreferences({
        visibleFieldsByType: sanitizeFieldMapByType(
          { ...(snapshot.preferences.visibleFieldsByType ?? {}), [activeType.slug]: activeLayout.card },
          allowedFieldIds
        ),
        detailVisibleFieldsByType: sanitizeFieldMapByType(
          { ...(snapshot.preferences.detailVisibleFieldsByType ?? {}), [activeType.slug]: activeLayout.detail },
          allowedFieldIds
        ),
        settings: {
          ...settings,
          cardFieldSchemaVersion: CARD_FIELDS_SCHEMA_VERSION,
          detailFieldZoneByType: nextDetailZones
        }
      });
      setLayoutDraftsByTypeSlug((cur) => { const n = { ...cur }; delete n[activeType.slug]; return n; });
      setDetailZoneDraftsByTypeSlug((cur) => { const n = { ...cur }; delete n[activeType.slug]; return n; });
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
  };

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
        settings: { allowAiGeneration: supportsAiGeneration(pendingFieldSetup.type) ? pendingFieldSetup.allowAiGeneration : false },
        options: supportsSelectableOptions(pendingFieldSetup.type) ? normalizedOptions : []
      });

      const [nextTypes, nextFields] = await Promise.all([fetchItemTypes(), fetchCustomFields()]);
      setItemTypes(nextTypes);
      setCustomFields(nextFields);

      const newField = [...nextFields]
        .filter((f) => f.type === pendingFieldSetup.type && f.name.trim().toLowerCase() === pendingFieldSetup.name.trim().toLowerCase())
        .sort((a, b) => (b.id > a.id ? 1 : -1))[0];

      if (newField) {
        const { targetScope: sc, targetIndex: idx, targetDetailZone } = pendingFieldSetup;
        setLayoutDraftsByTypeSlug((cur) => ({
          ...cur,
          [activeType.slug]: {
            card: sc === "card" ? addFieldIdToList(activeLayout.card, newField.id, idx) : [...activeLayout.card],
            detail: sc === "detail" ? addFieldIdToList(activeLayout.detail, newField.id, idx) : [...activeLayout.detail]
          }
        }));
        if (sc === "detail") {
          handleUpdateDetailZones(activeType.slug, {
            ...activeDetailZones,
            [newField.id]: targetDetailZone ?? "side"
          });
        }
      }
      setPendingFieldSetup(null);
    } finally {
      setFieldSaving(false);
    }
  };

  const handleSaveField = async () => {
    if (!fieldDraft?.name.trim()) return;
    const normalizedOptions = normalizeOptionInputs(fieldDraft.options);
    if (supportsSelectableOptions(fieldDraft.type) && normalizedOptions.length === 0) {
      setFieldError("Campos de selecao precisam de pelo menos uma opcao.");
      return;
    }
    setFieldSaving(true);
    setFieldError("");
    try {
      await updateCustomField(fieldDraft.id, {
        name: fieldDraft.name.trim(),
        type: fieldDraft.type,
        required: fieldDraft.required,
        settings: { allowAiGeneration: supportsAiGeneration(fieldDraft.type) ? fieldDraft.allowAiGeneration : false },
        options: supportsSelectableOptions(fieldDraft.type) ? normalizedOptions : []
      });
      await persistFieldCapabilities(fieldDraft.id, supportsAiGeneration(fieldDraft.type) && fieldDraft.allowAiGeneration);
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
      if (fieldDraft?.id === fieldId) setFieldDraft(null);
      await loadData();
    } finally {
      setFieldDeletingId(null);
    }
  };

  const isDraggingType = dragPayload?.kind === "type";
  const isDragging = dragPayload !== null;
  const activePendingTypeLabel = pendingFieldSetup
    ? (FIELD_TYPE_OPTIONS.find((o) => o.value === pendingFieldSetup.type)?.label ?? pendingFieldSetup.type)
    : null;
  const typeColor = activeType?.color || DEFAULT_TYPE_COLOR;
  const previewTypeId = activeType?.slug ?? boardConfig.taskTypes[0]?.id ?? "preview-type";
  const previewTypeLabel = activeType?.name ?? boardConfig.taskTypes.find((type) => type.id === previewTypeId)?.label ?? "Tipo";
  const previewTypeColor =
    activeType?.color ?? boardConfig.taskTypes.find((type) => type.id === previewTypeId)?.text ?? DEFAULT_TYPE_COLOR;
  const previewStatus = boardConfig.statuses[0] ?? { id: "preview-status", label: "Em validacao", dot: DEFAULT_TYPE_COLOR };

  const previewTaskTypes = useMemo(() => {
    const previewTypeMeta = {
      id: previewTypeId,
      label: previewTypeLabel,
      background: `${previewTypeColor}1a`,
      border: `${previewTypeColor}66`,
      text: previewTypeColor
    };

    if (boardConfig.taskTypes.some((type) => type.id === previewTypeId)) {
      return boardConfig.taskTypes.map((type) => (type.id === previewTypeId ? { ...type, ...previewTypeMeta } : type));
    }

    return [...boardConfig.taskTypes, previewTypeMeta];
  }, [boardConfig.taskTypes, previewTypeColor, previewTypeId, previewTypeLabel]);

  const previewBoardConfig = useMemo<BoardConfig>(
    () => ({
      ...boardConfig,
      taskTypes: previewTaskTypes,
      fieldDefinitions: allFields.map(({ id, label, type, options, source, capabilities }) => ({
        id,
        label,
        type,
        options,
        source,
        capabilities
      })),
      cardLayout: {
        ...boardConfig.cardLayout,
        visibleFieldIds: activeLayout.card,
        visibleFieldIdsByType: {
          ...(boardConfig.cardLayout.visibleFieldIdsByType ?? {}),
          ...(activeType ? { [activeType.slug]: activeLayout.card } : {})
        }
      }
    }),
    [activeLayout.card, activeType, allFields, boardConfig, previewTaskTypes]
  );

  const previewTask = useMemo<Task>(
    () => ({
      id: "preview-work-item",
      title: PREVIEW_CARD_TITLE,
      text: PREVIEW_CARD_DESCRIPTION,
      type: previewTypeId,
      status: previewStatus.id,
      position: 0,
      priority: 2,
      tags: PREVIEW_CARD_TAGS,
      assignee: PREVIEW_ASSIGNEE.id,
      checklist: {
        items: [
          { id: "check-1", label: "Mapear friccoes do fluxo", done: true },
          { id: "check-2", label: "Revisar copy dos CTAs", done: true },
          { id: "check-3", label: "Ajustar validacoes do formulario", done: true },
          { id: "check-4", label: "Validar eventos de conversao", done: false },
          { id: "check-5", label: "Publicar experimento", done: false }
        ]
      },
      due: PREVIEW_DUE_DATE,
      plannedStartAt: null,
      plannedEndAt: null,
      linkedDocuments: [],
      customFields: libraryFields.reduce<Record<string, TaskCustomFieldValue>>((acc, field) => {
        if (!isSystemCardFieldId(field.id)) {
          acc[field.id] = getPreviewCustomFieldValue(field);
        }
        return acc;
      }, {})
    }),
    [libraryFields, previewStatus.id, previewTypeId]
  );

  const cardPreviewFieldIds = useMemo(() => activeLayout.card, [activeLayout.card]);

  const handleDropIntoCardPreview = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    applyDropAtIndex("card", activeLayout.card.length);
  };

  const handlePreviewCardDragStart = (event: DragEvent<HTMLElement>, _taskId: string) => {
    event.preventDefault();
  };

  const makeDragOverHandler = (scope: LayoutScope) => (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (!dragPayload) return;
    setDropTarget({
      scope,
      index: computeDropIndex(event, dragPayload.kind === "field" ? dragPayload.fieldId : null, scope)
    });
  };

  const makeDragLeaveHandler = (scope: LayoutScope) => (event: DragEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDropTarget((cur) => (cur?.scope === scope ? null : cur));
    }
  };

  const openFieldEdit = (fieldId: string) => {
    const raw = customFieldById[fieldId];
    if (!raw) return;
    setFieldError("");
    setPendingFieldSetup(null);
    setFieldDraft({
      id: raw.id,
      name: raw.name,
      type: raw.type as CustomFieldType,
      required: raw.required,
      allowAiGeneration: readAllowAiGeneration(raw.settings),
      options: mapApiOptionsToDraft(raw.options)
    });
  };

  const renderCardPreviewSlot = ({
    fieldId,
    area,
    content
  }: {
    fieldId: string;
    area: "badge" | "title" | "description" | "summary" | "tags" | "custom-field" | "meta";
    content: ReactNode;
  }) => {
    const slotIndex = cardPreviewFieldIds.indexOf(fieldId);
    const isDropTarget = dropTarget?.scope === "card" && dropTarget?.index === slotIndex;

    return (
      <div
        key={`${fieldId}-${area}`}
        className={`workitem-editor-v2__card-preview-slot workitem-editor-v2__card-preview-slot--${area}${isDropTarget ? " is-drop-target" : ""}`}
        data-workitem-slot="card"
        data-field-id={fieldId}
        draggable
        onDragStart={(e) => handleDragStartField(e, fieldId, "card")}
        onDragEnd={handleDragEnd}
      >
        <div className="workitem-editor-v2__card-preview-slot-content">{content}</div>
        <div className="workitem-editor-v2__card-preview-slot-actions" draggable={false}>
          {customFieldById[fieldId] ? (
            <button
              type="button"
              className="workitem-editor-v2__field-action-edit"
              draggable={false}
              onClick={(e) => { e.stopPropagation(); openFieldEdit(fieldId); }}
              title="Editar campo"
            >
              E
            </button>
          ) : null}
          <button
            type="button"
            className="workitem-editor-v2__field-action-remove"
            draggable={false}
            onClick={(e) => {
              e.stopPropagation();
              activeType && handleUpdateLayout(activeType.slug, removeFieldFromScope(activeLayout, "card", fieldId));
            }}
            title="Remover do card"
          >
            x
          </button>
        </div>
      </div>
    );
  };

  const renderDetailFieldCard = (field: FieldLibraryItem, zone: DetailZone, index: number) => {
    const isDropLineVisible = dropTarget?.scope === "detail" && dropTarget.index === index;
    return (
      <div key={`detail-${zone}-${field.id}`} className="workitem-editor-v2__detail-preview-slot-wrap">
        {isDropLineVisible ? <div className="workitem-editor-v2__drop-line" /> : null}
        <div
          className={`workitem-editor-v2__detail-preview-card${zone === "side" ? " is-side" : ""}`}
          data-workitem-slot="detail"
          data-detail-zone={zone}
          data-field-id={field.id}
          draggable
          onDragStart={(e) => handleDragStartField(e, field.id, "detail")}
          onDragEnd={handleDragEnd}
        >
          <div className="workitem-editor-v2__detail-preview-card-head">
            <div>
              <strong>{field.label}</strong>
              <span>{getTaskFieldTypeLabel(field)}</span>
            </div>
            <div className="workitem-editor-v2__card-field-actions" draggable={false}>
              {customFieldById[field.id] ? (
                <button
                  type="button"
                  className="workitem-editor-v2__field-action-edit"
                  draggable={false}
                  onClick={(e) => { e.stopPropagation(); openFieldEdit(field.id); }}
                  title="Editar campo"
                >
                  E
                </button>
              ) : null}
              <button
                type="button"
                className="workitem-editor-v2__field-action-remove"
                draggable={false}
                onClick={(e) => {
                  e.stopPropagation();
                  activeType && handleUpdateLayout(activeType.slug, removeFieldFromScope(activeLayout, "detail", field.id));
                }}
                title="Remover do formulário"
              >
                x
              </button>
            </div>
          </div>
          <div className="workitem-editor-v2__detail-preview-card-body">
            {field.id === "sys:description" ? (
              <p className="workitem-editor-v2__detail-preview-copy">{PREVIEW_CARD_DESCRIPTION}</p>
            ) : field.id === "sys:tags" ? (
              <div className="workitem-editor-v2__detail-preview-pills">
                {PREVIEW_CARD_TAGS.map((tag) => (
                  <span key={tag} className="workitem-editor-v2__detail-preview-pill">{tag}</span>
                ))}
              </div>
            ) : field.id === "sys:priority" ? (
              <div className="workitem-editor-v2__detail-preview-priorities">
                {["Urgente", "Alta", "Media", "Baixa"].map((label) => (
                  <button key={label} type="button" className={`workitem-editor-v2__detail-priority-pill${label === "Media" ? " is-active" : ""}`}>
                    {label}
                  </button>
                ))}
              </div>
            ) : field.id === "sys:checklist" ? (
              <div className="workitem-editor-v2__detail-preview-checklist">
                <span className="workitem-editor-v2__detail-preview-progress">3 de 5 concluidos</span>
                <div className="workitem-editor-v2__detail-preview-progressbar"><i /></div>
              </div>
            ) : (
              <div className="workitem-editor-v2__detail-preview-input">
                {getPreviewValue(field)}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="workitem-editor-v2">
      {/* ── Topbar ─────────────────────────────────────────────────────── */}
      <div className="workitem-editor-v2__topbar">
        <div className="workitem-editor-v2__tabs">
          {activeItemTypes.map((type) => (
            <div key={type.id} className={`workitem-editor-v2__tab${activeType?.slug === type.slug ? " is-active" : ""}`}>
              <button type="button" onClick={() => setActiveTypeSlug(type.slug)}>
                <i style={{ background: type.color || DEFAULT_TYPE_COLOR }} />
                {type.name}
              </button>
            </div>
          ))}
          <button
            type="button"
            className="workitem-editor-v2__add-tab"
            onClick={() => { setEditingTypeId(null); setTypeComposer({ name: "", color: DEFAULT_TYPE_COLOR }); }}
          >
            Novo tipo
          </button>
        </div>

        <div className="workitem-editor-v2__save-area">
          <div className="workitem-editor-v2__summary">
            <span><strong>{activeItemTypes.length}</strong> tipos</span>
            <span><strong>{customFields.filter((f) => f.isActive !== false).length}</strong> campos</span>
            <span><strong>{cardFields.length}</strong> no card</span>
            <span><strong>{detailFields.length}</strong> no expandido</span>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={handleDiscardLayout} disabled={!hasUnsavedLayout || savingLayout}>
            Descartar
          </Button>
          <Button type="button" size="sm" onClick={() => void handleSaveLayout()} disabled={!hasUnsavedLayout || savingLayout}>
            {savingLayout ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      {/* ── Main area ──────────────────────────────────────────────────── */}
      <div className="workitem-editor-v2__body">
        {loading ? (
          <div className="workitem-editor-v2__loading">
            <div className="workitem-editor-v2__skeleton" style={{ flex: "0 0 280px" }} />
            <div className="workitem-editor-v2__skeleton" style={{ flex: 1 }} />
          </div>
        ) : (
          <>
            {/* ── Library ─────────────────────────────────────────────── */}
            <aside className="workitem-editor-v2__library">
              <div className="workitem-editor-v2__library-head">
                <span>Biblioteca</span>
                <h2>Campos disponíveis</h2>
              </div>

              <div className="workitem-editor-v2__lib-scroll">
                <div className="workitem-editor-v2__lib-section">
                  <p className="workitem-editor-v2__lib-section-title">Campos do item</p>
                  <p className="workitem-editor-v2__lib-hint">
                    Tudo aqui e tratado como campo do tipo. Se nao estiver no editor, nao entra no layout.
                  </p>
                  <div className="workitem-editor-v2__sys-fields">
                    {libraryFields.map((field) => (
                      <div
                        key={field.id}
                        className="workitem-editor-v2__sys-chip"
                        draggable
                        onDragStart={(e) => handleDragStartField(e, field.id, "library")}
                        onDragEnd={handleDragEnd}
                      >
                        <span>{field.label}</span>
                        <small>{field.source === "system" ? getTaskFieldTypeLabel(field) : `${getTaskFieldTypeLabel(field)} · editavel`}</small>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="workitem-editor-v2__lib-section">
                  <p className="workitem-editor-v2__lib-section-title">Novo campo</p>
                  <p className="workitem-editor-v2__lib-hint">
                    Arraste para o card ou formulário para criar e configurar.
                  </p>
                  <div className="workitem-editor-v2__type-tiles">
                    {FIELD_TYPE_OPTIONS.map((opt) => (
                      <div
                        key={opt.value}
                        className="workitem-editor-v2__type-tile"
                        draggable
                        onDragStart={(e) => handleDragStartType(e, opt.value)}
                        onDragEnd={handleDragEnd}
                      >
                        <strong>{opt.label}</strong>
                        <span>{opt.caption}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </aside>

            {/* ── Previews (stacked) ──────────────────────────────────── */}
            <div className="workitem-editor-v2__previews">

              {/* Card editor */}
              <section className="workitem-editor-v2__panel">
                <div className="workitem-editor-v2__panel-head">
                  <div>
                    <span>Card do board</span>
                    <h2>Como aparece no kanban</h2>
                  </div>
                  <small>{cardFields.length} campo{cardFields.length !== 1 ? "s" : ""}</small>
                </div>

                <div className="workitem-editor-v2__card-stage">
                  <div
                    className={`workitem-editor-v2__card-preview-drop${isDragging ? " is-drop-ready" : ""}${isDraggingType ? " is-type-target" : ""}`}
                    onDragOver={makeDragOverHandler("card")}
                    onDragLeave={makeDragLeaveHandler("card")}
                    onDrop={(e) => { e.preventDefault(); handleDropIntoScope(e, "card"); }}
                  >
                    <TaskCard
                      task={previewTask}
                      boardConfig={previewBoardConfig}
                      creatorName={PREVIEW_CREATED_BY}
                      assigneeName={PREVIEW_ASSIGNEE.name}
                      statusLabel={previewStatus.label}
                      assigneeSlot={<MemberAvatar member={PREVIEW_ASSIGNEE} />}
                      draggable={false}
                      fieldSlotRenderer={renderCardPreviewSlot}
                      onDragStart={handlePreviewCardDragStart}
                      onDragEnd={handleDragEnd}
                    />
                    {dropTarget?.scope === "card" && dropTarget?.index === cardPreviewFieldIds.length ? (
                      <div className="workitem-editor-v2__card-preview-drop-line" />
                    ) : null}
                    <div className={`workitem-editor-v2__card-preview-hint${isDragging ? " is-visible" : ""}`}>
                      {isDraggingType
                        ? "Solte sobre o preview para criar o campo no card."
                        : "Arraste da biblioteca e edite os campos direto no proprio preview."}
                    </div>
                  </div>

                  {false ? <div className="workitem-editor-v2__card-tools">
                    <div className="workitem-editor-v2__card-tools-head">
                      <strong>Campos ativos no card</strong>
                      <p>Reordene por aqui sem distorcer a aparencia real do card no board.</p>
                    </div>

                    <div
                      className={`workitem-editor-v2__card-fields${isDragging ? " is-drop-ready" : ""}${isDraggingType ? " is-type-target" : ""}`}
                      onDragOver={makeDragOverHandler("card")}
                      onDragLeave={makeDragLeaveHandler("card")}
                      onDrop={(e) => { e.preventDefault(); handleDropIntoScope(e, "card"); }}
                    >
                      {cardFields.length === 0 ? (
                        <p className="workitem-editor-v2__zone-empty">
                          Arraste campos da biblioteca ou solte direto no preview do card.
                        </p>
                      ) : (
                        cardFields.map((field, index) => (
                          <div key={`card-f-${field.id}`} className="workitem-editor-v2__card-slot-wrap">
                            {dropTarget?.scope === "card" && dropTarget?.index === index ? (
                              <div className="workitem-editor-v2__drop-line" />
                            ) : null}
                            <div
                              className="workitem-editor-v2__card-field"
                              data-workitem-slot="card"
                              data-field-id={field.id}
                              draggable
                              onDragStart={(e) => handleDragStartField(e, field.id, "card")}
                              onDragEnd={handleDragEnd}
                            >
                              <div className="workitem-editor-v2__card-field-info">
                                <span className="workitem-editor-v2__card-field-label">{field.label}</span>
                                <span className="workitem-editor-v2__card-field-value">{getPreviewValue(field)}</span>
                              </div>
                              <div className="workitem-editor-v2__card-field-actions" draggable={false}>
                                {!isSystemCardFieldId(field.id) ? (
                                  <button
                                    type="button"
                                    className="workitem-editor-v2__field-action-edit"
                                    draggable={false}
                                    onClick={(e) => { e.stopPropagation(); openFieldEdit(field.id); }}
                                    title="Editar campo"
                                  >
                                    âœŽ
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="workitem-editor-v2__field-action-remove"
                                  draggable={false}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    activeType && handleUpdateLayout(activeType.slug, removeFieldFromScope(activeLayout, "card", field.id));
                                  }}
                                  title="Remover do card"
                                >
                                  Ã—
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                      {dropTarget?.scope === "card" && dropTarget?.index === cardFields.length ? (
                        <div className="workitem-editor-v2__drop-line" />
                      ) : null}
                    </div>
                  </div> : null}
                </div>

                {false ? <div className="workitem-editor-v2__card-mock">
                  <div className="workitem-editor-v2__card-mock-accent" style={{ background: typeColor }} />
                  <div className="workitem-editor-v2__card-mock-body">
                    <div className="workitem-editor-v2__card-mock-meta">
                      <span className="workitem-editor-v2__card-mock-type" style={{ background: `${typeColor}22`, color: typeColor }}>
                        {activeType?.name ?? "Tipo"}
                      </span>
                      <span className="workitem-editor-v2__card-mock-status">Em validacao</span>
                    </div>
                    <p className="workitem-editor-v2__card-mock-title">Refinar experiencia do checkout</p>

                    {/* Drop zone — field chips directly in card */}
                    <div
                      className={`workitem-editor-v2__card-fields${isDragging ? " is-drop-ready" : ""}${isDraggingType ? " is-type-target" : ""}`}
                      onDragOver={makeDragOverHandler("card")}
                      onDragLeave={makeDragLeaveHandler("card")}
                      onDrop={(e) => { e.preventDefault(); handleDropIntoScope(e, "card"); }}
                    >
                      {cardFields.length === 0 ? (
                        <p className="workitem-editor-v2__zone-empty">
                          Arraste campos da biblioteca aqui
                        </p>
                      ) : (
                        cardFields.map((field, index) => (
                          <div key={`card-f-${field.id}`} className="workitem-editor-v2__card-slot-wrap">
                            {dropTarget?.scope === "card" && dropTarget?.index === index ? (
                              <div className="workitem-editor-v2__drop-line" />
                            ) : null}
                            <div
                              className="workitem-editor-v2__card-field"
                              data-workitem-slot="card"
                              data-field-id={field.id}
                              draggable
                              onDragStart={(e) => handleDragStartField(e, field.id, "card")}
                              onDragEnd={handleDragEnd}
                            >
                              <div className="workitem-editor-v2__card-field-info">
                                <span className="workitem-editor-v2__card-field-label">{field.label}</span>
                                <span className="workitem-editor-v2__card-field-value">{getPreviewValue(field)}</span>
                              </div>
                              <div className="workitem-editor-v2__card-field-actions" draggable={false}>
                                {!isSystemCardFieldId(field.id) ? (
                                  <button
                                    type="button"
                                    className="workitem-editor-v2__field-action-edit"
                                    draggable={false}
                                    onClick={(e) => { e.stopPropagation(); openFieldEdit(field.id); }}
                                    title="Editar campo"
                                  >
                                    ✎
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="workitem-editor-v2__field-action-remove"
                                  draggable={false}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    activeType && handleUpdateLayout(activeType.slug, removeFieldFromScope(activeLayout, "card", field.id));
                                  }}
                                  title="Remover do card"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                      {dropTarget?.scope === "card" && dropTarget?.index === cardFields.length ? (
                        <div className="workitem-editor-v2__drop-line" />
                      ) : null}
                    </div>
                  </div>
                </div> : null}
              </section>

              {/* Detail editor */}
              <section className="workitem-editor-v2__panel">
                <div className="workitem-editor-v2__panel-head">
                  <div>
                    <span>Work item aberto</span>
                    <h2>Formulário expandido</h2>
                  </div>
                  <small>{detailFields.length} campo{detailFields.length !== 1 ? "s" : ""}</small>
                </div>

                <div className="workitem-editor-v2__detail-shell">
                  <div className="workitem-editor-v2__detail-topbar">
                    <div>
                      <span className="workitem-editor-v2__detail-eyebrow">Mesmo visual do item aberto</span>
                      <strong>{activeType?.name ?? "Tipo"}</strong>
                    </div>
                    <div className="workitem-editor-v2__detail-topbar-chips">
                      <span>Resumo</span>
                      <span>{previewStatus.label}</span>
                    </div>
                  </div>

                  <div className="workitem-editor-v2__detail-layout">
                    <div className="workitem-editor-v2__detail-column">
                      <section className="workitem-editor-v2__detail-hero-panel">
                        <div className="workitem-editor-v2__detail-hero-accent" style={{ background: typeColor }} />
                        <div className="workitem-editor-v2__detail-hero-copy">
                          <span>{activeType?.name ?? "Tipo"}</span>
                          <h3>{PREVIEW_CARD_TITLE}</h3>
                          <p>{PREVIEW_CARD_DESCRIPTION}</p>
                        </div>
                      </section>

                      <div
                        className={`workitem-editor-v2__detail-zone${isDragging ? " is-drop-ready" : ""}${isDraggingType ? " is-type-target" : ""}`}
                        onDragOver={makeDetailZoneDragOverHandler("main")}
                        onDragLeave={makeDetailZoneDragLeaveHandler}
                        onDrop={(e) => {
                          e.preventDefault();
                          const index = computeDropIndexForSelector(
                            e,
                            '[data-workitem-slot="detail"][data-detail-zone="main"]',
                            dragPayload?.kind === "field" ? dragPayload.fieldId : null
                          );
                          applyDropAtDetailZoneIndex("main", index);
                        }}
                      >
                        <div className="workitem-editor-v2__detail-zone-head">
                          <span>Conteudo principal</span>
                          <strong>{detailMainFields.length} campo{detailMainFields.length !== 1 ? "s" : ""}</strong>
                        </div>

                        {detailMainFields.length === 0 ? (
                          <p className="workitem-editor-v2__zone-empty">Arraste campos para a coluna principal do item aberto.</p>
                        ) : (
                          detailMainFields.map((field, index) => renderDetailFieldCard(field, "main", index))
                        )}

                        {dropTarget?.scope === "detail" && dropTarget?.index === detailMainFields.length ? (
                          <div className="workitem-editor-v2__drop-line" />
                        ) : null}
                      </div>
                    </div>

                    <aside className="workitem-editor-v2__detail-sidebar">
                      <section className="workitem-editor-v2__detail-summary-panel">
                        <span className="workitem-editor-v2__detail-eyebrow">Resumo</span>
                        <div className="workitem-editor-v2__detail-preview-pills">
                          <span className="workitem-editor-v2__detail-preview-pill">Bug</span>
                          <span className="workitem-editor-v2__detail-preview-pill">{previewStatus.label}</span>
                          <span className="workitem-editor-v2__detail-preview-pill">13 campos</span>
                        </div>
                      </section>

                      <div
                        className={`workitem-editor-v2__detail-zone is-side${isDragging ? " is-drop-ready" : ""}${isDraggingType ? " is-type-target" : ""}`}
                        onDragOver={makeDetailZoneDragOverHandler("side")}
                        onDragLeave={makeDetailZoneDragLeaveHandler}
                        onDrop={(e) => {
                          e.preventDefault();
                          const index = computeDropIndexForSelector(
                            e,
                            '[data-workitem-slot="detail"][data-detail-zone="side"]',
                            dragPayload?.kind === "field" ? dragPayload.fieldId : null
                          );
                          applyDropAtDetailZoneIndex("side", index);
                        }}
                      >
                        <div className="workitem-editor-v2__detail-zone-head">
                          <span>Barra lateral</span>
                          <strong>{detailSideFields.length} campo{detailSideFields.length !== 1 ? "s" : ""}</strong>
                        </div>

                        {detailSideFields.length === 0 ? (
                          <p className="workitem-editor-v2__zone-empty">Solte aqui os campos da lateral, como metadados e apoio.</p>
                        ) : (
                          detailSideFields.map((field, index) => renderDetailFieldCard(field, "side", index))
                        )}

                        {dropTarget?.scope === "detail" && dropTarget?.index === detailSideFields.length ? (
                          <div className="workitem-editor-v2__drop-line" />
                        ) : null}
                      </div>
                    </aside>
                  </div>

                  <div className={`workitem-editor-v2__detail-drop-hint${isDragging ? " is-visible" : ""}`}>
                    {isDraggingType
                      ? "Solte em qualquer lado do preview para criar e posicionar o campo."
                      : "Arraste os campos entre conteudo principal e barra lateral, igual ao card aberto."}
                  </div>
                </div>
              </section>

            </div>
          </>
        )}
      </div>

      {/* ── Bottom row ─────────────────────────────────────────────────── */}
      <div className="workitem-editor-v2__composer-row">
        {/* Type composer */}
        <section className="workitem-editor-v2__composer">
          <header>
            <span>Tipo ativo</span>
            <h3>{editingTypeId ? "Editar tipo" : typeComposer ? "Novo tipo" : (activeType?.name ?? "Sem tipo")}</h3>
          </header>

          {typeComposer ? (
            <>
              <FormField label="Nome">
                <TextInput
                  value={typeComposer.name}
                  placeholder="Ex: Growth, Operacao, Bugs..."
                  onChange={(e) => setTypeComposer({ ...typeComposer, name: e.target.value })}
                />
              </FormField>
              <FormField label="Cor">
                <div className="workitem-editor-v2__color-row">
                  <input type="color" value={typeComposer.color} onChange={(e) => setTypeComposer({ ...typeComposer, color: e.target.value })} />
                  <TextInput value={typeComposer.color} onChange={(e) => setTypeComposer({ ...typeComposer, color: e.target.value })} />
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
                <small>{cardFields.length} no card &bull; {detailFields.length} no expandido</small>
              </div>
              <div className="workitem-editor-v2__composer-actions">
                <Button type="button" size="sm" variant="outline"
                  onClick={() => { setEditingTypeId(activeType.id); setTypeComposer({ name: activeType.name, color: activeType.color || DEFAULT_TYPE_COLOR }); }}
                >
                  Editar
                </Button>
                <Button type="button" size="sm" variant="outline"
                  onClick={() => void handleDeleteType(activeType.id)}
                  disabled={typeDeletingId === activeType.id}
                >
                  {typeDeletingId === activeType.id ? "Removendo..." : "Remover"}
                </Button>
              </div>
            </div>
          ) : (
            <p className="workitem-editor-v2__empty">Crie o primeiro tipo para comecar.</p>
          )}
        </section>

        {/* Field config panel */}
        <section className="workitem-editor-v2__composer">
          {pendingFieldSetup ? (
            <>
              <header>
                <span>Novo campo — {activePendingTypeLabel}</span>
                <h3>Configurar campo</h3>
              </header>

              <FormField label="Label do campo">
                <TextInput
                  value={pendingFieldSetup.name}
                  placeholder="Ex: Titulo, Impacto esperado, Prazo..."
                  autoFocus
                  onChange={(e) => setPendingFieldSetup({ ...pendingFieldSetup, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !supportsSelectableOptions(pendingFieldSetup.type)) void handleConfirmFieldSetup();
                    if (e.key === "Escape") setPendingFieldSetup(null);
                  }}
                />
              </FormField>

              <div className="workitem-editor-v2__toggles">
                <label>
                  <input type="checkbox" checked={pendingFieldSetup.required}
                    onChange={(e) => setPendingFieldSetup({ ...pendingFieldSetup, required: e.target.checked })} />
                  Obrigatório
                </label>
                <label>
                  <input type="checkbox" checked={pendingFieldSetup.allowAiGeneration}
                    disabled={!supportsAiGeneration(pendingFieldSetup.type)}
                    onChange={(e) => setPendingFieldSetup({ ...pendingFieldSetup, allowAiGeneration: e.target.checked })} />
                  IA no campo
                </label>
              </div>

              {supportsSelectableOptions(pendingFieldSetup.type) ? (
                <div className="workitem-editor-v2__options">
                  <div className="workitem-editor-v2__options-head">
                    <strong>Opções</strong>
                    <button type="button"
                      onClick={() => setPendingFieldSetup({
                        ...pendingFieldSetup,
                        options: [...pendingFieldSetup.options, createEmptyOptionDraft(pendingFieldSetup.options.length + 1)]
                      })}>
                      Adicionar
                    </button>
                  </div>
                  {pendingFieldSetup.options.map((opt) => (
                    <div key={opt.id} className="workitem-editor-v2__option-row">
                      <TextInput value={opt.label} placeholder="Label"
                        onChange={(e) => setPendingFieldSetup({ ...pendingFieldSetup, options: pendingFieldSetup.options.map((o) => o.id === opt.id ? { ...o, label: e.target.value } : o) })} />
                      <TextInput value={opt.value} placeholder="valor_interno"
                        onChange={(e) => setPendingFieldSetup({ ...pendingFieldSetup, options: pendingFieldSetup.options.map((o) => o.id === opt.id ? { ...o, value: e.target.value } : o) })} />
                    </div>
                  ))}
                </div>
              ) : null}

              {fieldError ? <p className="workitem-editor-v2__error">{fieldError}</p> : null}

              <div className="workitem-editor-v2__composer-actions">
                <Button type="button" size="sm" onClick={() => void handleConfirmFieldSetup()} disabled={fieldSaving || !pendingFieldSetup.name.trim()}>
                  {fieldSaving ? "Criando..." : "Adicionar ao layout"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setPendingFieldSetup(null); setFieldError(""); }}>
                  Cancelar
                </Button>
              </div>
            </>
          ) : fieldDraft ? (
            <>
              <header>
                <span>Campo customizado</span>
                <h3>Editar campo</h3>
              </header>

              <FormField label="Label do campo">
                <TextInput value={fieldDraft.name} placeholder="Ex: Impacto esperado"
                  onChange={(e) => setFieldDraft({ ...fieldDraft, name: e.target.value })} />
              </FormField>

              <div className="workitem-editor-v2__field-types">
                {FIELD_TYPE_OPTIONS.map((opt) => (
                  <button key={opt.value} type="button"
                    className={`workitem-editor-v2__field-type${fieldDraft.type === opt.value ? " is-active" : ""}`}
                    onClick={() => setFieldDraft({ ...fieldDraft, type: opt.value, allowAiGeneration: supportsAiGeneration(opt.value) ? fieldDraft.allowAiGeneration : false })}>
                    <strong>{opt.label}</strong>
                    <span>{opt.caption}</span>
                  </button>
                ))}
              </div>

              <div className="workitem-editor-v2__toggles">
                <label>
                  <input type="checkbox" checked={fieldDraft.required}
                    onChange={(e) => setFieldDraft({ ...fieldDraft, required: e.target.checked })} />
                  Obrigatório
                </label>
                <label>
                  <input type="checkbox" checked={fieldDraft.allowAiGeneration}
                    disabled={!supportsAiGeneration(fieldDraft.type)}
                    onChange={(e) => setFieldDraft({ ...fieldDraft, allowAiGeneration: e.target.checked })} />
                  IA no campo
                </label>
              </div>

              {supportsSelectableOptions(fieldDraft.type) ? (
                <div className="workitem-editor-v2__options">
                  <div className="workitem-editor-v2__options-head">
                    <strong>Opções</strong>
                    <button type="button"
                      onClick={() => setFieldDraft({ ...fieldDraft, options: [...fieldDraft.options, createEmptyOptionDraft(fieldDraft.options.length + 1)] })}>
                      Adicionar
                    </button>
                  </div>
                  {fieldDraft.options.map((opt) => (
                    <div key={opt.id} className="workitem-editor-v2__option-row">
                      <TextInput value={opt.label} placeholder="Label"
                        onChange={(e) => setFieldDraft({ ...fieldDraft, options: fieldDraft.options.map((o) => o.id === opt.id ? { ...o, label: e.target.value } : o) })} />
                      <TextInput value={opt.value} placeholder="valor_interno"
                        onChange={(e) => setFieldDraft({ ...fieldDraft, options: fieldDraft.options.map((o) => o.id === opt.id ? { ...o, value: e.target.value } : o) })} />
                    </div>
                  ))}
                </div>
              ) : null}

              {fieldError ? <p className="workitem-editor-v2__error">{fieldError}</p> : null}

              <div className="workitem-editor-v2__composer-actions">
                <Button type="button" size="sm" onClick={() => void handleSaveField()} disabled={fieldSaving || !fieldDraft.name.trim()}>
                  {fieldSaving ? "Salvando..." : "Salvar campo"}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setFieldDraft(null); setFieldError(""); }}>
                  Cancelar
                </Button>
                <Button type="button" size="sm" variant="outline"
                  onClick={() => void handleDeleteField(fieldDraft.id)}
                  disabled={fieldDeletingId === fieldDraft.id}>
                  {fieldDeletingId === fieldDraft.id ? "Removendo..." : "Remover campo"}
                </Button>
              </div>
            </>
          ) : (
            <div className="workitem-editor-v2__field-idle">
              <header>
                <span>Campo</span>
                <h3>Nenhum campo selecionado</h3>
              </header>
              <p className="workitem-editor-v2__empty">
                Arraste um tipo da biblioteca para o card ou formulário para criar um novo campo.
                Clique em ✎ em qualquer campo customizado para editar suas propriedades.
              </p>
            </div>
          )}
        </section>
      </div>

      {layoutMessage ? <p className="workitem-editor-v2__footer-message">{layoutMessage}</p> : null}
    </div>
  );
}
