import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { TaskCardDebugSnapshot } from "@/entities/task";
import type { ApiCustomField } from "@/modules/workspace/model";
import type { DetailZone, LayoutScope } from "@/pages/settings-page/model/work-item-layout-editor";
import {
  buildFieldDraftFromApiField,
  buildFieldDraftFromDefinition,
  buildFieldEditorPreview,
  buildPendingFieldPreview,
  FIELD_TYPE_OPTIONS,
  getDefaultDetailZone,
  resolvePendingFieldTargetLabel,
  type FieldDraft,
  type FieldLibraryItem,
  type PendingFieldSetup,
  type TypeDraft,
  type WorkItemEditorCanvasTab
} from "./work-item-editor-settings.model";

interface UseWorkItemEditorSelectionInput {
  activeCanvasTab: WorkItemEditorCanvasTab;
  activeDetailZones: Record<string, DetailZone>;
  cardFieldSet: Set<string>;
  detailFieldSet: Set<string>;
  customFieldByRuntimeId: Record<string, ApiCustomField>;
  editableFields: FieldLibraryItem[];
  fieldsById: Record<string, FieldLibraryItem>;
  fieldDraft: FieldDraft | null;
  pendingFieldSetup: PendingFieldSetup | null;
  typeComposer: TypeDraft | null;
  setFieldDraft: Dispatch<SetStateAction<FieldDraft | null>>;
  setFieldError: Dispatch<SetStateAction<string>>;
  setPendingFieldSetup: Dispatch<SetStateAction<PendingFieldSetup | null>>;
  setTypeComposer: Dispatch<SetStateAction<TypeDraft | null>>;
}

export function useWorkItemEditorSelection({
  activeCanvasTab,
  activeDetailZones,
  cardFieldSet,
  detailFieldSet,
  customFieldByRuntimeId,
  editableFields,
  fieldsById,
  fieldDraft,
  pendingFieldSetup,
  typeComposer,
  setFieldDraft,
  setFieldError,
  setPendingFieldSetup,
  setTypeComposer
}: UseWorkItemEditorSelectionInput) {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [previewCardDebug, setPreviewCardDebug] = useState<TaskCardDebugSnapshot | null>(null);

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
  }, [customFieldByRuntimeId, fieldDraft, fieldsById, pendingFieldSetup, selectedFieldId, setFieldDraft, setFieldError, typeComposer]);

  useEffect(() => {
    if (activeCanvasTab !== "field" || pendingFieldSetup || editableFields.length === 0) {
      return;
    }

    if (!selectedFieldId || fieldsById[selectedFieldId]?.isEditable === false) {
      setSelectedFieldId(editableFields[0].id);
      setFieldDraft(null);
    }
  }, [activeCanvasTab, editableFields, fieldsById, pendingFieldSetup, selectedFieldId, setFieldDraft]);

  const selectFieldForEditing = useCallback(
    (fieldId: string) => {
      setSelectedFieldId(fieldId);
      setFieldDraft(null);
      setPendingFieldSetup(null);
      setTypeComposer(null);
    },
    [setFieldDraft, setPendingFieldSetup, setTypeComposer]
  );

  const selectedField = selectedFieldId ? fieldsById[selectedFieldId] : null;
  const selectedInCard = selectedFieldId ? cardFieldSet.has(selectedFieldId) : false;
  const selectedInDetail = selectedFieldId ? detailFieldSet.has(selectedFieldId) : false;
  const selectedDetailZone = selectedFieldId
    ? (activeDetailZones[selectedFieldId] ?? getDefaultDetailZone(fieldsById[selectedFieldId]))
    : "side";
  const preferredFieldTargetScope: LayoutScope = activeCanvasTab === "detail" ? "detail" : "card";
  const fieldEditorPreview = useMemo(() => buildFieldEditorPreview(selectedField, fieldDraft), [fieldDraft, selectedField]);
  const pendingFieldPreview = useMemo(() => buildPendingFieldPreview(pendingFieldSetup), [pendingFieldSetup]);
  const activeFieldCanvasPreview = pendingFieldPreview ?? fieldEditorPreview;

  const activePendingTypeLabel = pendingFieldSetup
    ? (FIELD_TYPE_OPTIONS.find((option) => option.value === pendingFieldSetup.type)?.label ?? pendingFieldSetup.type)
    : null;
  const pendingFieldTargetLabel = useMemo(
    () => resolvePendingFieldTargetLabel(pendingFieldSetup, fieldsById),
    [fieldsById, pendingFieldSetup]
  );

  return {
    selectedFieldId,
    setSelectedFieldId,
    selectFieldForEditing,
    previewCardDebug,
    setPreviewCardDebug,
    selectedField,
    selectedInCard,
    selectedInDetail,
    selectedDetailZone,
    preferredFieldTargetScope,
    activeFieldCanvasPreview,
    activePendingTypeLabel,
    pendingFieldTargetLabel
  };
}
