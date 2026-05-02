import { useCallback, useEffect, useState } from "react";
import type { Dispatch, DragEvent, MouseEvent, SetStateAction } from "react";
import type { TaskFieldCardArea } from "@/entities/task";
import type { ApiItemType, CustomFieldType } from "@/modules/workspace/model";
import {
  applyFieldDrop,
  isEditorDropTargetEqual,
  type DetailZone,
  type EditorDropTarget,
  type LayoutDraft,
  type LayoutScope
} from "@/pages/settings-page/model/work-item-layout-editor";
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

  const handleDragStartField = useCallback(
    (event: DragEvent<HTMLElement>, fieldId: string, origin: "library" | "card" | "detail") => {
      setDragPayload({ kind: "field", fieldId, origin });
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", fieldId);
    },
    []
  );

  const beginDetailMouseDrag = useCallback(
    (event: MouseEvent<HTMLElement>, fieldId: string) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      setSelectedFieldId(fieldId);
      setFieldDraft(null);
      setPendingFieldSetup(null);
      setTypeComposer(null);
      setDragPayload({ kind: "field", fieldId, origin: "detail" });
    },
    [setFieldDraft, setPendingFieldSetup, setSelectedFieldId, setTypeComposer]
  );

  const handleDragStartType = useCallback((event: DragEvent<HTMLElement>, type: CustomFieldType) => {
    setDragPayload({ kind: "type", type });
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", `type:${type}`);
  }, []);

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
          checklistColor: "var(--text-secondary)"
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

  return {
    dragPayload,
    dropTarget,
    isDragging: dragPayload !== null,
    isDraggingType: dragPayload?.kind === "type",
    updateDropTarget,
    handleDragStartField,
    beginDetailMouseDrag,
    handleDragStartType,
    handleDragEnd,
    applyResolvedDropTarget,
    handleDropOnTarget,
    handlePreviewSurfaceDragOver,
    handleDetailZoneDragOver,
    handleDetailZoneMouseMove,
    makeSurfaceDragLeaveHandler
  };
}
