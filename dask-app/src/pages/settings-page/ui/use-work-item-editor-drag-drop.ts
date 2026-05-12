import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { TaskFieldCardArea } from "@/entities/task";
import type { ApiItemType } from "@/modules/workspace/model";
import {
  applyFieldDrop,
  isEditorDropTargetEqual,
  type DetailZone,
  type EditorDropTarget,
  type LayoutDraft
} from "@/pages/settings-page/model/work-item-layout-editor";
import { DEFAULT_BILLING_SUMMARY_DRAFT_SETTINGS } from "./work-item-editor-settings.model";
import type { DragPayload, FieldDraft, PendingFieldSetup, TypeDraft } from "./work-item-editor-settings.model";

interface UseWorkItemEditorDragDropInput {
  activeType: ApiItemType | null;
  activeLayout: LayoutDraft;
  activeDetailZones: Record<string, DetailZone>;
  activeCardAreasByFieldId: Record<string, TaskFieldCardArea>;
  allowedFieldIds: Set<string>;
  onUpdateLayout: (typeSlug: string, next: LayoutDraft) => void;
  onUpdateDetailZones: (typeSlug: string, next: Record<string, DetailZone>) => void;
  onSyncCardAreaDraft: (typeSlug: string, fieldId: string, nextArea: TaskFieldCardArea) => void;
  setFieldDraft: Dispatch<SetStateAction<FieldDraft | null>>;
  setFieldError: Dispatch<SetStateAction<string>>;
  setPendingFieldSetup: Dispatch<SetStateAction<PendingFieldSetup | null>>;
  setSelectedFieldId: Dispatch<SetStateAction<string | null>>;
  setTypeComposer: Dispatch<SetStateAction<TypeDraft | null>>;
}

export function useWorkItemEditorDragDrop({
  activeType,
  activeLayout,
  activeDetailZones,
  activeCardAreasByFieldId,
  allowedFieldIds,
  onUpdateLayout,
  onUpdateDetailZones,
  onSyncCardAreaDraft,
  setFieldDraft,
  setFieldError,
  setPendingFieldSetup,
  setSelectedFieldId,
  setTypeComposer
}: UseWorkItemEditorDragDropInput) {
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [dropTarget, setDropTarget] = useState<EditorDropTarget | null>(null);

  const updateDropTarget = useCallback((nextTarget: EditorDropTarget | null) => {
    setDropTarget((current) => (isEditorDropTargetEqual(current, nextTarget) ? current : nextTarget));
  }, []);

  const beginDrag = useCallback((payload: DragPayload) => {
    setDragPayload(payload);
    updateDropTarget(null);

    if (payload.kind === "field") {
      setSelectedFieldId(payload.fieldId);
      setFieldDraft(null);
      setPendingFieldSetup(null);
      setTypeComposer(null);
    }
  }, [setFieldDraft, setPendingFieldSetup, setSelectedFieldId, setTypeComposer, updateDropTarget]);

  const handleDragEnd = useCallback(() => {
    setDragPayload(null);
    updateDropTarget(null);
  }, [updateDropTarget]);

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
          checklistColor: "var(--text-secondary)",
          ...DEFAULT_BILLING_SUMMARY_DRAFT_SETTINGS
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

      onUpdateLayout(activeType.slug, nextDrop.layout);

      if (target.surface === "detail") {
        onUpdateDetailZones(activeType.slug, nextDrop.detailZonesByFieldId);
      }

      if (target.surface === "card") {
        onSyncCardAreaDraft(activeType.slug, dragPayload.fieldId, nextDrop.cardAreasByFieldId[dragPayload.fieldId]);
      }

      setSelectedFieldId(dragPayload.fieldId);
      updateDropTarget(null);
      setDragPayload(null);
    },
    [
      activeCardAreasByFieldId,
      activeDetailZones,
      activeLayout,
      activeType,
      allowedFieldIds,
      dragPayload,
      onSyncCardAreaDraft,
      onUpdateDetailZones,
      onUpdateLayout,
      setFieldDraft,
      setFieldError,
      setPendingFieldSetup,
      setSelectedFieldId,
      setTypeComposer,
      updateDropTarget
    ]
  );

  const completeDrop = useCallback(
    (target: EditorDropTarget | null) => {
      if (target) {
        applyResolvedDropTarget(target);
        return;
      }

      handleDragEnd();
    },
    [applyResolvedDropTarget, handleDragEnd]
  );

  return {
    dragPayload,
    dropTarget,
    isDragging: dragPayload !== null,
    isDraggingType: dragPayload?.kind === "type",
    updateDropTarget,
    beginDrag,
    handleDragEnd,
    applyResolvedDropTarget,
    completeDrop
  };
}
