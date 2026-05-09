import type { CSSProperties, DragEvent } from "react";
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

interface DocumentationFilesPaneProps {
  docsCount: number;
  filteredDocs: WorkspaceDocument[];
  folders: WorkspaceDocumentFolder[];
  activeDocId: string | null;
  activeFolderId: string | null;
  documentKindFilter: DocumentKindFilter;
  fromCard: boolean;
  isDocsLoading: boolean;
  onFilterChange: (filter: DocumentKindFilter) => void;
  onSelectDoc: (docId: string) => void;
  onSelectFolder: (folderId: string) => void;
  onCreateFolder: (parentId?: string | null) => void;
  onRenameFolder: (folderId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onMoveDocToFolder: (docId: string, folderId: string | null) => void;
}

export function DocumentationFilesPane({
  docsCount,
  filteredDocs,
  folders,
  activeDocId,
  activeFolderId,
  documentKindFilter,
  fromCard,
  isDocsLoading,
  onFilterChange,
  onSelectDoc,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveDocToFolder
}: DocumentationFilesPaneProps) {
  function handleDocDragStart(event: DragEvent<HTMLElement>, docId: string) {
    event.dataTransfer.setData("application/x-dask-doc-id", docId);
    event.dataTransfer.effectAllowed = "move";
  }

  function handleFolderDrop(event: DragEvent<HTMLElement>, folderId: string | null) {
    const docId = event.dataTransfer.getData("application/x-dask-doc-id");
    if (!docId) {
      return;
    }
    event.preventDefault();
    onMoveDocToFolder(docId, folderId);
  }

  function renderFolder(folder: WorkspaceDocumentFolder, depth = 0) {
    const childFolders = folders
      .filter((entry) => entry.parentId === folder.id)
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    const childDocs = filteredDocs.filter((doc) => getDocumentFolderId(doc) === folder.id);
    const isSelected = activeFolderId === folder.id;

    return (
      <div key={folder.id} className="documentation-page__folder-group">
        <div
          className={`documentation-page__folder-row${isSelected ? " is-active" : ""}`}
          style={{ "--doc-folder-depth": depth } as CSSProperties}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => handleFolderDrop(event, folder.id)}
        >
          <button type="button" className="documentation-page__folder-select" onClick={() => onSelectFolder(folder.id)}>
            <AppIcon name={isSelected ? "folder-open" : "folder"} />
            <span>{folder.name}</span>
          </button>
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
        </div>
        {childFolders.map((child) => renderFolder(child, depth + 1))}
        {childDocs.map((doc) => renderDoc(doc, depth + 1))}
      </div>
    );
  }

  function renderDoc(doc: WorkspaceDocument, depth = 0) {
    const docKind = normalizeDocumentKind(doc.kind);

    return (
      <PanelMenuItem
        key={doc.id}
        selected={activeDocId === doc.id}
        draggable
        className="documentation-page__file-item"
        onDragStart={(event) => handleDocDragStart(event, doc.id)}
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
    );
  }

  const visibleFolders = fromCard ? [] : folders;
  const rootFolders = visibleFolders
    .filter((folder) => !folder.parentId)
    .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  const rootDocs = fromCard ? filteredDocs : filteredDocs.filter((doc) => !getDocumentFolderId(doc));

  return (
    <aside className="documentation-page__files-pane">
      <PanelMenu
        title="Documentos"
        count={docsCount}
        action={
          !fromCard ? (
            <Button type="button" variant="ghost" size="icon" title="Nova pasta" onClick={() => onCreateFolder(null)}>
              <AppIcon name="folder" />
            </Button>
          ) : undefined
        }
        filter={
          !fromCard ? (
            <>
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
            </>
          ) : undefined
        }
      >
        {!fromCard ? (
          <div
            className="documentation-page__root-drop"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => handleFolderDrop(event, null)}
          >
            Arraste aqui para tirar da pasta
          </div>
        ) : null}
        {rootFolders.map((folder) => renderFolder(folder))}
        {rootDocs.map((doc) => renderDoc(doc))}
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
