import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { factoryBoardConfig } from "@/entities/task";
import { useWorkspace } from "@/modules/workspace";
import type { ApiBoardColumn, ApiWorkflowState } from "@/modules/workspace/model";
import "./board-editor-settings.css";

// ─── Types ───────────────────────────────────────────────────────────────────

type PerspectiveStatus = { id: string; label: string; dot: string };

type PerspectiveStatusSource =
  | { kind: "workflow_state" }
  | { kind: "custom_field"; fieldId: string; fallbackByStatus?: Record<string, string> };

type BoardPerspective = {
  id: string;
  label: string;
  caption?: string;
  statuses: PerspectiveStatus[];
  statusSource: PerspectiveStatusSource;
  allowedTaskTypes?: string[];
  compactCards?: boolean;
  visibleBoardColumnIds?: string[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
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

function serializePerspective(p: BoardPerspective, position: number) {
  return {
    key: p.id,
    name: p.label,
    caption: p.caption,
    compactCards: Boolean(p.compactCards),
    position,
    allowedTaskTypes: p.allowedTaskTypes ?? [],
    visibleBoardColumnIds: p.visibleBoardColumnIds ?? [],
    statusSource: p.statusSource,
    statuses: p.statuses
  };
}

// ─── Icons ────────────────────────────────────────────────────────────────────

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

// ─── Main component ───────────────────────────────────────────────────────────

export function BoardEditorSettings() {
  const {
    snapshot,
    fetchBoardColumns,
    fetchWorkflowStates,
    createBoardColumn,
    updateBoardColumn,
    deleteBoardColumn,
    updatePreferences
  } = useWorkspace();

  const boardConfig = snapshot?.boardConfig ?? factoryBoardConfig;
  const baseStatuses = boardConfig.statuses;

  // ── Data ──
  const [columns, setColumns] = useState<ApiBoardColumn[]>([]);
  const [workflowStates, setWorkflowStates] = useState<ApiWorkflowState[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ── Draft perspectives (manual save) ──
  const [draftPerspectives, setDraftPerspectives] = useState<BoardPerspective[] | null>(null);
  const hasUnsavedChanges = draftPerspectives !== null;

  // ── Columns hidden in this session (shown dimmed until save) ──
  // Record<perspectiveId, columnId[]>
  const [pendingHidden, setPendingHidden] = useState<Record<string, string[]>>({});

  // ── Perspectives ──
  const serverPerspectives = useMemo(
    () => resolvePerspectives(boardConfig, baseStatuses),
    [boardConfig, baseStatuses]
  );
  const displayPerspectives = useMemo(
    () => draftPerspectives ?? serverPerspectives,
    [draftPerspectives, serverPerspectives]
  );
  const [activePerspectiveId, setActivePerspectiveId] = useState<string>(
    () => serverPerspectives[0]?.id ?? "dev"
  );
  const [creatingPerspective, setCreatingPerspective] = useState(false);
  const [newPerspectiveName, setNewPerspectiveName] = useState("");
  const perspectiveInputRef = useRef<HTMLInputElement>(null);

  // ── Column inline edit ──
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnName, setEditingColumnName] = useState("");
  const [editingColumnStateId, setEditingColumnStateId] = useState("");

  // ── Delete confirmation ──
  const [deletingColumnId, setDeletingColumnId] = useState<string | null>(null);

  // ── Add column picker ──
  const [addColumnMode, setAddColumnMode] = useState<null | "pick" | "new">(null);
  const [newColumnName, setNewColumnName] = useState("");
  const [newColumnStateId, setNewColumnStateId] = useState("");
  const newColumnInputRef = useRef<HTMLInputElement>(null);

  // ── Drag reorder ──
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // ── Derived ──
  const activeStates = useMemo(() => workflowStates.filter(s => s.isActive), [workflowStates]);
  const activeColumns = useMemo(
    () => columns.filter(c => c.isActive).sort((a, b) => a.order - b.order),
    [columns]
  );
  const activePerspective = useMemo(
    () => displayPerspectives.find(p => p.id === activePerspectiveId) ?? displayPerspectives[0] ?? null,
    [displayPerspectives, activePerspectiveId]
  );
  const activePendingHidden = useMemo(
    () => new Set(pendingHidden[activePerspectiveId] ?? []),
    [pendingHidden, activePerspectiveId]
  );

  // Ordered visible columns for this perspective
  const visibleColumns = useMemo(() => {
    const ids = activePerspective?.visibleBoardColumnIds;
    const colById = new Map(activeColumns.map(c => [c.id, c]));
    if (Array.isArray(ids) && ids.length > 0) {
      return ids.map(id => colById.get(id)).filter(Boolean) as ApiBoardColumn[];
    }
    return activeColumns;
  }, [activePerspective, activeColumns]);

  // All columns shown in the canvas: visible first, then pending-hidden (dimmed) at end
  const columnsToShow = useMemo(() => {
    const hidden = activeColumns.filter(c => activePendingHidden.has(c.id));
    return [...visibleColumns, ...hidden];
  }, [visibleColumns, activeColumns, activePendingHidden]);

  // Available to add via picker (not currently shown)
  const columnsAvailableToAdd = useMemo(() => {
    const shownIds = new Set(columnsToShow.map(c => c.id));
    return activeColumns.filter(c => !shownIds.has(c.id));
  }, [activeColumns, columnsToShow]);

  // ── Load ──
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cols, states] = await Promise.all([fetchBoardColumns(), fetchWorkflowStates()]);
      setColumns(cols);
      setWorkflowStates(states);
      setNewColumnStateId(prev => prev || states[0]?.id || "");
    } finally {
      setLoading(false);
    }
  }, [fetchBoardColumns, fetchWorkflowStates]);

  useEffect(() => { void loadData(); }, [loadData]);

  useEffect(() => {
    if (creatingPerspective) perspectiveInputRef.current?.focus();
  }, [creatingPerspective]);

  useEffect(() => {
    if (addColumnMode === "new") newColumnInputRef.current?.focus();
  }, [addColumnMode]);

  // ── Persist ──
  const persistPerspectives = useCallback(
    async (nextPerspectives: BoardPerspective[], defaultBoardMode?: string) => {
      setSaving(true);
      try {
        await updatePreferences({
          ...(defaultBoardMode ? { defaultBoardMode } : {}),
          settings: { perspectives: nextPerspectives.map((p, i) => serializePerspective(p, i)) }
        });
      } finally {
        setSaving(false);
      }
    },
    [updatePreferences]
  );

  const handleSave = async () => {
    if (!draftPerspectives) return;
    await persistPerspectives(draftPerspectives, snapshot?.preferences.defaultBoardMode);
    setDraftPerspectives(null);
    setPendingHidden({});
  };

  const handleDiscard = () => {
    setDraftPerspectives(null);
    setPendingHidden({});
  };

  // ── Helpers to update draft ──
  const updateDraft = useCallback((updater: (prev: BoardPerspective[]) => BoardPerspective[]) => {
    setDraftPerspectives(prev => updater(prev ?? serverPerspectives));
  }, [serverPerspectives]);

  // ── Perspective handlers ──
  const handleCreatePerspective = () => {
    const name = newPerspectiveName.trim();
    if (!name) return;

    const baseId = toSlug(name) || "perspective";
    let nextId = baseId;
    let suffix = 2;
    const existingIds = new Set(displayPerspectives.map(p => p.id));
    while (existingIds.has(nextId)) { nextId = `${baseId}-${suffix}`; suffix += 1; }

    updateDraft(prev => [
      ...prev,
      {
        id: nextId,
        label: name.toUpperCase(),
        statuses: baseStatuses,
        statusSource: { kind: "workflow_state" },
        visibleBoardColumnIds: activeColumns.map(c => c.id)
      }
    ]);
    setActivePerspectiveId(nextId);
    setNewPerspectiveName("");
    setCreatingPerspective(false);
  };

  const handleDeletePerspective = (perspectiveId: string) => {
    if (displayPerspectives.length <= 1) return;
    const next = displayPerspectives.filter(p => p.id !== perspectiveId);
    if (activePerspectiveId === perspectiveId) setActivePerspectiveId(next[0]?.id ?? "dev");
    setDraftPerspectives(next);
  };

  // ── Column visibility ──
  const handleHideColumn = (columnId: string) => {
    // Remove from visible list in draft
    updateDraft(prev =>
      prev.map(p => {
        if (p.id !== activePerspectiveId) return p;
        const current =
          Array.isArray(p.visibleBoardColumnIds) && p.visibleBoardColumnIds.length > 0
            ? new Set(p.visibleBoardColumnIds)
            : new Set(activeColumns.map(c => c.id));
        current.delete(columnId);
        return { ...p, visibleBoardColumnIds: Array.from(current) };
      })
    );
    // Track as pending-hidden so column stays visible (dimmed) until save
    setPendingHidden(prev => ({
      ...prev,
      [activePerspectiveId]: [...(prev[activePerspectiveId] ?? []), columnId]
    }));
  };

  const handleShowColumn = (columnId: string) => {
    // Add back to visible list
    updateDraft(prev =>
      prev.map(p => {
        if (p.id !== activePerspectiveId) return p;
        const current =
          Array.isArray(p.visibleBoardColumnIds) && p.visibleBoardColumnIds.length > 0
            ? new Set(p.visibleBoardColumnIds)
            : new Set(activeColumns.map(c => c.id));
        current.add(columnId);
        return { ...p, visibleBoardColumnIds: Array.from(current) };
      })
    );
    // Remove from pending-hidden
    setPendingHidden(prev => ({
      ...prev,
      [activePerspectiveId]: (prev[activePerspectiveId] ?? []).filter(id => id !== columnId)
    }));
  };

  const handleAddExistingColumn = (columnId: string) => {
    updateDraft(prev =>
      prev.map(p => {
        if (p.id !== activePerspectiveId) return p;
        const current =
          Array.isArray(p.visibleBoardColumnIds) && p.visibleBoardColumnIds.length > 0
            ? new Set(p.visibleBoardColumnIds)
            : new Set(activeColumns.map(c => c.id));
        current.add(columnId);
        return { ...p, visibleBoardColumnIds: Array.from(current) };
      })
    );
    setAddColumnMode(null);
  };

  // ── Drag to reorder ──
  const handleDragStart = (e: DragEvent<HTMLDivElement>, columnId: string) => {
    setDraggingId(columnId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (columnId !== draggingId) setDragOverId(columnId);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, targetId: string) => {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }

    updateDraft(prev =>
      prev.map(p => {
        if (p.id !== activePerspectiveId) return p;
        const currentOrder =
          Array.isArray(p.visibleBoardColumnIds) && p.visibleBoardColumnIds.length > 0
            ? [...p.visibleBoardColumnIds]
            : activeColumns.map(c => c.id);
        const fromIndex = currentOrder.indexOf(draggingId);
        const toIndex = currentOrder.indexOf(targetId);
        if (fromIndex === -1 || toIndex === -1) return p;
        const newOrder = [...currentOrder];
        newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, draggingId);
        return { ...p, visibleBoardColumnIds: newOrder };
      })
    );

    setDraggingId(null);
    setDragOverId(null);
  };

  // ── Column CRUD (immediate save) ──
  const handleStartEdit = (col: ApiBoardColumn) => {
    setEditingColumnId(col.id);
    setEditingColumnName(col.name);
    setEditingColumnStateId(col.stateIds[0] ?? activeStates[0]?.id ?? "");
    setAddColumnMode(null);
    setDeletingColumnId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingColumnId || !editingColumnName.trim()) return;
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
    if (deletingColumnId !== columnId) { setDeletingColumnId(columnId); return; }
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
    if (!newColumnName.trim()) return;
    setSaving(true);
    try {
      await createBoardColumn({ name: newColumnName.trim(), stateIds: newColumnStateId ? [newColumnStateId] : [] });
      const updatedCols = await fetchBoardColumns();
      const previousIds = new Set(columns.map(c => c.id));
      const newCol = updatedCols.find(c => !previousIds.has(c.id));
      setColumns(updatedCols);

      if (newCol) {
        const current = draftPerspectives ?? serverPerspectives;
        const nextPerspectives = current.map(p => {
          if (p.id !== activePerspectiveId) {
            if (!Array.isArray(p.visibleBoardColumnIds) || p.visibleBoardColumnIds.length === 0) return p;
            return { ...p, visibleBoardColumnIds: [...p.visibleBoardColumnIds, newCol.id] };
          }
          const visible =
            Array.isArray(p.visibleBoardColumnIds) && p.visibleBoardColumnIds.length > 0
              ? new Set(p.visibleBoardColumnIds)
              : new Set(updatedCols.filter(c => c.isActive).map(c => c.id));
          visible.add(newCol.id);
          return { ...p, visibleBoardColumnIds: Array.from(visible) };
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

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="board-editor" onClick={() => { setDeletingColumnId(null); setAddColumnMode(null); }}>
      {/* Perspective bar */}
      <div className="board-editor__topbar">
        <div className="board-editor__tabs">
          {displayPerspectives.map(p => (
            <div key={p.id} className={`board-editor__tab${p.id === activePerspectiveId ? " is-active" : ""}`}>
              <button
                type="button"
                className="board-editor__tab-btn"
                onClick={e => { e.stopPropagation(); setActivePerspectiveId(p.id); }}
              >
                <i style={{ background: p.statuses[0]?.dot ?? "#0a86e8" }} />
                {p.label}
              </button>
              {displayPerspectives.length > 1 && (
                <button
                  type="button"
                  className="board-editor__tab-remove"
                  onClick={e => { e.stopPropagation(); handleDeletePerspective(p.id); }}
                >×</button>
              )}
            </div>
          ))}

          {creatingPerspective ? (
            <div className="board-editor__tab-create" onClick={e => e.stopPropagation()}>
              <input
                ref={perspectiveInputRef}
                className="board-editor__tab-input"
                value={newPerspectiveName}
                placeholder="Nome..."
                onChange={e => setNewPerspectiveName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") handleCreatePerspective();
                  if (e.key === "Escape") { setCreatingPerspective(false); setNewPerspectiveName(""); }
                }}
              />
              <button type="button" className="board-editor__tab-confirm" onClick={handleCreatePerspective} disabled={!newPerspectiveName.trim()}>Criar</button>
              <button type="button" className="board-editor__tab-cancel" onClick={() => { setCreatingPerspective(false); setNewPerspectiveName(""); }}>×</button>
            </div>
          ) : (
            <button type="button" className="board-editor__add-perspective" onClick={e => { e.stopPropagation(); setCreatingPerspective(true); }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Perspectiva
            </button>
          )}
        </div>

        {/* Save area */}
        <div className={`board-editor__save-area${hasUnsavedChanges ? " has-changes" : ""}`}>
          {hasUnsavedChanges && (
            <>
              <span className="board-editor__unsaved-label">
                <span className="board-editor__unsaved-dot" />
                Não salvo
              </span>
              <button type="button" className="board-editor__btn-discard" onClick={e => { e.stopPropagation(); handleDiscard(); }} disabled={saving}>
                Descartar
              </button>
            </>
          )}
          <button
            type="button"
            className="board-editor__btn-save-main"
            onClick={e => { e.stopPropagation(); void handleSave(); }}
            disabled={!hasUnsavedChanges || saving}
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      {/* Board canvas */}
      <div className="board-editor__canvas-wrap">
        <div className="board-editor__canvas">
          {loading ? (
            <>
              {[1, 2, 3, 4].map(i => <div key={i} className="board-editor__skeleton-col" />)}
            </>
          ) : (
            <>
              {columnsToShow.map(col => {
                const isHidden = activePendingHidden.has(col.id);
                const stateForCol = activeStates.find(s => s.id === col.stateIds[0]);
                const isEditing = editingColumnId === col.id;
                const isConfirmingDelete = deletingColumnId === col.id;
                const isDragging = draggingId === col.id;
                const isDragOver = dragOverId === col.id && draggingId !== col.id;

                return (
                  <div
                    key={col.id}
                    className={[
                      "board-editor__column",
                      isHidden ? "board-editor__column--hidden" : "",
                      isEditing ? "board-editor__column--editing" : "",
                      isConfirmingDelete ? "board-editor__column--confirming" : "",
                      isDragging ? "board-editor__column--dragging" : "",
                      isDragOver ? "board-editor__column--drag-over" : "",
                    ].filter(Boolean).join(" ")}
                    draggable={!isHidden && !isEditing && !isConfirmingDelete}
                    onDragStart={e => handleDragStart(e, col.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={e => handleDragOver(e, col.id)}
                    onDrop={e => handleDrop(e, col.id)}
                    onClick={e => e.stopPropagation()}
                  >
                    {isEditing ? (
                      <div className="board-editor__column-edit-form">
                        <div className="board-editor__edit-field">
                          <label className="board-editor__edit-label">Nome</label>
                          <input
                            className="board-editor__edit-input"
                            value={editingColumnName}
                            autoFocus
                            onChange={e => setEditingColumnName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") void handleSaveEdit();
                              if (e.key === "Escape") setEditingColumnId(null);
                            }}
                          />
                        </div>
                        <div className="board-editor__edit-field">
                          <label className="board-editor__edit-label">Estado automático</label>
                          <select className="board-editor__edit-select" value={editingColumnStateId} onChange={e => setEditingColumnStateId(e.target.value)}>
                            <option value="">Sem estado</option>
                            {activeStates.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </div>
                        <div className="board-editor__edit-actions">
                          <button type="button" className="board-editor__btn-save" onClick={() => void handleSaveEdit()} disabled={saving || !editingColumnName.trim()}>
                            {saving ? "..." : "Salvar"}
                          </button>
                          <button type="button" className="board-editor__btn-cancel" onClick={() => setEditingColumnId(null)}>Cancelar</button>
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
                            <span className="board-editor__column-dot" style={{ background: stateForCol?.color ?? "#0a86e8" }} />
                            <span className="board-editor__column-name">{col.name}</span>
                          </div>
                          <div className="board-editor__column-actions">
                            {!isHidden && (
                              <button type="button" className="board-editor__action-btn board-editor__action-btn--edit" onClick={e => { e.stopPropagation(); handleStartEdit(col); }} title="Editar">
                                <IconPencil />
                              </button>
                            )}
                            <button
                              type="button"
                              className={`board-editor__action-btn board-editor__action-btn--visibility${isHidden ? " is-hidden" : " is-visible"}`}
                              onClick={e => { e.stopPropagation(); isHidden ? handleShowColumn(col.id) : handleHideColumn(col.id); }}
                              title={isHidden ? "Mostrar nesta perspectiva" : "Ocultar nesta perspectiva"}
                            >
                              {isHidden ? <IconEyeOff /> : <IconEye />}
                            </button>
                            {!isHidden && (
                              <button
                                type="button"
                                className={`board-editor__action-btn board-editor__action-btn--delete${isConfirmingDelete ? " is-confirming" : ""}`}
                                onClick={e => { e.stopPropagation(); void handleDeleteColumn(col.id); }}
                                title={isConfirmingDelete ? "Confirmar?" : "Remover"}
                                disabled={saving}
                              >
                                <IconTrash />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="board-editor__column-meta">
                          <span className="board-editor__state-dot" style={{ background: stateForCol?.color ?? "#c0ccd8" }} />
                          <span className="board-editor__state-name">{stateForCol?.name ?? "Sem estado"}</span>
                          <span className="board-editor__col-slug">/{col.slug}</span>
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
                          <div className="board-editor__confirm-overlay" onClick={e => e.stopPropagation()}>
                            <p>Remover <strong>{col.name}</strong>?</p>
                            <div className="board-editor__confirm-actions">
                              <button type="button" className="board-editor__btn-confirm-delete" onClick={() => void handleDeleteColumn(col.id)} disabled={saving}>
                                {saving ? "Removendo..." : "Sim, remover"}
                              </button>
                              <button type="button" className="board-editor__btn-cancel" onClick={e => { e.stopPropagation(); setDeletingColumnId(null); }}>Cancelar</button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}

              {/* Add column */}
              {addColumnMode === null && (
                <button
                  type="button"
                  className="board-editor__add-column"
                  onClick={e => { e.stopPropagation(); setAddColumnMode("pick"); setEditingColumnId(null); setDeletingColumnId(null); }}
                >
                  <span className="board-editor__add-column-icon"><IconPlus /></span>
                  <span>Nova coluna</span>
                </button>
              )}

              {addColumnMode === "pick" && (
                <div className="board-editor__column board-editor__column--picker" onClick={e => e.stopPropagation()}>
                  <div className="board-editor__picker-head">
                    <span>Adicionar coluna</span>
                    <button type="button" className="board-editor__picker-close" onClick={() => setAddColumnMode(null)}>×</button>
                  </div>
                  <div className="board-editor__picker-body">
                    {columnsAvailableToAdd.length > 0 ? (
                      <>
                        <p className="board-editor__picker-section-label">Existentes</p>
                        <ul className="board-editor__picker-list">
                          {columnsAvailableToAdd.map(col => {
                            const st = activeStates.find(s => s.id === col.stateIds[0]);
                            return (
                              <li key={col.id}>
                                <button type="button" className="board-editor__picker-item" onClick={() => handleAddExistingColumn(col.id)}>
                                  <span className="board-editor__picker-dot" style={{ background: st?.color ?? "#0a86e8" }} />
                                  <span className="board-editor__picker-col-name">{col.name}</span>
                                  <span className="board-editor__picker-col-slug">/{col.slug}</span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      </>
                    ) : (
                      <p className="board-editor__picker-empty">Todas as colunas já estão nesta perspectiva.</p>
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
                <div className="board-editor__column board-editor__column--new" onClick={e => e.stopPropagation()}>
                  <div className="board-editor__column-edit-form">
                    <div className="board-editor__edit-field">
                      <label className="board-editor__edit-label">Nome</label>
                      <input
                        ref={newColumnInputRef}
                        className="board-editor__edit-input"
                        value={newColumnName}
                        placeholder="Ex: Em validação"
                        onChange={e => setNewColumnName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") void handleCreateColumn();
                          if (e.key === "Escape") setAddColumnMode("pick");
                        }}
                      />
                    </div>
                    <div className="board-editor__edit-field">
                      <label className="board-editor__edit-label">Estado automático</label>
                      <select className="board-editor__edit-select" value={newColumnStateId} onChange={e => setNewColumnStateId(e.target.value)}>
                        <option value="">Sem estado</option>
                        {activeStates.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="board-editor__edit-actions">
                      <button type="button" className="board-editor__btn-save" onClick={() => void handleCreateColumn()} disabled={saving || !newColumnName.trim()}>
                        {saving ? "..." : "Criar"}
                      </button>
                      <button type="button" className="board-editor__btn-cancel" onClick={() => { setAddColumnMode("pick"); setNewColumnName(""); }}>Voltar</button>
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
