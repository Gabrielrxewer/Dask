import { mergeCardFieldDefinitions } from "@/entities/task";
import type { TaskFieldDefinition } from "@/entities/task";
import {
  getCreatableTaskFieldTypeOptions,
  getTaskFieldRegistryEntry,
  supportsManualOptionsForTaskFieldType
} from "@/entities/task";
import type { ApiCustomField, CustomFieldType } from "@/modules/workspace/model";
import type { DetailZone, EditorDropTarget, LayoutScope } from "@/pages/settings-page/model/work-item-layout-editor";

export const FIELD_TYPE_OPTIONS: Array<{
  value: CustomFieldType;
  label: string;
  caption: string;
}> = getCreatableTaskFieldTypeOptions().map((option) => ({
  ...option,
  value: option.value as CustomFieldType
}));


export interface FieldOptionDraft {
  id: string;
  label: string;
  value: string;
}

export type BillingSummaryAggregationMode = "sum" | "average" | "count" | "manual";
export type BillingSummaryDisplayFormat = "currency" | "number" | "compact";

export interface BillingSummaryDraftSettings {
  billingCurrency: string;
  billingSourceFields: string;
  billingAggregationMode: BillingSummaryAggregationMode;
  billingDisplayFormat: BillingSummaryDisplayFormat;
  billingReadOnly: boolean;
}

export const DEFAULT_BILLING_SUMMARY_DRAFT_SETTINGS: BillingSummaryDraftSettings = {
  billingCurrency: "BRL",
  billingSourceFields: "",
  billingAggregationMode: "sum",
  billingDisplayFormat: "currency",
  billingReadOnly: true
};

export interface TypeDraft {
  name: string;
  color: string;
}

export interface FieldDraft {
  id: string;
  runtimeFieldId: string;
  name: string;
  type: TaskFieldDefinition["type"];
  required: boolean;
  allowAiGeneration: boolean;
  options: FieldOptionDraft[];
  checklistIcon: string;
  checklistColor: string;
  billingCurrency: string;
  billingSourceFields: string;
  billingAggregationMode: BillingSummaryAggregationMode;
  billingDisplayFormat: BillingSummaryDisplayFormat;
  billingReadOnly: boolean;
}

export interface PendingFieldSetup {
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
  billingCurrency: string;
  billingSourceFields: string;
  billingAggregationMode: BillingSummaryAggregationMode;
  billingDisplayFormat: BillingSummaryDisplayFormat;
  billingReadOnly: boolean;
}

export type DragPayload =
  | { kind: "field"; fieldId: string; origin: "library" | "card" | "detail" }
  | { kind: "type"; type: CustomFieldType };

export interface FieldLibraryItem extends TaskFieldDefinition {
  optionsCount: number;
  required: boolean;
  allowAiGeneration: boolean;
  hasApiDefinition: boolean;
}

export type WorkItemEditorCanvasTab = "card" | "detail" | "field";

export function buildCustomFieldRuntimeIndex(customFields: ApiCustomField[]): Record<string, ApiCustomField> {
  return customFields.reduce<Record<string, ApiCustomField>>((acc, field) => {
    acc[field.id] = field;
    acc[field.slug] = field;
    if (field.definitionId) acc[field.definitionId] = field;
    return acc;
  }, {});
}

export function buildFieldLibraryItems(input: {
  fields: TaskFieldDefinition[];
  customFieldByRuntimeId: Record<string, ApiCustomField>;
  fieldCapabilitiesById: Record<string, { aiEnhance?: boolean }>;
}): FieldLibraryItem[] {
  return input.fields.map((field) => {
    const cf =
      input.customFieldByRuntimeId[field.id] ??
      (field.definitionId ? input.customFieldByRuntimeId[field.definitionId] : undefined);
    const explicit = input.fieldCapabilitiesById[field.id]?.aiEnhance;
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
  });
}

export function buildFieldsById(fields: FieldLibraryItem[]): Record<string, FieldLibraryItem> {
  return fields.reduce<Record<string, FieldLibraryItem>>((acc, field) => {
    acc[field.id] = field;
    return acc;
  }, {});
}

export function supportsAiGeneration(type: TaskFieldDefinition["type"]): boolean {
  return getTaskFieldRegistryEntry(type).supportsAi === true;
}

export function supportsSelectableOptions(type: TaskFieldDefinition["type"]): boolean {
  return supportsManualOptionsForTaskFieldType(type);
}

export function isCatalogSelectType(type: TaskFieldDefinition["type"] | CustomFieldType): boolean {
  return type === "catalog_select";
}

export function buildFieldSettings(input: {
  type: TaskFieldDefinition["type"] | CustomFieldType;
  name: string;
  allowAiGeneration: boolean;
  checklistIcon: string;
  checklistColor: string;
  billingCurrency?: string;
  billingSourceFields?: string;
  billingAggregationMode?: BillingSummaryAggregationMode;
  billingDisplayFormat?: BillingSummaryDisplayFormat;
  billingReadOnly?: boolean;
}): Record<string, unknown> {
  const billingSourceFields = (input.billingSourceFields ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    allowAiGeneration: supportsAiGeneration(input.type as TaskFieldDefinition["type"]) ? input.allowAiGeneration : false,
    ...(isCatalogSelectType(input.type) ? { entityType: "billing_catalog_item" } : {}),
    ...(input.type === "billing_summary"
      ? {
          publicType: "billing_summary",
          displayAs: "billing_summary",
          billingSummary: {
            currency: input.billingCurrency?.trim() || "BRL",
            sourceFields: billingSourceFields,
            aggregationMode: input.billingAggregationMode ?? "sum",
            displayFormat: input.billingDisplayFormat ?? "currency",
            readOnly: input.billingReadOnly ?? true
          }
        }
      : {}),
    ...(input.type === "checklist"
      ? {
          checklistDisplay: {
            icon: input.checklistIcon,
            color: input.checklistColor,
            label: input.name.trim()
          }
        }
      : {})
  };
}

export function readChecklistDisplaySettings(source: Record<string, unknown> | null | undefined): { icon: string; color: string } {
  const display =
    source && typeof source === "object" && !Array.isArray(source) &&
    source.checklistDisplay && typeof source.checklistDisplay === "object" && !Array.isArray(source.checklistDisplay)
      ? (source.checklistDisplay as Record<string, unknown>)
      : {};

  return {
    icon: typeof display.icon === "string" && display.icon.trim().length > 0 ? display.icon : "checklist",
    color: typeof display.color === "string" && /^#[0-9a-fA-F]{6}$/.test(display.color) ? display.color : "var(--brand-blue)"
  };
}

export function readBillingSummarySettings(source: Record<string, unknown> | null | undefined): BillingSummaryDraftSettings {
  const raw =
    source && typeof source === "object" && !Array.isArray(source) &&
    source.billingSummary && typeof source.billingSummary === "object" && !Array.isArray(source.billingSummary)
      ? (source.billingSummary as Record<string, unknown>)
      : {};
  const aggregation = raw.aggregationMode;
  const display = raw.displayFormat;
  const sourceFields = Array.isArray(raw.sourceFields)
    ? raw.sourceFields.filter((value): value is string => typeof value === "string")
    : [];

  return {
    billingCurrency: typeof raw.currency === "string" && raw.currency.trim() ? raw.currency : DEFAULT_BILLING_SUMMARY_DRAFT_SETTINGS.billingCurrency,
    billingSourceFields: sourceFields.join(", "),
    billingAggregationMode: aggregation === "average" || aggregation === "count" || aggregation === "manual" ? aggregation : DEFAULT_BILLING_SUMMARY_DRAFT_SETTINGS.billingAggregationMode,
    billingDisplayFormat: display === "number" || display === "compact" ? display : DEFAULT_BILLING_SUMMARY_DRAFT_SETTINGS.billingDisplayFormat,
    billingReadOnly: typeof raw.readOnly === "boolean" ? raw.readOnly : DEFAULT_BILLING_SUMMARY_DRAFT_SETTINGS.billingReadOnly
  };
}

export function readAllowAiGeneration(settings: ApiCustomField["settings"] | undefined): boolean {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return false;
  return settings.allowAiGeneration === true;
}

export function readFieldCapabilitiesById(settings?: Record<string, unknown>): Record<string, { aiEnhance?: boolean }> {
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

export function readFieldDefinitionOverridesById(
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

export function applyFieldDefinitionOverrides(
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
        ...(override.config && typeof override.config === "object" ? override.config : {}),
        ...(typeof override.allowAiGeneration === "boolean" ? { allowAiGeneration: override.allowAiGeneration } : {}),
        ...(override.checklistDisplay && typeof override.checklistDisplay === "object" ? { checklistDisplay: override.checklistDisplay } : {})
      }
    };
  });
}

export function sanitizeOptionValue(v: string): string {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeOptionInputs(options: FieldOptionDraft[]): Array<{ label: string; value: string }> {
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

export function mapApiOptionsToDraft(options: ApiCustomField["options"]): FieldOptionDraft[] {
  return (options ?? []).map((o, i) => ({ id: o.id || `opt-${i}`, label: o.label, value: o.value }));
}

export function createEmptyOptionDraft(index: number): FieldOptionDraft {
  return { id: `new-opt-${Date.now()}-${index}`, label: "", value: "" };
}

export function resolveApiFieldDraftType(raw: ApiCustomField): CustomFieldType {
  if (raw.settings?.entityType === "billing_catalog_item" || raw.config?.entityType === "billing_catalog_item") {
    return "catalog_select";
  }
  if (raw.settings?.displayAs === "billing_summary" || raw.config?.displayAs === "billing_summary") {
    return "billing_summary";
  }
  return raw.type as CustomFieldType;
}

export function buildFieldDraftFromApiField(raw: ApiCustomField, runtimeFieldId: string): FieldDraft {
  const checklistDisplay = readChecklistDisplaySettings((raw.settings as Record<string, unknown> | null | undefined) ?? undefined);
  const billingSettings = readBillingSummarySettings((raw.settings as Record<string, unknown> | null | undefined) ?? undefined);
  return {
    id: raw.id,
    runtimeFieldId,
    name: raw.name,
    type: resolveApiFieldDraftType(raw),
    required: raw.required,
    allowAiGeneration: readAllowAiGeneration(raw.settings),
    options: mapApiOptionsToDraft(raw.options),
    checklistIcon: checklistDisplay.icon,
    checklistColor: checklistDisplay.color,
    ...billingSettings
  };
}

export function buildFieldDraftFromDefinition(field: TaskFieldDefinition): FieldDraft {
  const checklistDisplay = readChecklistDisplaySettings((field.config as Record<string, unknown> | null | undefined) ?? undefined);
  const billingSettings = readBillingSummarySettings((field.config as Record<string, unknown> | null | undefined) ?? undefined);
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
    checklistColor: checklistDisplay.color,
    ...billingSettings
  };
}


export function buildMergedFieldDefinitions(
  fieldDefinitions: TaskFieldDefinition[],
  settings?: Record<string, unknown>
): TaskFieldDefinition[] {
  return applyFieldDefinitionOverrides(mergeCardFieldDefinitions(fieldDefinitions), settings);
}
