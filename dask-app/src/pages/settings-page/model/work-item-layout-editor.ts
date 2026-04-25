import type { TaskFieldCardArea } from "@/entities/task";

export type LayoutScope = "card" | "detail";
export type DetailZone = "main" | "side";
export type DragFieldOrigin = "library" | "card" | "detail";

export interface LayoutDraft {
  card: string[];
  detail: string[];
}

export interface LayoutFieldDragPayload {
  fieldId: string;
  origin: DragFieldOrigin;
}

export type EditorDropTarget =
  | {
      surface: "card";
      kind: "replace-field";
      targetFieldId: string;
      area: TaskFieldCardArea;
    }
  | {
      surface: "card";
      kind: "empty-slot";
      area: TaskFieldCardArea;
      index: number;
    }
  | {
      surface: "detail";
      kind: "replace-field";
      targetFieldId: string;
      zone: DetailZone;
    }
  | {
      surface: "detail";
      kind: "insert";
      zone: DetailZone;
      index: number;
    };

export interface ApplyFieldDropResult {
  layout: LayoutDraft;
  cardAreasByFieldId: Record<string, TaskFieldCardArea>;
  detailZonesByFieldId: Record<string, DetailZone>;
  replacedFieldId: string | null;
}

const CARD_AREA_ORDER: TaskFieldCardArea[] = [
  "badge",
  "title",
  "description",
  "summary",
  "tags",
  "custom-field",
  "meta"
];

function uniqueFieldIds(values: string[]): string[] {
  return Array.from(
    new Set(values.filter((value): value is string => typeof value === "string" && value.trim().length > 0))
  );
}

function removeFieldId(values: string[], fieldId: string): string[] {
  return values.filter((value) => value !== fieldId);
}

export function isEditorDropTargetEqual(left: EditorDropTarget | null, right: EditorDropTarget | null): boolean {
  if (left === right) {
    return true;
  }

  if (!left || !right || left.surface !== right.surface || left.kind !== right.kind) {
    return false;
  }

  if (left.surface === "card" && right.surface === "card") {
    if (left.kind === "replace-field" && right.kind === "replace-field") {
      return left.targetFieldId === right.targetFieldId && left.area === right.area;
    }

    if (left.kind === "empty-slot" && right.kind === "empty-slot") {
      return left.area === right.area && left.index === right.index;
    }
  }

  if (left.surface === "detail" && right.surface === "detail") {
    if (left.kind === "replace-field" && right.kind === "replace-field") {
      return left.targetFieldId === right.targetFieldId && left.zone === right.zone;
    }

    if (left.kind === "insert" && right.kind === "insert") {
      return left.zone === right.zone && left.index === right.index;
    }
  }

  return false;
}

export function resolveCardInsertIndex(input: {
  orderedFieldIds: string[];
  cardAreasByFieldId: Record<string, TaskFieldCardArea>;
  targetArea: TaskFieldCardArea;
  positionInArea: number;
}): number {
  const targetFieldIds = input.orderedFieldIds.filter((fieldId) => input.cardAreasByFieldId[fieldId] === input.targetArea);
  const clampedPosition = Math.max(0, Math.min(input.positionInArea, targetFieldIds.length));

  if (targetFieldIds.length > 0) {
    if (clampedPosition <= 0) {
      return input.orderedFieldIds.indexOf(targetFieldIds[0]);
    }

    if (clampedPosition >= targetFieldIds.length) {
      return input.orderedFieldIds.indexOf(targetFieldIds[targetFieldIds.length - 1]) + 1;
    }

    return input.orderedFieldIds.indexOf(targetFieldIds[clampedPosition]);
  }

  const targetAreaIndex = CARD_AREA_ORDER.indexOf(input.targetArea);
  for (let index = 0; index < input.orderedFieldIds.length; index += 1) {
    const fieldArea = input.cardAreasByFieldId[input.orderedFieldIds[index]];
    const fieldAreaIndex = CARD_AREA_ORDER.indexOf(fieldArea);
    if (fieldAreaIndex > targetAreaIndex) {
      return index;
    }
  }

  return input.orderedFieldIds.length;
}

export function resolveDetailInsertIndex(
  orderedFieldIds: string[],
  detailZonesByFieldId: Record<string, DetailZone>,
  zone: DetailZone,
  zoneIndex: number
): number {
  const zoneFieldIds = orderedFieldIds.filter((fieldId) => (detailZonesByFieldId[fieldId] ?? "side") === zone);

  if (zoneFieldIds.length === 0) {
    return zone === "main" ? 0 : orderedFieldIds.length;
  }

  if (zoneIndex <= 0) {
    return orderedFieldIds.indexOf(zoneFieldIds[0]);
  }

  if (zoneIndex >= zoneFieldIds.length) {
    return orderedFieldIds.indexOf(zoneFieldIds[zoneFieldIds.length - 1]) + 1;
  }

  return orderedFieldIds.indexOf(zoneFieldIds[zoneIndex]);
}

export function applyFieldDrop(input: {
  draft: LayoutDraft;
  payload: LayoutFieldDragPayload;
  target: EditorDropTarget;
  allowedFieldIds: Set<string>;
  cardAreasByFieldId: Record<string, TaskFieldCardArea>;
  detailZonesByFieldId: Record<string, DetailZone>;
}): ApplyFieldDropResult {
  const { draft, payload, target, allowedFieldIds, cardAreasByFieldId, detailZonesByFieldId } = input;

  if (!allowedFieldIds.has(payload.fieldId)) {
    return {
      layout: draft,
      cardAreasByFieldId,
      detailZonesByFieldId,
      replacedFieldId: null
    };
  }

  if (target.kind === "replace-field" && target.targetFieldId === payload.fieldId) {
    return {
      layout: draft,
      cardAreasByFieldId,
      detailZonesByFieldId,
      replacedFieldId: null
    };
  }

  let nextCard = [...draft.card];
  let nextDetail = [...draft.detail];

  if (payload.origin === "card" || target.surface === "card") {
    nextCard = removeFieldId(nextCard, payload.fieldId);
  }

  if (payload.origin === "detail" || target.surface === "detail") {
    nextDetail = removeFieldId(nextDetail, payload.fieldId);
  }

  let replacedFieldId: string | null = null;

  if (target.surface === "card") {
    if (target.kind === "replace-field") {
      const insertIndex = nextCard.indexOf(target.targetFieldId);
      nextCard.splice(insertIndex >= 0 ? insertIndex : nextCard.length, 0, payload.fieldId);
    } else {
      const originalArea = cardAreasByFieldId[payload.fieldId];
      const originalAreaIndex = draft.card
        .filter((fieldId) => cardAreasByFieldId[fieldId] === target.area)
        .indexOf(payload.fieldId);
      const positionInArea =
        payload.origin === "card" &&
        originalArea === target.area &&
        originalAreaIndex >= 0 &&
        originalAreaIndex < target.index
          ? target.index - 1
          : target.index;
      const insertIndex = resolveCardInsertIndex({
        orderedFieldIds: nextCard,
        cardAreasByFieldId,
        targetArea: target.area,
        positionInArea
      });
      nextCard.splice(insertIndex, 0, payload.fieldId);
    }

    return {
      layout: {
        card: uniqueFieldIds(nextCard),
        detail: uniqueFieldIds(nextDetail)
      },
      cardAreasByFieldId: {
        ...cardAreasByFieldId,
        [payload.fieldId]: target.area
      },
      detailZonesByFieldId,
      replacedFieldId
    };
  }

  if (target.kind === "replace-field") {
    const insertIndex = nextDetail.indexOf(target.targetFieldId);
    nextDetail.splice(insertIndex >= 0 ? insertIndex : nextDetail.length, 0, payload.fieldId);
  } else {
    const originalZone = detailZonesByFieldId[payload.fieldId] ?? "side";
    const originalZoneIndex = draft.detail
      .filter((fieldId) => (detailZonesByFieldId[fieldId] ?? "side") === target.zone)
      .indexOf(payload.fieldId);
    const zoneIndex =
      payload.origin === "detail" &&
      originalZone === target.zone &&
      originalZoneIndex >= 0 &&
      originalZoneIndex < target.index
        ? target.index - 1
        : target.index;
    const insertIndex = resolveDetailInsertIndex(nextDetail, detailZonesByFieldId, target.zone, zoneIndex);
    nextDetail.splice(insertIndex, 0, payload.fieldId);
  }

  return {
    layout: {
      card: uniqueFieldIds(nextCard),
      detail: uniqueFieldIds(nextDetail)
    },
    cardAreasByFieldId,
    detailZonesByFieldId: {
      ...detailZonesByFieldId,
      [payload.fieldId]: target.zone
    },
    replacedFieldId
  };
}
