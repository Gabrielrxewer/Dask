import {
  getTaskFieldTypeLabel,
  readTaskFieldStorage,
  resolveTaskFieldCardArea,
  resolveTaskFieldDetailZone
} from "@/entities/task";
import type { TaskCardSlotArea, TaskFieldCardArea, TaskFieldDefinition } from "@/entities/task";
import type { DetailZone, LayoutDraft, LayoutScope } from "@/pages/settings-page/model/work-item-layout-editor";
import type { FieldLibraryItem, PendingFieldSetup } from "./work-item-editor-field-model";

export const DEFAULT_TYPE_COLOR = "var(--brand-blue)";

export const CARD_SLOT_AREA_META: Array<{ area: TaskCardSlotArea; label: string }> = [
  { area: "badge", label: "Topo" },
  { area: "title", label: "Titulo" },
  { area: "description", label: "Resumo" },
  { area: "summary", label: "Meta principal" },
  { area: "tags", label: "Tag principal" },
  { area: "custom-field", label: "Apoio" },
  { area: "meta", label: "Base" }
];

export const CARD_SLOT_AREA_LABELS = Object.fromEntries(
  CARD_SLOT_AREA_META.map(({ area, label }) => [area, label])
) as Record<TaskCardSlotArea, string>;

export function resolveLayoutFields(layout: LayoutDraft, fieldsById: Record<string, FieldLibraryItem>) {
  const cardFields = layout.card.map((id) => fieldsById[id]).filter((field): field is FieldLibraryItem => Boolean(field));
  const detailFields = layout.detail.map((id) => fieldsById[id]).filter((field): field is FieldLibraryItem => Boolean(field));

  return {
    cardFields,
    detailFields
  };
}

export function filterLibraryFields(fields: FieldLibraryItem[], search: string): FieldLibraryItem[] {
  if (!search.trim()) return fields;
  const query = search.trim().toLowerCase();
  return fields.filter((field) => {
    return field.label.toLowerCase().includes(query) || getTaskFieldTypeLabel(field).toLowerCase().includes(query);
  });
}

export function groupLibraryFieldsByUsage(input: {
  fields: FieldLibraryItem[];
  cardFieldSet: Set<string>;
  detailFieldSet: Set<string>;
}) {
  const { fields, cardFieldSet, detailFieldSet } = input;

  return {
    inBoth: fields.filter((field) => cardFieldSet.has(field.id) && detailFieldSet.has(field.id)),
    inCardOnly: fields.filter((field) => cardFieldSet.has(field.id) && !detailFieldSet.has(field.id)),
    inDetailOnly: fields.filter((field) => !cardFieldSet.has(field.id) && detailFieldSet.has(field.id)),
    unused: fields.filter((field) => !cardFieldSet.has(field.id) && !detailFieldSet.has(field.id))
  };
}

export function hasUnsavedWorkItemLayout(input: {
  activeTypeSlug: string | null | undefined;
  activeLayout: LayoutDraft;
  persistedLayout: LayoutDraft;
  layoutDraftsByTypeSlug: Record<string, LayoutDraft>;
  detailZoneDraftsByTypeSlug: Record<string, Record<string, DetailZone>>;
  persistedDetailZonesByType: Record<string, Record<string, DetailZone>>;
  cardAreaDraftsByTypeSlug: Record<string, Record<string, TaskFieldCardArea>>;
}): boolean {
  const typeSlug = input.activeTypeSlug;
  if (!typeSlug) return false;

  return Boolean(
    (input.layoutDraftsByTypeSlug[typeSlug] &&
      (!areSameOrderedIds(input.activeLayout.card, input.persistedLayout.card) ||
        !areSameOrderedIds(input.activeLayout.detail, input.persistedLayout.detail))) ||
      (input.detailZoneDraftsByTypeSlug[typeSlug] &&
        JSON.stringify(input.detailZoneDraftsByTypeSlug[typeSlug]) !==
          JSON.stringify(input.persistedDetailZonesByType[typeSlug] ?? {})) ||
      (input.cardAreaDraftsByTypeSlug[typeSlug] && Object.keys(input.cardAreaDraftsByTypeSlug[typeSlug]).length > 0)
  );
}

export function sanitizeFieldIds(values: string[], allowedFieldIds?: Set<string>): string[] {
  return Array.from(
    new Set(
      values
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter((v) => v.length > 0 && (!allowedFieldIds || allowedFieldIds.has(v)))
    )
  );
}

export function areSameOrderedIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function resolvePendingFieldTargetLabel(
  pendingFieldSetup: PendingFieldSetup | null,
  fieldsById: Record<string, FieldLibraryItem>
): string {
  if (!pendingFieldSetup) {
    return "";
  }

  const target = pendingFieldSetup.dropTarget;
  if (!target) {
    if (pendingFieldSetup.targetScope === "card") {
      return "Card do board";
    }
    return `Formulario Ã¢â‚¬â€ ${pendingFieldSetup.targetDetailZone === "main" ? "Coluna principal" : "Barra lateral"}`;
  }

  if (target.surface === "card") {
    if (target.kind === "replace-field") {
      return `Card do board Ã¢â‚¬â€ substitui ${fieldsById[target.targetFieldId]?.label ?? "campo"}`;
    }
    return `Card do board Ã¢â‚¬â€ ${CARD_SLOT_AREA_LABELS[target.area]}`;
  }

  const zoneLabel = target.zone === "main" ? "Coluna principal" : "Barra lateral";
  if (target.kind === "replace-field") {
    return `Formulario Ã¢â‚¬â€ ${zoneLabel} Ã¢â‚¬â€ substitui ${fieldsById[target.targetFieldId]?.label ?? "campo"}`;
  }

  return `Formulario Ã¢â‚¬â€ ${zoneLabel}`;
}

export function removeFieldFromScope(draft: LayoutDraft, scope: LayoutScope, fieldId: string): LayoutDraft {
  return scope === "card"
    ? { ...draft, card: draft.card.filter((id) => id !== fieldId) }
    : { ...draft, detail: draft.detail.filter((id) => id !== fieldId) };
}

export function addFieldIdToList(ids: string[], fieldId: string, index: number): string[] {
  const filtered = ids.filter((id) => id !== fieldId);
  filtered.splice(Math.max(0, Math.min(index, filtered.length)), 0, fieldId);
  return Array.from(new Set(filtered));
}

export function getDefaultDetailZone(field: TaskFieldDefinition | undefined): DetailZone {
  return field ? resolveTaskFieldDetailZone(field) : "side";
}

export function resolveDetailPreviewLayoutClass(field: TaskFieldDefinition, zone: DetailZone) {
  const storage = readTaskFieldStorage(field);
  const shouldSpan =
    zone === "main" &&
    (field.type === "long_text" ||
      field.type === "checklist" ||
      field.type === "schedule" ||
      (storage?.kind === "item_property" && (storage.property === "title" || storage.property === "description")));

  return shouldSpan ? "is-wide" : "is-compact";
}

export function resolveFallbackCardArea(field: TaskFieldDefinition | undefined): TaskFieldCardArea {
  return field ? resolveTaskFieldCardArea(field) : "custom-field";
}
