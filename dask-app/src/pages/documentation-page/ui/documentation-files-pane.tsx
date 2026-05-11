import { CSS } from "@dnd-kit/utilities";
import {
  DndContext,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent
} from "@dnd-kit/core";
import { useState, type CSSProperties, type ReactNode } from "react";
import type { WorkspaceDocument, WorkspaceDocumentFolder } from "@/modules/workspace";
import { AppIcon, Button, EmptyState, PanelMenu, PanelMenuItem, StatusBadge } from "@/shared/ui";
import {
  DOCUMENT_KIND_FILTERS,
  DOCUMENT_KIND_LABELS,
  normalizeDocumentKind,
  renderDocumentKindIcon,
  type DocumentKindFilter
} from "./documentation-page.local";
import { getDocumentFolderId } from "./documentation-page.model";

type DragEntity =
  | { type: "document"; id: string }
  | { type: "folder"; id: string };

interface DocumentationFilesPaneProps {
  docsCount: number;
  filteredDocs: WorkspaceDocument[];
  folders: WorkspaceDocumentFolder[];
  activeDocId: string | null;
  activeFolderId: string | null;
  documentKindFilter: DocumentKindFilter;
  search: string;
  tags: string[];
  selectedTags: string[];
  fromCard: boolean;
  isDocsLoading: boolean;
  canManageFolders?: boolean;
  currentUserId?: string | null;
  isClient?: boolean;
  onFilterChange: (filter: DocumentKindFilter) => void;
  onSearchChange: (value: string) => void;
  onToggleTag: (tag: string) => void;
  onSelectDoc: (docId: string) => void;
  onSelectFolder: (folderId: string) => void;
  onCreateFolder: (parentId?: string | null) => void;
  onRenameFolder: (folderId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveDocToFolder: (docId: string, folderId: string | null) => void;
  onMoveFolderToFolder: (folderId: string, parentId: string | null) => void;
}

function encodeDroppableId(folderId: string | null): string {
  return folderId ? `folder:${folderId}` : "folder:root";
}

function decodeDroppableId(id: string): string | null {
  if (id === "folder:root") return null;
  return id.startsWith("folder:") ? id.slice("folder:".length) : null;
}

function normalizeFilterLabel(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function DroppableFolder({
  folderId,
  disabled,
  className,
  children
}: {
  folderId: string | null;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: encodeDroppableId(folderId), disabled });

  return (
    <div ref={setNodeRef} className={`${className ?? ""}${isOver ? " is-drop-target" : ""}`}>
      {children}
    </div>
  );
}

function DraggableShell({
  entity,
  disabled,
  children
}: {
  entity: DragEntity;
  disabled?: boolean;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `${entity.type}:${entity.id}`,
    data: entity,
    disabled
  });

  return (
    <div
      ref={setNodeRef}
      className={isDragging ? "documentation-page__dnd-item is-dragging" : "documentation-page__dnd-item"}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

export function DocumentationFilesPane({
  docsCount,
  filteredDocs,
  folders,
  activeDocId,
  activeFolderId,
  documentKindFilter,
  search,
  tags,
  selectedTags,
  fromCard,
  isDocsLoading,
  canManageFolders = false,
  currentUserId,
  isClient = false,
  onFilterChange,
  onSearchChange,
  onToggleTag,
  onSelectDoc,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveDocToFolder,
  onMoveFolderToFolder
}: DocumentationFilesPaneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  function handleDragEnd(event: DragEndEvent) {
    setIsDragActive(false);
    const active = event.active.data.current as DragEntity | undefined;
    const overId = event.over?.id ? String(event.over.id) : "";
    if (!active || !overId) {
      return;
    }

    const targetFolderId = decodeDroppableId(overId);
    const targetFolder = targetFolderId ? folders.find((folder) => folder.id === targetFolderId) : null;
    if (isClient && targetFolder && targetFolder.createdBy !== currentUserId) {
      return;
    }
    if (active.type === "document") {
      onMoveDocToFolder(active.id, targetFolderId);
      return;
    }

    if (active.type === "folder" && active.id !== targetFolderId) {
      onMoveFolderToFolder(active.id, targetFolderId);
    }
  }

  function canManageFolder(folder: WorkspaceDocumentFolder): boolean {
    return canManageFolders && (!isClient || folder.createdBy === currentUserId);
  }

  function renderFolder(folder: WorkspaceDocumentFolder, depth = 0) {
    const childFolders = folders
      .filter((entry) => entry.parentId === folder.id)
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    const childDocs = filteredDocs.filter((doc) => getDocumentFolderId(doc) === folder.id);
    const isSelected = activeFolderId === folder.id;

    return (
      <div key={folder.id} className="documentation-page__folder-group">
        <DroppableFolder folderId={folder.id} disabled={isClient && folder.createdBy !== currentUserId}>
          <DraggableShell entity={{ type: "folder", id: folder.id }} disabled={fromCard || !canManageFolder(folder)}>
            <div
              className={`documentation-page__folder-row${isSelected ? " is-active" : ""}`}
              style={{ "--doc-folder-depth": depth } as CSSProperties}
            >
              <button type="button" className="documentation-page__folder-select" onClick={() => onSelectFolder(folder.id)}>
                <AppIcon name={isSelected ? "folder-open" : "folder"} />
                <span>{folder.name}</span>
              </button>
              {canManageFolder(folder) ? (
                <span className="documentation-page__folder-actions">
                  <Button type="button" variant="ghost" size="icon" title="Nova subpasta" onClick={() => onCreateFolder(folder.id)}>
                    <AppIcon name="plus" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" title="Editar pasta" onClick={() => onRenameFolder(folder.id)}>
                    <AppIcon name="pencil" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" title="Excluir pasta" onClick={() => onDeleteFolder(folder.id)}>
                    <AppIcon name="trash" />
                  </Button>
                </span>
              ) : null}
            </div>
          </DraggableShell>
        </DroppableFolder>
        {childFolders.map((child) => renderFolder(child, depth + 1))}
        {childDocs.map((doc) => renderDoc(doc, depth + 1))}
      </div>
    );
  }

  function renderDoc(doc: WorkspaceDocument, depth = 0) {
    const docKind = normalizeDocumentKind(doc.kind);
    const isActive = activeDocId === doc.id;

    return (
      <DraggableShell key={doc.id} entity={{ type: "document", id: doc.id }} disabled={fromCard}>
        <PanelMenuItem
          selected={isActive}
          className={`documentation-page__file-item${isActive ? " documentation-page__file-item--active" : ""}`}
          onClick={() => onSelectDoc(doc.id)}
          leading={
            <span
              className={`documentation-page__file-item-icon documentation-page__file-item-icon--${docKind}`}
              style={{ marginLeft: `${depth * 14}px` }}
            >
              {renderDocumentKindIcon(docKind)}
            </span>
          }
          label={doc.title}
          trailing={
            <StatusBadge size="sm" kind="tag" className={`documentation-page__kind-badge documentation-page__kind-badge--${docKind}`}>
              {DOCUMENT_KIND_LABELS[docKind]}
            </StatusBadge>
          }
        />
      </DraggableShell>
    );
  }

  const visibleFolders = fromCard ? [] : folders;
  const rootFolders = visibleFolders
    .filter((folder) => !folder.parentId)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  const rootDocs = fromCard ? filteredDocs : filteredDocs.filter((doc) => !getDocumentFolderId(doc));
  const documentKindLabels = new Set(
    [
      ...DOCUMENT_KIND_FILTERS
        .filter((filter) => filter.value !== "all")
        .map((filter) => filter.label),
      ...Object.values(DOCUMENT_KIND_LABELS)
    ].map((label) => normalizeFilterLabel(label))
  );
  const visibleTags = tags.filter((tag) => !documentKindLabels.has(normalizeFilterLabel(tag)) || selectedTags.includes(tag));

  return (
    <aside className="documentation-page__files-pane">
      <PanelMenu
        title="Documentos"
        count={docsCount}
        action={
          !fromCard && canManageFolders ? (
            <Button type="button" variant="ghost" size="icon" title="Nova pasta" onClick={() => onCreateFolder(null)}>
              <AppIcon name="folder" />
            </Button>
          ) : undefined
        }
        filter={
          !fromCard ? (
            <div className="documentation-page__files-controls">
              <label className="documentation-page__files-search">
                <AppIcon name="search" size={13} />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Buscar docs"
                />
              </label>
              <div className="documentation-page__files-kind-row">
                {DOCUMENT_KIND_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    className={`panel-menu-filter-btn${documentKindFilter === filter.value ? " is-active" : ""}`}
                    onClick={() => onFilterChange(filter.value)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              {visibleTags.length > 0 ? (
                <div className="documentation-page__tag-filters" aria-label="Filtrar por tags">
                  {visibleTags.slice(0, 8).map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={`documentation-page__tag-filter${selectedTags.includes(tag) ? " is-active" : ""}`}
                      onClick={() => onToggleTag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : undefined
        }
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          onDragStart={() => setIsDragActive(true)}
          onDragCancel={() => setIsDragActive(false)}
          onDragEnd={handleDragEnd}
        >
          <div className={`documentation-page__dnd-list${isDragActive ? " is-dnd-active" : ""}`}>
            {!fromCard ? (
              <DroppableFolder folderId={null} className="documentation-page__root-drop">
                Arraste aqui para tirar da pasta
              </DroppableFolder>
            ) : null}
            {rootFolders.map((folder) => renderFolder(folder))}
            {rootDocs.map((doc) => renderDoc(doc))}
          </div>
        </DndContext>
        {!isDocsLoading && filteredDocs.length === 0 ? (
          <EmptyState
            title="Nenhuma doc encontrada"
            description='Clique em "Nova doc" para criar a primeira referencia deste workspace.'
            size="compact"
            variant="card"
          />
        ) : null}
      </PanelMenu>
    </aside>
  );
}
