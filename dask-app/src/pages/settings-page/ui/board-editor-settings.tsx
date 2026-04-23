import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { factoryBoardConfig } from "@/entities/task";
import { useWorkspace } from "@/modules/workspace";
import type {
  ApiBoardColumn,
  ApiWorkflowState,
  BoardTemplatePerspective,
  BoardTemplateSummary
} from "@/modules/workspace/model";
import "./board-editor-settings.css";

type PerspectiveStatus = { id: string; label: string; dot: string };

type PerspectiveStatusSource =
  | { kind: "workflow_state" }
  | { kind: "custom_field"; fieldId: string; fallbackByStatus?: Record<string, string> };

type PerspectiveTemplateMeta = {
  templateId: string;
  templateName: string;
  perspectiveKey: string;
  perspectiveName: string;
};

type BoardPerspective = {
  id: string;
  label: string;
  caption?: string;
  statuses: PerspectiveStatus[];
  statusSource: PerspectiveStatusSource;
  allowedTaskTypes?: string[];
  compactCards?: boolean;
  visibleBoardColumnIds?: string[];
  template?: PerspectiveTemplateMeta;
};

type PerspectiveTemplateSeed = {
  key: string;
  templateId: string;
  templateName: string;
  templateDescription?: string | null;
  perspectiveKey: string;
  perspectiveName: string;
  caption?: string;
  statuses: PerspectiveStatus[];
  statusSource: PerspectiveStatusSource;
  allowedTaskTypes?: string[];
  compactCards?: boolean;
  visibleBoardColumnSlugs?: string[];
  visibleBoardColumnIds?: string[];
};

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function cloneStatuses(statuses: PerspectiveStatus[]): PerspectiveStatus[] {
  return statuses.map((status) => ({ ...status }));
}

function cloneStatusSource(source: PerspectiveStatusSource): PerspectiveStatusSource {
  if (source.kind === "custom_field") {
    return {
      kind: "custom_field",
      fieldId: source.fieldId,
      fallbackByStatus: source.fallbackByStatus ? { ...source.fallbackByStatus } : undefined
    };
  }

  return { kind: "workflow_state" };
}

function resolvePerspectives(rawBoardConfig: unknown, baseStatuses: PerspectiveStatus[]): BoardPerspective[] {
  if (rawBoardConfig && typeof rawBoardConfig === "object") {
    const cfg = rawBoardConfig as Record<string, unknown>;
    if (Array.isArray(cfg.perspectives) && cfg.perspectives.length > 0) {
      return cfg.perspectives as BoardPerspective[];
    }
    if (Array.isArray(cfg.views) && cfg.views.length > 0) {
      return cfg.views as BoardPerspective[];
    }
  }
  return [{ id: "dev", label: "DEV", statuses: baseStatuses, statusSource: { kind: "workflow_state" } }];
}

function serializePerspective(perspective: BoardPerspective, position: number) {
  return {
    key: perspective.id,
    name: perspective.label,
    caption: perspective.caption,
    compactCards: Boolean(perspective.compactCards),
    position,
    allowedTaskTypes: perspective.allowedTaskTypes ?? [],
    visibleBoardColumnIds: perspective.visibleBoardColumnIds ?? [],
    statusSource: perspective.statusSource,
    statuses: perspective.statuses,
    template: perspective.template
  };
}

function normalizeTemplatePerspectiveStatusSource(
  rawSource: BoardTemplatePerspective["statusSource"]
): PerspectiveStatusSource {
  if (rawSource?.kind === "custom_field" && typeof rawSource.fieldId === "string" && rawSource.fieldId.trim()) {
    return {
      kind: "custom_field",
      fieldId: rawSource.fieldId,
      fallbackByStatus: rawSource.fallbackByStatus ? { ...rawSource.fallbackByStatus } : undefined
    };
  }

  return { kind: "workflow_state" };
}

function extractTemplateSeeds(templates: BoardTemplateSummary[]): PerspectiveTemplateSeed[] {
  return templates.flatMap((template) => {
    const rawPerspectives = Array.isArray(template.schema?.perspectives) ? template.schema?.perspectives : [];
    const seeds = rawPerspectives.map((perspective, index): PerspectiveTemplateSeed | null => {
        if (!perspective || typeof perspective !== "object") {
          return null;
        }

        const perspectiveKey =
          typeof perspective.key === "string" && perspective.key.trim().length > 0
            ? perspective.key
            : `perspective-${index + 1}`;
        const perspectiveName =
          typeof perspective.name === "string" && perspective.name.trim().length > 0
            ? perspective.name
            : `Perspectiva ${index + 1}`;

        const statuses = Array.isArray(perspective.statuses)
          ? perspective.statuses
              .map((status) =>
                status &&
                typeof status === "object" &&
                typeof status.id === "string" &&
                typeof status.label === "string" &&
                typeof status.dot === "string"
                  ? { id: status.id, label: status.label, dot: status.dot }
                  : null
              )
              .filter((status): status is PerspectiveStatus => status !== null)
          : [];

        return {
          key: `${template.id}::${perspectiveKey}`,
          templateId: template.id,
          templateName: template.name,
          templateDescription: template.description ?? undefined,
          perspectiveKey,
          perspectiveName,
          caption: typeof perspective.caption === "string" ? perspective.caption : undefined,
          statuses,
          statusSource: normalizeTemplatePerspectiveStatusSource(perspective.statusSource),
          allowedTaskTypes: Array.isArray(perspective.allowedTaskTypes)
            ? perspective.allowedTaskTypes.filter((value): value is string => typeof value === "string")
            : undefined,
          compactCards: Boolean(perspective.compactCards),
          visibleBoardColumnSlugs: Array.isArray(perspective.visibleBoardColumnSlugs)
            ? perspective.visibleBoardColumnSlugs.filter((value): value is string => typeof value === "string")
            : undefined,
          visibleBoardColumnIds: Array.isArray(perspective.visibleBoardColumnIds)
            ? perspective.visibleBoardColumnIds.filter((value): value is string => typeof value === "string")
            : undefined
        };
      });

    return seeds.filter((seed): seed is PerspectiveTemplateSeed => seed !== null);
  });
}

function resolveVisibleColumnIdsFromSeed(seed: PerspectiveTemplateSeed, activeColumns: ApiBoardColumn[]): string[] {
  const columnIdBySlug = new Map(activeColumns.map((column) => [column.slug, column.id]));

  const fromSlugs = Array.isArray(seed.visibleBoardColumnSlugs)
    ? seed.visibleBoardColumnSlugs
        .map((slug) => columnIdBySlug.get(slug))
        .filter((columnId): columnId is string => Boolean(columnId))
    : [];

  if (fromSlugs.length > 0) {
    return Array.from(new Set(fromSlugs));
  }

  if (Array.isArray(seed.visibleBoardColumnIds) && seed.visibleBoardColumnIds.length > 0) {
    return Array.from(new Set(seed.visibleBoardColumnIds));
  }

  return activeColumns.map((column) => column.id);
}

function buildPerspectiveFromTemplateSeed(input: {
  seed: PerspectiveTemplateSeed;
  id: string;
  label: string;
  activeColumns: ApiBoardColumn[];
  fallbackStatuses: PerspectiveStatus[];
}): BoardPerspective {
  return {
    id: input.id,
    label: input.label,
    caption: input.seed.caption,
    statuses: cloneStatuses(input.seed.statuses.length > 0 ? input.seed.statuses : input.fallbackStatuses),
    statusSource: cloneStatusSource(input.seed.statusSource),
    allowedTaskTypes: input.seed.allowedTaskTypes ? [...input.seed.allowedTaskTypes] : undefined,
    compactCards: Boolean(input.seed.compactCards),
    visibleBoardColumnIds: resolveVisibleColumnIdsFromSeed(input.seed, input.activeColumns),
    template: {
      templateId: input.seed.templateId,
      templateName: input.seed.templateName,
      perspectiveKey: input.seed.perspectiveKey,
      perspectiveName: input.seed.perspectiveName
    }
  };
}

function IconEye() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconGrip() {
  return (
    <svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor">
      <circle cx="3.5" cy="2" r="1.4" />
      <circle cx="8.5" cy="2" r="1.4" />
      <circle cx="3.5" cy="7" r="1.4" />
      <circle cx="8.5" cy="7" r="1.4" />
      <circle cx="3.5" cy="12" r="1.4" />
      <circle cx="8.5" cy="12" r="1.4" />
    </svg>
  );
}

function IconTemplate() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5z" />
      <path d="M13 3v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h5" />
    </svg>
  );
}

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

  const boardConfig = snapshot?.boardConfig ?? factoryBoardConfig;
  const baseStatuses = boardConfig.statuses;

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

  const [activePerspectiveId, setActivePerspectiveId] = useState<string>(() => serverPerspectives[0]?.id ?? "dev");
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

  const [addColumnMode, setAddColumnMode] = useState<null | "pick" | "new">(null);
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
      setActivePerspectiveId(nextPerspectives[0]?.id ?? "dev");
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
        return { ...perspective, visibleBoardColumnIds: Array.from(currentVisible) };
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

  return (
    <div
      className="board-editor"
      onClick={() => {
        setDeletingColumnId(null);
        setAddColumnMode(null);
      }}
    >
      <div className="board-editor__topbar">
        <div className="board-editor__tabs">
          {displayPerspectives.map((perspective) => (
            <div key={perspective.id} className={`board-editor__tab${perspective.id === activePerspectiveId ? " is-active" : ""}`}>
              <button
                type="button"
                className="board-editor__tab-btn"
                onClick={(event) => {
                  event.stopPropagation();
                  setActivePerspectiveId(perspective.id);
                }}
              >
                <i style={{ background: perspective.statuses[0]?.dot ?? "#0a86e8" }} />
                {perspective.label}
              </button>
              {displayPerspectives.length > 1 && (
                <button
                  type="button"
                  className="board-editor__tab-remove"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDeletePerspective(perspective.id);
                  }}
                >
                  x
                </button>
              )}
            </div>
          ))}

          {creatingPerspective ? (
            <div className="board-editor__tab-create board-editor__tab-create--extended" onClick={(event) => event.stopPropagation()}>
              <input
                ref={perspectiveInputRef}
                className="board-editor__tab-input"
                value={newPerspectiveName}
                placeholder={selectedCreateTemplateSeed ? selectedCreateTemplateSeed.perspectiveName : "Nome..."}
                onChange={(event) => setNewPerspectiveName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleCreatePerspective();
                  }
                  if (event.key === "Escape") {
                    setCreatingPerspective(false);
                    setNewPerspectiveName("");
                    setNewPerspectiveTemplateKey("");
                  }
                }}
              />
              <select
                className="board-editor__tab-template-select"
                value={newPerspectiveTemplateKey}
                onChange={(event) => setNewPerspectiveTemplateKey(event.target.value)}
              >
                <option value="">Sem template</option>
                {templateSeeds.map((seed) => (
                  <option key={seed.key} value={seed.key}>
                    {seed.templateName} / {seed.perspectiveName}
                  </option>
                ))}
              </select>
              <button type="button" className="board-editor__tab-confirm" onClick={handleCreatePerspective}>
                Criar
              </button>
              <button
                type="button"
                className="board-editor__tab-cancel"
                onClick={() => {
                  setCreatingPerspective(false);
                  setNewPerspectiveName("");
                  setNewPerspectiveTemplateKey("");
                }}
              >
                x
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="board-editor__add-perspective"
              onClick={(event) => {
                event.stopPropagation();
                setCreatingPerspective(true);
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Perspectiva
            </button>
          )}
        </div>

        <div className={`board-editor__save-area${hasUnsavedChanges ? " has-changes" : ""}`}>
          {hasUnsavedChanges && (
            <>
              <span className="board-editor__unsaved-label">
                <span className="board-editor__unsaved-dot" />
                Nao salvo
              </span>
              <button type="button" className="board-editor__btn-discard" onClick={(event) => {
                event.stopPropagation();
                handleDiscard();
              }} disabled={saving}>
                Descartar
              </button>
            </>
          )}
          <button
            type="button"
            className="board-editor__btn-save-main"
            onClick={(event) => {
              event.stopPropagation();
              void handleSave();
            }}
            disabled={!hasUnsavedChanges || saving}
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      <div className="board-editor__template-toolbar">
        <div className="board-editor__template-group">
          <div className="board-editor__template-group-copy">
            <strong>Template por perspectiva</strong>
            <span>
              {activePerspective?.template
                ? `Base atual: ${activePerspective.template.templateName} / ${activePerspective.template.perspectiveName}`
                : "Aplique um template salvo na perspectiva ativa."}
            </span>
          </div>
          <div className="board-editor__template-actions">
            <select
              className="board-editor__template-select"
              value={selectedApplyTemplateKey}
              onChange={(event) => setSelectedApplyTemplateKey(event.target.value)}
              disabled={loadingTemplates || templateSeeds.length === 0}
            >
              <option value="">
                {loadingTemplates ? "Carregando templates..." : templateSeeds.length === 0 ? "Sem templates salvos" : "Selecionar template"}
              </option>
              {templateSeeds.map((seed) => (
                <option key={seed.key} value={seed.key}>
                  {seed.templateName} / {seed.perspectiveName}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="board-editor__btn-discard"
              onClick={() => handleApplyTemplateToActivePerspective()}
              disabled={!activePerspective || !selectedApplyTemplateSeed}
            >
              Aplicar template
            </button>
          </div>
        </div>

        <div className="board-editor__template-group board-editor__template-group--save">
          {creatingTemplateMode ? (
            <div className="board-editor__template-create">
              <input
                ref={templateInputRef}
                className="board-editor__template-input"
                value={newTemplateName}
                placeholder="Nome do template"
                onChange={(event) => setNewTemplateName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleSavePerspectiveAsTemplate();
                  }
                  if (event.key === "Escape") {
                    setCreatingTemplateMode(false);
                    setNewTemplateName("");
                    setNewTemplateDescription("");
                  }
                }}
              />
              <input
                className="board-editor__template-input board-editor__template-input--secondary"
                value={newTemplateDescription}
                placeholder="Descricao opcional"
                onChange={(event) => setNewTemplateDescription(event.target.value)}
              />
              <button type="button" className="board-editor__btn-save-main board-editor__btn-save-main--compact" onClick={() => void handleSavePerspectiveAsTemplate()}>
                Salvar template
              </button>
              <button
                type="button"
                className="board-editor__btn-cancel"
                onClick={() => {
                  setCreatingTemplateMode(false);
                  setNewTemplateName("");
                  setNewTemplateDescription("");
                }}
              >
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="board-editor__template-save-btn"
              onClick={() => {
                setCreatingTemplateMode(true);
                setTemplateFeedback("");
                setTemplateError("");
                setNewTemplateName(activePerspective ? `${activePerspective.label} Template` : "");
                setNewTemplateDescription(activePerspective?.caption ?? "");
              }}
              disabled={!activePerspective}
            >
              <IconTemplate />
              Salvar perspectiva como template
            </button>
          )}
          {templateFeedback ? <span className="board-editor__template-feedback">{templateFeedback}</span> : null}
          {templateError ? <span className="board-editor__template-error">{templateError}</span> : null}
        </div>
      </div>

      <div className="board-editor__canvas-wrap">
        <div className="board-editor__canvas">
          {loading ? (
            <>
              {[1, 2, 3, 4].map((index) => (
                <div key={index} className="board-editor__skeleton-col" />
              ))}
            </>
          ) : (
            <>
              {columnsToShow.map((column) => {
                const isHidden = activePendingHidden.has(column.id);
                const stateForColumn = activeStates.find((state) => state.id === column.stateIds[0]);
                const isEditing = editingColumnId === column.id;
                const isConfirmingDelete = deletingColumnId === column.id;
                const isDragging = draggingId === column.id;
                const isDragOver = dragOverId === column.id && draggingId !== column.id;

                return (
                  <div
                    key={column.id}
                    className={[
                      "board-editor__column",
                      isHidden ? "board-editor__column--hidden" : "",
                      isEditing ? "board-editor__column--editing" : "",
                      isConfirmingDelete ? "board-editor__column--confirming" : "",
                      isDragging ? "board-editor__column--dragging" : "",
                      isDragOver ? "board-editor__column--drag-over" : ""
                    ].filter(Boolean).join(" ")}
                    draggable={!isHidden && !isEditing && !isConfirmingDelete}
                    onDragStart={(event) => handleDragStart(event, column.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(event) => handleDragOver(event, column.id)}
                    onDrop={(event) => handleDrop(event, column.id)}
                    onClick={(event) => event.stopPropagation()}
                  >
                    {isEditing ? (
                      <div className="board-editor__column-edit-form">
                        <div className="board-editor__edit-field">
                          <label className="board-editor__edit-label">Nome</label>
                          <input
                            className="board-editor__edit-input"
                            value={editingColumnName}
                            autoFocus
                            onChange={(event) => setEditingColumnName(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                void handleSaveEdit();
                              }
                              if (event.key === "Escape") {
                                setEditingColumnId(null);
                              }
                            }}
                          />
                        </div>
                        <div className="board-editor__edit-field">
                          <label className="board-editor__edit-label">Estado automatico</label>
                          <select className="board-editor__edit-select" value={editingColumnStateId} onChange={(event) => setEditingColumnStateId(event.target.value)}>
                            <option value="">Sem estado</option>
                            {activeStates.map((state) => (
                              <option key={state.id} value={state.id}>
                                {state.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="board-editor__edit-actions">
                          <button type="button" className="board-editor__btn-save" onClick={() => void handleSaveEdit()} disabled={saving || !editingColumnName.trim()}>
                            {saving ? "..." : "Salvar"}
                          </button>
                          <button type="button" className="board-editor__btn-cancel" onClick={() => setEditingColumnId(null)}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="board-editor__column-head">
                          {!isHidden && (
                            <span className="board-editor__drag-handle" title="Arrastar para reorganizar">
                              <IconGrip />
                            </span>
                          )}
                          <div className="board-editor__column-title">
                            <span className="board-editor__column-dot" style={{ background: stateForColumn?.color ?? "#0a86e8" }} />
                            <span className="board-editor__column-name">{column.name}</span>
                          </div>
                          <div className="board-editor__column-actions">
                            {!isHidden && (
                              <button type="button" className="board-editor__action-btn board-editor__action-btn--edit" onClick={(event) => {
                                event.stopPropagation();
                                handleStartEdit(column);
                              }} title="Editar">
                                <IconPencil />
                              </button>
                            )}
                            <button
                              type="button"
                              className={`board-editor__action-btn board-editor__action-btn--visibility${isHidden ? " is-hidden" : " is-visible"}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                isHidden ? handleShowColumn(column.id) : handleHideColumn(column.id);
                              }}
                              title={isHidden ? "Mostrar nesta perspectiva" : "Ocultar nesta perspectiva"}
                            >
                              {isHidden ? <IconEyeOff /> : <IconEye />}
                            </button>
                            {!isHidden && (
                              <button
                                type="button"
                                className={`board-editor__action-btn board-editor__action-btn--delete${isConfirmingDelete ? " is-confirming" : ""}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleDeleteColumn(column.id);
                                }}
                                title={isConfirmingDelete ? "Confirmar?" : "Remover"}
                                disabled={saving}
                              >
                                <IconTrash />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="board-editor__column-meta">
                          <span className="board-editor__state-dot" style={{ background: stateForColumn?.color ?? "#c0ccd8" }} />
                          <span className="board-editor__state-name">{stateForColumn?.name ?? "Sem estado"}</span>
                          <span className="board-editor__col-slug">/{column.slug}</span>
                          {isHidden && (
                            <span className="board-editor__hidden-badge">
                              <IconEyeOff />
                              Oculta
                            </span>
                          )}
                        </div>

                        <div className={`board-editor__mock-cards${isHidden ? " is-dimmed" : ""}`}>
                          <div className="board-editor__mock-card board-editor__mock-card--a" />
                          <div className="board-editor__mock-card board-editor__mock-card--b" />
                          <div className="board-editor__mock-card board-editor__mock-card--c" />
                          <div className="board-editor__mock-card board-editor__mock-card--a" />
                          <div className="board-editor__mock-card board-editor__mock-card--b" />
                        </div>

                        {isConfirmingDelete && (
                          <div className="board-editor__confirm-overlay" onClick={(event) => event.stopPropagation()}>
                            <p>
                              Remover <strong>{column.name}</strong>?
                            </p>
                            <div className="board-editor__confirm-actions">
                              <button type="button" className="board-editor__btn-confirm-delete" onClick={() => void handleDeleteColumn(column.id)} disabled={saving}>
                                {saving ? "Removendo..." : "Sim, remover"}
                              </button>
                              <button type="button" className="board-editor__btn-cancel" onClick={(event) => {
                                event.stopPropagation();
                                setDeletingColumnId(null);
                              }}>
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}

              {addColumnMode === null && (
                <button
                  type="button"
                  className="board-editor__add-column"
                  onClick={(event) => {
                    event.stopPropagation();
                    setAddColumnMode("pick");
                    setEditingColumnId(null);
                    setDeletingColumnId(null);
                  }}
                >
                  <span className="board-editor__add-column-icon">
                    <IconPlus />
                  </span>
                  <span>Nova coluna</span>
                </button>
              )}

              {addColumnMode === "pick" && (
                <div className="board-editor__column board-editor__column--picker" onClick={(event) => event.stopPropagation()}>
                  <div className="board-editor__picker-head">
                    <span>Adicionar coluna</span>
                    <button type="button" className="board-editor__picker-close" onClick={() => setAddColumnMode(null)}>
                      x
                    </button>
                  </div>
                  <div className="board-editor__picker-body">
                    {columnsAvailableToAdd.length > 0 ? (
                      <>
                        <p className="board-editor__picker-section-label">Existentes</p>
                        <ul className="board-editor__picker-list">
                          {columnsAvailableToAdd.map((column) => {
                            const state = activeStates.find((entry) => entry.id === column.stateIds[0]);
                            return (
                              <li key={column.id}>
                                <button type="button" className="board-editor__picker-item" onClick={() => handleAddExistingColumn(column.id)}>
                                  <span className="board-editor__picker-dot" style={{ background: state?.color ?? "#0a86e8" }} />
                                  <span className="board-editor__picker-col-name">{column.name}</span>
                                  <span className="board-editor__picker-col-slug">/{column.slug}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    ) : (
                      <p className="board-editor__picker-empty">Todas as colunas ja estao nesta perspectiva.</p>
                    )}
                    <div className="board-editor__picker-divider" />
                    <button type="button" className="board-editor__picker-new-btn" onClick={() => setAddColumnMode("new")}>
                      <IconPlus />
                      Criar nova coluna
                    </button>
                  </div>
                </div>
              )}

              {addColumnMode === "new" && (
                <div className="board-editor__column board-editor__column--new" onClick={(event) => event.stopPropagation()}>
                  <div className="board-editor__column-edit-form">
                    <div className="board-editor__edit-field">
                      <label className="board-editor__edit-label">Nome</label>
                      <input
                        ref={newColumnInputRef}
                        className="board-editor__edit-input"
                        value={newColumnName}
                        placeholder="Ex: Em validacao"
                        onChange={(event) => setNewColumnName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            void handleCreateColumn();
                          }
                          if (event.key === "Escape") {
                            setAddColumnMode("pick");
                          }
                        }}
                      />
                    </div>
                    <div className="board-editor__edit-field">
                      <label className="board-editor__edit-label">Estado automatico</label>
                      <select className="board-editor__edit-select" value={newColumnStateId} onChange={(event) => setNewColumnStateId(event.target.value)}>
                        <option value="">Sem estado</option>
                        {activeStates.map((state) => (
                          <option key={state.id} value={state.id}>
                            {state.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="board-editor__edit-actions">
                      <button type="button" className="board-editor__btn-save" onClick={() => void handleCreateColumn()} disabled={saving || !newColumnName.trim()}>
                        {saving ? "..." : "Criar"}
                      </button>
                      <button type="button" className="board-editor__btn-cancel" onClick={() => {
                        setAddColumnMode("pick");
                        setNewColumnName("");
                      }}>
                        Voltar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
