import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { useWorkspace } from "@/modules/workspace";
import type { ApiBoardColumn, ApiWorkflowState, BoardTemplateSummary } from "@/modules/workspace/model";
import { BoardColumnsSection } from "./board-columns-section";
import { BoardEditorHeader } from "./board-editor-header";
import {
  buildPerspectiveFromTemplateSeed,
  cloneStatuses,
  extractTemplateSeeds,
  resolvePerspectives,
  serializePerspective,
  toSlug
} from "./board-editor-settings.model";
import type { BoardAddColumnMode, BoardPerspective } from "./board-editor-settings.model";
import { BoardTemplateToolbar } from "./board-template-toolbar";
import "./board-editor-settings.css";

export function BoardEditorSettings() {
  const {
    snapshot,
    fetchBoardColumns,
    fetchWorkflowStates,
    createBoardColumn,
    updateBoardColumn,
    deleteBoardColumn,
    updatePreferences,
    listBoardTemplates,
    createBoardTemplate
  } = useWorkspace();

  const boardConfig = snapshot?.boardConfig;
  const baseStatuses = boardConfig?.statuses ?? [];

  const [columns, setColumns] = useState<ApiBoardColumn[]>([]);
  const [workflowStates, setWorkflowStates] = useState<ApiWorkflowState[]>([]);
  const [boardTemplates, setBoardTemplates] = useState<BoardTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  const [draftPerspectives, setDraftPerspectives] = useState<BoardPerspective[] | null>(null);
  const hasUnsavedChanges = draftPerspectives !== null;

  const [pendingHidden, setPendingHidden] = useState<Record<string, string[]>>({});

  const serverPerspectives = useMemo(
    () => resolvePerspectives(boardConfig, baseStatuses),
    [boardConfig, baseStatuses]
  );
  const displayPerspectives = useMemo(
    () => draftPerspectives ?? serverPerspectives,
    [draftPerspectives, serverPerspectives]
  );

  const [activePerspectiveId, setActivePerspectiveId] = useState<string>(() => serverPerspectives[0]?.id ?? "");
  const [creatingPerspective, setCreatingPerspective] = useState(false);
  const [newPerspectiveName, setNewPerspectiveName] = useState("");
  const [newPerspectiveTemplateKey, setNewPerspectiveTemplateKey] = useState("");
  const perspectiveInputRef = useRef<HTMLInputElement>(null);

  const [selectedApplyTemplateKey, setSelectedApplyTemplateKey] = useState("");
  const [creatingTemplateMode, setCreatingTemplateMode] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDescription, setNewTemplateDescription] = useState("");
  const [templateFeedback, setTemplateFeedback] = useState("");
  const [templateError, setTemplateError] = useState("");
  const templateInputRef = useRef<HTMLInputElement>(null);

  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnName, setEditingColumnName] = useState("");
  const [editingColumnStateId, setEditingColumnStateId] = useState("");

  const [deletingColumnId, setDeletingColumnId] = useState<string | null>(null);

  const [addColumnMode, setAddColumnMode] = useState<BoardAddColumnMode>(null);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnStateId, setNewColumnStateId] = useState("");
  const newColumnInputRef = useRef<HTMLInputElement>(null);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const activeStates = useMemo(() => workflowStates.filter((state) => state.isActive), [workflowStates]);
  const activeColumns = useMemo(
    () => columns.filter((column) => column.isActive).sort((left, right) => left.order - right.order),
    [columns]
  );
  const activePerspective = useMemo(
    () => displayPerspectives.find((perspective) => perspective.id === activePerspectiveId) ?? displayPerspectives[0] ?? null,
    [displayPerspectives, activePerspectiveId]
  );
  const activePendingHidden = useMemo(
    () => new Set(pendingHidden[activePerspectiveId] ?? []),
    [pendingHidden, activePerspectiveId]
  );

  const templateSeeds = useMemo(() => extractTemplateSeeds(boardTemplates), [boardTemplates]);
  const selectedCreateTemplateSeed = useMemo(
    () => templateSeeds.find((seed) => seed.key === newPerspectiveTemplateKey) ?? null,
    [templateSeeds, newPerspectiveTemplateKey]
  );
  const selectedApplyTemplateSeed = useMemo(
    () => templateSeeds.find((seed) => seed.key === selectedApplyTemplateKey) ?? null,
    [templateSeeds, selectedApplyTemplateKey]
  );

  const visibleColumns = useMemo(() => {
    const ids = activePerspective?.visibleBoardColumnIds;
    const columnsById = new Map(activeColumns.map((column) => [column.id, column]));
    if (Array.isArray(ids) && ids.length > 0) {
      return ids.map((id) => columnsById.get(id)).filter(Boolean) as ApiBoardColumn[];
    }
    return activeColumns;
  }, [activePerspective, activeColumns]);

  const columnsToShow = useMemo(() => {
    const hiddenColumns = activeColumns.filter((column) => activePendingHidden.has(column.id));
    return [...visibleColumns, ...hiddenColumns];
  }, [visibleColumns, activeColumns, activePendingHidden]);

  const columnsAvailableToAdd = useMemo(() => {
    const shownIds = new Set(columnsToShow.map((column) => column.id));
    return activeColumns.filter((column) => !shownIds.has(column.id));
  }, [activeColumns, columnsToShow]);

  useEffect(() => {
    if (displayPerspectives.length === 0) {
      setActivePerspectiveId("");
      return;
    }

    if (!displayPerspectives.some((perspective) => perspective.id === activePerspectiveId)) {
      setActivePerspectiveId(displayPerspectives[0].id);
    }
  }, [activePerspectiveId, displayPerspectives]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadingTemplates(true);
    try {
      const [nextColumns, nextStates, nextTemplates] = await Promise.all([
        fetchBoardColumns(),
        fetchWorkflowStates(),
        listBoardTemplates()
      ]);
      setColumns(nextColumns);
      setWorkflowStates(nextStates);
      setBoardTemplates(nextTemplates);
      setNewColumnStateId((current) => current || nextStates[0]?.id || "");
    } finally {
      setLoading(false);
      setLoadingTemplates(false);
    }
  }, [fetchBoardColumns, fetchWorkflowStates, listBoardTemplates]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (creatingPerspective) {
      perspectiveInputRef.current?.focus();
    }
  }, [creatingPerspective]);

  useEffect(() => {
    if (creatingTemplateMode) {
      templateInputRef.current?.focus();
    }
  }, [creatingTemplateMode]);

  useEffect(() => {
    if (addColumnMode === "new") {
      newColumnInputRef.current?.focus();
    }
  }, [addColumnMode]);

  const persistPerspectives = useCallback(
    async (nextPerspectives: BoardPerspective[], defaultBoardMode?: string) => {
      setSaving(true);
      try {
        await updatePreferences({
          ...(defaultBoardMode ? { defaultBoardMode } : {}),
          settings: {
            perspectives: nextPerspectives.map((perspective, index) => serializePerspective(perspective, index))
          }
        });
      } finally {
        setSaving(false);
      }
    },
    [updatePreferences]
  );

  const handleSave = async () => {
    if (!draftPerspectives) {
      return;
    }

    await persistPerspectives(draftPerspectives, snapshot?.preferences.defaultBoardMode);
    setDraftPerspectives(null);
    setPendingHidden({});
  };

  const handleDiscard = () => {
    setDraftPerspectives(null);
    setPendingHidden({});
    setTemplateFeedback("");
    setTemplateError("");
    setSelectedApplyTemplateKey("");
  };

  const updateDraft = useCallback(
    (updater: (previous: BoardPerspective[]) => BoardPerspective[]) => {
      setDraftPerspectives((previous) => updater(previous ?? serverPerspectives));
    },
    [serverPerspectives]
  );

  const handleCreatePerspective = () => {
    const templateSeed = selectedCreateTemplateSeed;
    const typedName = newPerspectiveName.trim();
    const resolvedName = typedName || templateSeed?.perspectiveName || "";
    if (!resolvedName) {
      return;
    }

    const baseId = toSlug(typedName || templateSeed?.perspectiveKey || resolvedName) || "perspective";
    let nextId = baseId;
    let suffix = 2;
    const existingIds = new Set(displayPerspectives.map((perspective) => perspective.id));
    while (existingIds.has(nextId)) {
      nextId = `${baseId}-${suffix}`;
      suffix += 1;
    }

    const nextPerspective = templateSeed
      ? buildPerspectiveFromTemplateSeed({
          seed: templateSeed,
          id: nextId,
          label: resolvedName.toUpperCase(),
          activeColumns,
          fallbackStatuses: baseStatuses
        })
      : {
          id: nextId,
          label: resolvedName.toUpperCase(),
          statuses: cloneStatuses(baseStatuses),
          statusSource: { kind: "workflow_state" as const },
          visibleBoardColumnIds: activeColumns.map((column) => column.id)
        };

    updateDraft((previous) => [...previous, nextPerspective]);
    setActivePerspectiveId(nextId);
    setNewPerspectiveName("");
    setNewPerspectiveTemplateKey("");
    setCreatingPerspective(false);
  };

  const handleDeletePerspective = (perspectiveId: string) => {
    if (displayPerspectives.length <= 1) {
      return;
    }

    const nextPerspectives = displayPerspectives.filter((perspective) => perspective.id !== perspectiveId);
    if (activePerspectiveId === perspectiveId) {
      setActivePerspectiveId(nextPerspectives[0]?.id ?? "");
    }
    setDraftPerspectives(nextPerspectives);
  };

  const handleApplyTemplateToActivePerspective = () => {
    if (!activePerspective || !selectedApplyTemplateSeed) {
      return;
    }

    updateDraft((previous) =>
      previous.map((perspective) =>
        perspective.id === activePerspective.id
          ? buildPerspectiveFromTemplateSeed({
              seed: selectedApplyTemplateSeed,
              id: perspective.id,
              label: perspective.label,
              activeColumns,
              fallbackStatuses: baseStatuses
            })
          : perspective
      )
    );

    setTemplateFeedback(`Template ${selectedApplyTemplateSeed.templateName} aplicado em ${activePerspective.label}.`);
    setTemplateError("");
    setSelectedApplyTemplateKey("");
  };

  const handleSavePerspectiveAsTemplate = async () => {
    if (!activePerspective) {
      return;
    }

    const normalizedName = newTemplateName.trim();
    if (!normalizedName) {
      setTemplateError("Informe um nome para o template.");
      setTemplateFeedback("");
      return;
    }

    const visibleColumnIds =
      Array.isArray(activePerspective.visibleBoardColumnIds) && activePerspective.visibleBoardColumnIds.length > 0
        ? activePerspective.visibleBoardColumnIds
        : activeColumns.map((column) => column.id);
    const columnSlugById = new Map(activeColumns.map((column) => [column.id, column.slug]));
    const visibleBoardColumnSlugs = visibleColumnIds
      .map((columnId) => columnSlugById.get(columnId))
      .filter((slug): slug is string => Boolean(slug));

    setSaving(true);
    setTemplateError("");
    setTemplateFeedback("");
    try {
      await createBoardTemplate({
        name: normalizedName,
        description: newTemplateDescription.trim() || activePerspective.caption || "",
        schema: {
          perspectives: [
            {
              key: activePerspective.id,
              name: activePerspective.label,
              caption: activePerspective.caption,
              compactCards: Boolean(activePerspective.compactCards),
              allowedTaskTypes: activePerspective.allowedTaskTypes ?? [],
              visibleBoardColumnSlugs,
              createTaskColumnSlugs: (activePerspective.createTaskColumnIds ?? [])
                .map((columnId) => columnSlugById.get(columnId))
                .filter((slug): slug is string => Boolean(slug)),
              statusSource: activePerspective.statusSource,
              statuses: activePerspective.statuses
            }
          ]
        },
        rules: {
          source: "board_editor_perspective",
          perspectiveId: activePerspective.id
        }
      });

      setCreatingTemplateMode(false);
      setNewTemplateName("");
      setNewTemplateDescription("");
      setTemplateFeedback(`Template ${normalizedName} salvo com base na perspectiva ${activePerspective.label}.`);
      await loadData();
    } catch {
      setTemplateError("Nao foi possivel salvar o template desta perspectiva.");
    } finally {
      setSaving(false);
    }
  };

  const handleHideColumn = (columnId: string) => {
    updateDraft((previous) =>
      previous.map((perspective) => {
        if (perspective.id !== activePerspectiveId) {
          return perspective;
        }

        const currentVisible =
          Array.isArray(perspective.visibleBoardColumnIds) && perspective.visibleBoardColumnIds.length > 0
            ? new Set(perspective.visibleBoardColumnIds)
            : new Set(activeColumns.map((column) => column.id));
        currentVisible.delete(columnId);
        return {
          ...perspective,
          visibleBoardColumnIds: Array.from(currentVisible),
          createTaskColumnIds: (perspective.createTaskColumnIds ?? []).filter((id) => id !== columnId)
        };
      })
    );

    setPendingHidden((previous) => ({
      ...previous,
      [activePerspectiveId]: [...(previous[activePerspectiveId] ?? []), columnId]
    }));
  };

  const handleShowColumn = (columnId: string) => {
    updateDraft((previous) =>
      previous.map((perspective) => {
        if (perspective.id !== activePerspectiveId) {
          return perspective;
        }

        const currentVisible =
          Array.isArray(perspective.visibleBoardColumnIds) && perspective.visibleBoardColumnIds.length > 0
            ? new Set(perspective.visibleBoardColumnIds)
            : new Set(activeColumns.map((column) => column.id));
        currentVisible.add(columnId);
        return { ...perspective, visibleBoardColumnIds: Array.from(currentVisible) };
      })
    );

    setPendingHidden((previous) => ({
      ...previous,
      [activePerspectiveId]: (previous[activePerspectiveId] ?? []).filter((id) => id !== columnId)
    }));
  };

  const handleAddExistingColumn = (columnId: string) => {
    updateDraft((previous) =>
      previous.map((perspective) => {
        if (perspective.id !== activePerspectiveId) {
          return perspective;
        }

        const currentVisible =
          Array.isArray(perspective.visibleBoardColumnIds) && perspective.visibleBoardColumnIds.length > 0
            ? new Set(perspective.visibleBoardColumnIds)
            : new Set(activeColumns.map((column) => column.id));
        currentVisible.add(columnId);
        return { ...perspective, visibleBoardColumnIds: Array.from(currentVisible) };
      })
    );
    setAddColumnMode(null);
  };

  const handleToggleCreateTaskColumn = (columnId: string) => {
    updateDraft((previous) =>
      previous.map((perspective) => {
        if (perspective.id !== activePerspectiveId) {
          return perspective;
        }

        const current = new Set(perspective.createTaskColumnIds ?? []);
        if (current.has(columnId)) {
          current.delete(columnId);
        } else {
          current.add(columnId);
        }

        return { ...perspective, createTaskColumnIds: Array.from(current) };
      })
    );
  };

  const handleDragStart = (event: DragEvent<HTMLDivElement>, columnId: string) => {
    setDraggingId(columnId);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>, columnId: string) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (columnId !== draggingId) {
      setDragOverId(columnId);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, targetId: string) => {
    event.preventDefault();
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }

    updateDraft((previous) =>
      previous.map((perspective) => {
        if (perspective.id !== activePerspectiveId) {
          return perspective;
        }

        const currentOrder =
          Array.isArray(perspective.visibleBoardColumnIds) && perspective.visibleBoardColumnIds.length > 0
            ? [...perspective.visibleBoardColumnIds]
            : activeColumns.map((column) => column.id);
        const fromIndex = currentOrder.indexOf(draggingId);
        const toIndex = currentOrder.indexOf(targetId);
        if (fromIndex === -1 || toIndex === -1) {
          return perspective;
        }

        const nextOrder = [...currentOrder];
        nextOrder.splice(fromIndex, 1);
        nextOrder.splice(toIndex, 0, draggingId);
        return { ...perspective, visibleBoardColumnIds: nextOrder };
      })
    );

    setDraggingId(null);
    setDragOverId(null);
  };

  const handleStartEdit = (column: ApiBoardColumn) => {
    setEditingColumnId(column.id);
    setEditingColumnName(column.name);
    setEditingColumnStateId(column.stateIds[0] ?? activeStates[0]?.id ?? "");
    setAddColumnMode(null);
    setDeletingColumnId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingColumnId || !editingColumnName.trim()) {
      return;
    }

    setSaving(true);
    try {
      await updateBoardColumn(editingColumnId, {
        name: editingColumnName.trim(),
        stateIds: editingColumnStateId ? [editingColumnStateId] : []
      });
      setEditingColumnId(null);
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteColumn = async (columnId: string) => {
    if (deletingColumnId !== columnId) {
      setDeletingColumnId(columnId);
      return;
    }

    setSaving(true);
    try {
      await deleteBoardColumn(columnId);
      setDeletingColumnId(null);
      await loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleCreateColumn = async () => {
    if (!newColumnName.trim()) {
      return;
    }

    setSaving(true);
    try {
      await createBoardColumn({
        name: newColumnName.trim(),
        stateIds: newColumnStateId ? [newColumnStateId] : []
      });

      const updatedColumns = await fetchBoardColumns();
      const previousIds = new Set(columns.map((column) => column.id));
      const createdColumn = updatedColumns.find((column) => !previousIds.has(column.id));
      setColumns(updatedColumns);

      if (createdColumn) {
        const currentPerspectives = draftPerspectives ?? serverPerspectives;
        const nextPerspectives = currentPerspectives.map((perspective) => {
          if (perspective.id !== activePerspectiveId) {
            if (!Array.isArray(perspective.visibleBoardColumnIds) || perspective.visibleBoardColumnIds.length === 0) {
              return perspective;
            }
            return {
              ...perspective,
              visibleBoardColumnIds: [...perspective.visibleBoardColumnIds, createdColumn.id]
            };
          }

          const visible =
            Array.isArray(perspective.visibleBoardColumnIds) && perspective.visibleBoardColumnIds.length > 0
              ? new Set(perspective.visibleBoardColumnIds)
              : new Set(updatedColumns.filter((column) => column.isActive).map((column) => column.id));
          visible.add(createdColumn.id);
          return { ...perspective, visibleBoardColumnIds: Array.from(visible) };
        });

        if (draftPerspectives) {
          setDraftPerspectives(nextPerspectives);
        } else {
          await persistPerspectives(nextPerspectives);
        }
      }

      setNewColumnName("");
      setAddColumnMode(null);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelCreatePerspective = () => {
    setCreatingPerspective(false);
    setNewPerspectiveName("");
    setNewPerspectiveTemplateKey("");
  };

  const handleStartTemplateCreate = () => {
    setCreatingTemplateMode(true);
    setTemplateFeedback("");
    setTemplateError("");
    setNewTemplateName(activePerspective ? `${activePerspective.label} Template` : "");
    setNewTemplateDescription(activePerspective?.caption ?? "");
  };

  const handleCancelTemplateCreate = () => {
    setCreatingTemplateMode(false);
    setNewTemplateName("");
    setNewTemplateDescription("");
  };

  return (
    <div
      className="board-editor"
      onClick={() => {
        setDeletingColumnId(null);
        setAddColumnMode(null);
      }}
    >
      <BoardEditorHeader
        perspectives={displayPerspectives}
        activePerspectiveId={activePerspectiveId}
        creatingPerspective={creatingPerspective}
        newPerspectiveName={newPerspectiveName}
        newPerspectiveTemplateKey={newPerspectiveTemplateKey}
        selectedCreateTemplateSeed={selectedCreateTemplateSeed}
        templateSeeds={templateSeeds}
        perspectiveInputRef={perspectiveInputRef}
        hasUnsavedChanges={hasUnsavedChanges}
        saving={saving}
        onSelectPerspective={setActivePerspectiveId}
        onDeletePerspective={handleDeletePerspective}
        onCreatePerspective={handleCreatePerspective}
        onStartCreatingPerspective={() => setCreatingPerspective(true)}
        onCancelCreatingPerspective={handleCancelCreatePerspective}
        onNewPerspectiveNameChange={setNewPerspectiveName}
        onNewPerspectiveTemplateKeyChange={setNewPerspectiveTemplateKey}
        onDiscard={handleDiscard}
        onSave={() => void handleSave()}
      />

      <BoardTemplateToolbar
        activePerspective={activePerspective}
        templateSeeds={templateSeeds}
        selectedApplyTemplateKey={selectedApplyTemplateKey}
        selectedApplyTemplateSeed={selectedApplyTemplateSeed}
        loadingTemplates={loadingTemplates}
        creatingTemplateMode={creatingTemplateMode}
        templateInputRef={templateInputRef}
        newTemplateName={newTemplateName}
        newTemplateDescription={newTemplateDescription}
        templateFeedback={templateFeedback}
        templateError={templateError}
        onSelectedApplyTemplateKeyChange={setSelectedApplyTemplateKey}
        onApplyTemplateToActivePerspective={handleApplyTemplateToActivePerspective}
        onNewTemplateNameChange={setNewTemplateName}
        onNewTemplateDescriptionChange={setNewTemplateDescription}
        onSavePerspectiveAsTemplate={() => void handleSavePerspectiveAsTemplate()}
        onStartCreatingTemplate={handleStartTemplateCreate}
        onCancelCreatingTemplate={handleCancelTemplateCreate}
      />

      <BoardColumnsSection
        loading={loading}
        columnsToShow={columnsToShow}
        columnsAvailableToAdd={columnsAvailableToAdd}
        activeStates={activeStates}
        activePerspective={activePerspective}
        activePendingHidden={activePendingHidden}
        editingColumnId={editingColumnId}
        editingColumnName={editingColumnName}
        editingColumnStateId={editingColumnStateId}
        deletingColumnId={deletingColumnId}
        addColumnMode={addColumnMode}
        newColumnInputRef={newColumnInputRef}
        newColumnName={newColumnName}
        newColumnStateId={newColumnStateId}
        draggingId={draggingId}
        dragOverId={dragOverId}
        saving={saving}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onStartEdit={handleStartEdit}
        onEditingColumnNameChange={setEditingColumnName}
        onEditingColumnStateIdChange={setEditingColumnStateId}
        onSaveEdit={() => void handleSaveEdit()}
        onCancelEdit={() => setEditingColumnId(null)}
        onShowColumn={handleShowColumn}
        onHideColumn={handleHideColumn}
        onDeleteColumn={(columnId) => void handleDeleteColumn(columnId)}
        onCancelDelete={() => setDeletingColumnId(null)}
        onToggleCreateTaskColumn={handleToggleCreateTaskColumn}
        onOpenAddColumnPicker={() => {
          setAddColumnMode("pick");
          setEditingColumnId(null);
          setDeletingColumnId(null);
        }}
        onCloseAddColumnPicker={() => setAddColumnMode(null)}
        onAddExistingColumn={handleAddExistingColumn}
        onStartNewColumn={() => setAddColumnMode("new")}
        onNewColumnNameChange={setNewColumnName}
        onNewColumnStateIdChange={setNewColumnStateId}
        onCreateColumn={() => void handleCreateColumn()}
        onBackToPicker={() => {
          setAddColumnMode("pick");
          setNewColumnName("");
        }}
      />
    </div>
  );
}
