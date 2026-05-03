import { useCallback, useEffect, useMemo, useState } from "react";
import type { DragEvent, MouseEvent } from "react";
import {
  applyFieldCapabilityOverrides,
  factoryBoardConfig
} from "@/entities/task";
import type {
  TaskCardSlotArea,
  TaskFieldCardArea,
  TaskFieldVisualPriority
} from "@/entities/task";
import type { ApiBoardColumn, ApiCustomField, ApiItemType, ApiWorkflowState, CustomFieldType } from "@/modules/workspace/model";
import { useWorkspace } from "@/modules/workspace";
import {
  applyFieldDrop,
  type DetailZone,
  type LayoutScope
} from "@/pages/settings-page/model/work-item-layout-editor";
import { WorkItemCardEmptySlot } from "./work-item-card-empty-slot";
import { WorkItemDetailFieldCard } from "./work-item-detail-field-card";
import { WorkItemDetailInsertTarget } from "./work-item-detail-insert-target";
import { WorkItemEditorLoadingState } from "./work-item-editor-loading-state";
import { WorkItemEditorCanvas } from "./work-item-editor-canvas";
import { WorkItemEditorProperties } from "./work-item-editor-properties";
import { WorkItemEditorToolbar } from "./work-item-editor-toolbar";
import { WorkItemFieldLibrary } from "./work-item-field-library";
import {
  addFieldIdToList,
  buildCustomFieldRuntimeIndex,
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
  type PendingFieldSetup,
  type TypeDraft,
  type WorkItemEditorCanvasTab
} from "./work-item-editor-settings.model";
import { useWorkItemEditorDragDrop } from "./use-work-item-editor-drag-drop";
import { useWorkItemEditorLayout } from "./use-work-item-editor-layout";
import { useWorkItemEditorPreview } from "./use-work-item-editor-preview";
import { useWorkItemEditorSelection } from "./use-work-item-editor-selection";
import "./work-item-editor-settings.css";

// ── Component ──────────────────────────────────────────────────────────────

export function WorkItemEditorSettings() {
  const {
    snapshot,
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
  } = useWorkspace();

  const boardConfig = snapshot?.boardConfig ?? factoryBoardConfig;
  const settings = (snapshot?.preferences.settings as Record<string, unknown> | undefined) ?? {};

  const allFields = useMemo(
    () =>
      applyFieldCapabilityOverrides(
        buildMergedFieldDefinitions(Array.isArray(boardConfig.fieldDefinitions) ? boardConfig.fieldDefinitions : [], settings),
        settings
      ),
    [boardConfig.fieldDefinitions, settings]
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
              config: isCatalogSelectType(draft.type) ? { entityType: "billing_catalog_item" } : undefined,
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
            checklistColor: pendingFieldSetup.checklistColor
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
              checklistColor: fieldDraft.checklistColor
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
      checklistColor: "var(--text-secondary)"
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
    const isSelfDrag = dragPayload?.kind === "field" && dragPayload.fieldId === fieldId;

    return {
      className: `wie__card-field wie__card-field--${area}${isSelected ? " is-selected" : ""}${isReplaceTarget ? " is-replace-target" : ""}`,
      "data-workitem-slot": "card",
      "data-field-id": fieldId,
      "data-visual-priority": visualPriority,
      "data-drop-intent": isReplaceTarget ? "replace" : undefined,
      "data-drop-label": isReplaceTarget ? "Mover aqui" : undefined,
      draggable: true,
      onClick: (event: MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        setSelectedFieldId(fieldId);
        setFieldDraft(null);
        setPendingFieldSetup(null);
        setTypeComposer(null);
      },
      onDragStart: (event: DragEvent<HTMLElement>) => {
        event.stopPropagation();
        setSelectedFieldId(fieldId);
        handleDragStartField(event, fieldId, "card");
      },
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (!dragPayload || isSelfDrag) return;
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = dragPayload.kind === "type" ? "copy" : "move";
        updateDropTarget({
          surface: "card",
          kind: "replace-field",
          targetFieldId: fieldId,
          area
        });
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        if (isSelfDrag) return;
        handleDropOnTarget(event, {
          surface: "card",
          kind: "replace-field",
          targetFieldId: fieldId,
          area
        });
      },
      onDragEnd: handleDragEnd
    };
  };

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
      onDropOnTarget={handleDropOnTarget}
    />
  );

  const renderDetailInsertTarget = (zone: DetailZone, index: number) => (
    <WorkItemDetailInsertTarget
      zone={zone}
      index={index}
      dropTarget={dropTarget}
      dragPayload={dragPayload}
      onUpdateDropTarget={updateDropTarget}
      onDropOnTarget={handleDropOnTarget}
    />
  );

  const renderDetailFieldCard = (field: FieldLibraryItem, zone: DetailZone, index: number) => (
    <WorkItemDetailFieldCard
      field={field}
      zone={zone}
      index={index}
      selectedFieldId={selectedFieldId}
      dragPayload={dragPayload}
      isDragging={isDragging}
      previewTask={previewTask}
      previewBoardConfig={previewBoardConfig}
      previewRuntimeStatuses={previewRuntimeStatuses}
      previewMembersById={previewMembersById}
      renderDetailInsertTarget={renderDetailInsertTarget}
      onSelectField={selectFieldForEditing}
      onBeginDetailMouseDrag={beginDetailMouseDrag}
      onDragStartField={handleDragStartField}
      onDragEnd={handleDragEnd}
      onUpdateDropTarget={updateDropTarget}
      onDropOnTarget={handleDropOnTarget}
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
        onDiscardLayout={handleDiscardLayout}
        onSaveLayout={() => void handleSaveLayout()}
      />
      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="wie__body">
        {loading ? (
          <WorkItemEditorLoadingState />
        ) : (
          <>
            {/* ── Library ────────────────────────────────────────────────────── */}
            <WorkItemFieldLibrary
              activeCanvasTab={activeCanvasTab}
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
              onDragStartField={handleDragStartField}
              onDragStartType={handleDragStartType}
              onDragEnd={handleDragEnd}
              onOpenNewFieldPanel={openNewFieldPanel}
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
              renderCardEmptySlot={renderCardEmptySlot}
              renderDetailInsertTarget={renderDetailInsertTarget}
              renderDetailFieldCard={renderDetailFieldCard}
              onPreviewSurfaceDragOver={handlePreviewSurfaceDragOver}
              onSurfaceDragLeave={makeSurfaceDragLeaveHandler}
              onApplyResolvedDropTarget={applyResolvedDropTarget}
              onDragEnd={handleDragEnd}
              onClearSelectedField={() => setSelectedFieldId(null)}
              onDebugSnapshot={setPreviewCardDebug}
              onDetailZoneDragOver={handleDetailZoneDragOver}
              onDetailZoneMouseMove={handleDetailZoneMouseMove}
            />
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

      {layoutMessage ? <p className="wie__footer-message">{layoutMessage}</p> : null}
    </div>
  );
}
