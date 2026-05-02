import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { buildBoardMetrics } from "@/entities/task";
import { getDocumentTemplate } from "@/modules/workspace/model/document-templates";
import { useWorkspace, type DocumentKind, type DocumentationAssistantMode, type WorkspaceDocument, type WorkspaceDocumentMetadata } from "@/modules/workspace";
import { buildWorkspaceBoardPathWithTask } from "@/app/router";
import { LoadingState, WorkspaceFrame } from "@/shared/ui";
import { AppShell } from "@/widgets/app-shell";
import { DocumentationAssistantPanel } from "./documentation-assistant-panel";
import { DocumentationCreateModal } from "./documentation-create-modal";
import { DocumentationEditorPanel } from "./documentation-editor-panel";
import { DocumentationFilesPane } from "./documentation-files-pane";
import { DocumentationTopNavigation } from "./documentation-top-navigation";
import {
  buildAssistantConversationHistory,
  countDocumentWords,
  filterDocumentationDocs,
  renderWorkspaceDocumentMarkdown,
  resolveDocumentationAssistantStatus
} from "./documentation-page.model";
import {
  DEFAULT_INSTRUCTIONS,
  DOCUMENT_KIND_LABELS,
  createMessage,
  inferIntentMode,
  normalizeDocumentKind,
  type AssistantMessage,
  type DocumentKindFilter,
  type EditorViewMode
} from "./documentation-page.local";
import "./documentation-page.css";

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
  const navigate = useNavigate();
  const { workspaceSlug = "" } = useParams();
  const [searchParams] = useSearchParams();
  const initialDocId = searchParams.get("docId");
  const fromCard = searchParams.get("from") === "card";
  const fromCardTaskId = searchParams.get("taskId") ?? "";
  const fromCardBoardMode = searchParams.get("boardMode") ?? "";
  const metrics = useMemo(() => buildBoardMetrics(snapshot?.tasks ?? []), [snapshot?.tasks]);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const promptInputRef = useRef<HTMLTextAreaElement | null>(null);
  const editorTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);
  const dirtyDocIdsRef = useRef<Set<string>>(new Set());
  const saveSeqByDocRef = useRef<Record<string, number>>({});

  const [docs, setDocs] = useState<WorkspaceDocument[]>([]);
  const [isDocsLoading, setIsDocsLoading] = useState(true);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [documentKindFilter, setDocumentKindFilter] = useState<DocumentKindFilter>("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
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
    return docs.find((doc) => doc.id === activeDocId) ?? null;
  }, [docs, activeDocId]);

  const activeDocKind = normalizeDocumentKind(activeDoc?.kind);

  const filteredDocs = useMemo(
    () => filterDocumentationDocs({ docs, documentKindFilter, fromCard, initialDocId }),
    [docs, documentKindFilter, fromCard, initialDocId]
  );

  const activeMessages = useMemo(() => {
    if (!activeDoc) {
      return [];
    }
    return chatsByDoc[activeDoc.id] ?? [];
  }, [chatsByDoc, activeDoc]);

  const wordCount = useMemo(() => countDocumentWords(activeDoc), [activeDoc]);

  const renderedMarkdown = useMemo(
    () => renderWorkspaceDocumentMarkdown(activeDoc, snapshot),
    [activeDoc, snapshot]
  );

  const pushMessage = useCallback((docId: string, message: AssistantMessage) => {
    setChatsByDoc((previous) => ({
      ...previous,
      [docId]: [...(previous[docId] ?? []), message]
    }));
  }, []);

  const updateDocDraft = useCallback((docId: string, patch: Partial<Pick<WorkspaceDocument, "title" | "content" | "kind" | "tags" | "metadata">>) => {
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
          if (initialDocId && fetchedDocs.some((doc) => doc.id === initialDocId)) {
            return initialDocId;
          }
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
    if (documentKindFilter === "all" && !activeDocId && docs.length > 0) {
      setActiveDocId(docs[0].id);
      return;
    }

    if (documentKindFilter === "all") {
      return;
    }

    if (activeDocId && filteredDocs.some((doc) => doc.id === activeDocId)) {
      return;
    }

    setActiveDocId(filteredDocs[0]?.id ?? null);
  }, [activeDocId, docs, documentKindFilter, filteredDocs]);

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
          content: document.content,
          kind: normalizeDocumentKind(document.kind),
          tags: document.tags ?? [],
          metadata: document.metadata ?? {}
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

  async function createNewDoc(kind: DocumentKind) {
    setRunError(null);
    setSaveError(null);

    try {
      const template = getDocumentTemplate(kind);
      const created = await createWorkspaceDocument({
        title: template.title,
        content: template.content,
        kind,
        tags: [DOCUMENT_KIND_LABELS[kind]],
        metadata: template.metadata ?? {},
        position: docs.length
      });
      setDocs((previous) => [...previous, created]);
      setActiveDocId(created.id);
      setSelectedSnippet("");
      setDocumentKindFilter("all");
      setIsCreateModalOpen(false);
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
        kind: activeDocKind,
        tags: activeDoc.tags ?? [],
        metadata: activeDoc.metadata ?? {},
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
    const conversationHistory = buildAssistantConversationHistory({
      activeMessages,
      mode: inferredMode,
      instruction
    });

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
  const { status: assistantStatus, tone: assistantTone } = resolveDocumentationAssistantStatus({
    isRunning,
    activeDocId: activeDoc?.id ?? null,
    isSavingDocId
  });

  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) {
        void handleRunAssistant();
      }
    }
  }

  function updateActiveProposalMetadata(patch: WorkspaceDocumentMetadata) {
    if (!activeDoc) {
      return;
    }

    updateDocDraft(activeDoc.id, {
      metadata: {
        ...(activeDoc.metadata ?? {}),
        ...patch
      }
    });
  }

  function removeClientLogo() {
    if (!activeDoc) {
      return;
    }

    const nextMetadata = { ...(activeDoc.metadata ?? {}) };
    delete nextMetadata.clientLogoUrl;
    updateDocDraft(activeDoc.id, { metadata: nextMetadata });
  }

  function handleClientLogoFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (!activeDoc) {
      return;
    }

    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      updateDocDraft(activeDoc.id, {
        metadata: {
          ...(activeDoc.metadata ?? {}),
          clientLogoUrl: typeof reader.result === "string" ? reader.result : ""
        }
      });
    };
    reader.readAsDataURL(file);
  }

  const topNavigation = (
    <DocumentationTopNavigation
      fromCard={fromCard}
      disabled={isDocsLoading || isLoading}
      isAssistantOpen={isAssistantOpen}
      hasActiveDoc={Boolean(activeDoc)}
      canDeleteDoc={canDeleteDoc}
      onBack={() => navigate(buildWorkspaceBoardPathWithTask(workspaceSlug, fromCardTaskId, fromCardBoardMode))}
      onCreate={() => setIsCreateModalOpen(true)}
      onToggleAssistant={() => setIsAssistantOpen((previous) => !previous)}
      onDuplicate={() => void duplicateActiveDoc()}
      onDelete={() => void removeActiveDoc()}
    />
  );

  return (
    <AppShell
      metrics={metrics}
      noPageScroll
      hidePageHeader
      hideSidebarBrandMark
      topNavigation={topNavigation}
    >
      {isCreateModalOpen ? (
        <DocumentationCreateModal
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={createNewDoc}
        />
      ) : null}
      <WorkspaceFrame className={`documentation-page${isAssistantOpen ? " documentation-page--assistant-open" : ""}`}>
        <LoadingState
          text="Carregando documentação..."
          animation="documentation"
          variant="frame"
          visible={isLoading || isDocsLoading}
        />
        <DocumentationFilesPane
          docsCount={docs.length}
          filteredDocs={filteredDocs}
          activeDocId={activeDoc?.id ?? null}
          documentKindFilter={documentKindFilter}
          fromCard={fromCard}
          isDocsLoading={isDocsLoading}
          onFilterChange={setDocumentKindFilter}
          onSelectDoc={setActiveDocId}
        />

        <DocumentationEditorPanel
          activeDoc={activeDoc}
          activeDocKind={activeDocKind}
          editorTextareaRef={editorTextareaRef}
          logoFileInputRef={logoFileInputRef}
          selectedSnippet={selectedSnippet}
          wordCount={wordCount}
          renderedMarkdown={renderedMarkdown}
          editorViewMode={editorViewMode}
          onUpdateDocDraft={updateDocDraft}
          onUpdateProposalMetadata={updateActiveProposalMetadata}
          onChooseClientLogoFile={() => logoFileInputRef.current?.click()}
          onRemoveClientLogo={removeClientLogo}
          onClientLogoFileChange={handleClientLogoFileChange}
          onMarkdownToolbarAction={handleMarkdownToolbarAction}
          onEditorViewModeChange={setEditorViewMode}
          onEditorSelection={handleEditorSelection}
        />

        <DocumentationAssistantPanel
          isAssistantOpen={isAssistantOpen}
          activeDoc={activeDoc}
          activeMessages={activeMessages}
          isRunning={isRunning}
          assistantTone={assistantTone}
          assistantStatus={assistantStatus}
          activeMode={activeMode}
          isModeInfoOpen={isModeInfoOpen}
          messagesRef={messagesRef}
          promptInputRef={promptInputRef}
          prompt={prompt}
          canSend={canSend}
          lastRunLatencyMs={lastRunLatencyMs}
          includeSemanticContext={includeSemanticContext}
          loadError={loadError}
          saveError={saveError}
          runError={runError}
          onClose={() => setIsAssistantOpen(false)}
          onClearChat={clearActiveChat}
          onModeChange={setActiveMode}
          onToggleModeInfo={() => setIsModeInfoOpen((previous) => !previous)}
          onPromptChange={setPrompt}
          onPromptKeyDown={handlePromptKeyDown}
          onRunAssistant={() => void handleRunAssistant()}
          onSemanticContextChange={setIncludeSemanticContext}
        />
      </WorkspaceFrame>
    </AppShell>
  );
}
