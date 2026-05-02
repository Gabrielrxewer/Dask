import type { WorkspaceDocument } from "@/modules/workspace";
import {
  DOCUMENT_KIND_FILTERS,
  DOCUMENT_KIND_LABELS,
  formatRelativeDate,
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
      <header className="documentation-page__files-header">
        <div>
          <p>Documentos</p>
          <span>{docsCount} docs</span>
        </div>
      </header>

      {!fromCard && (
        <div className="documentation-page__kind-filters" aria-label="Filtrar documentos por tipo">
          {DOCUMENT_KIND_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              className={documentKindFilter === filter.value ? "is-active" : ""}
              onClick={() => onFilterChange(filter.value)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}

      <nav className="documentation-page__files-list">
        {filteredDocs.map((doc) => {
          const docKind = normalizeDocumentKind(doc.kind);

          return (
            <button
              key={doc.id}
              type="button"
              className={`documentation-page__file-item${activeDocId === doc.id ? " documentation-page__file-item--active" : ""}`}
              onClick={() => onSelectDoc(doc.id)}
            >
              <span className={`documentation-page__file-item-icon documentation-page__file-item-icon--${docKind}`}>
                {renderDocumentKindIcon(docKind)}
              </span>
              <div className="documentation-page__file-item-content">
                <div className="documentation-page__file-title-row">
                  <strong>{doc.title}</strong>
                  <span className={`documentation-page__kind-badge documentation-page__kind-badge--${docKind}`}>
                    {DOCUMENT_KIND_LABELS[docKind]}
                  </span>
                </div>
                <span>{`Atualizado em ${formatRelativeDate(doc.updatedAt)}`}</span>
              </div>
            </button>
          );
        })}
        {!isDocsLoading && filteredDocs.length === 0 ? (
          <div className="documentation-page__panel-empty documentation-page__panel-empty--compact shared-empty-panel">
            <h3>Nenhuma doc encontrada</h3>
            <p>Clique em "Nova doc" para comeÃ§ar.</p>
          </div>
        ) : null}
      </nav>
    </aside>
  );
}
