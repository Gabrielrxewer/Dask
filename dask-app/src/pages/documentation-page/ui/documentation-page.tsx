import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { buildBoardMetrics } from "@/entities/task";
import { useWorkspace, type DocumentationAssistantMode, type WorkspaceDocument } from "@/modules/workspace";
import { LoadingState, StatusBadge, TextInput, Textarea, WorkspaceActionButton, WorkspaceFrame } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import "./documentation-page.css";

type AssistantRole = "user" | "assistant" | "system";

interface AssistantMessage {
  id: string;
  role: AssistantRole;
  mode: DocumentationAssistantMode;
  content: string;
  createdAt: string;
}

type EditorViewMode = "write" | "split" | "preview";

const DEFAULT_INSTRUCTIONS: Record<DocumentationAssistantMode, string> = {
  chat: "Converse comigo sobre esta doc e responda objetivamente.",
  write: "Escreva documentacao em markdown pronta para uso.",
  maintain: "Revise e atualize esta documentacao mantendo o contexto."
};

const MODE_LABELS: Record<DocumentationAssistantMode, string> = {
  chat: "Chat",
  write: "Escrita",
  maintain: "Manutencao"
};

const EDITOR_VIEW_LABELS: Record<EditorViewMode, string> = {
  write: "Editar",
  split: "Dividido",
  preview: "Preview"
};

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatRelativeDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function createMessage(role: AssistantRole, mode: DocumentationAssistantMode, content: string): AssistantMessage {
  return {
    id: createId(),
    role,
    mode,
    content,
    createdAt: new Date().toISOString()
  };
}

function inferIntentMode(prompt: string, fallback: DocumentationAssistantMode): DocumentationAssistantMode {
  const normalized = prompt.toLowerCase();
  const rewritePattern = /(reescrev|reescreva|editar|edite|revise|melhore|corrija|atualize|refatore|reorganize)/;
  if (rewritePattern.test(normalized)) {
    return "maintain";
  }

  const writingPattern = /(escreva|crie|gere|adicione uma secao|nova secao|novo topico|documente)/;
  if (writingPattern.test(normalized)) {
    return "write";
  }

  return fallback;
}

export function DocumentationPage() {
  const {
    snapshot,
    isLoading,
    runDocumentationAssistant,
    listWorkspaceDocuments,
    createWorkspaceDocument,
    updateWorkspaceDocument,
    deleteWorkspaceDocument
  } = useWorkspace();
  const metrics = useMemo(() => buildBoardMetrics(snapshot?.tasks ?? []), [snapshot?.tasks]);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null);
  const editorTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const dirtyDocIdsRef = useRef<Set<string>>(new Set());
  const saveSeqByDocRef = useRef<Record<string, number>>({});

  const [docs, setDocs] = useState<WorkspaceDocument[]>([]);
  const [isDocsLoading, setIsDocsLoading] = useState(true);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [chatsByDoc, setChatsByDoc] = useState<Record<string, AssistantMessage[]>>({});
  const [selectedSnippet, setSelectedSnippet] = useState("");
  const [editorViewMode, setEditorViewMode] = useState<EditorViewMode>("split");
  const [activeMode, setActiveMode] = useState<DocumentationAssistantMode>("chat");
  const [isModeInfoOpen, setIsModeInfoOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [includeSemanticContext, setIncludeSemanticContext] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [isSavingDocId, setIsSavingDocId] = useState<string | null>(null);
  const [lastRunLatencyMs, setLastRunLatencyMs] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const activeDoc = useMemo(() => {
    return docs.find((doc) => doc.id === activeDocId) ?? docs[0] ?? null;
  }, [docs, activeDocId]);

  const activeMessages = useMemo(() => {
    if (!activeDoc) {
      return [];
    }
    return chatsByDoc[activeDoc.id] ?? [];
  }, [chatsByDoc, activeDoc]);

  const wordCount = useMemo(() => {
    if (!activeDoc) return 0;
    const trimmed = activeDoc.content.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [activeDoc?.content]);

  const pushMessage = useCallback((docId: string, message: AssistantMessage) => {
    setChatsByDoc((previous) => ({
      ...previous,
      [docId]: [...(previous[docId] ?? []), message]
    }));
  }, []);

  const updateDocDraft = useCallback((docId: string, patch: Partial<Pick<WorkspaceDocument, "title" | "content">>) => {
    setDocs((previous) =>
      previous.map((doc) =>
        doc.id === docId
          ? {
              ...doc,
              ...patch
            }
          : doc
      )
    );
    dirtyDocIdsRef.current.add(docId);
  }, []);

  const appendDocDraft = useCallback((docId: string, chunk: string) => {
    setDocs((previous) =>
      previous.map((doc) => {
        if (doc.id !== docId) {
          return doc;
        }
        return {
          ...doc,
          content: doc.content.trim().length === 0 ? chunk : `${doc.content.trimEnd()}\n\n${chunk}`
        };
      })
    );
    dirtyDocIdsRef.current.add(docId);
  }, []);

  const replaceDocWithServerVersion = useCallback((nextDoc: WorkspaceDocument) => {
    setDocs((previous) => previous.map((doc) => (doc.id === nextDoc.id ? nextDoc : doc)));
  }, []);

  useEffect(() => {
    let mounted = true;
    setIsDocsLoading(true);
    setLoadError(null);
    setSaveError(null);
    setRunError(null);
    setSelectedSnippet("");
    dirtyDocIdsRef.current = new Set();
    saveSeqByDocRef.current = {};

    listWorkspaceDocuments()
      .then((fetchedDocs) => {
        if (!mounted) {
          return;
        }
        setDocs(fetchedDocs);
        setActiveDocId((current) => {
          if (current && fetchedDocs.some((doc) => doc.id === current)) {
            return current;
          }
          return fetchedDocs[0]?.id ?? null;
        });
        setChatsByDoc((previous) => {
          const next: Record<string, AssistantMessage[]> = {};
          fetchedDocs.forEach((doc) => {
            if (previous[doc.id]) {
              next[doc.id] = previous[doc.id];
            }
          });
          return next;
        });
      })
      .catch((error) => {
        if (!mounted) {
          return;
        }
        setLoadError(error instanceof Error ? error.message : "Falha ao carregar docs.");
      })
      .finally(() => {
        if (mounted) {
          setIsDocsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [listWorkspaceDocuments]);

  useEffect(() => {
    setSelectedSnippet("");
    setSaveError(null);
    setRunError(null);
  }, [activeDoc?.id]);

  useEffect(() => {
    if (!messagesRef.current) {
      return;
    }
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [activeMessages.length, isRunning, activeDoc?.id]);

  useEffect(() => {
    const textarea = promptInputRef.current;
    if (!textarea) {
      return;
    }

    const minHeight = 32;
    const maxHeight = 112;
    textarea.style.height = "auto";
    const nextHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [prompt]);

  const persistDocDraft = useCallback(
    async (document: WorkspaceDocument, sequence: number) => {
      setIsSavingDocId(document.id);
      try {
        const updated = await updateWorkspaceDocument(document.id, {
          title: document.title,
          content: document.content
        });

        if (saveSeqByDocRef.current[document.id] !== sequence) {
          return;
        }

        dirtyDocIdsRef.current.delete(document.id);
        replaceDocWithServerVersion(updated);
        setSaveError(null);
      } catch (error) {
        if (saveSeqByDocRef.current[document.id] !== sequence) {
          return;
        }

        setSaveError(error instanceof Error ? error.message : "Falha ao salvar esta doc.");
      } finally {
        if (saveSeqByDocRef.current[document.id] === sequence) {
          setIsSavingDocId((current) => (current === document.id ? null : current));
        }
      }
    },
    [replaceDocWithServerVersion, updateWorkspaceDocument]
  );

  useEffect(() => {
    if (!activeDoc) {
      return;
    }

    if (!dirtyDocIdsRef.current.has(activeDoc.id)) {
      return;
    }

    const docSnapshot = { ...activeDoc };
    const timeoutHandle = setTimeout(() => {
      const nextSequence = (saveSeqByDocRef.current[docSnapshot.id] ?? 0) + 1;
      saveSeqByDocRef.current[docSnapshot.id] = nextSequence;
      void persistDocDraft(docSnapshot, nextSequence);
    }, 500);

    return () => {
      clearTimeout(timeoutHandle);
    };
  }, [activeDoc, persistDocDraft]);

  async function createNewDoc() {
    setRunError(null);
    setSaveError(null);

    try {
      const created = await createWorkspaceDocument({
        title: `Nova doc ${docs.length + 1}`,
        content: "",
        position: docs.length
      });
      setDocs((previous) => [...previous, created]);
      setActiveDocId(created.id);
      setSelectedSnippet("");
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Falha ao criar doc.");
    }
  }

  async function duplicateActiveDoc() {
    if (!activeDoc) {
      return;
    }

    setRunError(null);
    setSaveError(null);

    try {
      const duplicated = await createWorkspaceDocument({
        title: `${activeDoc.title} (copia)`,
        content: activeDoc.content,
        position: docs.length
      });
      setDocs((previous) => [...previous, duplicated]);
      setActiveDocId(duplicated.id);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Falha ao duplicar doc.");
    }
  }

  async function removeActiveDoc() {
    if (!activeDoc) {
      return;
    }

    setRunError(null);
    setSaveError(null);

    try {
      await deleteWorkspaceDocument(activeDoc.id);
      dirtyDocIdsRef.current.delete(activeDoc.id);
      delete saveSeqByDocRef.current[activeDoc.id];
      const nextDocs = docs.filter((doc) => doc.id !== activeDoc.id);
      setDocs(nextDocs);
      setActiveDocId(nextDocs[0]?.id ?? null);
      setChatsByDoc((previous) => {
        const next = { ...previous };
        delete next[activeDoc.id];
        return next;
      });
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Falha ao excluir doc.");
    }
  }

  function handleEditorSelection(textarea: HTMLTextAreaElement) {
    const nextSelection = textarea.value.slice(textarea.selectionStart, textarea.selectionEnd).trim();
    setSelectedSnippet(nextSelection.slice(0, 6000));
  }

  function focusEditorAtSelection(start: number, end: number) {
    requestAnimationFrame(() => {
      const textarea = editorTextareaRef.current;
      if (!textarea) {
        return;
      }
      textarea.focus();
      textarea.setSelectionRange(start, end);
      handleEditorSelection(textarea);
    });
  }

  function updateEditorFromToolbar(
    nextContent: string,
    selectionStart: number,
    selectionEnd: number
  ) {
    if (!activeDoc) {
      return;
    }
    updateDocDraft(activeDoc.id, { content: nextContent });
    focusEditorAtSelection(selectionStart, selectionEnd);
  }

  function insertInlineSyntax(prefix: string, suffix = prefix, placeholder = "texto") {
    if (!activeDoc) {
      return;
    }
    const textarea = editorTextareaRef.current;
    if (!textarea) {
      return;
    }

    const { selectionStart, selectionEnd, value } = textarea;
    const selected = value.slice(selectionStart, selectionEnd);
    const insertionTarget = selected || placeholder;
    const before = value.slice(0, selectionStart);
    const after = value.slice(selectionEnd);
    const insertion = `${prefix}${insertionTarget}${suffix}`;
    const nextContent = `${before}${insertion}${after}`;
    const cursorStart = selectionStart + prefix.length;
    const cursorEnd = cursorStart + insertionTarget.length;

    updateEditorFromToolbar(nextContent, cursorStart, cursorEnd);
  }

  function insertLinePrefix(prefix: string, placeholder = "Novo item") {
    if (!activeDoc) {
      return;
    }
    const textarea = editorTextareaRef.current;
    if (!textarea) {
      return;
    }

    const { selectionStart, selectionEnd, value } = textarea;
    const selected = value.slice(selectionStart, selectionEnd);
    const insertionTarget = selected || placeholder;
    const transformed = insertionTarget
      .split("\n")
      .map((line) => `${prefix}${line}`)
      .join("\n");
    const before = value.slice(0, selectionStart);
    const after = value.slice(selectionEnd);
    const nextContent = `${before}${transformed}${after}`;
    const cursorStart = selectionStart + prefix.length;
    const cursorEnd = selectionStart + transformed.length;

    updateEditorFromToolbar(nextContent, cursorStart, cursorEnd);
  }

  function insertBlockTemplate(template: string, selectionOffset = 0) {
    if (!activeDoc) {
      return;
    }
    const textarea = editorTextareaRef.current;
    if (!textarea) {
      return;
    }

    const { selectionStart, selectionEnd, value } = textarea;
    const before = value.slice(0, selectionStart);
    const after = value.slice(selectionEnd);
    const needsLineBreakBefore = before.length > 0 && !before.endsWith("\n");
    const needsLineBreakAfter = after.length > 0 && !after.startsWith("\n");
    const prefix = needsLineBreakBefore ? "\n" : "";
    const suffix = needsLineBreakAfter ? "\n" : "";
    const insertion = `${prefix}${template}${suffix}`;
    const nextContent = `${before}${insertion}${after}`;
    const cursor = selectionStart + prefix.length + selectionOffset;

    updateEditorFromToolbar(nextContent, cursor, cursor);
  }

  function handleMarkdownToolbarAction(action: string) {
    switch (action) {
      case "bold":
        insertInlineSyntax("**");
        return;
      case "italic":
        insertInlineSyntax("*");
        return;
      case "underline":
        insertInlineSyntax("<u>", "</u>");
        return;
      case "strike":
        insertInlineSyntax("~~");
        return;
      case "h1":
        insertLinePrefix("# ", "Titulo principal");
        return;
      case "h2":
        insertLinePrefix("## ", "Subtitulo");
        return;
      case "quote":
        insertLinePrefix("> ", "Citacao");
        return;
      case "ul":
        insertLinePrefix("- ", "Novo item");
        return;
      case "ol":
        insertLinePrefix("1. ", "Novo item");
        return;
      case "check":
        insertLinePrefix("- [ ] ", "Tarefa");
        return;
      case "code-inline":
        insertInlineSyntax("`", "`", "codigo");
        return;
      case "code-block":
        insertBlockTemplate("```ts\n// codigo\n```", 6);
        return;
      case "link":
        insertInlineSyntax("[", "](https://)", "texto do link");
        return;
      case "table":
        insertBlockTemplate("| Coluna A | Coluna B |\n| --- | --- |\n| Valor 1 | Valor 2 |", 2);
        return;
      case "divider":
        insertBlockTemplate("---");
        return;
      default:
        return;
    }
  }

  async function handleRunAssistant() {
    if (!activeDoc) {
      return;
    }

    const docId = activeDoc.id;
    const docTitle = activeDoc.title;
    const docContent = activeDoc.content;
    const instruction = (prompt.trim() || DEFAULT_INSTRUCTIONS[activeMode]).slice(0, 6000);
    const inferredMode = inferIntentMode(instruction, activeMode);
    const conversationHistory = [...activeMessages, createMessage("user", inferredMode, instruction)]
      .filter((message) => message.role === "user" || message.role === "assistant")
      .slice(-8)
      .map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.content.slice(0, 1800)
      }));

    pushMessage(docId, createMessage("user", inferredMode, instruction));
    setRunError(null);
    setIsRunning(true);
    const runStartedAt = Date.now();

    try {
      const result = await runDocumentationAssistant({
        mode: inferredMode,
        instruction,
        documentTitle: docTitle,
        documentContent: docContent,
        selection: selectedSnippet || undefined,
        conversationHistory,
        includeSemanticContext,
        topKContextDocs: 5
      });
      setLastRunLatencyMs(Date.now() - runStartedAt);

      pushMessage(docId, createMessage("assistant", inferredMode, result.content));

      if (result.action === "replace_document" && result.updatedDocument) {
        updateDocDraft(docId, { content: result.updatedDocument });
        pushMessage(docId, createMessage("system", inferredMode, "A IA atualizou esta doc automaticamente."));
      }

      if (result.action === "append_document" && result.updatedDocument) {
        appendDocDraft(docId, result.updatedDocument);
        pushMessage(docId, createMessage("system", inferredMode, "A IA anexou novo trecho nesta doc."));
      }

      setPrompt("");
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Falha ao processar IA de documentacao.");
      pushMessage(docId, createMessage("system", inferredMode, "Nao foi possivel processar sua solicitacao agora."));
    } finally {
      setIsRunning(false);
    }
  }

  function clearActiveChat() {
    if (!activeDoc) {
      return;
    }

    setChatsByDoc((previous) => ({
      ...previous,
      [activeDoc.id]: []
    }));
    setRunError(null);
  }

  const canDeleteDoc = docs.length > 0;
  const canSend = !isRunning && !isLoading && !isDocsLoading && Boolean(activeDoc);
  const assistantStatus = isRunning
    ? "Pensando"
    : activeDoc && isSavingDocId === activeDoc.id
      ? "Salvando"
      : "Pronta";
  const assistantTone = isRunning || (activeDoc && isSavingDocId === activeDoc.id) ? "warning" : "success";

  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) {
        void handleRunAssistant();
      }
    }
  }

  const topNavigation = (
    <section className="docs-top-nav" aria-label="Acoes de documentacao">
      <WorkspaceActionButton
        className="docs-top-nav__btn"
        tone="accent"
        label="Nova doc"
        disabled={isDocsLoading || isLoading}
        onClick={() => void createNewDoc()}
        icon="+"
      />
      <div className="docs-top-nav__actions">
        <WorkspaceActionButton
          className="docs-top-nav__btn"
          label="Duplicar doc"
          disabled={!activeDoc || isDocsLoading || isLoading}
          onClick={() => void duplicateActiveDoc()}
          icon={(
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          )}
        />
        <WorkspaceActionButton
          className="docs-top-nav__btn"
          tone="danger"
          label="Excluir doc"
          disabled={!activeDoc || !canDeleteDoc || isDocsLoading || isLoading}
          onClick={() => void removeActiveDoc()}
          icon={(
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M9 3h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M4 6h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M7 6v13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6" stroke="currentColor" strokeWidth="1.8" />
              <path d="M10 10v7M14 10v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          )}
        />
      </div>
    </section>
  );

  return (
    <AppShell
      metrics={metrics}
      noPageScroll
      hidePageHeader
      hideSidebarBrandMark
      topNavigation={topNavigation}
    >
      <WorkspaceFrame className="documentation-page">
        <LoadingState
          text="Carregando documentação..."
          animation="documentation"
          variant="frame"
          visible={isLoading || isDocsLoading}
        />
        <aside className="documentation-page__files-pane">
          <header className="documentation-page__files-header">
            <p>Documentos</p>
            <span>{docs.length} docs</span>
          </header>

          <nav className="documentation-page__files-list">
            {docs.map((doc) => (
              <button
                key={doc.id}
                type="button"
                className={`documentation-page__file-item${activeDoc?.id === doc.id ? " documentation-page__file-item--active" : ""}`}
                onClick={() => setActiveDocId(doc.id)}
              >
                <svg className="documentation-page__file-item-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                  <polyline points="14 2 14 8 20 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="8" y1="13" x2="16" y2="13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.55" />
                  <line x1="8" y1="17" x2="12" y2="17" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.55" />
                </svg>
                <div className="documentation-page__file-item-content">
                  <strong>{doc.title}</strong>
                  <span>{`Atualizado em ${formatRelativeDate(doc.updatedAt)}`}</span>
                </div>
              </button>
            ))}
            {!isDocsLoading && docs.length === 0 ? (
              <div className="documentation-page__panel-empty documentation-page__panel-empty--compact">
                <h3>Nenhuma doc criada</h3>
                <p>Clique em "Nova doc" para começar.</p>
              </div>
            ) : null}
          </nav>
        </aside>

        <section className="documentation-page__editor-pane">
          {activeDoc ? (
            <>
              <header className="documentation-page__editor-header">
                <TextInput
                  value={activeDoc.title}
                  onChange={(event) => updateDocDraft(activeDoc.id, { title: event.target.value })}
                  placeholder="Titulo da doc"
                />
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
                    onClick={() => handleMarkdownToolbarAction("h1")}
                    title="Titulo 1"
                    data-label="H1"
                  />
                  <button
                    type="button"
                    className="documentation-page__toolbar-btn documentation-page__toolbar-btn--heading"
                    onClick={() => handleMarkdownToolbarAction("h2")}
                    title="Titulo 2"
                    data-label="H2"
                  />
                  <button
                    type="button"
                    className="documentation-page__toolbar-btn documentation-page__toolbar-btn--text documentation-page__toolbar-btn--bold"
                    onClick={() => handleMarkdownToolbarAction("bold")}
                    title="Negrito"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    className="documentation-page__toolbar-btn documentation-page__toolbar-btn--text documentation-page__toolbar-btn--italic"
                    onClick={() => handleMarkdownToolbarAction("italic")}
                    title="Italico"
                  >
                    I
                  </button>
                  <button
                    type="button"
                    className="documentation-page__toolbar-btn documentation-page__toolbar-btn--text documentation-page__toolbar-btn--underline"
                    onClick={() => handleMarkdownToolbarAction("underline")}
                    title="Sublinhado"
                  >
                    U
                  </button>
                  <button
                    type="button"
                    className="documentation-page__toolbar-btn documentation-page__toolbar-btn--text documentation-page__toolbar-btn--strike"
                    onClick={() => handleMarkdownToolbarAction("strike")}
                    title="Riscado"
                  >
                    S
                  </button>
                </div>

                <div className="documentation-page__editor-toolbar-separator" aria-hidden="true" />

                <div className="documentation-page__editor-toolbar-group">
                  <button
                    type="button"
                    className="documentation-page__toolbar-btn"
                    onClick={() => handleMarkdownToolbarAction("ul")}
                    title="Lista com marcadores"
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <circle cx="4" cy="7" r="1.5" fill="currentColor" />
                      <circle cx="4" cy="12" r="1.5" fill="currentColor" />
                      <circle cx="4" cy="17" r="1.5" fill="currentColor" />
                      <path d="M8 7h12M8 12h12M8 17h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="documentation-page__toolbar-btn"
                    onClick={() => handleMarkdownToolbarAction("ol")}
                    title="Lista numerada"
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M10 6h11M10 12h11M10 18h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      <path d="M3.5 5.5h.8v5M3.5 10.5h1.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M3.2 14.5h1.8l-2 3.5h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="documentation-page__toolbar-btn"
                    onClick={() => handleMarkdownToolbarAction("check")}
                    title="Checklist"
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="3" y="5" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.7" />
                      <path d="M4.5 7.8L5.8 9.2L8 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M11 7.8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      <rect x="3" y="13" width="5.5" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.7" />
                      <path d="M11 15.8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="documentation-page__toolbar-btn"
                    onClick={() => handleMarkdownToolbarAction("quote")}
                    title="Citacao"
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="3" y="4" width="2.5" height="16" rx="1.25" fill="currentColor" opacity="0.6" />
                      <path d="M8 8h10M8 12h8M8 16h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="documentation-page__toolbar-btn"
                    onClick={() => handleMarkdownToolbarAction("code-inline")}
                    title="Codigo inline"
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M8 9L4 12l4 3M16 9l4 3-4 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="14" y1="7" x2="10" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="documentation-page__toolbar-btn"
                    onClick={() => handleMarkdownToolbarAction("code-block")}
                    title="Bloco de codigo"
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="2" y="4" width="20" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M8 9L5 12l3 3M16 9l3 3-3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      <line x1="13.5" y1="9" x2="10.5" y2="15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="documentation-page__toolbar-btn"
                    onClick={() => handleMarkdownToolbarAction("link")}
                    title="Link"
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="documentation-page__toolbar-btn"
                    onClick={() => handleMarkdownToolbarAction("table")}
                    title="Tabela"
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M3 9h18M3 15h18M9 9v12M15 9v12" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="documentation-page__toolbar-btn"
                    onClick={() => handleMarkdownToolbarAction("divider")}
                    title="Divisor horizontal"
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <line x1="4" y1="8" x2="20" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.35" />
                      <line x1="4" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <line x1="4" y1="16" x2="20" y2="16" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity="0.35" />
                    </svg>
                  </button>
                </div>

                <div className="documentation-page__editor-view-switch">
                  {(Object.keys(EDITOR_VIEW_LABELS) as EditorViewMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={editorViewMode === mode ? "is-active" : ""}
                      onClick={() => setEditorViewMode(mode)}
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
                    onChange={(event) => updateDocDraft(activeDoc.id, { content: event.target.value })}
                    onMouseUp={(event) => handleEditorSelection(event.currentTarget)}
                    onKeyUp={(event) => handleEditorSelection(event.currentTarget)}
                    placeholder="Escreva em Markdown. A visualizacao aparece ao lado."
                    className="documentation-page__editor-textarea"
                  />
                ) : null}

                {editorViewMode !== "write" ? (
                  <article className="documentation-page__editor-preview markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {activeDoc.content.trim().length > 0 ? activeDoc.content : "_Sem conteudo ainda._"}
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
            <div className="documentation-page__panel-empty">
              <h3>Selecione uma doc</h3>
              <p>Crie uma nova doc ou selecione uma existente para começar a editar.</p>
            </div>
          )}
        </section>

        <aside className="documentation-page__assistant-pane">
          <header className="documentation-page__assistant-header">
            <div>
              <h2>Chat IA</h2>
              <p>{activeDoc ? `ON: ${activeDoc.title}` : "Selecione uma doc"}</p>
            </div>
            <div className="documentation-page__assistant-tools">
              <button
                type="button"
                className="documentation-page__clear-chat-button"
                aria-label="Limpar chat"
                title="Limpar chat desta doc"
                disabled={activeMessages.length === 0 || isRunning}
                onClick={clearActiveChat}
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 3h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M4 6h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M7 6v13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M10 10v7M14 10v7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
              <StatusBadge tone={assistantTone}>{assistantStatus}</StatusBadge>
            </div>
          </header>

          <div className="documentation-page__modes">
            <button
              type="button"
              className={`documentation-page__mode-chip${activeMode === "chat" ? " documentation-page__mode-chip--active" : ""}`}
              onClick={() => setActiveMode("chat")}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="documentation-page__mode-chip-icon">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
              {MODE_LABELS.chat}
            </button>
            <button
              type="button"
              className={`documentation-page__mode-chip${activeMode === "write" ? " documentation-page__mode-chip--active" : ""}`}
              onClick={() => setActiveMode("write")}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="documentation-page__mode-chip-icon">
                <path d="M12 20h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {MODE_LABELS.write}
            </button>
            <button
              type="button"
              className={`documentation-page__mode-chip${activeMode === "maintain" ? " documentation-page__mode-chip--active" : ""}`}
              onClick={() => setActiveMode("maintain")}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="documentation-page__mode-chip-icon">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {MODE_LABELS.maintain}
            </button>
            <button
              type="button"
              className="documentation-page__mode-info-button"
              aria-label="Mais informacoes sobre os modos do chat"
              aria-expanded={isModeInfoOpen}
              onClick={() => setIsModeInfoOpen((previous) => !previous)}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 17v-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M12 8h.01"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
                <path
                  d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
            </button>
            {isModeInfoOpen ? (
              <div className="documentation-page__mode-info-popover" role="status">
                <strong>Modos do Chat IA</strong>
                <p>
                  Chat responde duvidas sobre a doc. Escrita cria novos trechos em markdown. Manutencao revisa,
                  corrige ou atualiza o conteudo existente.
                </p>
              </div>
            ) : null}
          </div>

          <div ref={messagesRef} className="documentation-page__messages">
            {activeMessages.length === 0 ? (
              <div className="documentation-page__messages-empty-state">
                <div className="documentation-page__messages-empty-avatar" aria-hidden="true">
                  AI
                </div>
                <h3>Vamos comecar esta doc?</h3>
                <p>
                  Digite livremente no chat. Se pedir para reescrever, revisar ou melhorar, eu atualizo o conteudo da
                  doc automaticamente.
                </p>
              </div>
            ) : (
              activeMessages.map((message) => (
                <article
                  key={message.id}
                  className={`documentation-page__message documentation-page__message--${message.role}`}
                >
                  <div className="documentation-page__message-avatar" aria-hidden="true">
                    {message.role === "assistant" ? "AI" : message.role === "user" ? "VO" : "SI"}
                  </div>
                  <div className="documentation-page__message-bubble">
                    <header>
                      <strong>{message.role === "assistant" ? "Dask AI" : message.role === "user" ? "Voce" : "Sistema"}</strong>
                      <span>{`${MODE_LABELS[message.mode]} - ${formatRelativeDate(message.createdAt)}`}</span>
                    </header>
                    <p>{message.content}</p>
                  </div>
                </article>
              ))
            )}

            {isRunning ? (
              <article className="documentation-page__message documentation-page__message--thinking">
                <div className="documentation-page__message-avatar" aria-hidden="true">
                  AI
                </div>
                <div className="documentation-page__message-bubble">
                  <header>
                    <strong>Dask AI</strong>
                    <span>Pensando...</span>
                  </header>
                  <div className="documentation-page__thinking-dots" aria-label="IA pensando">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </article>
            ) : null}
          </div>

          <div className="documentation-page__composer">
            <div className="documentation-page__composer-shell">
              <Textarea
                ref={promptInputRef}
                rows={3}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={handlePromptKeyDown}
                placeholder="Converse com a IA sobre esta doc. Ex.: Reescreva de forma mais objetiva."
                className="documentation-page__composer-input"
              />
              <button
                type="button"
                className="documentation-page__send-button"
                aria-label="Enviar mensagem"
                disabled={!canSend}
                onClick={() => void handleRunAssistant()}
              >
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 19 19 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M9 5h10v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <p className="documentation-page__composer-hint">Enter envia - Shift + Enter quebra linha</p>
            {lastRunLatencyMs !== null ? (
              <p className="documentation-page__composer-latency">{`Ultima resposta: ${(lastRunLatencyMs / 1000).toFixed(1)}s`}</p>
            ) : null}
            <label className="documentation-page__composer-checkbox">
              <input
                type="checkbox"
                checked={includeSemanticContext}
                onChange={(event) => setIncludeSemanticContext(event.target.checked)}
              />
              Enriquecer com contexto do workspace
            </label>
            {loadError ? <p className="documentation-page__error">{loadError}</p> : null}
            {saveError ? <p className="documentation-page__error">{saveError}</p> : null}
            {runError ? <p className="documentation-page__error">{runError}</p> : null}
          </div>

          <div className="documentation-page__assistant-footer">
            <p>Se voce pedir para reescrever ou editar, a IA atualiza a doc automaticamente.</p>
          </div>
        </aside>
      </WorkspaceFrame>
    </AppShell>
  );
}
