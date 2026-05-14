import { useCallback, useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent
} from "@dnd-kit/core";
import {
  applyFieldCapabilityOverrides
} from "@/entities/task";
import type {
  BoardConfig,
  TaskCardSlotArea,
  TaskFieldCardArea,
  TaskFieldVisualPriority
} from "@/entities/task";
import type { ApiBoardColumn, ApiCustomField, ApiItemType, ApiWorkflowState, CustomFieldType } from "@/modules/workspace/model";
import { useCurrentWorkspace, useWorkspaceWorkItemConfigActions } from "@/modules/workspace";
import {
  applyFieldDrop,
  type DetailZone,
  type EditorDropTarget,
  type LayoutScope
} from "@/pages/settings-page/model/work-item-layout-editor";
import { WorkItemCardEmptySlot } from "./work-item-card-empty-slot";
import { WorkItemDetailFieldCard } from "./work-item-detail-field-card";
import { WorkItemDetailInsertTarget } from "./work-item-detail-insert-target";
import { WorkItemEditorLoadingState } from "./work-item-editor-loading-state";
import { WorkItemEditorCanvas } from "./work-item-editor-canvas";
import { WorkItemFieldTypePicker } from "./work-item-field-type-picker";
import { WorkItemEditorProperties } from "./work-item-editor-properties";
import { WorkItemEditorToolbar } from "./work-item-editor-toolbar";
import { WorkItemFieldLibrary } from "./work-item-field-library";
import {
  addFieldIdToList,
  buildCustomFieldRuntimeIndex,
  DEFAULT_BILLING_SUMMARY_DRAFT_SETTINGS,
  FIELD_TYPE_OPTIONS,
  buildFieldLibraryItems,
  buildFieldSettings,
  buildFieldsById,
  buildMergedFieldDefinitions,
  DEFAULT_TYPE_COLOR,
  filterLibraryFields,
  groupLibraryFieldsByUsage,
  isCatalogSelectType,
  normalizeOptionInputs,
  readFieldCapabilitiesById,
  readFieldDefinitionOverridesById,
  supportsAiGeneration,
  supportsSelectableOptions,
  type FieldDraft,
  type FieldLibraryItem,
  type DragPayload,
  type PendingFieldSetup,
  type TypeDraft,
  type WorkItemEditorCanvasTab
} from "./work-item-editor-settings.model";
import { useWorkItemEditorDragDrop } from "./use-work-item-editor-drag-drop";
import { useWorkItemEditorLayout } from "./use-work-item-editor-layout";
import { useWorkItemEditorPreview } from "./use-work-item-editor-preview";
import { useWorkItemEditorSelection } from "./use-work-item-editor-selection";
import "./work-item-editor-settings.css";

const emptyBoardConfig: BoardConfig = {
  statuses: [],
  taskTypes: [],
  fieldDefinitions: [],
  cardLayout: { visibleFieldIds: [] },
  perspectives: []
};

type WorkItemEditorDndData = {
  payload?: DragPayload;
  target?: EditorDropTarget;
};

function readEditorDragPayload(data: unknown): DragPayload | null {
  return (data as WorkItemEditorDndData | undefined)?.payload ?? null;
}

function readEditorDropTarget(data: unknown): EditorDropTarget | null {
  return (data as WorkItemEditorDndData | undefined)?.target ?? null;
}

// ── Component ──────────────────────────────────────────────────────────────

export function WorkItemEditorSettings() {
  const dndSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3
      }
    }),
    useSensor(KeyboardSensor)
  );
  const currentWorkspace = useCurrentWorkspace();
  const workItemConfigActions = useWorkspaceWorkItemConfigActions(currentWorkspace.workspaceSlug);
  const {
    fetchBoardColumns,
    fetchWorkflowStates,
    fetchItemTypes,
    fetchCustomFields,
    createItemType,
    updateItemType,
    deleteItemType,
    createCustomField,
    updateCustomField,
    deleteCustomField,
    replaceItemTypeFieldBindings,
    updatePreferences
  } = workItemConfigActions;
  const snapshot = currentWorkspace.snapshot;

  const boardConfig = snapshot?.boardConfig ?? emptyBoardConfig;
  const settings = (snapshot?.preferences.settings as Record<string, unknown> | undefined) ?? {};

  const allFields = useMemo(
    () =>
      applyFieldCapabilityOverrides(
        buildMergedFieldDefinitions(Array.isArray(boardConfig?.fieldDefinitions) ? boardConfig.fieldDefinitions : [], settings),
        settings
      ),
    [boardConfig?.fieldDefinitions, settings]
  );
  const fieldCapabilitiesById = useMemo(() => readFieldCapabilitiesById(settings), [settings]);
  const allowedFieldIds = useMemo(() => new Set(allFields.map((f) => f.id)), [allFields]);

  // ── Data state ──────────────────────────────────────────────────────────
  const [itemTypes, setItemTypes] = useState<ApiItemType[]>([]);
  const [customFields, setCustomFields] = useState<ApiCustomField[]>([]);
  const [boardColumns, setBoardColumns] = useState<ApiBoardColumn[]>([]);
  const [workflowStates, setWorkflowStates] = useState<ApiWorkflowState[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Type navigation ──────────────────────────────────────────────────────
  const [activeTypeSlug, setActiveTypeSlug] = useState("");

  // ── Type composer ────────────────────────────────────────────────────────
  const [typeComposer, setTypeComposer] = useState<TypeDraft | null>(null);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [typeSaving, setTypeSaving] = useState(false);
  const [typeDeletingId, setTypeDeletingId] = useState<string | null>(null);

  // ── Field panels ─────────────────────────────────────────────────────────
  const [fieldDraft, setFieldDraft] = useState<FieldDraft | null>(null);
  const [pendingFieldSetup, setPendingFieldSetup] = useState<PendingFieldSetup | null>(null);
  const [fieldTypePickerMode, setFieldTypePickerMode] = useState<"new" | "pending" | "draft" | null>(null);
  const [fieldSaving, setFieldSaving] = useState(false);
  const [fieldDeletingId, setFieldDeletingId] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState("");

  // ── Canvas interaction ───────────────────────────────────────────────────
  const [activeCanvasTab, setActiveCanvasTab] = useState<WorkItemEditorCanvasTab>("card");

  // ── Library filter ───────────────────────────────────────────────────────
  const [librarySearch, setLibrarySearch] = useState("");

  // ── Load ─────────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [nextTypes, nextFields, nextBoardColumns, nextWorkflowStates] = await Promise.all([
        fetchItemTypes(),
        fetchCustomFields(),
        fetchBoardColumns(),
        fetchWorkflowStates()
      ]);
      setItemTypes(nextTypes);
      setCustomFields(nextFields);
      setBoardColumns(nextBoardColumns.filter((c) => c.isActive).sort((a, b) => a.order - b.order));
      setWorkflowStates(nextWorkflowStates.filter((s) => s.isActive));
    } finally {
      setLoading(false);
    }
  }, [fetchBoardColumns, fetchCustomFields, fetchItemTypes, fetchWorkflowStates]);

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

  const customFieldByRuntimeId = useMemo(() => buildCustomFieldRuntimeIndex(customFields), [customFields]);

  const libraryFields = useMemo<FieldLibraryItem[]>(
    () =>
      buildFieldLibraryItems({
        fields: allFields,
        customFieldByRuntimeId,
        fieldCapabilitiesById
      }),
    [allFields, customFieldByRuntimeId, fieldCapabilitiesById]
  );

  const fieldsById = useMemo(() => buildFieldsById(libraryFields), [libraryFields]);
  const editableFields = useMemo(
    () => libraryFields.filter((field) => field.isEditable !== false),
    [libraryFields]
  );

  const {
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
    handleAddFieldToLayout: addFieldToLayout,
    handleRemoveFromLayout,
    handleSetDetailZoneForField,
    handleSyncCardAreaDraft,
    handleSetCardAreaForField,
    handleSaveLayout,
    handleDiscardLayout
  } = useWorkItemEditorLayout({
    activeItemTypes,
    activeType,
    boardConfig,
    allFields,
    fieldsById,
    allowedFieldIds,
    replaceItemTypeFieldBindings
  });

  const {
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
  } = useWorkItemEditorSelection({
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
  });

  const handleAddFieldToLayout = useCallback(
    (fieldId: string, scope: LayoutScope) => {
      addFieldToLayout(fieldId, scope);
      setSelectedFieldId(fieldId);
      setActiveCanvasTab(scope);
    },
    [addFieldToLayout]
  );
  // Library grouping by usage
  const filteredLibraryFields = useMemo(() => filterLibraryFields(libraryFields, librarySearch), [libraryFields, librarySearch]);
  const groupedLibraryFields = useMemo(
    () => groupLibraryFieldsByUsage({ fields: filteredLibraryFields, cardFieldSet, detailFieldSet }),
    [filteredLibraryFields, cardFieldSet, detailFieldSet]
  );

  const {
    dragPayload,
    dropTarget,
    isDragging,
    isDraggingType,
    updateDropTarget,
    beginDrag,
    handleDragEnd,
    completeDrop
  } = useWorkItemEditorDragDrop({
    activeType,
    activeLayout,
    activeDetailZones,
    activeCardAreasByFieldId,
    allowedFieldIds,
    onUpdateLayout: handleUpdateLayout,
    onUpdateDetailZones: handleUpdateDetailZones,
    onSyncCardAreaDraft: handleSyncCardAreaDraft,
    setFieldDraft,
    setFieldError,
    setPendingFieldSetup,
    setSelectedFieldId,
    setTypeComposer
  });

  const handleEditorDragStart = useCallback((event: DragStartEvent) => {
    const payload = readEditorDragPayload(event.active.data.current);
    if (payload) {
      beginDrag(payload);
    }
  }, [beginDrag]);

  const handleEditorDragOver = useCallback((event: DragOverEvent) => {
    updateDropTarget(readEditorDropTarget(event.over?.data.current));
  }, [updateDropTarget]);

  const handleEditorDragEnd = useCallback((event: DragEndEvent) => {
    completeDrop(readEditorDropTarget(event.over?.data.current) ?? dropTarget);
  }, [completeDrop, dropTarget]);
  // ── Type CRUD ─────────────────────────────────────────────────────────────
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

  const persistFieldDefinitionOverride = useCallback(
    async (fieldId: string, draft: FieldDraft) => {
      if (!snapshot) return;

      const normalizedOptions = normalizeOptionInputs(draft.options).map((option, index) => ({
        id: `override-${fieldId}-${index + 1}`,
        label: option.label,
        value: option.value
      }));
      const currentOverrides = readFieldDefinitionOverridesById(settings);

      await updatePreferences({
        settings: {
          ...settings,
          fieldDefinitionsById: {
            ...currentOverrides,
            [fieldId]: {
              ...(currentOverrides[fieldId] ?? {}),
              label: draft.name.trim(),
              name: draft.name.trim(),
              type: draft.type,
              required: draft.required,
              options: supportsSelectableOptions(draft.type as CustomFieldType) ? normalizedOptions : [],
              allowAiGeneration: supportsAiGeneration(draft.type as CustomFieldType) ? draft.allowAiGeneration : false,
              config: buildFieldSettings({
                type: draft.type,
                name: draft.name,
                allowAiGeneration: draft.allowAiGeneration,
                checklistIcon: draft.checklistIcon,
                checklistColor: draft.checklistColor,
                billingCurrency: draft.billingCurrency,
                billingSourceFields: draft.billingSourceFields,
                billingAggregationMode: draft.billingAggregationMode,
                billingDisplayFormat: draft.billingDisplayFormat,
                billingReadOnly: draft.billingReadOnly
              }),
              checklistDisplay:
                draft.type === "checklist"
                  ? {
                      icon: draft.checklistIcon,
                      color: draft.checklistColor,
                      label: draft.name.trim()
                    }
                  : undefined
            }
          }
        }
      });
    },
    [settings, snapshot, updatePreferences]
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

  // ── Field CRUD ────────────────────────────────────────────────────────────
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
        settings: {
          ...buildFieldSettings({
            type: pendingFieldSetup.type,
            name: pendingFieldSetup.name,
            allowAiGeneration: pendingFieldSetup.allowAiGeneration,
            checklistIcon: pendingFieldSetup.checklistIcon,
            checklistColor: pendingFieldSetup.checklistColor,
            billingCurrency: pendingFieldSetup.billingCurrency,
            billingSourceFields: pendingFieldSetup.billingSourceFields,
            billingAggregationMode: pendingFieldSetup.billingAggregationMode,
            billingDisplayFormat: pendingFieldSetup.billingDisplayFormat,
            billingReadOnly: pendingFieldSetup.billingReadOnly
          })
        },
        options: supportsSelectableOptions(pendingFieldSetup.type) ? normalizedOptions : []
      });

      const [nextTypes, nextFields] = await Promise.all([fetchItemTypes(), fetchCustomFields()]);
      setItemTypes(nextTypes);
      setCustomFields(nextFields);

      const newField = [...nextFields]
        .filter((f) => f.type === pendingFieldSetup.type && f.name.trim().toLowerCase() === pendingFieldSetup.name.trim().toLowerCase())
        .sort((a, b) => (b.id > a.id ? 1 : -1))[0];

      if (newField) {
        const newFieldRuntimeId = newField.slug;
        const { addToLayout, targetScope: sc, targetIndex: idx, targetDetailZone, dropTarget } = pendingFieldSetup;

        if (addToLayout) {
          if (dropTarget) {
            const nextDrop = applyFieldDrop({
              draft: activeLayout,
              payload: { fieldId: newFieldRuntimeId, origin: "library" },
              target: dropTarget,
              allowedFieldIds: new Set([...allowedFieldIds, newFieldRuntimeId]),
              cardAreasByFieldId: activeCardAreasByFieldId,
              detailZonesByFieldId: activeDetailZones
            });

            handleUpdateLayout(activeType.slug, nextDrop.layout);

            if (dropTarget.surface === "detail") {
              handleUpdateDetailZones(activeType.slug, nextDrop.detailZonesByFieldId);
            }

            if (dropTarget.surface === "card") {
              handleSyncCardAreaDraft(activeType.slug, newFieldRuntimeId, nextDrop.cardAreasByFieldId[newFieldRuntimeId]);
            }
          } else {
            setLayoutDraftsByTypeSlug((cur) => ({
              ...cur,
              [activeType.slug]: {
                card: sc === "card" ? addFieldIdToList(activeLayout.card, newFieldRuntimeId, idx) : [...activeLayout.card],
                detail: sc === "detail" ? addFieldIdToList(activeLayout.detail, newFieldRuntimeId, idx) : [...activeLayout.detail]
              }
            }));
            if (sc === "detail") {
              handleUpdateDetailZones(activeType.slug, { ...activeDetailZones, [newFieldRuntimeId]: targetDetailZone ?? "side" });
            }
          }
        }
        setSelectedFieldId(newFieldRuntimeId);
        setActiveCanvasTab(addToLayout ? sc : "field");
      }
      setPendingFieldSetup(null);
    } finally {
      setFieldSaving(false);
    }
  };

  const handleSaveField = async () => {
    if (!fieldDraft?.name.trim()) return;
    const normalizedOptions = normalizeOptionInputs(fieldDraft.options);
    if (supportsSelectableOptions(fieldDraft.type as CustomFieldType) && normalizedOptions.length === 0) {
      setFieldError("Campos de selecao precisam de pelo menos uma opcao.");
      return;
    }
    setFieldSaving(true);
    setFieldError("");
    try {
      const selectedDefinition = fieldsById[fieldDraft.runtimeFieldId];
      const isCustomField = selectedDefinition?.hasApiDefinition === true;

      if (isCustomField) {
        await updateCustomField(fieldDraft.id, {
          name: fieldDraft.name.trim(),
          type: fieldDraft.type as CustomFieldType,
          required: fieldDraft.required,
          settings: {
            ...buildFieldSettings({
              type: fieldDraft.type,
              name: fieldDraft.name,
              allowAiGeneration: fieldDraft.allowAiGeneration,
              checklistIcon: fieldDraft.checklistIcon,
              checklistColor: fieldDraft.checklistColor,
              billingCurrency: fieldDraft.billingCurrency,
              billingSourceFields: fieldDraft.billingSourceFields,
              billingAggregationMode: fieldDraft.billingAggregationMode,
              billingDisplayFormat: fieldDraft.billingDisplayFormat,
              billingReadOnly: fieldDraft.billingReadOnly
            })
          },
          options: supportsSelectableOptions(fieldDraft.type as CustomFieldType) ? normalizedOptions : []
        });
      }

      await persistFieldCapabilities(
        fieldDraft.runtimeFieldId,
        supportsAiGeneration(fieldDraft.type as CustomFieldType) && fieldDraft.allowAiGeneration
      );
      await persistFieldDefinitionOverride(fieldDraft.runtimeFieldId, fieldDraft);
      const savedFieldId = fieldDraft.runtimeFieldId;
      setFieldDraft(null);
      setSelectedFieldId(savedFieldId);
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
      if (selectedFieldId === fieldId) setSelectedFieldId(null);
      await loadData();
    } finally {
      setFieldDeletingId(null);
    }
  };

  const openNewFieldPanel = (type: CustomFieldType) => {
    setFieldError("");
    setFieldDraft(null);
    setTypeComposer(null);
    setPendingFieldSetup({
      type,
      targetScope: preferredFieldTargetScope,
      targetIndex: (preferredFieldTargetScope === "card" ? activeLayout.card : activeLayout.detail).length,
      targetDetailZone: preferredFieldTargetScope === "detail" ? "side" : undefined,
      dropTarget: null,
      addToLayout: activeCanvasTab !== "field",
      name: "",
      required: false,
      allowAiGeneration: false,
      options: [],
      checklistIcon: "checklist",
      checklistColor: "var(--text-secondary)",
      ...DEFAULT_BILLING_SUMMARY_DRAFT_SETTINGS
    });
  };

  // ── Preview computation ──────────────────────────────────────────────────
  const {
    typeColor,
    previewStatus,
    previewTask,
    previewBoardConfig,
    previewMembersById,
    previewRuntimeStatuses
  } = useWorkItemEditorPreview({
    activeType,
    activeLayout,
    activeDetailZones,
    activeCardAreaDrafts,
    allFields,
    libraryFields,
    boardConfig,
    boardColumns,
    workflowStates,
    snapshot
  });
  // ── Card preview field props ──────────────────────────────────────────────
  const getCardPreviewFieldProps = ({
    fieldId,
    area,
    visualPriority
  }: {
    fieldId: string;
    area: TaskFieldCardArea;
    visualPriority: TaskFieldVisualPriority;
    index: number;
    slotLimit: number;
    occupiedCount: number;
  }) => {
    const isReplaceTarget =
      dropTarget?.surface === "card" &&
      dropTarget.kind === "replace-field" &&
      dropTarget.targetFieldId === fieldId;
    const isSelected = selectedFieldId === fieldId;

    return {
      className: `wie__card-field wie__card-field--${area}${isSelected ? " is-selected" : ""}${isReplaceTarget ? " is-replace-target" : ""}`,
      "data-workitem-slot": "card",
      "data-field-id": fieldId,
      "data-visual-priority": visualPriority,
      "data-drop-intent": isReplaceTarget ? "replace" : undefined,
      onClick: (event: MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        setSelectedFieldId(fieldId);
        setFieldDraft(null);
        setPendingFieldSetup(null);
        setTypeComposer(null);
      }
    };
  };

  const handleOpenNewFieldPicker = () => {
    setFieldError("");
    setFieldTypePickerMode("new");
  };

  const handleSelectFieldType = (type: CustomFieldType) => {
    setFieldError("");

    if (fieldTypePickerMode === "pending" && pendingFieldSetup) {
      setPendingFieldSetup({
        ...pendingFieldSetup,
        type,
        allowAiGeneration: supportsAiGeneration(type) ? pendingFieldSetup.allowAiGeneration : false,
        options: supportsSelectableOptions(type) ? pendingFieldSetup.options : []
      });
      setFieldTypePickerMode(null);
      return;
    }

    if (fieldTypePickerMode === "draft" && fieldDraft) {
      setFieldDraft({
        ...fieldDraft,
        type,
        allowAiGeneration: supportsAiGeneration(type) ? fieldDraft.allowAiGeneration : false
      });
      setFieldTypePickerMode(null);
      return;
    }

    setFieldTypePickerMode(null);
    openNewFieldPanel(type);
  };

  const selectedPickerType =
    fieldTypePickerMode === "pending"
      ? pendingFieldSetup?.type
      : fieldTypePickerMode === "draft"
        ? (fieldDraft?.type as CustomFieldType | undefined)
        : null;

  const getCardPreviewFieldDragConfig = ({
    fieldId
  }: {
    fieldId: string;
  }) => ({
    id: `work-item-card-field:${fieldId}`,
    data: {
      payload: { kind: "field", fieldId, origin: "card" }
    }
  });

  const getCardPreviewFieldDropConfig = ({
    fieldId,
    area
  }: {
    fieldId: string;
    area: TaskFieldCardArea;
  }) => ({
    id: `work-item-card-replace:${fieldId}`,
    disabled: !dragPayload || (dragPayload.kind === "field" && dragPayload.fieldId === fieldId),
    data: {
      target: {
        surface: "card",
        kind: "replace-field",
        targetFieldId: fieldId,
        area
      } satisfies EditorDropTarget
    }
  });

  const dragOverlayLabel = useMemo(() => {
    if (!dragPayload) return "";
    if (dragPayload.kind === "type") {
      return FIELD_TYPE_OPTIONS.find((option) => option.value === dragPayload.type)?.label ?? "Novo campo";
    }
    return fieldsById[dragPayload.fieldId]?.label ?? "Campo";
  }, [dragPayload, fieldsById]);

  const dragOverlayMeta = useMemo(() => {
    if (!dragPayload) return "";
    if (dragPayload.kind === "type") return "criar campo";
    if (dragPayload.origin === "card") return "reposicionar no card";
    if (dragPayload.origin === "detail") return "mover do formulario";
    return "arrastar da biblioteca";
  }, [dragPayload]);

  // ── Renders ───────────────────────────────────────────────────────────────

  const renderCardEmptySlot = ({
    area,
    index,
    occupiedCount,
    slotLimit
  }: {
    area: TaskCardSlotArea;
    index: number;
    occupiedCount: number;
    slotLimit: number;
    availableCount: number;
  }) => (
    <WorkItemCardEmptySlot
      area={area}
      index={index}
      occupiedCount={occupiedCount}
      slotLimit={slotLimit}
      dropTarget={dropTarget}
      dragPayload={dragPayload}
      onUpdateDropTarget={updateDropTarget}
    />
  );

  const renderDetailInsertTarget = (zone: DetailZone, index: number) => (
    <WorkItemDetailInsertTarget
      zone={zone}
      index={index}
      dropTarget={dropTarget}
      dragPayload={dragPayload}
      onUpdateDropTarget={updateDropTarget}
    />
  );

  const renderDetailFieldCard = (field: FieldLibraryItem, zone: DetailZone, index: number) => (
    <WorkItemDetailFieldCard
      field={field}
      zone={zone}
      index={index}
      selectedFieldId={selectedFieldId}
      isDragging={isDragging}
      previewTask={previewTask}
      previewBoardConfig={previewBoardConfig}
      previewRuntimeStatuses={previewRuntimeStatuses}
      previewMembersById={previewMembersById}
      dropTarget={dropTarget}
      dragPayload={dragPayload}
      renderDetailInsertTarget={renderDetailInsertTarget}
      onUpdateDropTarget={updateDropTarget}
      onSelectField={selectFieldForEditing}
    />
  );
  // ── Slot panel ────────────────────────────────────────────────────────────


  // ── Properties panel content ──────────────────────────────────────────────

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="wie">
      {/* ── Topbar ─────────────────────────────────────────────────────────── */}
      <WorkItemEditorToolbar
        activeItemTypes={activeItemTypes}
        activeType={activeType}
        cardFieldsCount={cardFields.length}
        detailFieldsCount={detailFields.length}
        hasUnsavedLayout={hasUnsavedLayout}
        savingLayout={savingLayout}
        canChangeFieldType={Boolean(pendingFieldSetup || fieldDraft)}
        onSelectType={setActiveTypeSlug}
        onEditType={(type) => {
          setEditingTypeId(type.id);
          setTypeComposer({ name: type.name, color: type.color || DEFAULT_TYPE_COLOR });
          setFieldDraft(null);
          setPendingFieldSetup(null);
          setSelectedFieldId(null);
        }}
        onNewType={(draft) => {
          setEditingTypeId(null);
          setTypeComposer(draft);
          setFieldDraft(null);
          setPendingFieldSetup(null);
          setSelectedFieldId(null);
        }}
        onOpenNewFieldPicker={handleOpenNewFieldPicker}
        onRequestFieldTypeChange={() => {
          if (!pendingFieldSetup && !fieldDraft) return;
          setFieldTypePickerMode(pendingFieldSetup ? "pending" : "draft");
        }}
        onDiscardLayout={handleDiscardLayout}
        onSaveLayout={() => void handleSaveLayout()}
      />
      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="wie__body">
        {loading ? (
          <WorkItemEditorLoadingState />
        ) : (
          <>
            <DndContext
              sensors={dndSensors}
              collisionDetection={pointerWithin}
              onDragStart={handleEditorDragStart}
              onDragOver={handleEditorDragOver}
              onDragEnd={handleEditorDragEnd}
              onDragCancel={handleDragEnd}
            >
            {/* ── Library ────────────────────────────────────────────────────── */}
            <WorkItemFieldLibrary
              librarySearch={librarySearch}
              libraryFieldsInCardOnly={groupedLibraryFields.inCardOnly}
              libraryFieldsInBoth={groupedLibraryFields.inBoth}
              libraryFieldsInDetailOnly={groupedLibraryFields.inDetailOnly}
              libraryFieldsUnused={groupedLibraryFields.unused}
              cardFieldSet={cardFieldSet}
              detailFieldSet={detailFieldSet}
              selectedFieldId={selectedFieldId}
              onSearchChange={setLibrarySearch}
              onSelectField={(fieldId) => {
                setSelectedFieldId(fieldId);
                setFieldDraft(null);
                setPendingFieldSetup(null);
                setTypeComposer(null);
              }}
            />
            {/* ── Canvas ───────────────────────────────────────────────────────── */}
            <WorkItemEditorCanvas
              activeCanvasTab={activeCanvasTab}
              setActiveCanvasTab={setActiveCanvasTab}
              cardFields={cardFields}
              detailFields={detailFields}
              detailMainFields={detailMainFields}
              detailSideFields={detailSideFields}
              selectedFieldId={selectedFieldId}
              selectedInCard={selectedInCard}
              selectedInDetail={selectedInDetail}
              pendingFieldSetup={pendingFieldSetup}
              activeFieldCanvasPreview={activeFieldCanvasPreview}
              activeType={activeType}
              typeColor={typeColor}
              previewStatusLabel={previewStatus.label}
              previewTask={previewTask}
              previewBoardConfig={previewBoardConfig}
              previewMembersById={previewMembersById}
              previewRuntimeStatuses={previewRuntimeStatuses}
              isDragging={isDragging}
              isDraggingType={isDraggingType}
              dropTarget={dropTarget}
              getCardPreviewFieldProps={getCardPreviewFieldProps}
              getCardPreviewFieldDragConfig={getCardPreviewFieldDragConfig}
              getCardPreviewFieldDropConfig={getCardPreviewFieldDropConfig}
              renderCardEmptySlot={renderCardEmptySlot}
              renderDetailInsertTarget={renderDetailInsertTarget}
              renderDetailFieldCard={renderDetailFieldCard}
              onClearSelectedField={() => setSelectedFieldId(null)}
              onDebugSnapshot={setPreviewCardDebug}
            />
            <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
              {dragPayload ? (
                <div className="wie__drag-overlay" data-drag-kind={dragPayload.kind}>
                  <span className="wie__drag-overlay-grip" aria-hidden="true">::</span>
                  <span>
                    <strong>{dragOverlayLabel}</strong>
                    <small>{dragOverlayMeta}</small>
                  </span>
                </div>
              ) : null}
            </DragOverlay>
            </DndContext>
            {/* ── Properties ──────────────────────────────────────────────────── */}
            <aside className="wie__props">
              <WorkItemEditorProperties
                pendingFieldSetup={pendingFieldSetup}
                setPendingFieldSetup={setPendingFieldSetup}
                activePendingTypeLabel={activePendingTypeLabel}
                pendingFieldTargetLabel={pendingFieldTargetLabel}
                fieldDraft={fieldDraft}
                setFieldDraft={setFieldDraft}
                fieldSaving={fieldSaving}
                fieldDeletingId={fieldDeletingId}
                fieldError={fieldError}
                setFieldError={setFieldError}
                selectedField={selectedField}
                selectedFieldId={selectedFieldId}
                setSelectedFieldId={setSelectedFieldId}
                selectedInCard={selectedInCard}
                selectedInDetail={selectedInDetail}
                selectedDetailZone={selectedDetailZone}
                activeCanvasTab={activeCanvasTab}
                activeLayout={activeLayout}
                activeCardAreaDrafts={activeCardAreaDrafts}
                previewCardDebug={previewCardDebug}
                typeComposer={typeComposer}
                setTypeComposer={setTypeComposer}
                editingTypeId={editingTypeId}
                setEditingTypeId={setEditingTypeId}
                typeSaving={typeSaving}
                typeDeletingId={typeDeletingId}
                onConfirmFieldSetup={() => void handleConfirmFieldSetup()}
                onSaveField={() => void handleSaveField()}
                onDeleteField={(fieldId) => void handleDeleteField(fieldId)}
                onSaveType={() => void handleSaveType()}
                onDeleteType={(typeId) => void handleDeleteType(typeId)}
                onAddFieldToLayout={handleAddFieldToLayout}
                onRemoveFromLayout={handleRemoveFromLayout}
                onSetDetailZoneForField={handleSetDetailZoneForField}
                onSetCardAreaForField={handleSetCardAreaForField}
              />
            </aside>
          </>
        )}
      </div>

      <WorkItemFieldTypePicker
        open={fieldTypePickerMode !== null}
        onOpenChange={(open) => setFieldTypePickerMode(open ? fieldTypePickerMode : null)}
        selectedType={selectedPickerType}
        title={fieldTypePickerMode === "new" ? "Novo campo" : "Trocar tipo do campo"}
        description={
          fieldTypePickerMode === "new"
            ? "Escolha o tipo de campo para criar e configurar no editor."
            : "Escolha o novo tipo. As configuracoes compativeis serao mantidas."
        }
        onSelectType={handleSelectFieldType}
      />

      {layoutMessage ? <p className="wie__footer-message">{layoutMessage}</p> : null}
    </div>
  );
}
