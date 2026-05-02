import { useCallback, useMemo, useState } from "react";
import { buildTaskFieldBindingsForType, resolveTaskFieldCardArea, resolveWorkItemFieldBindings } from "@/entities/task";
import type { BoardConfig, TaskFieldCardArea, TaskFieldDefinition } from "@/entities/task";
import type { ApiItemType, WorkItemFieldBindingInput } from "@/modules/workspace/model";
import type { DetailZone, LayoutDraft, LayoutScope } from "@/pages/settings-page/model/work-item-layout-editor";
import {
  getDefaultDetailZone,
  hasUnsavedWorkItemLayout,
  removeFieldFromScope,
  resolveLayoutFields,
  sanitizeFieldIds,
  type FieldLibraryItem
} from "./work-item-editor-settings.model";

interface UseWorkItemEditorLayoutInput {
  activeItemTypes: ApiItemType[];
  activeType: ApiItemType | null;
  boardConfig: BoardConfig;
  allFields: TaskFieldDefinition[];
  fieldsById: Record<string, FieldLibraryItem>;
  allowedFieldIds: Set<string>;
  replaceItemTypeFieldBindings: (typeId: string, bindings: WorkItemFieldBindingInput[]) => Promise<void>;
}

export function useWorkItemEditorLayout({
  activeItemTypes,
  activeType,
  boardConfig,
  allFields,
  fieldsById,
  allowedFieldIds,
  replaceItemTypeFieldBindings
}: UseWorkItemEditorLayoutInput) {
  const [layoutDraftsByTypeSlug, setLayoutDraftsByTypeSlug] = useState<Record<string, LayoutDraft>>({});
  const [detailZoneDraftsByTypeSlug, setDetailZoneDraftsByTypeSlug] = useState<Record<string, Record<string, DetailZone>>>({});
  const [cardAreaDraftsByTypeSlug, setCardAreaDraftsByTypeSlug] = useState<Record<string, Record<string, TaskFieldCardArea>>>({});
  const [savingLayout, setSavingLayout] = useState(false);
  const [layoutMessage, setLayoutMessage] = useState("");

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

  const { cardFields, detailFields } = useMemo(
    () => resolveLayoutFields(activeLayout, fieldsById),
    [activeLayout, fieldsById]
  );
  const detailMainFields = detailFields.filter((field) => activeDetailZones[field.id] === "main");
  const detailSideFields = detailFields.filter((field) => activeDetailZones[field.id] !== "main");

  const hasUnsavedLayout = hasUnsavedWorkItemLayout({
    activeTypeSlug: activeType?.slug,
    activeLayout,
    persistedLayout: activeType ? getEffectiveLayout(activeType.slug) : { card: [], detail: [] },
    layoutDraftsByTypeSlug,
    detailZoneDraftsByTypeSlug,
    persistedDetailZonesByType,
    cardAreaDraftsByTypeSlug
  });

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
      const next: LayoutDraft =
        scope === "card"
          ? { ...activeLayout, card: [...activeLayout.card.filter((id) => id !== fieldId), fieldId] }
          : { ...activeLayout, detail: [...activeLayout.detail.filter((id) => id !== fieldId), fieldId] };
      handleUpdateLayout(activeType.slug, next);
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

  const clearActiveTypeDrafts = useCallback(() => {
    if (!activeType) return;
    setLayoutDraftsByTypeSlug((cur) => {
      const next = { ...cur };
      delete next[activeType.slug];
      return next;
    });
    setDetailZoneDraftsByTypeSlug((cur) => {
      const next = { ...cur };
      delete next[activeType.slug];
      return next;
    });
    setCardAreaDraftsByTypeSlug((cur) => {
      const next = { ...cur };
      delete next[activeType.slug];
      return next;
    });
  }, [activeType]);

  const handleSaveLayout = useCallback(async () => {
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
        .map((binding): WorkItemFieldBindingInput | null => {
          const field = fieldsById[binding.fieldId];
          if (!field?.definitionId) return null;
          return {
            fieldDefinitionId: field.definitionId,
            displayContext: binding.displayContext as WorkItemFieldBindingInput["displayContext"],
            order: binding.order,
            section: binding.section,
            isVisible: binding.isVisible,
            isRequiredOverride: binding.isRequiredOverride,
            isReadonlyOverride: binding.isReadonlyOverride,
            settings: (binding.settings ?? null) as Record<string, unknown> | null
          };
        })
        .filter((binding): binding is WorkItemFieldBindingInput => binding !== null);

      await replaceItemTypeFieldBindings(activeType.id, bindings);
      clearActiveTypeDrafts();
      setLayoutMessage("Layout salvo com sucesso.");
    } catch {
      setLayoutMessage("Nao foi possivel salvar agora.");
    } finally {
      setSavingLayout(false);
    }
  }, [
    activeDetailZones,
    activeLayout.card,
    activeLayout.detail,
    activeType,
    allFields,
    boardConfig.fieldBindings,
    cardAreaDraftsByTypeSlug,
    clearActiveTypeDrafts,
    fieldsById,
    replaceItemTypeFieldBindings
  ]);

  const handleDiscardLayout = useCallback(() => {
    setLayoutMessage("");
    clearActiveTypeDrafts();
  }, [clearActiveTypeDrafts]);

  return {
    activeLayout,
    activeDetailZones,
    activeCardAreaDrafts,
    activeCardAreasByFieldId,
    cardFieldSet,
    detailFieldSet,
    cardFields,
    detailFields,
    detailMainFields,
    detailSideFields,
    savingLayout,
    layoutMessage,
    hasUnsavedLayout,
    setLayoutDraftsByTypeSlug,
    handleUpdateLayout,
    handleUpdateDetailZones,
    handleAddFieldToLayout,
    handleRemoveFromLayout,
    handleSetDetailZoneForField,
    handleSyncCardAreaDraft,
    handleSetCardAreaForField,
    handleSaveLayout,
    handleDiscardLayout
  };
}
