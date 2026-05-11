import type { WorkItemPublicField, WorkItemLayoutFieldRef } from "@/entities/work-item-schema";

export type WorkItemFormLayoutZone = "main" | "side";
export type WorkItemFormFieldSpan = "compact" | "wide";

export interface WorkItemFormFieldLayout {
  zone: WorkItemFormLayoutZone;
  span: WorkItemFormFieldSpan;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRecordValue(source: unknown, key: string): unknown {
  return isRecord(source) ? source[key] : undefined;
}

function normalizeZone(value: unknown): WorkItemFormLayoutZone | null {
  return value === "main" || value === "side" ? value : null;
}

function normalizeSpan(value: unknown): WorkItemFormFieldSpan | null {
  if (value === "wide" || value === "full" || value === "full-width" || value === 2 || value === "2") {
    return "wide";
  }

  if (value === "compact" || value === "half" || value === "half-width" || value === 1 || value === "1") {
    return "compact";
  }

  return null;
}

function getLayoutZone(
  field: WorkItemPublicField,
  layoutRef?: WorkItemLayoutFieldRef,
  fallbackZone: WorkItemFormLayoutZone = "side"
): WorkItemFormLayoutZone {
  return (
    normalizeZone(layoutRef?.section) ??
    normalizeZone(readRecordValue(layoutRef?.display, "detailZone")) ??
    normalizeZone(readRecordValue(field.display, "detailZone")) ??
    normalizeZone(readRecordValue(field.metadata, "detailSection")) ??
    fallbackZone
  );
}

function getExplicitSpan(
  field: WorkItemPublicField,
  layoutRef?: WorkItemLayoutFieldRef
): WorkItemFormFieldSpan | null {
  const layoutDisplay = layoutRef?.display;
  const fieldDisplay = field.display;
  const metadata = field.metadata;

  return (
    normalizeSpan(readRecordValue(layoutDisplay, "formSpan")) ??
    normalizeSpan(readRecordValue(layoutDisplay, "layoutSpan")) ??
    normalizeSpan(readRecordValue(layoutDisplay, "span")) ??
    normalizeSpan(readRecordValue(layoutDisplay, "width")) ??
    normalizeSpan(readRecordValue(fieldDisplay, "formSpan")) ??
    normalizeSpan(readRecordValue(fieldDisplay, "layoutSpan")) ??
    normalizeSpan(readRecordValue(fieldDisplay, "span")) ??
    normalizeSpan(readRecordValue(fieldDisplay, "width")) ??
    normalizeSpan(readRecordValue(metadata, "formSpan")) ??
    normalizeSpan(readRecordValue(metadata, "layoutSpan")) ??
    normalizeSpan(readRecordValue(metadata, "span")) ??
    normalizeSpan(readRecordValue(metadata, "width"))
  );
}

function isPrimaryTextProperty(field: WorkItemPublicField, layoutRef?: WorkItemLayoutFieldRef): boolean {
  const storage = readRecordValue(field.metadata, "storage");
  const property = readRecordValue(storage, "property");
  const cardArea =
    readRecordValue(layoutRef?.display, "cardArea") ??
    readRecordValue(field.display, "cardArea") ??
    readRecordValue(field.metadata, "cardArea");

  return (
    property === "title" ||
    property === "description" ||
    cardArea === "title" ||
    cardArea === "description" ||
    field.key === "title" ||
    field.key === "description" ||
    field.key === "sys_title" ||
    field.key === "sys_description"
  );
}

function shouldUseWideSpan(
  field: WorkItemPublicField,
  zone: WorkItemFormLayoutZone,
  layoutRef?: WorkItemLayoutFieldRef
): boolean {
  if (zone !== "main") {
    return false;
  }

  return (
    field.type === "textarea" ||
    field.type === "long_text" ||
    (field.type as string) === "schedule" ||
    field.type === "checklist" ||
    isPrimaryTextProperty(field, layoutRef)
  );
}

export function resolveWorkItemFormFieldLayout(
  field: WorkItemPublicField,
  layoutRef?: WorkItemLayoutFieldRef,
  fallbackZone?: WorkItemFormLayoutZone
): WorkItemFormFieldLayout {
  const zone = getLayoutZone(field, layoutRef, fallbackZone);
  const span = getExplicitSpan(field, layoutRef) ?? (shouldUseWideSpan(field, zone, layoutRef) ? "wide" : "compact");

  return { zone, span };
}
