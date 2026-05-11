import type { ChangeEvent, Ref } from "react";
import type { Task } from "@/entities/task";
import { DocumentDecisionBlock, DocumentPreview, type DocumentVariableDiagnostic } from "@/modules/documentation";
import type { DocumentKind, WorkspaceDocument, WorkspaceDocumentMetadata } from "@/modules/workspace";
import { AppDropdownMenu, AppIcon, AppTooltip, Button, EmptyState, StatusBadge, TextInput, Textarea } from "@/shared/ui";
import {
  DOCUMENT_KIND_DESCRIPTIONS,
  DOCUMENT_KIND_LABELS,
  EDITOR_VIEW_LABELS,
  formatRelativeDate,
  getCommercialDocumentStatus,
  type EditorViewMode
} from "./documentation-page.local";

function commercialStatusKind(status: ReturnType<typeof getCommercialDocumentStatus>) {
  if (status === "approved" || status === "accepted" || status === "signed") return "approved";
  if (status === "sent" || status === "viewed") return "sent";
  if (status === "rejected") return "error";
  return "draft";
}

interface DocumentationEditorPanelProps {
  activeDoc: WorkspaceDocument | null;
  activeDocKind: DocumentKind;
  linkedWorkItem?: Task | null;
  editorTextareaRef: Ref<HTMLTextAreaElement>;
  logoFileInputRef: Ref<HTMLInputElement>;
  selectedSnippet: string;
  wordCount: number;
  renderedMarkdown: string;
  variableDiagnostics?: DocumentVariableDiagnostic[];
  variableItems?: Array<{ id: string; label: string; hint?: string }>;
  autosaveStatus?: "saved" | "dirty" | "saving" | "error" | "conflict";
  saveError?: string | null;
  uploadProgress?: number | null;
  editorViewMode: EditorViewMode;
  readOnly?: boolean;
  clientDecision?: {
    positiveLabel: string;
    description?: string;
    isSubmitting: boolean;
    error: string | null;
    success: boolean;
    onAccept: () => void;
    onReject: () => void;
  };
  onUpdateDocDraft: (
    docId: string,
    patch: Partial<Pick<WorkspaceDocument, "title" | "content" | "kind" | "tags" | "metadata">>
  ) => void;
  onUpdateProposalMetadata: (patch: WorkspaceDocumentMetadata) => void;
  onChooseClientLogoFile: () => void;
  onRemoveClientLogo: () => void;
  onClientLogoFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onMarkdownToolbarAction: (action: string) => void;
  onInsertVariable: (variableKey: string) => void;
  onEditorViewModeChange: (mode: EditorViewMode) => void;
  onEditorSelection: (textarea: HTMLTextAreaElement) => void;
}

export function DocumentationEditorPanel({
  activeDoc,
  activeDocKind,
  linkedWorkItem,
  editorTextareaRef,
  logoFileInputRef,
  selectedSnippet,
  wordCount,
  renderedMarkdown,
  variableDiagnostics = [],
  variableItems = [],
  autosaveStatus = "saved",
  saveError,
  uploadProgress,
  editorViewMode,
  readOnly = false,
  clientDecision,
  onUpdateDocDraft,
  onUpdateProposalMetadata,
  onChooseClientLogoFile,
  onRemoveClientLogo,
  onClientLogoFileChange,
  onMarkdownToolbarAction,
  onInsertVariable,
  onEditorViewModeChange,
  onEditorSelection
}: DocumentationEditorPanelProps) {
  return (
    <section className="documentation-page__editor-pane">
      {activeDoc ? (
        <>
          <header className="documentation-page__editor-header">
            <div className="documentation-page__editor-kind-row">
              <StatusBadge size="sm" kind="tag" className={`documentation-page__kind-badge documentation-page__kind-badge--${activeDocKind}`}>
                {DOCUMENT_KIND_LABELS[activeDocKind]}
              </StatusBadge>
              {activeDocKind !== "wiki" ? (
                <StatusBadge
                  size="sm"
                  kind={commercialStatusKind(getCommercialDocumentStatus(activeDoc))}
                  className={`documentation-page__commercial-status documentation-page__commercial-status--${getCommercialDocumentStatus(activeDoc)}`}
                >
                  {getCommercialDocumentStatus(activeDoc)}
                </StatusBadge>
              ) : null}
              <p>{DOCUMENT_KIND_DESCRIPTIONS[activeDocKind]}</p>
            </div>
            <div className="documentation-page__document-context-row">
              <StatusBadge
                size="sm"
                kind={autosaveStatus === "error" || autosaveStatus === "conflict" ? "error" : autosaveStatus === "saved" ? "approved" : "sent"}
              >
                {autosaveStatus === "saved"
                  ? "Salvo"
                  : autosaveStatus === "saving"
                    ? "Salvando"
                    : autosaveStatus === "dirty"
                      ? "Alteracoes pendentes"
                      : autosaveStatus === "conflict"
                        ? "Conflito"
                        : "Erro ao salvar"}
              </StatusBadge>
              <span className="documentation-page__linked-work-item">
                <AppIcon name="board" size={15} />
                {linkedWorkItem ? (
                  <>
                    <strong>{linkedWorkItem.title}</strong>
                    <span>{linkedWorkItem.status}</span>
                  </>
                ) : (
                  <span>Nenhum card vinculado</span>
                )}
              </span>
            </div>
            {saveError ? <p className="documentation-page__inline-error">{saveError}</p> : null}
            {readOnly ? (
              <h2 className="documentation-page__preview-title">{activeDoc.title}</h2>
            ) : (
              <TextInput
                value={activeDoc.title}
                onChange={(event) => onUpdateDocDraft(activeDoc.id, { title: event.target.value })}
                placeholder="Titulo da doc"
              />
            )}
            {!readOnly && activeDocKind === "proposal" ? (
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
                    <Button type="button" variant="outline" size="sm" onClick={onChooseClientLogoFile}>
                      {typeof uploadProgress === "number" ? `Enviando ${uploadProgress}%` : "Adicionar/Substituir"}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={onRemoveClientLogo} disabled={!activeDoc.metadata?.clientLogoUrl}>
                      Remover
                    </Button>
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

          {!readOnly ? (
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

            <div className="documentation-page__editor-toolbar-separator" aria-hidden="true" />

            <div className="documentation-page__editor-toolbar-group">
              <AppDropdownMenu
                align="start"
                trigger={
                  <Button type="button" variant="ghost" size="sm" className="documentation-page__variable-picker-trigger">
                    <AppIcon name="zap" size={15} />
                    Variaveis
                  </Button>
                }
                items={variableItems.map((variable) => ({
                  id: variable.id,
                  label: variable.label,
                  hint: variable.hint,
                  onSelect: () => onInsertVariable(variable.id)
                }))}
              />
              <AppTooltip content="Insere variaveis seguras do card vinculado no Markdown.">
                <span className="documentation-page__toolbar-help" tabIndex={0}>
                  <AppIcon name="info" size={15} />
                </span>
              </AppTooltip>
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
          ) : null}

          <div className={`documentation-page__editor-body documentation-page__editor-body--${editorViewMode}`}>
            {!readOnly && editorViewMode !== "preview" ? (
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
                <DocumentPreview markdown={renderedMarkdown} diagnostics={variableDiagnostics} />
              </article>
            ) : null}
          </div>

          {clientDecision ? <DocumentDecisionBlock {...clientDecision} /> : null}

          <footer className="documentation-page__editor-footer">
            <p>
              {selectedSnippet
                ? `Foco da IA: "${selectedSnippet.slice(0, 140)}${selectedSnippet.length > 140 ? "..." : ""}"`
                : "Selecione um trecho para pedir ajustes especificos na doc."}
            </p>
          </footer>
        </>
      ) : (
        <EmptyState
          className="documentation-page__panel-empty"
          title="Selecione uma doc"
          description="Crie uma nova doc ou selecione uma existente para começar a editar."
        />
      )}
    </section>
  );
}
