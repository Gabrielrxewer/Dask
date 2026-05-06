import type { WorkspaceDocument } from "@/modules/workspace";
import { EmptyState, PanelMenu, PanelMenuItem, StatusBadge } from "@/shared/ui";
import {
  DOCUMENT_KIND_FILTERS,
  DOCUMENT_KIND_LABELS,
  normalizeDocumentKind,
  renderDocumentKindIcon,
  type DocumentKindFilter
} from "./documentation-page.local";

interface DocumentationFilesPaneProps {
  docsCount: number;
  filteredDocs: WorkspaceDocument[];
  activeDocId: string | null;
  documentKindFilter: DocumentKindFilter;
  fromCard: boolean;
  isDocsLoading: boolean;
  onFilterChange: (filter: DocumentKindFilter) => void;
  onSelectDoc: (docId: string) => void;
}

export function DocumentationFilesPane({
  docsCount,
  filteredDocs,
  activeDocId,
  documentKindFilter,
  fromCard,
  isDocsLoading,
  onFilterChange,
  onSelectDoc
}: DocumentationFilesPaneProps) {
  return (
    <aside className="documentation-page__files-pane">
      <PanelMenu
        title="Documentos"
        count={docsCount}
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
        {filteredDocs.map((doc) => {
          const docKind = normalizeDocumentKind(doc.kind);

          return (
            <PanelMenuItem
              key={doc.id}
              selected={activeDocId === doc.id}
              onClick={() => onSelectDoc(doc.id)}
              leading={
                <span className={`documentation-page__file-item-icon documentation-page__file-item-icon--${docKind}`}>
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
        })}
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
