import type { ChangeEvent, Ref } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { DocumentKind, WorkspaceDocument, WorkspaceDocumentMetadata } from "@/modules/workspace";
import { AppIcon, TextInput, Textarea } from "@/shared/ui";
import {
  DOCUMENT_KIND_DESCRIPTIONS,
  DOCUMENT_KIND_LABELS,
  EDITOR_VIEW_LABELS,
  formatRelativeDate,
  markdownUrlTransform,
  type EditorViewMode
} from "./documentation-page.local";

interface DocumentationEditorPanelProps {
  activeDoc: WorkspaceDocument | null;
  activeDocKind: DocumentKind;
  editorTextareaRef: Ref<HTMLTextAreaElement>;
  logoFileInputRef: Ref<HTMLInputElement>;
  selectedSnippet: string;
  wordCount: number;
  renderedMarkdown: string;
  editorViewMode: EditorViewMode;
  onUpdateDocDraft: (
    docId: string,
    patch: Partial<Pick<WorkspaceDocument, "title" | "content" | "kind" | "tags" | "metadata">>
  ) => void;
  onUpdateProposalMetadata: (patch: WorkspaceDocumentMetadata) => void;
  onChooseClientLogoFile: () => void;
  onRemoveClientLogo: () => void;
  onClientLogoFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onMarkdownToolbarAction: (action: string) => void;
  onEditorViewModeChange: (mode: EditorViewMode) => void;
  onEditorSelection: (textarea: HTMLTextAreaElement) => void;
}

export function DocumentationEditorPanel({
  activeDoc,
  activeDocKind,
  editorTextareaRef,
  logoFileInputRef,
  selectedSnippet,
  wordCount,
  renderedMarkdown,
  editorViewMode,
  onUpdateDocDraft,
  onUpdateProposalMetadata,
  onChooseClientLogoFile,
  onRemoveClientLogo,
  onClientLogoFileChange,
  onMarkdownToolbarAction,
  onEditorViewModeChange,
  onEditorSelection
}: DocumentationEditorPanelProps) {
  return (
    <section className="documentation-page__editor-pane">
      {activeDoc ? (
        <>
          <header className="documentation-page__editor-header">
            <div className="documentation-page__editor-kind-row">
              <span className={`documentation-page__kind-badge documentation-page__kind-badge--${activeDocKind}`}>
                {DOCUMENT_KIND_LABELS[activeDocKind]}
              </span>
              <p>{DOCUMENT_KIND_DESCRIPTIONS[activeDocKind]}</p>
            </div>
            <TextInput
              value={activeDoc.title}
              onChange={(event) => onUpdateDocDraft(activeDoc.id, { title: event.target.value })}
              placeholder="Titulo da doc"
            />
            {activeDocKind === "proposal" ? (
              <section className="documentation-page__proposal-logo">
                <input
                  ref={logoFileInputRef}
                  type="file"
                  accept="image/*"
                  className="documentation-page__hidden-input"
                  onChange={onClientLogoFileChange}
                />
                <div className="documentation-page__proposal-logo-preview">
                  {activeDoc.metadata?.clientLogoUrl ? (
                    <img src={activeDoc.metadata.clientLogoUrl} alt="Logo do cliente" />
                  ) : (
                    <span>Logo do cliente</span>
                  )}
                </div>
                <div className="documentation-page__proposal-logo-controls">
                  <label htmlFor="client-logo-url">Logo do cliente</label>
                  <div className="documentation-page__proposal-logo-row">
                    <TextInput
                      id="client-logo-url"
                      value={activeDoc.metadata?.clientLogoUrl ?? ""}
                      onChange={(event) => onUpdateProposalMetadata({ clientLogoUrl: event.target.value })}
                      placeholder="Cole a URL da imagem ou envie um arquivo"
                    />
                    <button type="button" onClick={onChooseClientLogoFile}>
                      Adicionar/Substituir
                    </button>
                    <button type="button" onClick={onRemoveClientLogo} disabled={!activeDoc.metadata?.clientLogoUrl}>
                      Remover
                    </button>
                  </div>
                </div>
              </section>
            ) : null}
            <div className="documentation-page__editor-meta">
              <p>{`Ultima edicao: ${formatRelativeDate(activeDoc.updatedAt)}`}</p>
              <div className="documentation-page__editor-meta-right">
                {selectedSnippet ? <span className="documentation-page__snippet-hint">Trecho selecionado</span> : null}
                <span className="documentation-page__editor-wordcount">{`${wordCount} palavras`}</span>
              </div>
            </div>
          </header>

          <div className="documentation-page__editor-toolbar">
            <div className="documentation-page__editor-toolbar-group">
              <button
                type="button"
                className="documentation-page__toolbar-btn documentation-page__toolbar-btn--heading"
                onClick={() => onMarkdownToolbarAction("h1")}
                title="Titulo 1"
                data-label="H1"
              />
              <button
                type="button"
                className="documentation-page__toolbar-btn documentation-page__toolbar-btn--heading"
                onClick={() => onMarkdownToolbarAction("h2")}
                title="Titulo 2"
                data-label="H2"
              />
              <button
                type="button"
                className="documentation-page__toolbar-btn documentation-page__toolbar-btn--text documentation-page__toolbar-btn--bold"
                onClick={() => onMarkdownToolbarAction("bold")}
                title="Negrito"
              >
                B
              </button>
              <button
                type="button"
                className="documentation-page__toolbar-btn documentation-page__toolbar-btn--text documentation-page__toolbar-btn--italic"
                onClick={() => onMarkdownToolbarAction("italic")}
                title="Italico"
              >
                I
              </button>
              <button
                type="button"
                className="documentation-page__toolbar-btn documentation-page__toolbar-btn--text documentation-page__toolbar-btn--underline"
                onClick={() => onMarkdownToolbarAction("underline")}
                title="Sublinhado"
              >
                U
              </button>
              <button
                type="button"
                className="documentation-page__toolbar-btn documentation-page__toolbar-btn--text documentation-page__toolbar-btn--strike"
                onClick={() => onMarkdownToolbarAction("strike")}
                title="Riscado"
              >
                S
              </button>
            </div>

            <div className="documentation-page__editor-toolbar-separator" aria-hidden="true" />

            <div className="documentation-page__editor-toolbar-group">
              <button type="button" className="documentation-page__toolbar-btn" onClick={() => onMarkdownToolbarAction("ul")} title="Lista com marcadores">
                <AppIcon name="list" />
              </button>
              <button type="button" className="documentation-page__toolbar-btn" onClick={() => onMarkdownToolbarAction("ol")} title="Lista numerada">
                <AppIcon name="list-ordered" />
              </button>
              <button type="button" className="documentation-page__toolbar-btn" onClick={() => onMarkdownToolbarAction("check")} title="Checklist">
                <AppIcon name="square-check" />
              </button>
              <button type="button" className="documentation-page__toolbar-btn" onClick={() => onMarkdownToolbarAction("quote")} title="Citacao">
                <AppIcon name="message" />
              </button>
              <button type="button" className="documentation-page__toolbar-btn" onClick={() => onMarkdownToolbarAction("code-inline")} title="Codigo inline">
                <AppIcon name="code" />
              </button>
              <button type="button" className="documentation-page__toolbar-btn" onClick={() => onMarkdownToolbarAction("code-block")} title="Bloco de codigo">
                <AppIcon name="square-code" />
              </button>
              <button type="button" className="documentation-page__toolbar-btn" onClick={() => onMarkdownToolbarAction("link")} title="Link">
                <AppIcon name="link" />
              </button>
              <button type="button" className="documentation-page__toolbar-btn" onClick={() => onMarkdownToolbarAction("table")} title="Tabela">
                <AppIcon name="table" />
              </button>
              <button type="button" className="documentation-page__toolbar-btn" onClick={() => onMarkdownToolbarAction("divider")} title="Divisor horizontal">
                <AppIcon name="minus" />
              </button>
            </div>

            <div className="documentation-page__editor-view-switch">
              {(Object.keys(EDITOR_VIEW_LABELS) as EditorViewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={editorViewMode === mode ? "is-active" : ""}
                  onClick={() => onEditorViewModeChange(mode)}
                >
                  {EDITOR_VIEW_LABELS[mode]}
                </button>
              ))}
            </div>
          </div>

          <div className={`documentation-page__editor-body documentation-page__editor-body--${editorViewMode}`}>
            {editorViewMode !== "preview" ? (
              <Textarea
                ref={editorTextareaRef}
                value={activeDoc.content}
                onChange={(event) => onUpdateDocDraft(activeDoc.id, { content: event.target.value })}
                onMouseUp={(event) => onEditorSelection(event.currentTarget)}
                onKeyUp={(event) => onEditorSelection(event.currentTarget)}
                placeholder="Escreva em Markdown. A visualizacao aparece ao lado."
                className="documentation-page__editor-textarea"
              />
            ) : null}

            {editorViewMode !== "write" ? (
              <article className={`documentation-page__editor-preview markdown-body documentation-page__editor-preview--${activeDocKind}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={markdownUrlTransform}>
                  {renderedMarkdown.trim().length > 0 ? renderedMarkdown : "_Sem conteudo ainda._"}
                </ReactMarkdown>
              </article>
            ) : null}
          </div>

          <footer className="documentation-page__editor-footer">
            <p>
              {selectedSnippet
                ? `Foco da IA: "${selectedSnippet.slice(0, 140)}${selectedSnippet.length > 140 ? "..." : ""}"`
                : "Selecione um trecho para pedir ajustes especificos na doc."}
            </p>
          </footer>
        </>
      ) : (
        <div className="documentation-page__panel-empty shared-empty-panel">
          <h3>Selecione uma doc</h3>
          <p>Crie uma nova doc ou selecione uma existente para comeÃ§ar a editar.</p>
        </div>
      )}
    </section>
  );
}
